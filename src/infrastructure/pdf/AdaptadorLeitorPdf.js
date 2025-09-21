import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PdfReader } = require('pdfreader');

/**
 * Lê o arquivo PDF e transforma cada trecho de texto em um token homogêneo { p, x, y, t }.
 * - p: número da página
 * - x, y: coordenadas do texto na página
 * - t: conteúdo textual (trimado)
 * Retorna uma Promise que resolve com os tokens já ordenados por página, Y e X.
 * Utilizado para alimentar parsers que dependem de posição no layout do PDF.
 * @param {string} caminhoPdf caminho do arquivo PDF
 * @returns {Promise<Array<{p:number,x:number,y:number,t:string}>>}
 */
export function extrairTokensDoPdf(caminhoPdf) {
  return new Promise((resolve, reject) => {
    const items = [];
    let paginaNo = 0;
    try {
      new PdfReader().parseFileItems(caminhoPdf, (err, item) => {
        if (err) return reject(err);
        if (!item) return resolve(items.sort((a,b) => a.p - b.p || a.y - b.y || a.x - b.x));
        if (item.page) {
          paginaNo = item.page;
        } else if (item.text) {
          items.push({ p: paginaNo, x: item.x, y: item.y, t: String(item.text).trim() });
        }
      });
    } catch (e) {
      reject(e);
    }
  });
}
