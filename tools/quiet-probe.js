// node tools/quiet-probe.js [--seed 1] [--minutes 330]: the playthrough's quiet stretches on the core alone, no
// browser (clarity fix 3, PLAN.md M6a: no stretch over 10 minutes with nothing new after hour 1). Prints each quiet
// stretch of the newcomer's run (tools/playthrough.js record) with its length and the goal strip's words, and when the
// Capital opened.
import { record } from './playthrough.js';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? +process.argv[i + 1] : d; };
const SEED = arg('seed', 1), MIN = arg('minutes', 330), LIMIT = 10;
const { moments, r } = record(SEED, MIN);
// round first, so 106:59.6 reads 107:00, not 106:60
const mm = x => { const s = Math.round(x); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
let worst = 0;
for (const m of moments) if (m.kinds[0] === 'quiet') {
  const n = parseInt(m.what[0]) || 2, from = m.quietFrom;
  if (from >= 3600) worst = Math.max(worst, n);
  console.log(`${mm(from)} ${n} min | ${m.town} | ${m.goal}`);
}
const cap = moments.find(m => m.what.some(w => w === 'Capital founded'));
console.log(`seed ${SEED}: Capital ${cap ? mm(cap.at) : 'never'}, Ridge ${r.ridgeAt ? mm(r.ridgeAt) : 'never'}, run ${mm(r.end)}; longest quiet after hour 1 ${worst} min (limit ${LIMIT})`);
process.exitCode = worst > LIMIT ? 1 : 0;
