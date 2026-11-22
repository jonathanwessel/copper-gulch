/* The raider card (owner, 2026-11-22: "Can I click on a mob to see the current buffs and debuffs? Like poison, frozen,
   shield strength?"). A tap on a raider opens it: the raider's picture and name, its health as a bar with have / most,
   its armor as a bar with what poison ate off it, each effect on it now with a mark, a word and the seconds left, the
   coins it pays and the tower that hits it hardest. It follows the raider live while the game runs, and when the raider
   falls or gets through it says so for a moment and closes. Every value comes from foeStatus (src/core/defense.js),
   which the bots count with too. Live numbers sit in cells of fixed width, so the card never twitches. */
import { FOES } from '../data/foes.js';
import { foeStatus } from '../core/defense.js';
import { bestLine } from './wave.js';
import { drawFoe } from '../art/foes.js';
import { fmt, fmtLive } from './format.js';

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

/* The word for each effect, in the order foeStatus lists them. */
export const EFFECT_WORDS = { frozen: 'Frozen', poison: 'Poisoned', rot: 'Rotting', spread: 'Spreads poison', fire: 'On fire', slow: 'Slowed', brittle: 'Brittle' };
const pct = x => Math.round(x * 100) + '%';
/* Seconds left, at most 3 characters ("4s", "12s"), or "No end" for an effect that lasts until the raider falls. */
export const fxLeft = s => (s === null || s === undefined ? 'No end' : Math.min(99, Math.max(1, Math.ceil(s - 1e-9))) + 's');
const coins = n => { const r = Math.max(1, Math.round(n)); return 'Worth ' + fmt(r) + (r === 1 ? ' coin.' : ' coins.'); };

/* What the card shows for one raider (pure, for the tests and the words check). store: what raiders ride for in this
   town ('vault' or 'stockpile'). */
export function foeView(town, f, store = 'vault') {
  const st = foeStatus(town, f), F = FOES[f.kind];
  return {
    name: F.name, boss: st.boss,
    health: { text: fmtLive(Math.ceil(st.hp - 1e-9)) + ' / ' + fmtLive(Math.ceil(st.max - 1e-9)), share: st.max > 0 ? Math.max(0, Math.min(1, st.hp / st.max)) : 0 },
    // the share of each hit it blocks now, and what it was before poison ate some, on its own row (review of
    // 2026.11.22-9: a sentence under the bar said the row's fact again)
    armor: st.armorFull > 0 ? { text: pct(st.armor) + (st.eaten > 0 ? ', was ' + pct(st.armorFull) : ''), share: st.armor, full: st.armorFull } : null,
    effects: st.effects.map(e => ({ key: e.key, word: EFFECT_WORDS[e.key], left: e.key === 'spread' ? '' : fxLeft(e.left) })),
    none: 'No effects.', // review of 2026.11.22-9: "Nothing on it now" read as a narrator
    worth: coins(st.worth), best: bestLine(town, f.kind),
    gone: st.gone === 'down' ? F.name + ' down!' : st.gone === 'through' ? 'It got to the ' + store + '.' : null,
  };
}

/* The lines of the card as text, for the words check (tools/audit.js reads cards through their text). */
export function foeLines(town, f, store) {
  const v = foeView(town, f, store), out = [v.name, 'Health', v.health.text];
  if (v.armor) out.push('Armor', v.armor.text);
  for (const e of v.effects) out.push(e.word, e.left);
  if (!v.effects.length) out.push(v.none);
  out.push(v.worth + ' ' + v.best);
  if (v.gone) out.push(v.gone);
  return out.filter(Boolean);
}

// each effect's mark, 7 by 7 pixels, drawn in its own color
const PIX = {
  frozen: ['#..#..#', '.#.#.#.', '..###..', '#######', '..###..', '.#.#.#.', '#..#..#'],
  poison: ['...#...', '..###..', '..###..', '.#####.', '.#####.', '.#####.', '..###..'],
  rot: ['.#####.', '#######', '#..#..#', '#######', '.##.##.', '.#####.', '.#.#.#.'],
  spread: ['##.....', '##..##.', '....##.', '.##....', '.##..##', '.....##', '.......'],
  fire: ['...#...', '..##...', '..###..', '.####..', '.#####.', '#######', '.#####.'],
  slow: ['#.....#', '.#...#.', '..#.#..', '...#...', '#.....#', '.#...#.', '..#.#..'],
  brittle: ['....#..', '...#...', '..##...', '...##..', '....#..', '...#...', '..#....'],
};
const PATHS = Object.fromEntries(Object.entries(PIX).map(([k, rows]) => [k, rows.map((row, y) => [...row].map((c, x) => (c === '#' ? `M${x} ${y}h1v1h-1z` : '')).join('')).join('')]));
function mark(key) {
  const i = document.createElement('i'); i.className = 'fxmark fx-' + key; i.setAttribute('aria-hidden', 'true');
  i.innerHTML = '<svg viewBox="0 0 7 7" shape-rendering="crispEdges"><path d="' + PATHS[key] + '"/></svg>';
  return i;
}
function barRow(label, cls) {
  const row = el('div', 'foestat ' + cls), bar = el('span', 'fbar'), fill = el('i'), ghost = el('u'), num = el('b');
  bar.append(ghost, fill); row.append(el('span', 'flabel', label), bar, num);
  return { row, fill, ghost, num };
}

/* Fill the card for raider f; returns { update() } that paints it again from the raider's live state and returns
   false once the card should close (a moment after the raider fell or got through). */
export function foeCard(card, town, f, { store = 'vault', onClose = () => {} } = {}) {
  card.replaceChildren();
  card.classList.add('foecard');
  const head = el('div', 'cardhead'), pic = drawFoe(f.kind), close = el('button', 'btn small close', 'Close');
  pic.className = 'foepic';
  const v0 = foeView(town, f, store);
  head.append(pic, el('h2', null, v0.name), close);
  close.addEventListener('click', onClose);
  const hp = barRow('Health', 'hp'), ar = v0.armor ? barRow('Armor', 'ar') : null;
  const fx = el('div', 'foefx'), worth = el('p', 'uses', v0.worth + ' ' + v0.best);
  card.append(head, hp.row);
  if (ar) card.append(ar.row);
  card.append(fx, worth);
  let sig = '', goneFor = 0, last = performance.now();
  const set = (n, s) => { if (n.textContent !== s) n.textContent = s; };
  const update = () => {
    const now = performance.now(), dt = (now - last) / 1000; last = now;
    const v = foeView(town, f, store);
    // gone: the card keeps how it last looked and says so where the coins line was, so nothing jumps or moves (review of
    // 2026.11.22-9: the armor bar rose back after the kill and the card grew by a line)
    if (v.gone) {
      set(hp.num, v.health.text); hp.fill.style.width = '0%';
      set(worth, v.gone); worth.className = 'note gone';
      card.classList.add('gonefoe');
      goneFor += Math.min(dt, .2); // a long gap between frames (a hidden page, a slow frame) never cuts the moment short
      return goneFor <= 1.6;
    }
    set(hp.num, v.health.text); hp.fill.style.width = (100 * v.health.share).toFixed(1) + '%';
    if (ar) {
      set(ar.num, v.armor.text); ar.fill.style.width = (100 * v.armor.share).toFixed(1) + '%'; ar.ghost.style.width = (100 * v.armor.full).toFixed(1) + '%';
    }
    // the effects are built again only when the set of them changes; the seconds are written in place
    const s = v.effects.map(e => e.key).join();
    if (s !== sig || !fx.firstChild) {
      sig = s;
      fx.replaceChildren(...(v.effects.length ? v.effects.map(e => { const c = el('span', 'fx'); c.dataset.fx = e.key; c.append(mark(e.key), el('span', 'fxword', e.word), el('b', 'fxleft', e.left)); return c; }) : [el('span', 'fxnone', v.none)]));
    } else for (const e of v.effects) { const n = fx.querySelector('[data-fx="' + e.key + '"] .fxleft'); if (n) set(n, e.left); }
    return true;
  };
  update();
  return { update, id: f.id };
}
