/* Numbers and times on screen, short and plain. */
const SUFFIX = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi'];
export function fmt(n) {
  if (!isFinite(n)) return '0';
  const a = Math.abs(n);
  if (a < 1) return (Math.round(n * 100) / 100).toString();
  if (a < 10) return (Math.round(n * 10) / 10).toString();
  if (a < 1000) return Math.floor(n).toString();
  const i = Math.min(SUFFIX.length - 1, Math.floor(Math.log10(a) / 3)), v = n / 10 ** (i * 3);
  return (v < 10 ? +v.toFixed(2) : v < 100 ? +v.toFixed(1) : Math.floor(v)).toString() + SUFFIX[i]; // 1.8K, not 1.80K
}
/* A live count on the HUD (owner rule: live numbers never change the size or place of anything on screen). Never
   more than 5 characters, with fixed decimals so the cell keeps its width as the count grows: 0-999 (and 0.0-9.9 for a
   rate under 10), then 1.00K-9.99K, 10.0K-99.9K, 100K-999K, 1.00M... It rounds down, so 999.96 never shows as 1000. */
export function fmtLive(n) {
  if (!isFinite(n) || n <= 0) return '0';
  if (n < 10 && n % 1) return (Math.floor(n * 10 + 1e-9) / 10).toFixed(1);
  if (n < 1000) return String(Math.floor(n + 1e-9));
  const i = Math.min(SUFFIX.length - 1, Math.floor(Math.log10(n) / 3)), v = n / 10 ** (i * 3);
  const s = v < 10 ? (Math.floor(v * 100 + 1e-9) / 100).toFixed(2) : v < 100 ? (Math.floor(v * 10 + 1e-9) / 10).toFixed(1) : String(Math.floor(v + 1e-9));
  return s + SUFFIX[i];
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
