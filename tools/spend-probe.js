// SEED=5 [MEND=0] [MIN=175] node tools/spend-probe.js: what spends the purse between the Capital and its first
// building on one newcomer seed (tools/firstplay.js), summed by what was bought, in which town, and the goal strip's
// step at the time (clarity fix 3b part 2c: on seed 5 212K went on tower upgrades while the strip asked for the building).
import { WAVE } from '../src/data/foes.js';
import { newcomer } from './firstplay.js';
import { capitalOpen } from '../src/core/capital.js';
import { goalNow } from '../src/core/goals.js';

if (process.env.MEND !== undefined) WAVE.mend = +process.env.MEND;
const seed = +(process.env.SEED || 5), MIN = +(process.env.MIN || 175);
let wired = false, prev = null, pend = [], capAt = null, built = null, now = 0;
const sum = {};
newcomer(seed, MIN, (g, at) => {
  const purse = g.shared.purse.coins; now = at;
  if (!wired) {
    wired = true;
    const tag = what => e => { const gn = goalNow(g); pend.push(what + (e.town ? '@' + e.town : '') + ' [' + (gn ? gn.id : '-') + ']'); };
    for (const n of ['tower:build', 'tower:upgrade', 'build', 'foreman:hire']) g.bus.on(n, tag(n));
    g.bus.on('breach', e => pend.push('loss@' + e.town + ' ' + e.why));
    g.bus.on('institution:found', () => { built ??= now; });
  }
  if (capitalOpen(g)) capAt ??= at;
  // a drop in the purse since the last step goes to what was bought in it (its first event; the step's income is small)
  if (capAt !== null && built === null && prev !== null && pend.length && purse < prev) sum[pend[0]] = (sum[pend[0]] || 0) + prev - purse;
  pend = []; prev = purse;
  return built !== null;
});
const mm = x => (x === null ? 'not yet' : (x / 60).toFixed(1) + ' min');
console.log(`seed ${seed}: Capital ${mm(capAt)}, first building ${mm(built)}`);
for (const [k, v] of Object.entries(sum).sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(Math.round(v / 1000) + 'K', k);
