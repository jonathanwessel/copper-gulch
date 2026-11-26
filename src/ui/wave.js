/* The raiders card: what the wave number on the play screen opens (owner, 2026-11-19: the next wave's raiders left
   the wave bar, which keeps one width). During a break it says when the next wave comes, whether it is a boss wave and
   which raiders can ride in it. During a wave it counts the raiders still to come or on the road, by kind. Each kind
   has its picture and the tower that hits it hardest (review of 2026.11.19-14). */
import { FOES, WAVE_TYPES } from '../data/foes.js'; // WAVE_TYPES: which raiders a wave can bring
import { TOWERS } from '../data/towers.js';
import { bossWave, wavesOf, towerOpen } from '../core/defense.js';
import { drawFoe } from '../art/foes.js';
import { WON_LINE, clock } from './state.js';

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
// a kind's plural: its own (Horsemen), or the name with an s (review of 2026.11.20-6: "Riders" read as "raiders")
const many = name => { const f = Object.values(FOES).find(x => x.name === name); return (f && f.many) || (name.endsWith('s') ? name : name + 's'); };
const plural = (n, name) => n + ' ' + (n === 1 ? name : many(name));

/* The wave bar's name for the waves: the wave number, or Raids at a won outpost, whose light raids never climb
   (owner, 2026-11-20: "Does Dry Creek waves keep going?"). */
export const waveTitle = town => (town.won ? 'Raids' : 'Wave ' + town.wave);
/* The wave bar's timer: what the next wave waits for, in a box of fixed width. */
/* The wave bar's word and the hold button come from one state, so the bar never says Fighting beside Resume waves
   (owner, 2026-11-22): while waves are held the bar says On hold, even with raiders still on the road, and Resume
   waves shows only then. */
/* call: Call now shows only in a break that is not held, so a held town shows one control, Resume waves (review of
   2026.11.23-7: Call now beside Resume waves). It keeps its place while hidden, so the bar keeps one width. */
export const waveBar = ws => ({ hold: !!ws.hold, word: waveTimer(ws), button: ws.hold ? 'Resume waves' : 'Hold waves', call: !ws.hold && ws.phase === 'break' });
/* A running countdown reads as a clock on every screen, "in 1:57" here as "Raid in 1:57" on the map (clarity fix 8j:
   "in 2m", "in 28s" and "Raid in 1:57" were three forms for one timer). */
export const waveTimer = ws => (ws.hold ? 'On hold' : ws.phase !== 'break' ? 'Fighting' : 'in ' + clock(ws.timer));

/* The tower open in this town that hits a raider kind hardest (its best factor), or null when none does. */
export function bestTower(town, kind) {
  const f = FOES[kind]; if (!f) return null;
  // a tower the player has here comes first, then one they can build (clarity fix 8k: the boss card said "Weak to Snake
  // Oil Still" in a town with none, beside the Cannons that also hit it harder)
  let best = null, top = 1, own = null, ownTop = 1;
  const has = new Set((town.towers || []).map(t => t.kind));
  for (const [k, T] of Object.entries(TOWERS)) {
    if (!T.best || !towerOpen(town, k)) continue;
    const m = Math.max(T.best[kind] || 1, f.armor > 0 ? T.best.armored || 1 : 1, f.boss ? T.best.boss || 1 : 1);
    if (m > top) { top = m; best = k; }
    if (has.has(k) && m > ownTop) { ownTop = m; own = k; }
  }
  return own || best;
}

/* A raider row's tower line: the tower that hits it hardest under a small label, or Any when no tower hits it harder
   (review of 2026.11.20-3: the Bandit row looked empty). A label, not a sentence (review of 2026.11.22-12: "Snake Oil
   Still works best" read as "still works best", and as advice). */
/* Clarity fix 8d: "Best tower" was flagged a fourth time (built against, or hitting it now?), so the row says a fact
   about the raider, the tower that does it extra damage, not a pick of towers (review of 2026.11.22-13: "Hits it
   hardest" could read as what the raider hits). */
export const BEST_LABEL = 'Weak to';
/* tower null when no tower hits it harder, and then the row is left out (review of 2026.11.23-7: "Best tower · Any" was
   flagged both as an empty row in 2026.11.20-3 and as filler, so by the twice-flagged rule it goes). */
export const bestView = (town, kind) => { const b = bestTower(town, kind); return { label: BEST_LABEL, tower: b ? TOWERS[b].name : null }; };
export const bestLine = (town, kind) => { const v = bestView(town, kind); return v.tower ? v.label + ' · ' + v.tower : ''; };

/* The raiders card's lead line during a wave: how many are on the road and how many are still to come out. */
// all out: a count like the other two forms (clarity fix 8k: "All of them are on the road." above "1 Bandit")
export const roadLine = (road, queued) => (!queued ? road + ' on the road. No more to come.' : !road ? queued + ' still to come, none on the road yet.' : road + ' on the road, ' + queued + ' still to come.');

/* What the card shows (pure, for the tests): its lines, and the raider kinds as rows, with how many are left during a
   wave (n) or null during a break. */
export function waveInfo(town) {
  const ws = town.waves, w = town.wave, boss = (town.def && town.def.boss) || 'wagon', lines = [];
  if (ws.phase !== 'break') {
    const n = {};
    for (const k of ws.queue) n[k] = (n[k] || 0) + 1;
    for (const f of ws.foes) n[f.kind] = (n[f.kind] || 0) + 1;
    const kinds = Object.entries(n).sort((a, b) => b[1] - a[1]);
    // one lead line in every case, and never a count a row already says: how many are on the road and how many are
    // still to come (clarity fix 8h: "3 raiders left." led a card with more kinds, while one kind had no line at all;
    // 8e had dropped the total there since it said its one row's count twice)
    lines.push(roadLine(ws.foes.length, ws.queue.length));
    return { lines, kinds: kinds.map(([kind, c]) => ({ kind, n: c })) };
  }
  if (town.won) lines.push(WON_LINE); // the map card's words (state.js)
  lines.push(ws.hold ? 'On hold. It comes when you tap Resume waves.' : (town.won ? 'The next raid comes in ' : 'It comes in ') + clock(ws.timer) + '.'); // the bar's clock (clarity fix 8j)
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
        const bv = bestView(town, kind), line = el('span', 'uses');
        if (bv.tower) { line.append(el('span', 'flabel', bv.label + ' '), el('b', 'besttower', bv.tower)); txt.append(line); }
        row.append(pic, txt); out.push(row);
      }
      box.replaceChildren(...out);
    };
    paint();
    let acc = 0;
    return dt => { if ((acc += dt) < .25) return; acc = 0; paint(); };
  };
}
