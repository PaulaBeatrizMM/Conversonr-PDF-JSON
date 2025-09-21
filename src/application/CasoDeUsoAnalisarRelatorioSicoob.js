import { SicoobAnalisadorDeTokens } from '../infrastructure/parsers/SicoobAnalisadorDeTokens.js';
import { extrairTokensDoPdf } from '../infrastructure/pdf/AdaptadorLeitorPdf.js';
import { unirSacadoEntrePaginas } from '../infrastructure/preprocess/UnirSacadoEntrePaginas.js';

export class CasoDeUsoAnalisarRelatorioSicoob {

  constructor() {}

  /**
   * Executa o parsing a partir do PDF.
   * @param {{ inputPath: string }} params
   * @returns {Promise<any>} resultado do parser
   */
  async execute({ inputPath }) {
    let tokens = await extrairTokensDoPdf(inputPath);

    // Pré-processamento
    tokens = unirSacadoEntrePaginas(tokens);

    // Parse final
    const parser = new SicoobAnalisadorDeTokens();
    const result = parser.analisar(tokens);

    return result;
  }
}
