export class Grupo {
  /**
   * Cria o grupo de linhas (registros) do relatório, identificado por título/categoria.
   * @param {string} titulo - Nome/título da categoria/ seção no relatório.
   */
  constructor(titulo) {
    this.TituloDaCategoria = titulo;
    this.LinhasDaTabela = [];
  }

  /**
   * Adiciona uma linha (registro) a este grupo.
   * @param {object} linha - Objeto do tipo Linha contendo os campos extraídos do relatório.
   */
  adicionaLinha(linha) {
    this.LinhasDaTabela.push(linha);
  }
}