/** Numbers as Spanish readers expect them: decimal comma, up to one decimal («16,8»). */
export function formatNumber(n: number, maxDecimals = 1): string {
  return n.toLocaleString('es', { maximumFractionDigits: maxDecimals });
}
