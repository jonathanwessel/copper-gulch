// node tools/climb-probe.js [--lines] [--seed N] [--seeds 6] [--minutes 420] [--from 200] [--every 10]: the newcomer's climb in
// Iron Ridge after its charter (PLAN.md M6a, "The newcomer's Ridge wall at waves 44-52"). The newcomer of
// tools/firstplay.js plays on the core, and from minute --from on the probe prints every --every minutes, per town:
// the wave and best wave, the towers (how many, their levels low / median / high, the kinds), the purse, the coins
// spent in that town on towers and on buildings since the last line, its losses (why, from which wave), where the
// newcomer was and what the strip said. A last line per seed sums the climb: when Silver Falls opened (or not), the
// longest the strip showed one step in a row from the Ridge's charter on, and the wave the Ridge stood at most.
// The gate (exit code, "ok" or FAIL lines, run by tools/bots.js): the newcomer opens Silver Falls within FALLS_BY of
// play on at least FALLS_MOST of the seeds and on the median seed, and from the Ridge's charter until the Falls opens no
// strip step stays up more than STEP_MAX in a row. A step that counts coins with the time to go (a save) is left out:
// it changes as the coins come. Before the fix the newcomer opened the Falls on 2 of 6 seeds in 10 hours, after filling
// every Ridge pad with Crossbows right after its charter. It prints only the summary lines unless --lines is given.
import { newcomer } from './firstplay.js';
import { goalNow, meterWords } from '../src/core/goals.js';
import { deedsHeld } from '../src/core/charter.js';
import { isOutpost } from '../src/core/economy.js';
import { towerCost } from '../src/core/defense.js';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? +process.argv[i + 1] : d; };
const SEEDS = arg('seeds', 6), MINUTES = arg('minutes', 420), ONE = arg('seed', 0), FROM = arg('from', 200) * 60, EVERY = arg('every', 10) * 60;
const QUIET = !process.argv.includes('--lines');
export const FALLS_BY = 600 * 60, FALLS_MOST = 2 / 3, STEP_MAX = 30 * 60;
const mm = s => s == null ? 'never' : Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
const k = n => n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(Math.round(n));

export function climb(seed, minutes = MINUTES, onLine = null) {
  const rec = { falls: null, spend: {}, lost: [], step: { text: null, from: 0, longest: 0, at: 0, which: null }, peak: {} };
  let lastLine = -1e9;
  const r = newcomer(seed, minutes, (g, at) => {
    if (!rec.hooked) {
      rec.hooked = true;
      const spend = (town, what, n) => { const s = rec.spend[town] ||= { tower: 0, building: 0 }; s[what] += n; };
      g.bus.on('tower:build', e => { const t = g.towns[e.town], x = t.towers.find(y => y.spot === e.spot); spend(e.town, 'tower', x ? x.spent : 0); });
      g.bus.on('tower:upgrade', e => { const t = g.towns[e.town]; spend(e.town, 'tower', towerCost(t, t.towers.find(y => y.spot === e.spot).kind, e.level - 1).coins); });
      g.bus.on('build', e => { spend(e.town, 'building', e.cost || 0); });
      g.bus.on("breach", e => { if (!g.towns[e.town].won) rec.lost.push({ at: g.stats.steps * .25, town: e.town, why: e.why, wave: e.wave, lost: e.lost }); });
      g.bus.on('town:found', e => { if ((e.town || e.id) === 'falls') rec.falls ??= g.stats.steps * .25; });
      g.bus.on('charter:sign', e => { if (e.town === 'ridge') rec.signed ??= g.stats.steps * .25; });
    }
    if ((g.stats.steps % 4) !== 0) return false;
    const gn = goalNow(g), text = gn ? (gn.need ? null : gn.text) : '(none)';
    const st = rec.step, climbing = rec.signed != null && rec.falls == null;
    if (!climbing || text !== st.text) { st.text = climbing ? text : null; st.from = at; }
    if (st.text && at - st.from > st.longest) { st.longest = at - st.from; st.at = st.from; st.which = st.text; }
    for (const t of Object.values(g.towns)) if (!isOutpost(t)) rec.peak[t.id] = Math.max(rec.peak[t.id] || 0, t.wave);
    if (at < FROM || at - lastLine < EVERY) return false;
    lastLine = at;
    const towns = Object.values(g.towns).filter(t => !isOutpost(t)).map(t => {
      const lv = t.towers.map(x => x.level).sort((a, b) => a - b), kinds = {};
      for (const x of t.towers) kinds[x.kind] = (kinds[x.kind] || 0) + 1;
      const s = rec.spend[t.id] || { tower: 0, building: 0 };
      const line = `${t.id} w${t.wave}/${t.bestWave}${t.waves.hold ? ' HOLD' : ''} vault ${Math.round(100 * t.vault.hp / t.vault.max)}% | ${lv.length} towers lv ${lv[0] || 0}/${lv[Math.floor(lv.length / 2)] || 0}/${lv[lv.length - 1] || 0} of ${t.def.board.spots.length} pads [${Object.entries(kinds).map(([a, b]) => a + ' ' + b).join(', ')}] | spent towers ${k(s.tower)} buildings ${k(s.building)}`;
      rec.spend[t.id] = { tower: 0, building: 0 };
      return line;
    });
    const lost = rec.lost.filter(x => x.at > at - EVERY).map(x => `${x.town} ${x.why} w${x.wave}`).join(', ');
    const out = `  ${mm(at)} in ${g.active}: "${text}"${gn && gn.meter ? ' [' + meterWords(gn, g) + ']' : ''} | purse ${k(g.shared.purse.coins)} deeds ${deedsHeld(g)} | lost: ${lost || '-'}\n    ` + towns.join('\n    ');
    if (onLine) onLine(out); else if (!QUIET) console.log(out);
    return false;
  });
  rec.r = r;
  return rec;
}

if (process.argv[1] && process.argv[1].split(String.fromCharCode(92)).join('/').endsWith('tools/climb-probe.js')) {
  const at = [], miss = [];
  for (let seed = ONE || 1; seed <= (ONE || SEEDS); seed++) {
    if (!QUIET) console.log('seed ' + seed);
    const rec = climb(seed, Math.max(MINUTES, FALLS_BY / 60));
    const st = rec.step;
    at.push(rec.falls);
    console.log(`seed ${seed}: Ridge charter ${mm(rec.signed)}, Silver Falls ${mm(rec.falls)}, Ridge peak wave ${rec.peak.ridge || 0}, lost ${rec.lost.filter(x => x.town === 'ridge' && x.at >= FROM).length} times in the Ridge after ${mm(FROM)}, longest strip step ${Math.round(st.longest / 60)} min at ${mm(st.at)} "${st.which}"`);
    if (st.longest > STEP_MAX) miss.push(`seed ${seed}: "${st.which}" stayed up ${Math.round(st.longest / 60)} min in a row from ${mm(st.at)} (want under ${STEP_MAX / 60})`);
  }
  const inTime = at.filter(x => x != null && x <= FALLS_BY).length, med = at.map(x => x == null ? Infinity : x).sort((a, b) => a - b)[Math.floor(at.length / 2)];
  console.log('Silver Falls opened at ' + at.map(x => x == null ? 'never' : Math.round(x / 60)).join(' ') + ' min');
  if (inTime < Math.ceil(FALLS_MOST * at.length) || med > FALLS_BY) miss.push(`the newcomer opened Silver Falls on ${inTime} of ${at.length} seeds within ${FALLS_BY / 60} min (want ${Math.ceil(FALLS_MOST * at.length)} and the median)`);
  console.log(miss.length ? miss.map(m => 'FAIL ' + m).join(String.fromCharCode(10)) : 'ok');
  process.exitCode = miss.length ? 1 : 0;
}
