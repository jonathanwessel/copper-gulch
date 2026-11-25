// node tools/mode-probe.js <gulch|ridge> <always|skip|boom|pick> [seeds] [strategy]: the active bot with every town's
// goods on one sell mode (Market depth part 2b, PLAN.md M6a), one line per seed, for an A/B of the modes on the same
// seeds in a few minutes, like tools/boom-probe.js. always: the release bots' play (no mode set). skip: Skip busts on
// every good. boom: Booms only on every good. pick: the active player's pick (pickModes below).
// gulch: Dry Creek won, Gulch wave 10 and 20 (minutes from the new game for Dry Creek, from the Gulch's start for the
// waves) and the coins the empire earned by the end; ridge: the Ridge's wave 10 (minutes after getting there) and the
// coins earned by then.
import { campaign, empire, SELL_BOT, STRATEGY_MINUTES } from './balance.js';
import { setSellMode, saturation, boomsOpen } from '../src/core/market.js';
import { GOODS } from '../src/data/goods.js';

const [part = 'gulch', policy = 'always', n = '6', strategy = 'active'] = process.argv.slice(2), seeds = +n;
/* The active player's pick: Skip busts on a good the market is not flooded with (its price stays above PICK.flood of
   full), where holding through a bust sells the pile later at a good price; Always on a flooded good, where a held
   pile would sell into a low price anyway. */
export const PICK = { flood: .6 };
export function pickModes(g) {
  if (!boomsOpen(g)) return; // no boom or bust before the second town, so every good sells on Always till then
  for (const t of Object.values(g.towns)) for (const good of Object.keys(t.goods || {})) {
    if (!GOODS[good]) continue;
    const want = policy === 'skip' ? 'skip' : policy === 'boom' ? 'boom' : saturation(g, good) > PICK.flood ? 'skip' : 'always';
    setSellMode(t, good, want);
  }
}
if (policy !== 'always') SELL_BOT.policy = pickModes;
const m = x => x == null ? 'never' : (x / 60).toFixed(1), k = x => (x / 1000).toFixed(0) + 'K';
const row = [];
for (let s = 1; s <= seeds; s++) {
  if (part === 'gulch') { const c = campaign(s, strategy, STRATEGY_MINUTES); row.push(`${m(c.dc.won)}/${m(c.gulch && c.gulch.wave10)}/${m(c.gulch && c.gulch.wave20)} ${k(c.game.earned || 0)}`); }
  else { const e = empire(s, strategy); row.push(`${m(e.ridge && e.ridge.w10)} ${k(e.game.earned || 0)}`); }
}
console.log(`${part} ${policy} ${strategy}: ${row.join(' | ')}`);
