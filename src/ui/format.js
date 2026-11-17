/* Numbers and times on screen, short and plain. */
const SUFFIX = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi'];
export function fmt(n) {
  if (!isFinite(n)) return '0';
  const a = Math.abs(n);
  if (a < 10) return (Math.round(n * 10) / 10).toString();
  if (a < 1000) return Math.floor(n).toString();
  const i = Math.min(SUFFIX.length - 1, Math.floor(Math.log10(a) / 3)), v = n / 10 ** (i * 3);
  return (v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : Math.floor(v).toString()) + SUFFIX[i];
}
/* How long ago, from milliseconds: "just now", "5 min ago", "3 h ago", "2 days ago". */
export function ago(ms) {
  const s = Math.max(0, ms) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + ' min ago';
  if (s < 86400) return Math.floor(s / 3600) + ' h ago';
  const d = Math.floor(s / 86400);
  return d + (d === 1 ? ' day ago' : ' days ago');
}
