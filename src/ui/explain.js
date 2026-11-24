/* Tap a number, see where it comes from (owner rule: every number explains itself). Draws what src/core/explain.js
   works out: the starting value, one row per level, path, market or bonus, and the total. Also the Income sheet
   (tap the coins) and the Vault sheet (tap the wave and vault bar).
   Words follow the writing rule: plain labels, units a player knows, no colons. */
import { heart } from './heart.js';
import { fmt, fmtDmg, fmtPrice, fmtLive, priceNum, splitLive, LITTLE } from './format.js';
import { explainVault } from '../core/explain.js';

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

/* Reach in words a player can compare (the circles on the map show the rest). */
export const reachWord = (range, minRange = 0) => (minRange ? 'Long, not up close' : range < 2.3 ? 'Short' : range < 3.2 ? 'Medium' : 'Long');
/* Blast in words, Small or Wide (the circles on the map show the rest). */
export const blastWord = r => (r < 1.2 ? 'Small' : 'Wide');
/* Shots in words: "1.3 a second", "One every 3 seconds". */
// just under one a second rounds to one, never "One every 1 seconds" (screenshot of 2026.11.21-9: a level 19 Cannon)
export const shotsWord = r => (r >= 1 ? fmt(r) + ' a second' : Math.round(1 / r) <= 1 ? 'About 1 a second' : 'One every ' + Math.round(1 / r) + ' seconds');

/* A working foreman that is not buying, beside its "Foreman · On" switch: what it is doing and why, as a status, not a
   story (review of 2026.11.19-9: "The foreman waits. Timber sells low..." read as a narrator). */
/* It says when the foreman buys again, what it does, not its reasons (review of 2026.11.19-11: "Timber sells low and no
   workshop needs more" read as narrator reasoning beside a cheap upgrade). */
export function foremanLine(why, good) {
  /* a status, as short as a sign (review of 2026.11.20-2: "buys the next level once timber sells for more" beside 1M coins and a 41-coin level read odd) */
  if (why === 'short') return 'Waiting for more ' + good + '.';
  if (why === 'flooded') return 'Foreman paused while the ' + good + ' price is low.'; // what it waits for (review of 2026.11.20-8) // review of 2026.11.20-4: "a better price" beside a good kept for towers
  return 'Waiting until a level pays for itself within an hour.';
}
/* Goods your buildings keep back for a tower's next upgrade or path, named without amounts: the cost row above the line
   shows those (review of 2026.11.19-9: "20 copper and 20 bricks are set aside for this path" said the cost twice). Short,
   so a landscape tower card fits without scrolling (review of 2026.11.19-10). */
export function keepLine(goods, what) {
  const n = goods.length > 1 ? goods.slice(0, -1).join(', ') + ' and ' + goods[goods.length - 1] : goods[0];
  return 'Saving ' + n + ' for this ' + what + '.'; // a status, not a rule (review of 2026.11.19-14: "is kept for this upgrade, not sold" read like a manual)
}

/* A value in its unit. */
export function unitText(unit, v, extra = {}) {
  if (unit === 'rate') return fmtLive(v) + '/s'; // as the top bar writes it, so the Income total and the bar agree (review 2026-11-18)
  if (unit === 'coins') return fmtPrice(v); // a price: one decimal under 10 coins, one digit that is not 0 under 0.1
  if (unit === 'hits') return Math.round(v) + (Math.round(v) === 1 ? ' hit' : ' hits');
  if (unit === 'shots') return shotsWord(v);
  if (unit === 'reach') return reachWord(v, extra.minRange);
  if (unit === 'blast') return blastWord(v);
  if (unit === 'dmg') return fmtDmg(v);
  return fmt(v);
}
/* A factor, written as one ("× 1.15", "× 3.7", "× 0.82"): the parts multiply, so they never read as if they add. */
/* A factor under 0.01 keeps its first digit that is not 0 ("× 0.003"), one more on the last try. */
const places = (m, digits) => Math.max(digits ?? (m >= 2 ? 1 : 2), m > 0 && m < .01 ? Math.min(6, Math.floor(-Math.log10(m)) + 1) + (digits === 3 ? 1 : 0) : 0);
const shownMul = (r, m) => (r === 1 ? (m >= 1 ? 1.01 : .99) : r); // a factor never reads × 1
export function mulText(m, digits) {
  const k = 10 ** places(m, digits);
  return mulWord(shownMul(Math.round(m * k) / k, m));
}
/* A factor as written. A factor under 0.01 keeps a digit (see places), so it never reads "× 0" (review 2026-11-18). */
const mulWord = v => '× ' + (v < 1e-6 ? 'almost 0' : String(+v.toFixed(7))); // a factor is never 0: one too small to write reads "almost 0"
/* A factor under 0.01 as "÷ 2,000" (review of 2026.11.19-8: "× almost 0" put a factor in words). Two digits that count. */
export const divText = m => '÷ ' + (m > 0 ? Number((1 / m).toPrecision(2)).toLocaleString('en-US') : 'a lot');
/* A total as written, the way unitText shows it. */
const shownNum = (unit, v) => (unit === 'coins' && v > 0 && v < 10 ? (v < .0095 ? 'almost' : priceNum(v)) : unit === 'dmg' ? fmtDmg(v) : fmt(v));
/* The factors as written, so that the start times them gives the total as written (a level 6 tower read
   "36 × 1.3 × 1.3 = 59", owner review 2026-11-18). Each factor is its value rounded to 1 or 2 decimals, or 2 or 3 if
   needed, and at 3 decimals up or down, whichever makes the product read right. Returns one number per row (null for a starting value). */
export function mulShown(ex) {
  const want = shownNum(ex.unit, ex.value), idx = ex.rows.map((r, i) => (r.base === undefined ? i : -1)).filter(i => i >= 0);
  const read = vals => shownNum(ex.unit, ex.rows.reduce((v, r, i) => (r.base !== undefined ? r.base : v * vals[i]), 1));
  let first = null;
  for (const digits of [undefined, 2, 3]) {
    const near = [], other = [];
    for (const [i, r] of ex.rows.entries()) {
      if (r.base !== undefined) { near[i] = other[i] = null; continue; }
      const k = 10 ** places(r.mul, digits), lo = Math.floor(r.mul * k) / k, hi = Math.ceil(r.mul * k) / k, n = Math.round(r.mul * k) / k;
      near[i] = shownMul(n, r.mul); other[i] = shownMul(n === lo ? hi : lo, r.mul);
    }
    if (!first) first = near;
    // nearest first at 1-2, then 2, then 3 decimals; only at 3 decimals may a factor round the other way
    for (let mask = 0; mask < (digits === 3 ? 1 << Math.min(idx.length, 6) : 1); mask++) {
      const vals = near.map((v, i) => { const j = idx.indexOf(i); return j >= 0 && mask >> j & 1 ? other[i] : v; });
      if (read(vals) === want) return vals;
    }
  }
  return first;
}

/* The breakdown box: one row per part, then the total. */
export function explainBox(ex, { extra = {}, total = 'Total' } = {}) {
  const box = el('div', 'explain why');
  const row = (a, b, cls) => { const r = el('div', cls); r.append(el('span', null, a), el('b', null, b)); box.append(r); };
  const vals = ex.unit === 'reach' || ex.unit === 'shots' ? null : mulShown(ex);
  // a price that reads "almost 0 coins": a factor under 0.01 reads "÷ 2,000" with it
  const almost = ex.unit === 'coins' && shownNum('coins', ex.value) === 'almost';
  for (const [i, r] of ex.rows.entries()) row(r.label, r.base !== undefined ? unitText(ex.unit, r.base, extra) : almost && r.mul < .01 ? divText(r.mul) : vals ? mulWord(vals[i]) : mulText(r.mul));
  if (total && (ex.rows.length > 1 || ex.unit === 'reach')) row(total, unitText(ex.unit, ex.value, extra), 'total'); // total null: the price bar above says it
  return box;
}

/* The Income sheet: coins a second by where they came from, then the bonuses already in those numbers.
   income() gives explainIncome over the same few seconds as the number at the top. */
export function incomeSheet(income) {
  return body => {
    const parts = el('div', 'explain why'), bonus = el('div', 'explain why'), bsec = el('div', 'sec');
    bsec.append(el('h3', null, 'Bonuses included'), bonus); // review of 2026.11.19-10: Deeds × 1.5 under the total read as not yet added
    body.append(parts, bsec);
    let sig = '';
    const paint = () => {
      // the rows add up to the total as written (review of 2026.11.19-5: 4.7 + 0.6 + 0.0 under +5.4/s)
      const ex = income(), sp = splitLive(ex.value, ex.rows.map(r => r.value));
      const rows = ex.rows.map((r, i) => [r.label, sp.rows[i]]).filter(r => r[1]).map(([l, v]) => [l, (v === LITTLE ? v : '+' + v + '/s')]);
      if (!rows.length) rows.push(['No coins in the last few seconds', '']);
      else rows.push(['Total', '+' + sp.total + '/s', 'total']);
      const b = ex.bonuses.map(r => [r.label + (r.on === 'sales' ? ' on sales' : r.on === 'raiders' ? ' on raiders' : ''), mulText(r.mul)]);
      const s = JSON.stringify([rows, b]);
      if (s === sig) return; sig = s;
      const fill = (box, list) => box.replaceChildren(...list.map(([a, v, cls]) => { const r = el('div', cls); r.append(el('span', null, a), el('b', null, v)); return r; }));
      fill(parts, rows); fill(bonus, b); bsec.hidden = !b.length;
    };
    paint();
    // painted whenever the top bar writes a new number (it keeps the object until then), so the two always agree
    // (review of 2026.11.19-5: the sheet painted every 0.5 s and the bar every 0.2 s, +28/s beside +25/s)
    let last = income();
    const tick = () => { const ex = income(); if (ex === last) return; last = ex; paint(); };
    tick.sync = tick; // in the frame the top bar writes its number (review of 2026.11.19-7: +5.3/s beside +5.2/s)
    return tick;
  };
}

/* Hits mended for each wave beaten: whole hits, or a half as 2½ (words read of 2026.11.23-11: "+2.5 hits" matched
   nothing on the heart, which counts whole hits). */
export const mendText = n => { const w = Math.floor(n + 1e-9), half = Math.abs(n - w - .5) < .05; return (half ? w + '½' : String(Math.round(n))) + (n === 1 ? ' hit' : ' hits'); };
/* The Vault sheet (a stockpile's too): its strength and what adds to it, the hits left, and what each raider takes. */
export function vaultSheet(town) {
  return body => {
    const top = el('div'), each = el('div', 'explain why'), sec = el('div', 'sec');
    sec.append(el('h3', null, 'Each raider that gets in'), each);
    body.append(top, sec);
    let sig = '';
    const paint = () => {
      const ex = explainVault(town), s = JSON.stringify([ex.rows, ex.value, ex.left]);
      if (s === sig) return; sig = s;
      const box = explainBox(ex, { total: 'Full strength' }), left = el('div', 'total');
      const hits = el('b', 'hitsleft'); hits.append(heart(), el('span', null, unitText('hits', ex.left))); // the wave bar's heart (review of 2026.11.20-15: nothing tied it to the vault)
      left.append(el('span', null, 'Hits left'), hits);
      const mend = el('div', 'total'); mend.append(el('span', null, 'Each wave you beat'), el('b', null, '+' + mendText(ex.mend)));
      box.append(left, mend); top.replaceChildren(box);
      each.replaceChildren(...ex.raiders.map(r => { const d = el('div'); d.append(el('span', null, r.label), el('b', null, unitText('hits', r.hits))); return d; }));
    };
    paint();
    let acc = 0;
    return dt => { if ((acc += dt) < .3) return; acc = 0; paint(); };
  };
}
