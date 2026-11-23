// node tools/capital-probe.js [--seeds 6] [--minutes 240] [--price 60000]: the Capital wall (clarity fix 3, PLAN.md M6a). Plays the
// newcomer bot (tools/firstplay.js) and prints, every 15 minutes of play, Iron Ridge's best wave, the purse and the
// empire's coins a minute, then when Iron Ridge reached wave 30 and when the Capital opened.
import { newcomer } from './firstplay.js';
import { capitalOpen } from '../src/core/capital.js';
import { CAPITAL_DEF } from '../src/data/capital.js';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? +process.argv[i + 1] : d; };
const SEEDS = arg('seeds', 6), MIN = arg('minutes', 240);
if (process.argv.includes('--price')) CAPITAL_DEF.found.coins = arg('price', CAPITAL_DEF.found.coins); // try a price
const k = x => x >= 1000 ? (x / 1000).toFixed(1) + 'K' : Math.round(x) + '';
for (let s = 1; s <= SEEDS; s++) {
  const rows = []; let w30 = null, cap = null, last = [0, 0], peak = 0;
  newcomer(s, MIN, (g, at) => {
    const rt = g.towns.ridge, purse = g.town.coins;
    if (purse > peak) peak = purse;
    if (w30 === null && rt && rt.bestWave >= 30) w30 = at;
    if (cap === null && capitalOpen(g)) cap = at;
    if (at % 900 === 0 && at > 0) {
      const per = (g.earned - last[1]) / ((at - last[0]) / 60); last = [at, g.earned];
      rows.push(`${at / 60}m ridge ${rt ? rt.bestWave : '-'} purse ${k(purse)} ${k(per)}/min`);
    }
    return false;
  });
  console.log(`seed ${s} | ridge w30 ${w30 === null ? 'never' : (w30 / 60).toFixed(0) + 'm'} | capital ${cap === null ? 'never' : (cap / 60).toFixed(0) + 'm'} | peak purse ${k(peak)}`);
  console.log('  ' + rows.join(' | '));
}
