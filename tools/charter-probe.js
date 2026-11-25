// node tools/charter-probe.js [--seeds 6] [--minutes 240] [--seed N]: the newcomer and the charter (clarity fix 9,
// PLAN.md M6a). Runs the newcomer bot of tools/firstplay.js on the core and prints, per seed, when the charter was
// first offered, when each town could first pay a deed, when (if) the newcomer signed, and what the goal strip said
// every 15 minutes from the offer on (the deeds each town would pay, the purse, each town's best wave).
import { newcomer } from './firstplay.js';
import { goalNow, meterWords } from '../src/core/goals.js';
import { deedsFor, deedsHeld } from '../src/core/charter.js';
import { isOutpost } from '../src/core/economy.js';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? +process.argv[i + 1] : d; };
const SEEDS = arg('seeds', 6), MINUTES = arg('minutes', 240), ONE = arg('seed', 0);
const mm = s => s == null ? 'never' : Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');

for (let seed = ONE || 1; seed <= (ONE || SEEDS); seed++) {
  const rec = { offer: null, deedAt: {}, signs: [], lines: [] };
  let lastLine = -1e9, lastText = '';
  const r = newcomer(seed, MINUTES, (g, at) => {
    if (!rec.hooked) {
      rec.hooked = true;
      g.bus.on('charter:offer', e => { rec.offer ??= { at: g.stats.steps * .25, town: e.town }; });
      g.bus.on('town:found', e => { if (e.town === 'falls' || e.id === 'falls') rec.falls ??= g.stats.steps * .25; });
      g.bus.on('charter:sign', e => { rec.signs.push({ at: g.stats.steps * .25, town: e.town, deeds: e.deeds, wave: e.wave }); });
    }
    if ((g.stats.steps % 240) !== 0) return false;
    for (const t of Object.values(g.towns)) if (!isOutpost(t) && deedsFor(t) >= 1) rec.deedAt[t.id] ??= at;
    const gn = goalNow(g), text = gn ? gn.text + (gn.meter ? ' [' + meterWords(gn, g) + ']' : '') : '(none)';
    if (rec.offer && (at - lastLine >= 900 || (text !== lastText && at - lastLine >= 120))) {
      lastLine = at; lastText = text;
      const towns = Object.values(g.towns).filter(t => !isOutpost(t)).map(t => t.id + ' w' + t.bestWave + ' d' + deedsFor(t)).join(', ');
      rec.lines.push(`  ${mm(at)} in ${g.active}: ${text} | held ${deedsHeld(g)} | purse ${Math.round(g.purse ?? g.town.coins)} | ${towns}`);
    }
    return false;
  });
  console.log(`seed ${seed}: offered ${mm(rec.offer && rec.offer.at)} (${rec.offer ? rec.offer.town : '-'}), a deed at ${Object.entries(rec.deedAt).map(([k, v]) => k + ' ' + mm(v)).join(', ') || 'none'}, signed ${rec.signs.map(s => s.town + ' ' + mm(s.at) + ' for ' + s.deeds + ' at wave ' + s.wave).join(', ') || 'never'}, Ridge ${mm(r.ridgeAt)}, Capital ${mm(r.capitalAt)}, Silver Falls ${mm(rec.falls)}`);
  for (const l of rec.lines.slice(ONE ? -30 : 0, ONE ? undefined : 40)) console.log(l);
}
