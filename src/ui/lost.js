/* What a town lost while the player was away, in plain words (owner rule, 2026-11-17: a town away that loses its vault
   or its boss wave holds its own waves until the player goes there). town.lost is set by fall() in src/core/defense.js:
   { why: 'vault' | 'boss', wave, back, coins }. */
import { FOES } from '../data/foes.js';
import { fmt } from './format.js';
import { willRetry, retryState, autoOf } from '../core/automation.js';

const AGAIN = 'start again by themselves after a tower goes up a level.';

const bossName = town => ((FOES[town.def.boss || 'wagon'] || FOES.wagon).name).toLowerCase();
const storeOf = town => town.def.store || 'vault';

/* The toast when it happens. here: the player is in this town now (it lost during time away). game: given, a town with
   Keep trying the boss on says it tries again by itself. */
export function lostToast(town, here = false, game = null) {
  const l = town.lost || { why: 'vault', back: town.wave };
  if (game && willRetry(game, town)) return (l.why === 'boss' ? 'The ' + bossName(town) + ' got through in ' + town.def.name + '.' : 'The ' + storeOf(town) + ' in ' + town.def.name + ' fell.') + ' Its waves ' + AGAIN;
  if (here) return (l.why === 'boss' ? 'The ' + bossName(town) + ' got through while you were away.' : 'Your ' + storeOf(town) + ' fell while you were away.')
    + ' You dropped back to wave ' + l.back + '. Tap Resume waves when you are ready.';
  return (l.why === 'boss' ? 'The ' + bossName(town) + ' broke into ' + town.def.name + '.' : 'The ' + storeOf(town) + ' in ' + town.def.name + ' fell.')
    + ' Its waves wait until you go there.';
}
/* The card when the boss gets through in the town in play (boss waves are gates, owner rule 2026-11-17): what
   happened, and what to do. The waves are on hold until the player taps Resume waves or Call now. */
export function lostCard(town, game = null) {
  const l = town.lost || { wave: town.wave, back: town.wave, coins: 0 };
  const again = game && willRetry(game, town);
  return {
    title: 'Wave ' + l.wave + ' lost',
    lines: ['The ' + bossName(town) + ' reached your ' + storeOf(town) + '. You dropped back to wave ' + l.back + (l.coins > 0 ? ' and lost ' + fmt(l.coins) + ' coins.' : '.'),
      again ? 'Your waves are on hold. They ' + AGAIN : 'Your waves are on hold. Build more towers, then tap Resume waves.'],
  };
}
/* The line on the town's map card while it tries its boss again (Keep trying the boss): on hold until a tower goes up,
   stuck (Auto-towers cannot raise one), or playing back up to the boss. */
export function retryLine(game, town) {
  const st = retryState(game, town), a = autoOf(game, town).boss, name = 'the ' + bossName(town), here = town.def.short || town.def.name;
  if (st === 'climb') return here + ' fights ' + name + ' again at wave ' + a.wave + '.';
  if (st === 'stuck') return here + ' fights ' + name + ' again after a tower goes up a level. Go there and raise one.';
  return here + ' fights ' + name + ' again after a tower goes up a level. Auto-towers will raise one.';
}
/* The warning line on the town's map card while its waves are on hold. */
export function lostLine(town) {
  const l = town.lost || { why: 'vault' };
  return (l.why === 'boss' ? 'The ' + bossName(town) + ' got through.' : 'The ' + storeOf(town) + ' fell.') + ' Tap Play ' + (town.def.short || town.def.name) + ', then Resume waves.';
}
