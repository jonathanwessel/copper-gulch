/* Numbers and times on screen, short and plain. */
const SUFFIX = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi'];
export function fmt(n) {
  if (!isFinite(n)) return '0';
  const a = Math.abs(n);
  if (a < 1) return (Math.round(n * 100) / 100).toString();
  if (a < 10) return (Math.round(n * 10) / 10).toString();
  if (a < 1000) return Math.floor(n + 1e-9).toString(); // 59.99999 from a product of factors is 60
  const i = Math.min(SUFFIX.length - 1, Math.floor(Math.log10(a) / 3)), v = n / 10 ** (i * 3);
  return (v < 10 ? +v.toFixed(2) : v < 100 ? +v.toFixed(1) : Math.floor(v)).toString() + SUFFIX[i]; // 1.8K, not 1.80K
}
/* A price in coins, rounded for a player (review 2026-11-18: "0.93 coins"): under 10 coins one decimal, from 10 up as
   fmt. Under 0.1 it keeps one digit that is not 0 ("0.04 coins", "0.003 coins"), so a flooded good never reads
   "0 coins" and its price breakdown multiplies to it as written (review of 2026.11.19-4: "× under 0.01" next to
   "under 0.1 coin" did not add up). Under 0.01 it is "almost 0 coins" (a second review: "0.00005 coins" is unreadable). */
export const ALMOST = 'almost 0 coins';
export function priceNum(v) {
  if (v < .095) return String(+v.toPrecision(1));
  return v < 10 ? String(Math.round(v * 10) / 10) : fmt(v);
}
export function fmtPrice(v) {
  if (!isFinite(v) || v <= 0) return '0 coins';
  if (v < .0095) return ALMOST;
  const s = priceNum(v);
  return s + (s === '1' ? ' coin' : ' coins');
}
/* "sells for 0.9 coins each", "sells for 0.004 coins each" */
export const sellsFor = v => 'sells for ' + fmtPrice(v) + ' each';
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

/* A building's output with its good as the unit (review of 2026.11.19-3: "1 a second" said 1 of what?): "1 plank a second",
   "2.4 planks a second", "0.5 copper ore a second". Goods named in the plural drop the s for exactly 1 (not glass). */
export const oneOf = good => { const name = good.name.toLowerCase(); return /[^s]s$/.test(name) ? name.slice(0, -1) : name; };
export function perSecond(n, good) {
  const v = fmt(n);
  return v + ' ' + (v === '1' ? oneOf(good) : good.name.toLowerCase()) + ' a second';
}
