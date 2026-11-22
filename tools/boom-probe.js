// node tools/boom-probe.js <gulch|ridge> <on|off> [seeds]: the strategy bots' gates with booms and busts on or off
// (src/core/market.js, BOOM), one line per strategy and seed, for an A/B run in about 5-10 minutes. Gulch: Dry Creek
// won, wave 10 and wave 20 (strategies); Ridge: Iron Ridge wave 10 after getting there (empire).
import { BOOM } from '../src/core/market.js';
import { campaign, empire, STRATEGIES, STRATEGY_MINUTES } from './balance.js';

const [part = 'gulch', mode = 'on', n = '6', only = ''] = process.argv.slice(2), seeds = +n;
if (mode === 'off') BOOM.first = BOOM.gap[0] = BOOM.gap[1] = 1e12;
// try a minmax number without editing balance.js: MM_PREP=2 (levels before a boss), MM_NOGUARD=1 (no guard after a leak)
if (process.env.MM_PREP) STRATEGIES.minmax.prep = +process.env.MM_PREP;
if (process.env.MM_NOGUARD) STRATEGIES.minmax.level = w => 2 + w / 2;
const m = x => x == null ? 'never' : (x / 60).toFixed(1);
for (const k of Object.keys(STRATEGIES).filter(k => !only || only.split(',').includes(k))) {
  const row = [];
  for (let s = 1; s <= seeds; s++) {
    if (part === 'gulch') { const c = campaign(s, k, STRATEGY_MINUTES); row.push(`${m(c.dc.won)}/${m(c.gulch && c.gulch.wave10)}/${m(c.gulch && c.gulch.wave20)}`); }
    else { const e = empire(s, k); row.push(m(e.ridge && e.ridge.w10)); }
  }
  console.log(`${part} ${mode} ${k}: ${row.join(' | ')}`);
}
