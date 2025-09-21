/**
 * Converte um número no formato pt-BR (ex.: "1.234,56") para Number (ex.: 1234.56).
 * Retorna null para valores nulos, vazios ou não numéricos.
 * @param {string|number|null|undefined} str
 * @returns {number|null}
 */
export function parsePtBrNumber(str) {
  if (str == null) return null;
  const texto = String(str).trim();
  if (!texto) return null;
  const normalizado = texto.replace(/\./g, '').replace(/,/g, '.');
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : null;
}
