/* The raiders card: what the wave number on the play screen opens (owner, 2026-11-19: the next wave's raiders left
   the wave bar, which keeps one width). During a break it says when the next wave comes, whether it is a boss wave and
   which raiders can ride in it. During a wave it counts the raiders still to come or on the road, by kind. */
import { FOES, WAVE_TYPES } from '../data/foes.js'; // WAVE_TYPES: which raiders a wave can bring
import { bossWave, wavesOf } from '../core/defense.js';

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const plural = (n, name) => n + ' ' + (n === 1 ? name : name.endsWith('s') ? name : name + 's');

/* The wave bar's timer: what the next wave waits for, in a box of fixed width. */
export const waveTimer = ws => (ws.phase !== 'break' ? 'Fighting' : ws.hold ? 'On hold' : 'in ' + Math.ceil(ws.timer) + 's');

/* The card's lines, in plain words (pure, for the tests). */
export function waveLines(town) {
  const ws = town.waves, w = town.wave, boss = (town.def && town.def.boss) || 'wagon', lines = [];
  if (ws.phase !== 'break') {
    const n = {};
    for (const k of ws.queue) n[k] = (n[k] || 0) + 1;
    for (const f of ws.foes) n[f.kind] = (n[f.kind] || 0) + 1;
    const left = Object.values(n).reduce((a, b) => a + b, 0);
    const kinds = Object.entries(n).sort((a, b) => b[1] - a[1]);
    if (kinds.length === 1) { lines.push(plural(left, FOES[kinds[0][0]].name) + ' left.'); return lines; } // one kind: no list beside it
    lines.push(plural(left, 'raider') + ' left.');
    for (const [k, c] of kinds) lines.push(plural(c, FOES[k].name));
    return lines;
  }
  lines.push(ws.hold ? 'On hold. It comes when you tap Resume waves.' : 'It comes in ' + Math.ceil(ws.timer) + ' seconds.');
  if (bossWave(town, w)) lines.push('A boss wave. The ' + FOES[boss].name.toLowerCase() + ' comes last. Stop it to pass.');
  const kinds = new Set();
  for (const [t, T] of Object.entries(WAVE_TYPES)) if (w >= T.from && (t === 'mixed' || w >= 4)) for (const k of Object.keys(T.mix)) if (w >= FOES[k].from) kinds.add(k);
  if (!kinds.size) kinds.add('raider');
  if (wavesOf(town).boatEvery && town.def.board && town.def.board.river) kinds.add('boat');
  lines.push('Can bring ' + [...kinds].map(k => FOES[k].name + 's').join(', ').replace(/, ([^,]*)$/, ' and $1') + '.');
  return lines;
}

/* The sheet body: the lines, kept up while it is open. */
export function waveSheet(town) {
  return body => {
    const box = el('div', 'goods'); body.append(box);
    let sig = '';
    const paint = () => {
      const lines = waveLines(town), s = lines.join('|');
      if (s === sig) return;
      sig = s; box.replaceChildren(...lines.map((t, i) => el('p', i ? 'uses' : 'note', t)));
    };
    paint();
    let acc = 0;
    return dt => { if ((acc += dt) < .25) return; acc = 0; paint(); };
  };
}
