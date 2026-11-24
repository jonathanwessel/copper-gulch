// node tools/stall-probe.js [--seeds 6] [--minutes 330] [--seed N]: clarity fix 6 (PLAN.md M6a, review 6). The
// newcomer of tools/firstplay.js plays, and every second the probe reads each workshop it has built (a building with
// inputs): when it was built, when it first ran at half its rate or more (its real rate, town.ran), the share of the
// time it was stalled (stallOf, src/core/stall.js: the same measure the card, the Goods sheet and the strip use) and its
// longest stall with the good it waited for. A workshop built and making next to nothing for minutes is a chain the
// player was never told about ("Tools at 0 after the Toolsmith is built"). The exit code follows the gate: every
// workshop the newcomer builds runs at half its rate within FIRST_LIMIT seconds of being built, and no strip step for a
// stall stays up more than STEP_LIMIT seconds in a row (a step that never clears names the wrong building: before the
// held-for-towers case counted, "upgrade the Steel Mill" stayed up 3.7 hours while it climbed to level 21 behind a
// Blast Furnace at level 3).
import { newcomer } from './firstplay.js';
import { BUILDINGS } from '../src/data/buildings.js';
import { buildingsOf, output } from '../src/core/economy.js';
import { stallOf } from '../src/core/stall.js';
import { goalNow } from '../src/core/goals.js';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? +process.argv[i + 1] : d; };
const SEEDS = arg('seeds', 6), MIN = arg('minutes', 330), ONE = arg('seed', 0);
export const FIRST_LIMIT = 300, STEP_LIMIT = 600;
const mm = x => { const s = Math.round(x); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
let bad = 0;
for (const seed of ONE ? [ONE] : Array.from({ length: SEEDS }, (_, i) => i + 1)) {
  const w = {}, steps = {}, row = { text: null, from: 0, longest: 0, at: 0, which: null };
  newcomer(seed, MIN, (g, at) => {
    if (Math.round(at * 4) % 4) return false;
    const goal = goalNow(g);
    if (goal && goal.stall) steps[goal.text] = (steps[goal.text] || 0) + 1;
    const st = goal && goal.stall ? goal.text : null;
    if (st !== row.text) { row.text = st; row.from = at; }
    if (st && at - row.from > row.longest) { row.longest = at - row.from; row.at = row.from; row.which = st; }
    for (const t of Object.values(g.towns)) for (const id of buildingsOf(t)) {
      if (!Object.keys(BUILDINGS[id].inputs).length || !t.level(id)) continue;
      const k = t.id + ':' + id, r = w[k] ||= { built: at, first: null, run: null, longest: 0, longAt: 0, good: null, stalled: 0, seen: 0 };
      r.seen++;
      if (r.first === null && (t.ran[id] || 0) >= output(t, id) * .5) r.first = at;
      const s = stallOf(g, t, id);
      if (s) { r.stalled++; r.run ??= { from: at, good: s.good }; }
      else r.run = null;
      if (r.run && at - r.run.from > r.longest) { r.longest = at - r.run.from; r.longAt = r.run.from; r.good = r.run.good; }
    }
    return false;
  });
  for (const [k, r] of Object.entries(w)) {
    const wait = (r.first ?? MIN * 60) - r.built, over = wait > FIRST_LIMIT;
    if (over) bad++;
    console.log(`seed ${seed} ${k.padEnd(22)} built ${mm(r.built)} at half rate +${Math.round(wait)} s${over ? ' OVER' : ''} | stalled ${Math.round(100 * r.stalled / r.seen)}% | longest stall ${Math.round(r.longest)} s at ${mm(r.longAt)} on ${r.good || '-'}`);
  }
  for (const [t, n] of Object.entries(steps)) console.log(`seed ${seed} strip "${t}" ${n} s`);
  const long = row.longest > STEP_LIMIT;
  if (long) bad++;
  console.log(`seed ${seed}: longest stall step ${Math.round(row.longest)} s in a row${row.which ? ' at ' + mm(row.at) + ' "' + row.which + '"' : ''}${long ? ' OVER' : ''}`);
}
process.exitCode = bad ? 1 : 0;
