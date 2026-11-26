/* Tap a number, see where it comes from (owner rule: every number explains itself). Draws what src/core/explain.js
   works out: the starting value, one row per level, path, market or bonus, and the total. Also the Income sheet
   (tap the coins) and the Vault sheet (tap the wave and vault bar).
   Words follow the writing rule: plain labels, units a player knows, no colons. */
import { heart } from './heart.js';
import { fmt, fmtDmg, fmtPrice, fmtLive, priceNum, splitLive, rateWords, HITS_LEFT } from './format.js';
import { explainVault } from '../core/explain.js';

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

/* Reach in words a player can compare (the circles on the map show the rest). */
export const reachWord = (range, minRange = 0) => (minRange ? 'Long, not up close' : range < 2.3 ? 'Short' : range < 3.2 ? 'Medium' : 'Long');
/* Blast in words, Small or Wide (the circles on the map show the rest). */
export const blastWord = r => (r < 1.2 ? 'Small' : 'Wide');
/* Shots in one form for every tower, whole shots a minute: "84 a minute", "30 a minute" (clarity fix 8j: "1.4 a second"
   beside "One every 2 seconds" were two forms for one stat, so two towers could not be compared at a glance). */
export const shotsWord = r => Math.max(1, Math.round(r * 60)) + ' a minute';

/* A working foreman that is not buying, beside its "Foreman · On" switch: what it is doing and why, as a status, not a
   story (review of 2026.11.19-9: "The foreman waits. Timber sells low..." read as a narrator). */
/* It says when the foreman buys again, what it does, not its reasons (review of 2026.11.19-11: "Timber sells low and no
   workshop needs more" read as narrator reasoning beside a cheap upgrade). */
/* down: how far the price is down now, "99%", so a card that shows no price still says the one the foreman waits on
   (clarity fix 8k: "Foreman paused while the timber price is down." on a card with no price). */
export function foremanLine(why, good, down = '') {
  /* a status, as short as a sign (review of 2026.11.20-2: "buys the next level once timber sells for more" beside 1M coins and a 41-coin level read odd) */
  if (why === 'short') return 'Waiting for more ' + good + '.';
  if (why === 'flooded') return 'Foreman paused while the ' + good + ' price is down' + (down ? ' ' + down : '') + '.'; // up and down, the price's words everywhere (clarity fix 8i)
  // what it waits for (review of 2026.11.20-8) // review of 2026.11.20-4: "a better price" beside a good kept for towers
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
    // nearest first at 1-2, then 2, then 3 decimals; at 2 or 3 a factor may round the other way, so a level row reads
    // "× 2.94", never "× 2.932" (review of 2026.11.23-9; with this no tower breakdown needs 3 decimals)
    for (let mask = 0; mask < (digits ? 1 << Math.min(idx.length, 6) : 1); mask++) {
      const vals = near.map((v, i) => { const j = idx.indexOf(i); return j >= 0 && mask >> j & 1 ? other[i] : v; });
      if (read(vals) === want) return vals;
    }
  }
  return first;
}

/* The breakdown box: one row per part, then the total. */
/* A factor on a price as how far it moves it, "Down 34%" or "Up 15%" (clarity fix 8a: "Sold a lot lately × 0.66" was a
   bare number beside the row's "Down 34%"). Never 0%, and a drop stops at 99%. */
export const pctWord = m => (m >= 1 ? 'Up ' + Math.max(1, Math.round((m - 1) * 100)) : 'Down ' + Math.min(99, Math.max(1, Math.round((1 - m) * 100)))) + '%';
/* A bonus as how much it adds, "50% more" or "10% less" (clarity fix 8b: "Deeds × 1.5" in the Income bonuses was a bare
   factor, the same fix as the Goods rows' "Down 34%"). */
export const moreWord = m => (m >= 1 ? Math.max(1, Math.round((m - 1) * 100)) + '% more' : Math.min(99, Math.max(1, Math.round((1 - m) * 100))) + '% less');
/* Clarity fix 8j: a why row says what it adds, as the Vault sheet does, never a bare factor ("Level 6 × 2.94", "Wave 4
   × 3" and "Level 10 and 25 bonuses × 4" in the fresh-eyes read of 2026.11.25-8). Each row's amount is the running total
   as written less the one before, so the start and the rows add up to the total as written. A reach, shots or blast
   row says it in words ("25% more"), since its total is a word. A row too small to write reads as words too. */
const stepOf = (unit, v) => {
  const a = Math.abs(v);
  if (unit === 'dmg' && a >= 10 && a < 999.5) return 1;
  if (a < 1) return .01;
  if (a < 10) return .1;
  if (a < 1000) return 1;
  const i = Math.floor(Math.log10(a) / 3), w = a / 10 ** (i * 3);
  return 10 ** (i * 3) * (w < 10 ? .01 : w < 100 ? .1 : 1);
};
const WORD_UNITS = ['reach', 'shots', 'blast'];
/* A number as its row writes it, and that string as a number (null for "1.2K"). */
const shownOf = (unit, v) => (unit === 'dmg' ? fmtDmg(v) : unit === 'rate' ? fmtLive(v) : fmt(v));
const numOf = s => (/^\d+(\.\d+)?$/.test(s) ? +s : null);
const decimalsOf = s => (s.includes('.') ? s.split('.')[1].length : 0);
export function addsShown(ex) {
  if (WORD_UNITS.includes(ex.unit)) return ex.rows.map(r => (r.base !== undefined ? null : moreWord(r.mul)));
  const totalS = shownOf(ex.unit, ex.value), T = numOf(totalS);
  const bases = ex.rows.filter(r => r.base !== undefined).map(r => shownOf(ex.unit, r.base));
  // under 1,000 the rows keep the finest decimals the start or the total shows, so the sum is exact
  const dec = T === null ? 0 : Math.max(decimalsOf(totalS), ...bases.map(decimalsOf));
  const step = T === null ? stepOf(ex.unit, ex.value) : 10 ** -dec, q = v => Math.round(v / step) * step;
  const last = ex.rows.map(r => r.base === undefined).lastIndexOf(true);
  let v = 1, prev = 0;
  return ex.rows.map((r, i) => {
    if (r.base !== undefined) { v = r.base; const s = shownOf(ex.unit, r.base); prev = numOf(s) ?? r.base; return null; }
    v *= r.mul;
    const now = i === last ? (T ?? q(ex.value)) : q(v), d = now - prev;
    prev = now;
    const amount = Math.abs(d), shown = T === null ? fmt(amount) : String(+amount.toFixed(dec));
    if (shown === '0') return moreWord(r.mul);
    return (d < 0 ? '-' : '+') + shown + (ex.unit === 'rate' ? '/s' : '');
  });
}
/* A rate in a card reads in words, rows and total alike (clarity fix 8m: "+78/s" rows over "40 timber a second" on one
   card); the top bar keeps "/s". */
export const cardRate = s => s.replace(/[/]s$/, ' a second');
export function explainBox(ex, { extra = {}, total = 'Total', pct = false } = {}) {
  const box = el('div', 'explain why');
  if (ex.unit === 'rate') return rateBox(box, ex, total);
  // the old-waves row's label is the wave bar's gold wave number (review of 2026.11.23-9)
  const row = (a, b, cls, old) => { const r = el('div', cls); r.append(el('span', old ? 'oldwave' : null, a), el('b', null, b)); box.append(r); };
  const adds = pct ? null : addsShown(ex);
  for (const [i, r] of ex.rows.entries()) row(r.label, r.base !== undefined ? unitText(ex.unit, r.base, extra) : pct ? pctWord(r.mul) : adds[i], null, r.old);
  if (total && (ex.rows.length > 1 || ex.unit === 'reach')) row(total, unitText(ex.unit, ex.value, extra), 'total'); // total null: the price bar above says it
  return box;
}

function rateBox(box, ex, total) {
  const adds = addsShown(ex), row = (a, b, cls) => { const r = el('div', cls); r.append(el('span', null, a), el('b', null, b)); box.append(r); };
  for (const [i, r] of ex.rows.entries()) row(r.label, cardRate(r.base !== undefined ? unitText('rate', r.base) : adds[i]));
  if (total && ex.rows.length > 1) row(total, cardRate(unitText('rate', ex.value)), 'total');
  return box;
}
/* The Income sheet's rows in one form (clarity fix 8m: "a second" rows beside "2 a minute" ones on one card). Rows big
   enough for the total's last digit read "N a second" and add up to it; the ones too small for that are named on one
   line under the total, with no number ("Also a few coins from Dry Creek."). */
export function incomeRows(ex) {
  const sp = splitLive(ex.value, ex.rows.map(r => r.value)), rows = [], small = [];
  ex.rows.forEach((r, i) => { if (!sp.rows[i]) return; if (sp.under[i]) small.push(r.label); else rows.push([r.label, rateWords(sp.rows[i])]); });
  const also = small.length ? 'Also a few coins from ' + (small.length > 1 ? small.slice(0, -1).join(', ') + ' and ' + small[small.length - 1] : small[0]).replace(/^Selling/, 'selling') + '.' : '';
  return { rows, total: rows.length || small.length ? rateWords(sp.total) : '', also };
}
/* The Income sheet: coins a second by where they came from, then the bonuses already in those numbers.
   income() gives explainIncome over the same minute as the number at the top (clarity fix 10). */
export function incomeSheet(income) {
  return body => {
    const parts = el('div', 'explain why'), bonus = el('div', 'explain why'), bsec = el('div', 'sec'), also = el('p', 'uses');
    bsec.append(el('h3', null, 'Bonuses included'), bonus); // review of 2026.11.19-10: Deeds × 1.5 under the total read as not yet added
    body.append(parts, also, bsec);
    let sig = '';
    const paint = () => {
      // the rows add up to the total as written (review of 2026.11.19-5: 4.7 + 0.6 + 0.0 under +5.4/s)
      const ex = income(), ir = incomeRows(ex), rows = ir.rows.slice(); // in words in a card (clarity fix 8a), the top bar keeps /s
      if (!ir.total) rows.push(['No coins in the last minute', '']);
      else rows.push(['Total', ir.total, 'total']);
      const b = ex.bonuses.map(r => [r.label + (r.on === 'sales' ? ' on sales' : r.on === 'raiders' ? ' on raiders' : ''), moreWord(r.mul)]);
      const s = JSON.stringify([rows, b, ir.also]);
      if (s === sig) return; sig = s;
      const fill = (box, list) => box.replaceChildren(...list.map(([a, v, cls]) => { const r = el('div', cls); r.append(el('span', null, a), el('b', null, v)); return r; }));
      fill(parts, rows); fill(bonus, b); bsec.hidden = !b.length; also.textContent = ir.also; also.hidden = !ir.also;
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
/* The Hits left row: Full when the Can take row above already says the number (clarity fix 8e: "Can take 25 hits" right
   above "Hits left 25 hits"), otherwise the hits left. */
export const hitsLeftWords = ex => (ex.rows.length > 1 && ex.left >= ex.value - 1e-9 ? 'Full' : String(Math.max(0, Math.ceil(ex.left - 1e-9)))); // the count alone under Hits left (clarity fix 8m)
/* What a beaten wave does to the vault, on the Vault sheet and in its tip card (clarity fix 8g). */
export const mendLine = town => 'Each wave you beat mends the ' + ((town.def && town.def.store) || 'vault') + ' a little.';
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
      // each bonus as the hits it adds, so nothing is left to multiply (review of 2026.11.23-11: "War Office × 1.25"
      // was a sum for the player to work out), then the most it holds
      const box = el('div', 'explain why'), left = el('div', 'total');
      const add = (a, v, cls) => { const r = el('div', cls); r.append(el('span', null, a), el('b', null, v)); box.append(r); };
      let v = 0;
      for (const r of ex.rows) {
        if (r.base !== undefined) { v = r.base; add(r.label, unitText('hits', r.base)); continue; }
        const d = v * (r.mul - 1); v += d;
        add(r.label, (d < 0 ? '-' : '+') + mendText(Math.abs(d)));
      }
      // the map card's own words for it (review of 2026.11.23-13: "Most hits" beside the map's "Vault can take")
      if (ex.rows.length > 1) add('Can take', unitText('hits', ex.value), 'total'); // CAN_TAKE in src/ui/map.js (clarity fix 8d)
      const hits = el('b', 'hitsleft');
      hits.append(heart(), el('span', null, hitsLeftWords(ex))); // the wave bar's heart (review of 2026.11.20-15: nothing tied it to the vault)
      left.append(el('span', null, HITS_LEFT), hits);
      // the mend in words, not a number: "+2½ hits" beside a heart that counts whole hits was flagged twice (fresh-eyes
      // reads of 2026.11.25-6 and -7), and whole mends tipped two bot gates (GDD.md, Vault), so the control changed
      box.append(left); top.replaceChildren(box, el('p', 'uses mendline', mendLine(town)));
      each.replaceChildren(...ex.raiders.map(r => { const d = el('div'); d.append(el('span', null, r.label), el('b', null, unitText('hits', r.hits))); return d; }));
    };
    paint();
    let acc = 0;
    return dt => { if ((acc += dt) < .3) return; acc = 0; paint(); };
  };
}
