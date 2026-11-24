// node tools/quiet-probe.js [--seed 1] [--minutes 330]: the playthrough's quiet stretches on the core alone, no
// browser (clarity fix 3, PLAN.md M6a: no stretch over 10 minutes with nothing new after hour 1). Prints each quiet
// stretch of the newcomer's run (tools/playthrough.js record) with its length and the goal strip's words, and when the
// Capital opened. A stretch still going when the run stops says so: it may be far longer (clarity fix 3b part 2c: seed
// 5's "11 min" at the end of the window was a 36-minute wall), and AFTER=30 runs on longer after the Capital.
// Part 2d counts only the stretches before the Capital's first building ("before the first building"): what comes after
// it is part 3's wait. The exit code follows that count when a first building stands, else the whole run.
// MEND=0 (or any share): the vault's mend for each wave beaten (src/data/foes.js, WAVE.mend), for an A/B of it
import { record } from './playthrough.js';
import { WAVE } from '../src/data/foes.js';
if (process.env.MEND !== undefined) WAVE.mend = +process.env.MEND;
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? +process.argv[i + 1] : d; };
const SEED = arg('seed', 1), MIN = arg('minutes', 330), LIMIT = 10;
const { moments, r } = record(SEED, MIN);
// round first, so 106:59.6 reads 107:00, not 106:60
const mm = x => { const s = Math.round(x); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const inst = moments.find(m => m.what.some(w => /^institution /.test(w))); // its first building (clarity fix 3b part 2c)
let worst = 0, pre = 0, over = 0, open = null;
for (const m of moments) if (m.kinds[0] === 'quiet') {
  const n = parseInt(m.what[0]) || 2, from = m.quietFrom;
  if (from >= 3600) worst = Math.max(worst, n);
  if (from >= 3600 && (!inst || from < inst.at)) { pre = Math.max(pre, n); over += Math.max(0, n - LIMIT); }
  const going = r.end - (from + n * 60) < 90 && m === moments.filter(x => x.kinds[0] === 'quiet').pop();
  if (going) open = n;
  console.log(`${mm(from)} ${n} min | ${m.town} | ${m.goal}${going ? ' | still going when the run stopped' : ''}`);
}
const cap = moments.find(m => m.what.some(w => w === 'Capital founded'));
console.log(`seed ${SEED}: Capital ${cap ? mm(cap.at) : 'never'}, first building ${inst ? mm(inst.at) : 'not yet'}, Ridge ${r.ridgeAt ? mm(r.ridgeAt) : 'never'}, run ${mm(r.end)}; longest quiet after hour 1 ${worst} min (limit ${LIMIT}), before the first building ${pre} min (${over} over)${open !== null ? `; the last stretch (${open} min) was still going when the run stopped` : ''}`);
process.exitCode = (inst ? pre : worst) > LIMIT ? 1 : 0;
