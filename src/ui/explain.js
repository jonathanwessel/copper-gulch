/* Tap a number, see where it comes from (owner rule: every number explains itself). Draws what src/core/explain.js
   works out: the starting value, one row per level, path, market or bonus, and the total. Also the Income sheet
   (tap the coins) and the Vault sheet (tap the wave and vault bar).
   Words follow the writing rule: plain labels, units a player knows, no colons. */
import { fmt } from './format.js';
import { explainVault } from '../core/explain.js';

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

/* Reach in words a player can compare (the circles on the map show the rest). */
export const reachWord = (range, minRange = 0) => (minRange ? 'Long, not up close' : range < 2.3 ? 'Short' : range < 3.2 ? 'Medium' : 'Long');
/* Shots in words: "1.3 a second", "One every 3 seconds". */
export const shotsWord = r => (r >= 1 ? fmt(r) + ' a second' : 'One every ' + Math.round(1 / r) + ' seconds');

/* A value in its unit. */
export function unitText(unit, v, extra = {}) {
  if (unit === 'rate') return fmt(v) + '/s';
  if (unit === 'coins') return fmt(v) + (Math.abs(v - 1) < .05 ? ' coin' : ' coins');
  if (unit === 'hits') return Math.round(v) + (Math.round(v) === 1 ? ' hit' : ' hits');
  if (unit === 'shots') return shotsWord(v);
  if (unit === 'reach') return reachWord(v, extra.minRange);
  return fmt(v);
}
/* A factor, written as one ("× 1.15", "× 3.7", "× 0.82"): the parts multiply, so they never read as if they add. */
export function mulText(m) {
  const r = m >= 2 ? Math.round(m * 10) / 10 : Math.round(m * 100) / 100;
  return '× ' + (r === 1 ? (m >= 1 ? 1.01 : .99) : r);
}

/* The breakdown box: one row per part, then the total. */
export function explainBox(ex, { extra = {}, total = 'Total' } = {}) {
  const box = el('div', 'explain why');
  const row = (a, b, cls) => { const r = el('div', cls); r.append(el('span', null, a), el('b', null, b)); box.append(r); };
  for (const r of ex.rows) row(r.label, r.base !== undefined ? unitText(ex.unit, r.base, extra) : mulText(r.mul));
  if (ex.rows.length > 1 || ex.unit === 'reach') row(total, unitText(ex.unit, ex.value, extra), 'total');
  return box;
}

/* The Income sheet: coins a second by where they came from, then the bonuses already in those numbers.
   income() gives explainIncome over the same few seconds as the number at the top. */
export function incomeSheet(income) {
  return body => {
    const parts = el('div', 'explain why'), bonus = el('div', 'explain why'), bsec = el('div', 'sec');
    bsec.append(el('h3', null, 'Bonuses'), bonus);
    body.append(parts, bsec);
    let sig = '';
    const paint = () => {
      const ex = income(), rows = ex.rows.map(r => [r.label, '+' + unitText('rate', r.value)]);
      if (!rows.length) rows.push(['No coins in the last few seconds', '']);
      else rows.push(['Total', '+' + unitText('rate', ex.value), 'total']);
      const b = ex.bonuses.map(r => [r.label + (r.on === 'sales' ? ' on sales' : r.on === 'raiders' ? ' on raiders' : ''), mulText(r.mul)]);
      const s = JSON.stringify([rows, b]);
      if (s === sig) return; sig = s;
      const fill = (box, list) => box.replaceChildren(...list.map(([a, v, cls]) => { const r = el('div', cls); r.append(el('span', null, a), el('b', null, v)); return r; }));
      fill(parts, rows); fill(bonus, b); bsec.hidden = !b.length;
    };
    paint();
    let acc = 0;
    return dt => { if ((acc += dt) < .5) return; acc = 0; paint(); };
  };
}

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
      left.append(el('span', null, 'Hits left'), el('b', null, unitText('hits', ex.left)));
      box.append(left); top.replaceChildren(box);
      each.replaceChildren(...ex.raiders.map(r => { const d = el('div'); d.append(el('span', null, r.label), el('b', null, unitText('hits', r.hits))); return d; }));
    };
    paint();
    let acc = 0;
    return dt => { if ((acc += dt) < .3) return; acc = 0; paint(); };
  };
}
