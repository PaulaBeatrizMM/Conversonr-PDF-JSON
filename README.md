# Leitor de PDF — Relatórios Sicoob → JSON

Conversor que lê **extrato do banco Sicoob** em **PDF** e gera um **JSON estruturado** com os campos de cada lançamento (sacado, nosso número, seu número, datas e valores).

---

## ✨ Principais recursos

- **CLI** simples (`sicoob-parse`) para rodar pelo terminal.
- **Arquitetura limpa**: camadas `domain`, `application`, `infrastructure`, `interface`, `utils`.
- **Parser posicional**: usa as coordenadas (x, y) do texto no PDF para identificar colunas.
- **Tratamento de quebra de página**: junta corretamente o **Sacado** quando o nome quebra para o topo da página seguinte.
- **Números pt-BR**: converte strings do tipo `1.234,56` para `1234.56` (Number).

---

## 📦 Requisitos

- **Node.js >= 18** (conferir com `node -v`)

---

## 🧭 Estrutura do projeto

```text
Leitor de PDF/
├─ ArquivosPDF/
│  └─ Sicoob.pdf
├─ package.json
├─ README.md
├─ .gitignore
└─ src/
   ├─ application/
   │  └─ CasoDeUsoAnalisarRelatorioSicoob.js
   ├─ domain/
   │  └─ entities/
   │     ├─ Grupo.js
   │     └─ Linha.js
   ├─ infrastructure/
   │  ├─ parsers/
   │  │  └─ SicoobAnalisadorDeTokens.js
   │  ├─ pdf/
   │  │  └─ AdaptadorLeitorPdf.js
   │  └─ preprocess/
   │     └─ UnirSacadoEntrePaginas.js
   ├─ interface/
   │  └─ cli/
   │     └─ index.js
   └─ utils/
      ├─ date.js
      └─ number.js
```

### O que cada parte faz (resumo)

- **src/interface/cli/index.js**  
  Implementa a **linha de comando** (`sicoob-parse`). Lê argumentos/opções, chama o caso de uso e salva o JSON.

- **src/application/CasoDeUsoAnalisarRelatorioSicoob.js**  
  **Orquestra** o fluxo: extrai tokens do PDF → junta *Sacado* entre páginas → delega ao parser de tokens → retorna os grupos e linhas.

- **src/infrastructure/pdf/AdaptadorLeitorPdf.js**  
  Lê o PDF com `pdfreader` e padroniza tokens `{ p, x, y, t }` (página, posição e texto).

- **src/infrastructure/preprocess/UnirSacadoEntrePaginas.js**  
  Detecta quando o **Sacado** foi quebrado na virada de página e **concatena** os trechos, removendo tokens redundantes.

- **src/infrastructure/parsers/SicoobAnalisadorDeTokens.js**  
  Descobre **colunas** pelos rótulos do cabeçalho, **varre linha a linha** e monta objetos `Grupo` e `Linha` com os campos extraídos.

- **src/domain/entities/{Grupo,Linha}.js**  
  **Modelos de domínio** usados como saída do caso de uso.

- **src/utils/{number,date,text}.js**  
  Utilitários para **número pt-BR** e validação de **data**.

---

## 🚀 Instalação

Dentro da pasta do projeto:
```bash
npm i
```
---

## ▶️ Como usar

### 1) Via `npm start` (usa o PDF de exemplo)
```bash
npm start
```
Isso executa:
```bash
node ./src/interface/cli/index.js ./ArquivosPDF/Sicoob.pdf -o extracao.json
```
Saída padrão: **`extracao.json`** na raiz do projeto.

### 2) Via CLI diretamente
```bash
node ./src/interface/cli/index.js <caminho/para/seu.pdf> -o saida.json
```

### 3) (Opcional) Como binário local
O `package.json` expõe um binário chamado **`sicoob-parse`**. Se você instalar localmente ou globalmente, pode chamar:
```bash
sicoob-parse <caminho/para/seu.pdf> -o saida.json
```

---

## 📤 Formato do JSON de saída

A saída é um **array** de **grupos**. Cada grupo tem um `TituloDaCategoria` e uma lista `LinhasDaTabela` com as linhas (registros).

### Exemplo (abreviado)
```json
[
  {
    "TituloDaCategoria": "51-LIQUIDAÇÃO - VIA CAIXA/DINHEIRO",
    "LinhasDaTabela": [
      {
        "sacado": "SANTANA E COM. DE CA",
        "nossoNumero": "44-1",
        "seuNumero": "61909",
        "nnCorresp": null,
        "dataPrevisaoCredito": "19/02/2018",
        "dataVencimento": "19/02/2018",
        "valor": 693.94,
        "valorMora": null,
        "valorDesconto": 0,
        "valorOutros": 0,
        "dataBaixa": "19/02/2018",
        "valorBaixado": 693.94
      }
    ]
  }
]
```
---