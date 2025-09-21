export class Linha {
  /**
   * Cria uma linha (registro) com os campos extraídos do relatório.
   * @param {string|null} sacado nome do sacado (pode ser null)
   * @param {string|null} nossoNumero nosso número (pode ser null)
   * @param {string|null} seuNumero seu número (pode ser null)
   * @param {string|null} nnCorresp número de controle/correspondente (pode ser null)
   * @param {string|null} dataPrevisaoCredito data prevista para crédito (pode ser null)
   * @param {string|null} dataVencimento data de vencimento (pode ser null)
   * @param {number|null} valor valor principal (default 0)
   * @param {number|null} valorMora valor de mora/juros (default 0)
   * @param {number|null} valorDesconto valor de desconto (default 0)
   * @param {number|null} valorOutros valor de outros acréscimos (default 0)
   * @param {string|null} dataBaixa data de baixa (pode ser null)
   * @param {number|null} valorBaixado valor baixado (default 0)
   */
  constructor({
    sacado = null,
    nossoNumero = null,
    seuNumero = null,
    nnCorresp = null,
    dataPrevisaoCredito = null,
    dataVencimento = null,
    valor = 0,
    valorMora = 0,
    valorDesconto = 0,
    valorOutros = 0,
    dataBaixa = null,
    valorBaixado = 0,
  }) {
    this.sacado = sacado;
    this.nossoNumero = nossoNumero;
    this.seuNumero = seuNumero;
    this.nnCorresp = nnCorresp;
    this.dataPrevisaoCredito = dataPrevisaoCredito;
    this.dataVencimento = dataVencimento;
    this.valor = (valor ?? 0) || 0;
    this.valorMora = (valorMora ?? 0) || 0;
    this.valorDesconto = (valorDesconto ?? 0) || 0;
    this.valorOutros = (valorOutros ?? 0) || 0;
    this.dataBaixa = dataBaixa;
    this.valorBaixado = (valorBaixado ?? 0) || 0;
  }
}
