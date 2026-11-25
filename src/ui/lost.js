/* What a town lost while the player was away, in plain words (owner rule, 2026-11-17: a town away that loses its vault
   or its boss wave holds its own waves until the player goes there). town.lost is set by fall() in src/core/defense.js:
   { why: 'vault' | 'boss', wave, back, coins }. */
import { FOES } from '../data/foes.js';
import { fmt } from './format.js';
import { willRetry, retryState, autoOf } from '../core/automation.js';
import { bossWave, atWall } from '../core/defense.js';

/* Keep trying the boss never holds: it climbs back to the wave before the one lost and plays there until a tower goes
   up a level. The line says what brings the boss back, with no wave number (review of 2026.11.23-7: "goes back up to
   wave 19 and stays there" was flagged a second time after its rewording, so by the twice-flagged rule it went). */
const AGAIN = 'It tries again after a tower goes up a level.';

export const bossName = town => ((FOES[town.def.boss || 'wagon'] || FOES.wagon).name).toLowerCase();
const storeOf = town => town.def.store || 'vault';

/* The toast when it happens. here: the player is in this town now (it lost during time away). game: given, a town with
   Keep trying the boss on says it tries again by itself. */
export function lostToast(town, here = false, game = null, onMap = false) {
  const l = town.lost || { why: 'vault', back: town.wave };
  if (game && willRetry(game, town)) return (l.why === 'boss' ? 'The ' + bossName(town) + ' got through in ' + town.def.name + '.' : 'The ' + storeOf(town) + ' in ' + town.def.name + ' fell.') + ' ' + AGAIN;
  if (here) return (l.why === 'boss' ? 'The ' + bossName(town) + ' got through while you were away.' : 'Your ' + storeOf(town) + ' fell while you were away.')
    + ' You dropped back to wave ' + l.back + '. Tap Resume waves when you are ready.';
  // which town and where to go, not what happened: the map card says that (review of 2026.11.20-15: one loss told three ways)
  // at its wall nothing calls the player there (no dot, no strip step), so the toast only says it
  if (atWall(town)) return town.def.name + ' lost ' + (l.wave ? 'wave ' + l.wave : 'a wave') + ' again. Its waves are on hold.' + (onMap ? ' Tap ' + (town.def.short || town.def.name) + ' to see it.' : '');
  return town.def.name + ' lost ' + (l.wave ? 'wave ' + l.wave : 'a wave') + '.'
    + (onMap ? ' Tap ' + (town.def.short || town.def.name) + ' to see it.' : ' Tap Map to go there.'); // one step: the map card says the rest (lostLine). Review of 2026.11.19-9: four steps in one toast
}
/* The card when the boss gets through in the town in play (boss waves are gates, owner rule 2026-11-17): what
   happened, and what to do. The waves are on hold until the player taps Resume waves or Call now. */
export function lostCard(town, game = null) {
  const l = town.lost || { wave: town.wave, back: town.wave, coins: 0 };
  const again = game && willRetry(game, town);
  // a fallen vault holds the town in play only at its wall (atWall: the second loss in a row with no new best wave)
  const what = l.why === 'boss' ? 'The ' + bossName(town) + ' got through.' : 'Your ' + storeOf(town) + ' fell again.';
  return {
    title: 'Wave ' + l.wave + ' lost',
    lines: [what + ' You dropped back to wave ' + l.back + (l.coins > 0 ? ' and lost ' + fmt(l.coins) + ' coins.' : '.'),
      again ? 'The ' + bossName(town) + ' comes back after a tower goes up a level.' : 'Your waves are on hold. ' + (atWall(town) ? 'Tap a tower and upgrade it' : 'Build more towers') + ', then tap Resume waves.'],
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
  // it keeps fighting meanwhile, so the line never reads as waiting beside Fighting (review of 2026.11.23-9)
  // it names Auto, whose switch does this, so a town beside it On hold after the same loss reads as the switch off,
  // not a second rule (review of 2026.11.23-10)
  // and that it went back, so Fighting a lower wave beside it reads right (review of 2026.11.23-13)
  return here + ' lost wave ' + w + ' and went back. Auto tries it again after a tower goes up a level.';
}
/* The warning line on the town's map card while its waves are on hold: what happened and the wave it went back to
   (review of 2026.11.20-4: "got through. The vault is full again." read as a contradiction). */
const whatHappened = town => ((town.lost || {}).why === 'boss' ? 'The ' + bossName(town) + ' got through.' : 'The ' + storeOf(town) + ' fell.');
export function lostLine(town) {
  const l = town.lost || { why: 'vault' };
  // at its wall (lost twice with no new best wave between) it asks for upgrades first, as the strip there does
  if (atWall(town)) return whatHappened(town) + (l.back ? ' Back to wave ' + l.back + ' again.' : '') + ' Tap Play ' + (town.def.short || town.def.name) + ', upgrade its towers, then tap Resume waves.';
  return whatHappened(town) + (l.back ? ' Back to wave ' + l.back + '.' : '') + ' Tap Play ' + (town.def.short || town.def.name) + ', then Resume waves.'; // the button under it names the town (review of 2026.11.20-15)
}
