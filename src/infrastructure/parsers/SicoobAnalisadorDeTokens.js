import { Grupo } from '../../domain/entities/Grupo.js';
import { Linha } from '../../domain/entities/Linha.js';
import { parsePtBrNumber } from '../../utils/number.js';
import { isPtBrDate } from '../../utils/date.js';

const EPS_Y = 0.24;

const ROTULOS = {
  SACADO: 'Sacado',
  NOSSO: 'Nosso Número',
  SEU: 'Seu Número',
  NN: 'NN Corresp.',
  DTPREV: 'Dt. Previsão',
  DTVENC: 'Dt. Vencimento',
  VALOR: 'Valor',
  VOUTROS: 'Vlr. Outros',
  VLMORA: 'Vlr. Mora',
  VLDESC: 'Vlr. Desc.',
  DTLQ: 'Dt. Liquid.',
  DTBX: 'Dt. Baixa',
  VLCBR: 'Vlr. Cobrado',
  VLBAI: 'Vlr. Baixado',
  CRED: 'Crédito'
};

/**
 * Percorre uma janela de tokens a partir de um índice e detecta,
 * pelos rótulos de cabeçalho, a coordenada X de cada coluna do relatório.
 * Retorna um mapa { rótulo -> x } com as posições das colunas encontradas.
 * @param {Array} tokens
 * @param {number} indiceInicial
 * @returns {Record<string, number>}
 */
function encontrarColunaX(tokens, indiceInicial) {
  const janela = tokens.slice(indiceInicial, indiceInicial + 200);
  const mapa = {};
  for (const t of janela) {
    const s = t.t;
    if (s === ROTULOS.SACADO || s === ROTULOS.NOSSO || s === ROTULOS.SEU ||
        s === ROTULOS.NN || s === ROTULOS.DTVENC || s === ROTULOS.VALOR ||
        s === ROTULOS.VOUTROS) {
      mapa[s] = t.x;
    } else if (/^Vlr\. Mora/i.test(s)) {
      mapa[ROTULOS.VLMORA] = t.x;
    } else if (/^Vlr\. Desc/i.test(s)) {
      mapa[ROTULOS.VLDESC] = t.x;
    } else if (/^Dt\. Liquid/i.test(s)) {
      mapa[ROTULOS.DTLQ] = t.x;
    } else if (/^Dt\. Baixa/i.test(s)) {
      mapa[ROTULOS.DTBX] = t.x;
    } else if (/^Vlr\. Cobrado/i.test(s)) {
      mapa[ROTULOS.VLCBR] = t.x;
    } else if (/^Vlr\. Baixado/i.test(s)) {
      mapa[ROTULOS.VLBAI] = t.x;
    } else if (/^Dt\. Previs/i.test(s)) {
      mapa[ROTULOS.DTPREV] = t.x;
    }
  }
  return mapa;
}

/**
 * Retorna apenas os textos dos tokens que estão estritamente dentro
 * do intervalo horizontal [x0, x1) para a mesma linha (faixa) analisada.
 * @param {Array} tokensDaLinha
 * @param {number} x0
 * @param {number} x1
 * @returns {Array}
 */
function textosNoIntervaloEstrito(tokensDaLinha, x0, x1) {
  return tokensDaLinha.filter(t => (t.x >= x0) && (t.x < x1)).map(t => t.t);
}

export class SicoobAnalisadorDeTokens {
  /**
   * Analisa uma lista de tokens posicionais ({p,x,y,t}) página a página,
   * descobre as colunas pelo cabeçalho, varre cada linha de dados e
   * constrói objetos de domínio (Grupo e Linha) com os campos extraídos.
   * Retorna um array de Grupos contendo suas Linhas válidas.
   * @param {Array<{p:number,x:number,y:number,t:string}>} tokens
   * @returns {Array<Grupo>}
   */
  analisar(tokens) {
    const porPagina = new Map();
    for (const t of tokens) {
      const array = porPagina.get(t.p) || [];
      array.push(t);
      porPagina.set(t.p, array);
    }
    const grupos = [];
    let grupoAtual = null;
    let rotulosXs = null;
    let intervalos = null;

    const paginas = [...porPagina.keys()].sort((a,b)=> a-b);

    for (const p of paginas) {

      const tokensDaPagina = porPagina.get(p);

      tokensDaPagina.sort((a,b)=> a.y - b.y || a.x - b.x);

      for (let i = 0; i < tokensDaPagina.length; i++) {

        const token = tokensDaPagina[i];
        const texto = token.t;

        // Detecta o início de um novo grupo pelo padrão de cabeçalho no canto esquerdo
        if (/^\d{2}-/.test(texto) && texto.length > 4 && token.x < 5.0) {
          const y0 = token.y;

          const mesmaLinha = tokensDaPagina
            .filter(t => Math.abs(t.y - y0) <= 0.12 && t.x < 30)
            .sort((a,b)=> a.x - b.x);

          let cabecalho = mesmaLinha.map(t=>t.t).join(' ').trim();

          cabecalho = cabecalho.split(' Sacado')[0].trim();

          grupoAtual = new Grupo(cabecalho);

          grupos.push(grupoAtual);

          rotulosXs = encontrarColunaX(tokensDaPagina, i);

          const ehLiquidacao = ROTULOS.DTLQ in rotulosXs;

          const ordem = [
            ROTULOS.NOSSO, 
            ROTULOS.SEU, 
            ROTULOS.NN, 
            ROTULOS.DTPREV, 
            ROTULOS.DTVENC, 
            ROTULOS.VALOR, 
            ROTULOS.VLMORA, 
            ROTULOS.VLDESC, 
            ROTULOS.VOUTROS
          ];

          // Acrescenta colunas de data/valor finais de acordo com o tipo da seção
          const fimData  = ehLiquidacao ? ROTULOS.DTLQ  : ROTULOS.DTBX;
          const fimValor = ehLiquidacao ? ROTULOS.VLCBR : ROTULOS.VLBAI;

          if (fimData in rotulosXs) ordem.push(fimData);

          if (fimValor in rotulosXs) ordem.push(fimValor);

          // Ordena as colunas pela posição X para montar intervalos [xInicial, xFinal)
          const colunas = ordem
            .filter(k => k in rotulosXs)
            .map(k => [k, rotulosXs[k]])
            .sort((a,b)=> a[1]-b[1]);

          intervalos = [];

          const primeiroX = colunas[0][1];

          const limiteEsquerdo = primeiroX / 2;

          // Constrói intervalos horizontais entre colunas (meio a meio)
          for (let indice = 0; indice < colunas.length; indice++) {
            const [nome, x] = colunas[indice];
            const esquerda = (indice > 0) ? colunas[indice-1][1] : 0.0;
            const direita  = (indice + 1 < colunas.length) ? colunas[indice+1][1] : 1e9;
            const xInicial = (indice > 0) ? (esquerda + x) / 2 : limiteEsquerdo;
            const xFinal   = (indice + 1 < colunas.length) ? (x + direita) / 2 : 1e9;
            intervalos.push([nome, xInicial, xFinal]);
          }

          // Adiciona intervalo do "Sacado" (tudo à esquerda do "Nosso Número")
          if (ROTULOS.NOSSO in rotulosXs) {
            intervalos.unshift(['Sacado', 0.0, limiteEsquerdo]);
          }

        }

        if (!grupoAtual || !rotulosXs || !(ROTULOS.NOSSO in rotulosXs)) continue;

        const intervaloNosso = intervalos.find(s => s[0] === ROTULOS.NOSSO);

        const [nx0, nx1] = [intervaloNosso[1], intervaloNosso[2]];

        // Detecta linhas de dados pelo padrão do "Nosso Número" (ex.: 44-1)
        if ((token.x >= nx0 - 0.2) && (token.x < nx1 + 0.2) && /\d+-\d+/.test(texto)) {
          const y0 = token.y;

          // Junta tokens da mesma linha (tolerância vertical EPS_Y)
          const faixa = tokensDaPagina
            .filter(t => Math.abs(t.y - y0) <= EPS_Y)
            .sort((a,b)=> a.x - b.x);

          const textosDoIntervalo = (rotulo) => {
            const intervalo = intervalos.find(s => s[0] === rotulo);
            if (!intervalo) return [];
            return textosNoIntervaloEstrito(faixa, intervalo[1], intervalo[2]);
          };

          const tokensSacado = tokensDaPagina
            .filter(t => t.x < rotulosXs[ROTULOS.NOSSO] && t.y >= y0 - 0.6 && t.y <= y0 + 0.4)
            .sort((a,b)=> a.y - b.y || a.x - b.x);

          const sacado = tokensSacado.map(t=>t.t).join(' ').replace(/\bSacado\b/g,'').trim() || null;

          const nossoNumero = (textosDoIntervalo(ROTULOS.NOSSO).find(s => /^\d+-\d+$/.test(s)) || null);

          let seuNumero = null;

          const intervaloSeu = intervalos.find(s => s[0] === ROTULOS.SEU);

          if (intervaloSeu) {
            const [sx0, sx1] = [intervaloSeu[1], intervaloSeu[2]];

            const textos = tokensDaPagina
              .filter(t => t.x >= sx0 && t.x < sx1 && t.y >= y0 - 0.6 && t.y <= y0 + 0.6)
              .sort((a,b)=> a.y - b.y || a.x - b.x)
              .map(t => t.t)
              .filter(s => /^[A-Za-z0-9_\-]+$/.test(s));

            if (textos.length) {
              let unido = textos.join('');

              unido = unido.replace(/\bREV-([0-9]+)\b/gi, 'REV$1');
              unido = unido.replace(/--+/g, '-');
              seuNumero = unido.trim() || null;
            }
          }

          const nnCorrespBruto = textosDoIntervalo(ROTULOS.NN)[0] || null;

          let nnCorresp = nnCorrespBruto;

          if (nnCorresp != null) {
            const s = String(nnCorresp).trim();
            if (s === '' || /^0+$/.test(s) || s === '-') nnCorresp = null;
          }

          const candidatosDtPrev = (textosDoIntervalo(ROTULOS.DTPREV) || []).filter(t => /^\d{2}\/\d{2}\/\d{4}$/.test(t));
          const dtPrev = candidatosDtPrev.length ? candidatosDtPrev[0] : null;
          const dtVenc = textosDoIntervalo(ROTULOS.DTVENC)[0] || null;
          const valorStr = textosDoIntervalo(ROTULOS.VALOR)[0] || null;
          const valorOutrosStr = textosDoIntervalo(ROTULOS.VOUTROS)[0] || null;

          const rotuloData = (rotulosXs[ROTULOS.DTLQ] != null) ? ROTULOS.DTLQ : ROTULOS.DTBX;
          const candidatosData = (textosDoIntervalo(rotuloData) || []).filter(t => /^\d{2}\/\d{2}\/\d{4}$/.test(t));
          const dtFinal = candidatosData.length ? candidatosData[0] : null;

          const valorFinalStr =
            textosDoIntervalo('Vlr. Cobrado')[0] ||
            textosDoIntervalo('Vlr. Baixado')[0] ||
            textosDoIntervalo('Vlr. Final')[0] ||
            null;

          const vmoraX = rotulosXs[ROTULOS.VLMORA];
          const voutrosX = rotulosXs[ROTULOS.VOUTROS];

          let intermediarios = [];

          if (vmoraX != null && voutrosX != null) {
            intermediarios = faixa
              .filter(t =>
                t.x >= (vmoraX + rotulosXs[ROTULOS.VALOR]) / 2 &&
                t.x <  (voutrosX + (rotulosXs[ROTULOS.VLDESC] ?? vmoraX)) / 2 &&
                /^[0-9\.,]+$/.test(t.t)
              )
              .sort((a,b)=> a.x - b.x)
              .map(t => t.t);
          }
          
          const valorMora = intermediarios.length >= 1 ? parsePtBrNumber(intermediarios[0]) : null;
          const valorDesconto = intermediarios.length >= 2 ? parsePtBrNumber(intermediarios[1]) : 0;

          // Monta a entidade de domínio com todos os campos extraídos e normalizados
          const linha = new Linha({
            sacado,
            nossoNumero,
            seuNumero,
            nnCorresp,
            dataPrevisaoCredito: (dtPrev && isPtBrDate(dtPrev)) ? dtPrev : null,
            dataVencimento: (dtVenc && isPtBrDate(dtVenc)) ? dtVenc : null,
            valor: parsePtBrNumber(valorStr),
            valorMora: (valorMora == null ? null : valorMora),
            valorDesconto: valorDesconto ?? 0,
            valorOutros: parsePtBrNumber(valorOutrosStr) ?? 0,
            dataBaixa: (dtFinal && isPtBrDate(dtFinal)) ? dtFinal : null,
            valorBaixado: parsePtBrNumber(valorFinalStr),
          });

          // Adiciona a linha ao grupo atual somente se houver "Nosso Número" válido
          if (linha.nossoNumero) grupoAtual.adicionaLinha(linha);
        }
      }
    }

    // Garante que cada grupo só tenha linhas com "Nosso Número" válido
    for (const g of grupos) {
      g.LinhasDaTabela = g.LinhasDaTabela.filter(r => !!r.nossoNumero);
    }
    return grupos;
  }
}
