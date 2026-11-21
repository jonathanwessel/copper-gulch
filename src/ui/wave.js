/* The raiders card: what the wave number on the play screen opens (owner, 2026-11-19: the next wave's raiders left
   the wave bar, which keeps one width). During a break it says when the next wave comes, whether it is a boss wave and
   which raiders can ride in it. During a wave it counts the raiders still to come or on the road, by kind. Each kind
   has its picture and the tower that hits it hardest (review of 2026.11.19-14). */
import { FOES, WAVE_TYPES } from '../data/foes.js'; // WAVE_TYPES: which raiders a wave can bring
import { TOWERS } from '../data/towers.js';
import { bossWave, wavesOf, towerOpen } from '../core/defense.js';
import { drawFoe } from '../art/foes.js';

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
// a kind's plural: its own (Horsemen), or the name with an s (review of 2026.11.20-6: "Riders" read as "raiders")
const many = name => { const f = Object.values(FOES).find(x => x.name === name); return (f && f.many) || (name.endsWith('s') ? name : name + 's'); };
const plural = (n, name) => n + ' ' + (n === 1 ? name : many(name));

/* The wave bar's name for the waves: the wave number, or Raids at a won outpost, whose light raids never climb
   (owner, 2026-11-20: "Does Dry Creek waves keep going?"). */
export const waveTitle = town => (town.won ? 'Raids' : 'Wave ' + town.wave);
/* The wave bar's timer: what the next wave waits for, in a box of fixed width. */
export const waveTimer = ws => (ws.phase !== 'break' ? 'Fighting' : ws.hold ? 'On hold' : ws.timer > 99 ? 'in ' + Math.ceil(ws.timer / 60) + 'm' : 'in ' + Math.ceil(ws.timer) + 's'); // "in 2m" past 99 seconds, never three digits (review of 2026.11.20-14: "in 120s")

/* The tower open in this town that hits a raider kind hardest (its best factor), or null when none does. */
export function bestTower(town, kind) {
  const f = FOES[kind]; if (!f) return null;
  let best = null, top = 1;
  for (const [k, T] of Object.entries(TOWERS)) {
    if (!T.best || !towerOpen(town, k)) continue;
    const m = Math.max(T.best[kind] || 1, f.armor > 0 ? T.best.armored || 1 : 1, f.boss ? T.best.boss || 1 : 1);
    if (m > top) { top = m; best = k; }
  }
  return best;
}

/* A raider row's tower line: the best tower, or Any when no tower hits it harder (review of 2026.11.20-3: the Bandit
   row looked empty). */
export const bestLine = (town, kind) => { const b = bestTower(town, kind); return b ? TOWERS[b].name + ' works best.' : 'Any tower works.'; }; // a sentence, no dot where a colon would go (review of 2026.11.20-5)

/* What the card shows (pure, for the tests): its lines, and the raider kinds as rows, with how many are left during a
   wave (n) or null during a break. */
export function waveInfo(town) {
  const ws = town.waves, w = town.wave, boss = (town.def && town.def.boss) || 'wagon', lines = [];
  if (ws.phase !== 'break') {
    const n = {};
    for (const k of ws.queue) n[k] = (n[k] || 0) + 1;
    for (const f of ws.foes) n[f.kind] = (n[f.kind] || 0) + 1;
    const left = Object.values(n).reduce((a, b) => a + b, 0);
    const kinds = Object.entries(n).sort((a, b) => b[1] - a[1]);
    if (kinds.length === 1) return { lines: [plural(left, FOES[kinds[0][0]].name).toLowerCase() + ' left.'], kinds: [{ kind: kinds[0][0], n: null }] }; // one kind: the line says how many
    lines.push(plural(left, 'raider') + ' left.');
    return { lines, kinds: kinds.map(([kind, c]) => ({ kind, n: c })) };
  }
  if (town.won) lines.push('Won. Light raids keep coming and your towers hold them.');
  lines.push(ws.hold ? 'On hold. It comes when you tap Resume waves.' : (town.won ? 'The next raid comes in ' : 'It comes in ') + Math.ceil(ws.timer) + ' seconds.');
  if (bossWave(town, w)) lines.push('A boss wave. The ' + FOES[boss].name.toLowerCase() + ' comes last. Stop it to pass.');
  const kinds = new Set();
  for (const [t, T] of Object.entries(WAVE_TYPES)) if (w >= T.from && (t === 'mixed' || w >= 4)) for (const k of Object.keys(T.mix)) if (w >= FOES[k].from) kinds.add(k);
  if (!kinds.size) kinds.add('raider');
  if (wavesOf(town).boatEvery && town.def.board && town.def.board.river) kinds.add('boat');
  if (bossWave(town, w)) kinds.add(boss);
  return { lines, kinds: [...kinds].map(kind => ({ kind, n: null })), can: true };
}

/* The card's lines as text (pure, for the tests and the audit). */
export function waveLines(town) {
  const { lines, kinds, can } = waveInfo(town);
  if (can) return [...lines, 'Can bring ' + kinds.filter(k => !FOES[k.kind].boss).map(k => many(FOES[k.kind].name)).join(', ').replace(/, ([^,]*)$/, ' and $1') + '.'];
  return [...lines, ...kinds.filter(k => k.n !== null).map(k => plural(k.n, FOES[k.kind].name))];
}

/* The sheet body: the lines and one row per raider kind, kept up while it is open. */
export function waveSheet(town) {
  return body => {
    const box = el('div', 'goods foes'); body.append(box);
    let sig = '';
    const paint = () => {
      const { lines, kinds, can } = waveInfo(town), s = lines.join('|') + JSON.stringify(kinds);
      if (s === sig) return;
      sig = s;
      const out = lines.map((t, i) => el('p', i ? 'uses' : 'note', t));
      if (can) out.push(el('h3', '', 'Can bring'));
      for (const { kind, n } of kinds) {
        const row = el('div', 'option foe'), pic = drawFoe(kind), txt = el('div');
        pic.className = 'foepic'; row.dataset.foe = kind;
        txt.append(el('b', null, n === null ? FOES[kind].name : plural(n, FOES[kind].name)));
        txt.append(el('span', 'uses', bestLine(town, kind)));
        row.append(pic, txt); out.push(row);
      }
      box.replaceChildren(...out);
    };
    paint();
    let acc = 0;
    return dt => { if ((acc += dt) < .25) return; acc = 0; paint(); };
  };
}
