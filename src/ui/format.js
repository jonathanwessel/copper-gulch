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
  if (!isFinite(v) || v <= 0) return fmtPrice(v) + ' each';
  if (v >= .95) { const c = v < 1000 ? Math.round(v) : v; return fmt(c) + (c === 1 ? ' coin' : ' coins') + ' each'; } // whole coins (review of 2026.11.20-6: "1.5 coins each")
  return 'under 1 coin each'; // one form in every list (review of 2026.11.20-8: "7 coins per 10" beside "2 coins each"); the price bar shows how low
}
/* "sells for 4.6 coins each", "sells for 6 coins per 10" */
export const sellsFor = v => 'sells for ' + each(v);
/* A good's line on the Goods sheet: the stock, how many the towers keep first, and the price as "13 coins each" (one
   pattern, review of 2026.11.20-1). Every unit kept for towers: nothing is sold now, so no price (review 2026-11-18:
   "sells for 0 coins each" next to Sell On). The same words whether some or all are kept, so "first 19 kept" beside
   19 in stock says why nothing sells (review of 2026.11.20-1: "all kept for towers" beside "Sell extra · On" read as
   broken). open: its price box says the price. */
export function goodsLine({ have, kept = 0, selling = true, price = 0, open = false }) {
  // one pattern on every row, the price always shown (review of 2026.11.20-4: "all kept for towers · extra gets sold" on
  // every row read as a rule, and rows came with no price, "1.5 coins each" or "7 coins per 10"). Never more kept than
  // there is (the 2026.11.20-2 screenshots: "226 kept" beside 122 in stock).
  const n = Math.floor(have + 1e-9), k = Math.min(n, Math.ceil(kept - 1e-9));
  // what the towers keep, then the spare that Sell spare sells (review of 2026.11.20-7: "84 kept for towers" beside a lit
  // Sell spare read as a switch with nothing to do; "0 spare" says so)
  // on every row, selling or not (review of 2026.11.20-10: Iron Ridge's rows with Sell spare off had no second line)
  const saved = ' · ' + fmtLive(k) + ' for towers · ' + fmtLive(n - k) + ' spare';
  // the price moved to the front of the price bar, priceLabel (review of 2026.11.20-6: "2 / coins each" wrapped on a
  // phone, and a price beside "122 kept for towers" read as selling what is kept)
  return fmtLive(n) + ' in stock' + saved;
}
/* The price at the front of a good's price bar, always the price in one form: "2 coins each", "7 coins per 10" or
   "Almost 0 coins each" (review of 2026.11.20-7: the label changed between "Price" and a price, and "Almost 0" sat where
   Top or High sit). The bar's end word is only ever how high it stands (priceWord). An open breakdown has no total row. */
export const priceLabel = price => { const s = each(price); return s[0].toUpperCase() + s.slice(1); };
/* The Goods sheet's switch for a good: one label, Sell · On or Sell · Off. */
export function goodsSwitch({ selling = true }) {
  return selling ? 'Sell spare · On' : 'Sell spare · Off'; // spare: what the towers do not keep (review of 2026.11.20-6)
}
/* What an open good on the Goods sheet says in place of its price rows, or null to show the rows. A price that reads
   "almost 0 coins" says why in words, and a good with none to sell says what it would pay (review of 2026.11.19-9: a
   good with none to sell showed its rows down to "Sold a lot lately ÷ 19,000"). */
/* One reason at a time (review of 2026.11.19-11: "towers need it all" beside "You sold a lot of it lately"). The sheet
   no longer has a header line, so the note says the price comes back. */
export function priceNote({ have, kept = 0, price = 0 }) {
  const none = have - kept < 1;
  if (price < .0095) return (none ? '' : 'You sold a lot of it lately. ') + 'The price comes back over time.';
  if (none) return 'Pays ' + each(price) + ' once you have some to sell.';
  return null;
}
/* A research item's line before it runs: how many levels are done ("Level 1 of 5" before any research read as a level
   you had, review of 2026.11.19-7). */
export const levelsDone = (L, max) => L + ' of ' + max + ' done'; // review of 2026.11.20-4: "No levels yet · 20 seconds"
/* A live count on the HUD (owner rule: live numbers never change the size or place of anything on screen). Never
   more than 5 characters, with fixed decimals so the cell keeps its width as the count grows: 0-999 (and 0.0-9.9 for a
   rate under 10), then 1.00K-9.99K, 10.0K-99.9K, 100K-999K, 1.00M... It rounds down, so 999.96 never shows as 1000. */
export function fmtLive(n) {
  if (!isFinite(n) || n < .1) return '0'; // never 0.0 (review of 2026.11.19-14: +0.6/s flipped to +0.0/s beside +0/s)
  if (n < 10 && n % 1) return (Math.floor(n * 10 + 1e-9) / 10).toFixed(1);
  if (n < 1000) return String(Math.floor(n + 1e-9));
  const i = Math.min(SUFFIX.length - 1, Math.floor(Math.log10(n) / 3)), v = n / 10 ** (i * 3);
  const s = v < 10 ? (Math.floor(v * 100 + 1e-9) / 100).toFixed(2) : v < 100 ? (Math.floor(v * 10 + 1e-9) / 10).toFixed(1) : String(Math.floor(v + 1e-9));
  return s + SUFFIX[i];
}
/* The vault on the wave bar and the map labels: the hits it can take, beside a heart (src/ui/heart.js), at most 5
   characters (review of 2026.11.20-14: "Vault 20/20" read as gold; review of 2026.11.20-13: a green bar read as a countdown). */
export function vaultCount(v) {
  const max = Math.max(1, Math.floor((v && v.max) || 0)), hp = Math.min(max, Math.max(0, Math.ceil((v && v.hp) || 0)));
  return fmtLive(hp);
}
/* What you have, under a price: "have 400" (review of 2026.11.20-14: "400 / 12 coins" read as 400 out of 12). */
export const haveWords = n => 'have ' + fmtLive(Math.max(0, n));
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
