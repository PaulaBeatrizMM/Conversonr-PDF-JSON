const EPS_Y = 0.24;
const MARGEM_X = 0.2;

const ROTULOS = {
  SACADO: /\bSacado\b/i,
  NOSSO:  /\bNosso\s*N[úu]mero\b/i,
  SEU:    /\bSeu\s*N[úu]mero\b/i,
  PREV:   /Previs[aã]o\s*Cr[eé]dito/i,
  VENC:   /Vencimento/i,
  VALOR:  /^Valor$/i,
  MORA:   /Vlr\.?\s*Mora/i,
  DESC:   /Vlr\.?\s*Desc/i,
  OUTR:   /Vlr\.?\s*Outros\s*Acresc/i,
  DTLQ:   /Dt\.?\s*Liquid/i,
  COBR:   /Vlr\.?\s*(Cobrado|Baixado)/i,
};

const RE_CABECALHO =
  /(Relat[óo]rio|T[íi]tulos por Per[íi]odo|Cedente:|Tipo Consulta|Data Inicial|Data Final|Conta Corrente|CPF|CNPJ|Ordenado por|P[áa]gina|Sacado|Nosso|Seu|Previs|Venc|Liquid|Baixa|Vlr\.)/i;

const ORDEM_CAMPOS = ['SEU','PREV','VENC','VALOR','MORA','DESC','OUTR','DTLQ','COBR'];
const PROXIMO_CAMPO  = { SEU:'PREV', PREV:'VENC', VENC:'VALOR', VALOR:'MORA', MORA:'DESC', DESC:'OUTR', OUTR:'DTLQ', DTLQ:'COBR', COBR:null };

/** Retorna true se a string está no formato monetário pt-BR (ex.: 1.234,56). */
const ehMonetario = s => /^\d{1,3}(?:\.\d{3})*,\d{2}$/.test(s);
/** Retorna true se a string está no formato de data DD/MM/AAAA. */
const ehData      = s => /^\d{2}\/\d{2}\/\d{4}$/.test(s);
/** Retorna true para identificadores numéricos/alfanuméricos típicos (ex.: "144186", "44-4"). */
const ehNumero    = s => /^[0-9A-Z-]{2,}$/i.test(s);

/** Agrupa coordenadas Y em faixas discretas para considerar tokens na mesma linha. */
const chaveFaixaY = y => Math.round(y / EPS_Y);

/**
 * Agrupa tokens por linhas (faixas de Y), calcula o Y médio da faixa e ordena tokens por X.
 * @param {Array<{x:number,y:number,t:string}>} tokens
 * @returns {Array<{y:number,itens:Array}>}
 */
function agruparFaixas(tokens) {
  const mapa = new Map();
  for (const t of tokens) {
    const chave = chaveFaixaY(t.y);
    if (!mapa.has(chave)) mapa.set(chave, []);
    mapa.get(chave).push(t);
  }
  const faixas = [...mapa.values()].map(itens => ({
    y: itens.reduce((a,b)=>a+b.y,0)/itens.length,
    itens: itens.slice().sort((a,b)=> a.x-b.x)
  }));
  faixas.sort((a,b)=> a.y-b.y);
  return faixas;
}

/**
 * Detecta a posição X aproximada de cada coluna usando os rótulos do cabeçalho.
 * @param {Array} tokensDaPagina
 * @returns {Record<string, number>} mapa coluna-x
 */
function detectarColunas(tokensDaPagina) {
  const xs = {};
  for (const t of tokensDaPagina) {
    for (const [chave, regex] of Object.entries(ROTULOS)) {
      if (regex.test(t.t)) xs[chave] = xs[chave] ?? t.x;
    }
  }
  const ordenados = Object.entries(xs).sort((a,b)=> a[1]-b[1]);
  if (xs.SACADO == null && ordenados.length) xs.SACADO = ordenados[0][1] - 5;
  return xs;
}

/**
 * Extrai o texto que cai dentro da faixa horizontal (X) de uma coluna na mesma linha (faixa).
 * @param {{itens:Array}} faixa
 * @param {Record<string,number>} colunas
 * @param {string} chave chave da coluna atual
 * @param {string|null} proximaChave chave da próxima coluna (limite direito)
 * @returns {{texto:string|null,tokens:Array}}
 */
function textoNaColuna(faixa, colunas, chave, proximaChave) {
  const x0 = colunas[chave]; if (x0 == null) return { texto:null, tokens:[] };
  const x1 = proximaChave ? colunas[proximaChave] : null;
  const itens = faixa.itens.filter(it => it.x >= x0 - MARGEM_X && it.x < (x1 ?? (it.x+1)));
  const texto = itens.map(i => i.t).join(' ').replace(/\s+/g,' ').trim() || null;
  return { texto, tokens: itens };
}

/**
 * Verifica se a linha parece conter dados válidos à direita (ex.: Seu Número, Vencimento ou Valor).
 * Ajuda a distinguir linhas de dados de linhas de cabeçalho/ruído.
 * @param {{itens:Array}} faixa
 * @param {Record<string,number>} colunas
 * @returns {boolean}
 */
function possuiDadosADireita(faixa, colunas) {
  const seu    = textoNaColuna(faixa, colunas, 'SEU',   'PREV').texto;
  const venc   = textoNaColuna(faixa, colunas, 'VENC',  'VALOR').texto;
  const valor  = textoNaColuna(faixa, colunas, 'VALOR', 'MORA').texto;
  return (seu && ehNumero(seu)) || (venc && ehData(venc)) || (valor && ehMonetario(valor));
}

/**
 * Retorna os tokens posicionados à esquerda da coluna "Nosso Número" (candidato a campo "Sacado"),
 * filtrando fora qualquer conteúdo de cabeçalho.
 * @param {{itens:Array}} faixa
 * @param {Record<string,number>} colunas
 * @returns {Array}
 */
function tokensEsquerda(faixa, colunas) {
  const xNosso = colunas.NOSSO ?? 150;
  return faixa.itens.filter(i => i.x < xNosso - MARGEM_X && !RE_CABECALHO.test(i.t));
}

/**
 * Compara duas faixas (linhas) verificando se os campos numéricos/datas à direita correspondem.
 * Para detectar continuação de uma mesma linha na página seguinte.
 * @param {{itens:Array}} faixa1
 * @param {{itens:Array}} faixa2
 * @param {Record<string,number>} colunas
 */
function camposCorrespondem(faixa1, faixa2, colunas) {
  for (const k of ORDEM_CAMPOS) {
    const v1 = textoNaColuna(faixa1, colunas, k, PROXIMO_CAMPO[k]).texto?.trim() || null;
    const v2 = textoNaColuna(faixa2, colunas, k, PROXIMO_CAMPO[k]).texto?.trim() || null;
    if (v1 && v2 && v1 !== v2) return false;
  }
  return true;
}

/**
 * Heurística: identifica se a faixa parece ser de cabeçalho (contém muitos termos típicos de header).
 * Usado para evitar juntar o Sacado com linhas de cabeçalho na página seguinte.
 * @param {{itens:Array}} faixa
 * @returns {boolean}
 */
function ehFaixaCabecalho(faixa) {
  const qtd = faixa.itens.filter(t => RE_CABECALHO.test(t.t)).length;
  return qtd >= Math.max(1, Math.floor(faixa.itens.length * 0.5));
}

/**
 * Escolhe o último token “de texto” (com letras) para servir de ponto de concatenação do Sacado.
 * Se não houver letras, usa o último token da faixa.
 * @param {Array} tokens
 * @returns {object}
 */
function escolherTokenCauda(tokens) {
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (/[A-Za-zÀ-ú]/.test(tokens[i].t)) return tokens[i];
  }
  return tokens[tokens.length - 1];
}

/**
 * Concatena o texto Adicionado ao tokenCauda, cuidando de espaços e hífens.
 * @param {object} tokenCauda token que receberá o texto adicionado
 * @param {string} textoAdicionado texto a ser adicionado
 */
function concatenarInteligente(tokenCauda, textoAdicionado) {
  if (!textoAdicionado) return;
  const base = tokenCauda.t || '';
  const iniciaPalavra = /^[A-Za-zÀ-ú]/.test(textoAdicionado);
  const terminaComHifen = /-$/.test(base);
  if (terminaComHifen && iniciaPalavra) {
    tokenCauda.t = base.replace(/-$/, '') + textoAdicionado;
  } else {
    tokenCauda.t = (base && !/\s$/.test(base) ? base + ' ' : base) + textoAdicionado;
  }
}

/**
 * Une automaticamente o campo "Sacado" quando ele quebra para a próxima página:
 * detecta a última linha válida da página atual, busca a primeira linha da próxima página
 * que corresponde ao campo à direita (ou não tenham dados à direita), concatena o texto
 * da esquerda (nome do sacado) e remove os tokens redundantes.
 * @param {Array<{p:number,x:number,y:number,t:string}>} tokens
 * @returns {Array} tokens com o "Sacado" já unido entre páginas
 */
export function unirSacadoEntrePaginas(tokens) {
  const porPagina = new Map();
  for (const t of tokens) {
    if (!porPagina.has(t.p)) porPagina.set(t.p, []);
    porPagina.get(t.p).push(t);
  }
  for (const arr of porPagina.values()) arr.sort((a,b)=> a.y-b.y || a.x-b.x);
  const paginas = [...porPagina.keys()].sort((a,b)=> a-b);

  const paraRemover = new Set();

  for (const p of paginas) {
    const proxima = p + 1;
    if (!porPagina.has(proxima)) continue;

    const atual    = porPagina.get(p);
    const seguinte = porPagina.get(proxima);

    const colunasAtuais   = detectarColunas(atual);
    const colunasProximas = Object.keys(detectarColunas(seguinte)).length ? detectarColunas(seguinte) : colunasAtuais;

    const faixasAtuais   = agruparFaixas(atual);
    const faixasProximas = agruparFaixas(seguinte);

    const validas = faixasAtuais.filter(f => possuiDadosADireita(f, colunasAtuais));
    if (!validas.length) continue;

    const faixaBase  = validas[validas.length - 1];
    const esquerdaBase  = tokensEsquerda(faixaBase, colunasAtuais);
    if (!esquerdaBase.length) continue;

    const tokenCauda = escolherTokenCauda(esquerdaBase);
    const seuBase    = textoNaColuna(faixaBase, colunasAtuais, 'SEU', 'PREV').texto?.trim();

    const varredura = Math.min(16, faixasProximas.length);
    for (let i = 0; i < varredura; i++) {
      const faixa = faixasProximas[i];
      if (ehFaixaCabecalho(faixa)) continue;

      const esquerda = tokensEsquerda(faixa, colunasProximas);
      if (!esquerda.length) continue;

      const nossoNumero  = textoNaColuna(faixa, colunasProximas, 'NOSSO','SEU').texto?.trim() || '';
      const seuNumero    = textoNaColuna(faixa, colunasProximas, 'SEU',  'PREV').texto?.trim() || '';
      const textoEsquerda = esquerda.map(i => i.t).join(' ').replace(/\s+/g,' ').trim();

      if (!textoEsquerda || RE_CABECALHO.test(textoEsquerda)) continue;

      const forte = !!(seuBase && seuNumero && seuBase === seuNumero) &&
                    !nossoNumero &&
                    camposCorrespondem(faixaBase, faixa, colunasAtuais);

      const alternativa = !possuiDadosADireita(faixa, colunasProximas);

      if (forte || alternativa) {
        esquerda.forEach(t => paraRemover.add(t));
        concatenarInteligente(tokenCauda, textoEsquerda);
        break;
      }
    }
  }

  return tokens.filter(t => !paraRemover.has(t));
}
