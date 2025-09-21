/**
 * Verifica se a string está no formato de data pt-BR "DD/MM/AAAA" (apenas o formato).
 * @param {string} s
 * @returns {boolean} true se a string corresponde ao formato; caso contrário, false.
 */
export function isPtBrDate(s) {
  return typeof s === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(s);
}
