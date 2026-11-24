// node tools/broke-probe.js [--seeds 6] [--minutes 60] [--seed N]: clarity fix 4 (PLAN.md M6a, review 3). The newcomer
// of tools/firstplay.js plays its first hour, and every second the probe reads the goal strip as the screen does: the
// coins its step needs (goalCoins), the purse, and the empire's income over the last minute (earnRate, the number the
// strip's "about 4 min to go" uses). A stretch where the strip asks for coins the purse lacks while nothing comes in is
// a goal the player cannot act on ("0 / 12" at +0/s in Dry Creek, review 2026.11.23). Prints each stretch over LIMIT
// seconds with its goal, and the longest per seed; the exit code follows the gate (none over LIMIT).
import { newcomer } from './firstplay.js';
import { brokeWatch, BROKE_LIMIT } from '../src/core/goals.js';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? +process.argv[i + 1] : d; };
const SEEDS = arg('seeds', 6), MIN = arg('minutes', 60), ONE = arg('seed', 0);
const mm = x => { const s = Math.round(x); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
let bad = 0;
for (const seed of ONE ? [ONE] : Array.from({ length: SEEDS }, (_, i) => i + 1)) {
  const w = brokeWatch();
  newcomer(seed, MIN, (g, at) => { w.step(g, at); return false; });
  const long = w.stretches.filter(s => s.len > BROKE_LIMIT);
  for (const s of long) console.log(`seed ${seed} ${mm(s.from)} ${Math.round(s.len)} s | ${s.town} | ${s.goal} | needs ${s.need}`);
  console.log(`seed ${seed}: longest ${Math.round(w.longest)} s with a coin goal and no income (limit ${BROKE_LIMIT})`);
  if (long.length) bad++;
}
process.exitCode = bad ? 1 : 0;
