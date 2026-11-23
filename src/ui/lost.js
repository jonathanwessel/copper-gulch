/* What a town lost while the player was away, in plain words (owner rule, 2026-11-17: a town away that loses its vault
   or its boss wave holds its own waves until the player goes there). town.lost is set by fall() in src/core/defense.js:
   { why: 'vault' | 'boss', wave, back, coins }. */
import { FOES } from '../data/foes.js';
import { fmt } from './format.js';
import { willRetry, retryState, autoOf, againWave } from '../core/automation.js';
import { bossWave } from '../core/defense.js';

/* Keep trying the boss never holds: it climbs back to the wave before the one lost and stays there until a tower goes
   up a level ("stays at", not "plays again": review of 2026.11.22-2, the screen said Fighting wave 18 beside "plays wave 19 again"). */
const AGAIN = (l, town) => 'Your waves ' + stayAt(town, l.wave, 'go', 'stay') + ' until a tower goes up a level.';
/* "stays at wave 19", or "goes back up to wave 19 and stays there" while the town is below it, so the line never names
   a wave the top bar does not show (review of 2026.11.23-6: "stays at wave 19" beside "Wave 18"). go, stay: the verbs. */
export function stayAt(town, lost, go = 'goes', stay = 'stays') {
  const a = againWave({ wave: lost || 1 });
  return town && town.wave < a ? go + ' back up to wave ' + a + ' and ' + stay + ' there' : stay + ' at wave ' + a;
}

export const bossName = town => ((FOES[town.def.boss || 'wagon'] || FOES.wagon).name).toLowerCase();
const storeOf = town => town.def.store || 'vault';

/* The toast when it happens. here: the player is in this town now (it lost during time away). game: given, a town with
   Keep trying the boss on says it tries again by itself. */
export function lostToast(town, here = false, game = null, onMap = false) {
  const l = town.lost || { why: 'vault', back: town.wave };
  if (game && willRetry(game, town)) return (l.why === 'boss' ? 'The ' + bossName(town) + ' got through in ' + town.def.name + '.' : 'The ' + storeOf(town) + ' in ' + town.def.name + ' fell.') + ' ' + AGAIN(l, town);
  if (here) return (l.why === 'boss' ? 'The ' + bossName(town) + ' got through while you were away.' : 'Your ' + storeOf(town) + ' fell while you were away.')
    + ' You dropped back to wave ' + l.back + '. Tap Resume waves when you are ready.';
  // which town and where to go, not what happened: the map card says that (review of 2026.11.20-15: one loss told three ways)
  return town.def.name + ' lost ' + (l.wave ? 'wave ' + l.wave : 'a wave') + '.'
    + (onMap ? ' Tap ' + (town.def.short || town.def.name) + ' to see it.' : ' Tap Map to go there.'); // one step: the map card says the rest (lostLine). Review of 2026.11.19-9: four steps in one toast
}
/* The card when the boss gets through in the town in play (boss waves are gates, owner rule 2026-11-17): what
   happened, and what to do. The waves are on hold until the player taps Resume waves or Call now. */
export function lostCard(town, game = null) {
  const l = town.lost || { wave: town.wave, back: town.wave, coins: 0 };
  const again = game && willRetry(game, town);
  return {
    title: 'Wave ' + l.wave + ' lost',
    lines: ['The ' + bossName(town) + ' got through. You dropped back to wave ' + l.back + (l.coins > 0 ? ' and lost ' + fmt(l.coins) + ' coins.' : '.'),
      again ? AGAIN(l, town) + ' Then the ' + bossName(town) + ' comes back.' : 'Your waves are on hold. Build more towers, then tap Resume waves.'],
  };
}
/* The line on the town's map card while it tries its boss again (Keep trying the boss): playing the last wave it beat
   again until a tower goes up, stuck (Auto-towers cannot raise one), or playing on to the wave it lost. */
export function retryLine(game, town) {
  const st = retryState(game, town), a = autoOf(game, town).boss, here = town.def.short || town.def.name;
  const w = a ? a.wave : (town.lost || {}).wave, what = w && !bossWave(town, w) ? 'wave ' + w : 'the ' + bossName(town);
  if (st === 'climb') return here + (what.startsWith('wave') ? ' fights ' + what + ' again.' : ' fights ' + what + ' again at wave ' + w + '.');
  if (st === 'stuck') return 'Play ' + here + ' and upgrade a tower one level. Then it fights ' + what + ' again.';
  // the loss and what it does now (review of 2026.11.20-18: the line never said the town lost)
  return here + ' lost wave ' + w + '. It ' + stayAt(town, w) + ' until a tower goes up a level.';
}
/* The warning line on the town's map card while its waves are on hold: what happened and the wave it went back to
   (review of 2026.11.20-4: "got through. The vault is full again." read as a contradiction). */
const whatHappened = town => ((town.lost || {}).why === 'boss' ? 'The ' + bossName(town) + ' got through.' : 'The ' + storeOf(town) + ' fell.');
export function lostLine(town) {
  const l = town.lost || { why: 'vault' };
  return whatHappened(town) + (l.back ? ' Back to wave ' + l.back + '.' : '') + ' Tap Play ' + (town.def.short || town.def.name) + ', then Resume waves.'; // the button under it names the town (review of 2026.11.20-15)
}
