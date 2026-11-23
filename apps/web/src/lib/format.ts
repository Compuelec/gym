/** Numbers as Spanish readers expect them: decimal comma, up to one decimal («16,8»). */
export function formatNumber(n: number, maxDecimals = 1): string {
  return n.toLocaleString('es', { maximumFractionDigits: maxDecimals });
}

/** Durations for people: «45 s» for short holds, «15 min» or «2:30 min» for cardio. */
export function formatDuration(seconds: number): string {
  if (seconds < 120) return `${seconds} s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m} min` : `${m}:${String(s).padStart(2, '0')} min`;
}
