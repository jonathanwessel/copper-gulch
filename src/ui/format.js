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
/* Damage: the nearest whole number from 10 to 999 (review of 2026.11.19-8: 13 × 3.05 × 1.15 × 3 × 1.3 read 177, since
   fmt rounds down, and a reader rounds to 178). Coins keep rounding down, so a cost never reads as paid too soon. */
export const fmtDmg = n => (isFinite(n) && Math.abs(n) >= 10 && Math.abs(n) < 999.5 ? String(Math.round(n)) : fmt(n));
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
/* A price in words: "4.6 coins each", or under 1 coin what 10 or 100 of it pay, "6 coins per 10" (review of
   2026.11.19-12: "0.6 coins each" is a coin nobody can hold). The open price breakdown keeps one unit's price, so its
   rows multiply as written. */
export function each(v) {
  if (!isFinite(v) || v < .0095 || v >= .95) return fmtPrice(v) + ' each';
  const n = v >= .095 ? 10 : 100, c = Math.round(v * n);
  return c + (c === 1 ? ' coin' : ' coins') + ' per ' + n;
}
/* "sells for 4.6 coins each", "sells for 6 coins per 10" */
export const sellsFor = v => 'sells for ' + each(v);
/* A good's line on the Goods sheet. Every unit kept for towers: nothing is sold now, so no price (review 2026-11-18:
   "sells for 0 coins each" next to Sell On), and it says there is none to sell, since "all kept" beside Sell On read
   as a contradiction (review of 2026.11.19-7). Sell Off says it is not sold and what it would sell for, so it never sits
   as "worth 0.9" beside another good's "sells for 13" with nothing saying why. open: its price box says the price. */
export function goodsLine({ have, kept = 0, selling = true, price = 0, open = false }) {
  const all = selling && kept > 0 && kept + .5 >= have;
  // (review of 2026.11.19-12: "none to sell" beside a lit Sell · On; the switch now reads Sell extra, goodsSwitch)
  const saved = all ? ' · all kept for towers' : !kept || !selling ? '' : ' · ' + kept + ' kept for towers';
  return fmtLive(Math.floor(have + 1e-9)) + ' in stock' + saved + (open || all ? '' : ' · ' + (selling ? sellsFor(price) : 'not sold, ' + each(price) + ' if sold'));
}
/* The Goods sheet's switch for a good. While towers keep every unit it says it sells only what they leave. */
export function goodsSwitch({ have, kept = 0, selling = true }) {
  if (!selling) return 'Sell · Off';
  return kept > 0 && kept + .5 >= have ? 'Sell extra · On' : 'Sell · On';
}
/* What an open good on the Goods sheet says in place of its price rows, or null to show the rows. A price that reads
   "almost 0 coins" says why in words, and a good with none to sell says what it would pay (review of 2026.11.19-9: a
   good with none to sell showed its rows down to "Sold a lot lately ÷ 19,000"). */
/* One reason at a time (review of 2026.11.19-11: "towers need it all" beside "You sold a lot of it lately"). The sheet
   no longer has a header line, so the note says the price comes back. */
export function priceNote({ have, kept = 0, price = 0 }) {
  const none = have - kept < 1;
  if (price < .0095) return (none ? 'It pays almost nothing now.' : 'You sold a lot of it lately, so it pays almost nothing now.') + ' The price comes back over time.';
  if (none) return 'Pays ' + each(price) + ' once you have some to sell.';
  return null;
}
/* A research item's line before it runs: how many levels are done ("Level 1 of 5" before any research read as a level
   you had, review of 2026.11.19-7). */
export const levelsDone = (L, max) => (L ? L + ' of ' + max + ' levels done' : 'No levels yet');
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

/* Rows that add up to their total as written (review of 2026.11.19-5: "4.7 + 0.6 + 0.0" under "+5.4/s"). The total is
   written as fmtLive writes it, rounding down; the rows share its last digit's steps by the largest remainder, so the
   written rows always sum to the written total. A row too small for one step reads "under 0.1" (or "under 10" and so on
   at a bigger total), never 0. */
const liveStep = n => {
  if (n < 1000) return 1;
  const i = Math.min(SUFFIX.length - 1, Math.floor(Math.log10(n) / 3)), v = n / 10 ** (i * 3);
  return 10 ** (i * 3) * (v < 10 ? .01 : v < 100 ? .1 : 1);
};
export function splitLive(total, values) {
  total = isFinite(total) && total > 0 ? total : 0;
  const tenths = total < 10, step = tenths ? 1 : liveStep(total);
  const units = tenths ? Math.floor(total * 10 + 1e-9) : Math.floor(total / step + 1e-9); // the same rounding as fmtLive
  const raw = values.map(v => (isFinite(v) && v > 0 ? (tenths ? v * 10 : v / step) : 0)), got = raw.map(r => Math.floor(r + 1e-9));
  let left = units - got.reduce((s, g) => s + g, 0);
  const order = raw.map((r, i) => [r - got[i], i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; left > 0 && order.length; k = (k + 1) % order.length, left--) got[order[k][1]]++;
  while (left < 0) { const i = got.indexOf(Math.max(...got)); got[i]--; left++; } // only from float slack
  // whole coins from 10 to 999 are written as whole numbers (the 2026.11.19-6 map read "+9.0/s" and "under 1.0/s" beside +37/s)
  const write = u => (tenths ? (u / 10).toFixed(1) : step === 1 ? String(u) : fmtLive(u * step * (1 + 1e-9)));
  const under = 'under ' + (tenths ? '0.1' : step === 1 ? '1' : fmtLive(step * (1 + 1e-9)));
  return { total: fmtLive(total), rows: got.map((u, i) => (u > 0 ? write(u) : raw[i] > 0 ? under : null)) };
}
