// node tools/balance.js [--seeds 3] [--minutes 60]: plays Copper Gulch with a steady, sensible player (no waiting,
// no mistakes) straight on the simulation core, and checks the pacing targets that exist so far:
//   the first tower under 1 minute; wave 10 cleared in 7-9 minutes; no breach in waves 1-3; the first charter offered
//   at 35-45 minutes. The player signs the first charter once it pays a deed (--sign n: once it pays n), picks the
//   first side of every perk pair it can, and plays on; it reports how long the new charter takes to get back to the
//   old one's best wave.
// The player picks towers the way a careful player would: every open tower kind on every empty pad it fits (mortar
// pits included), and every upgrade, scored by damage per coin over the stretch of road that pad covers. It reports
// which kinds it bought and which kind did the most damage in each wave.
// Tower variety (the M1 target, reported here, not yet a release gate): every tower kind is the best buy at some
// point in the first hour, and no single kind does the most damage in every wave.
// Prints a table per seed and "ok" or the misses.
import { newGame } from '../src/core/setup.js';
import { build, cost, unlocked, missing, output, uses } from '../src/core/economy.js';
import { price as marketPrice } from '../src/core/market.js';
import { buildTower, upgradeTower, towerCost, towerStats, canPay, towerAt, towerOpen, fitsSpot, roadOf, isPit } from '../src/core/defense.js';
import { pointAt, dist } from '../src/core/path.js';
import { BUILDINGS } from '../src/data/buildings.js';
import { GOODS } from '../src/data/goods.js';
import { TOWERS, PATHS, PATH_LEVEL, POISON_SECONDS } from '../src/data/towers.js';
import { itemsOf, researchBlock, researchCost, startResearch } from '../src/core/research.js';
import { canHire, hireCost, hireForeman } from '../src/core/foremen.js';
import { deedsFor, signCharter, pickPerk, perkState } from '../src/core/charter.js';
import { PERKS } from '../src/data/perks.js';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? +process.argv[i + 1] : d; };
const SEEDS = arg('seeds', 3), MINUTES = arg('minutes', 90), SIGN_AT = arg('sign', 1);
const SPACING = 1.1; // about how far apart raiders ride, in world units

/* Road units inside a ring [lo, hi] around a spot (memoized). */
const COVER = new Map();
function cover(town, spot, lo, hi) {
  const key = spot + ':' + lo.toFixed(2) + ':' + hi.toFixed(2);
  if (!COVER.has(key)) {
    const r = roadOf(town), p = town.def.board.spots[spot]; let n = 0;
    for (let s = 0; s <= r.length; s += .1) { const d = dist(p, pointAt(r, s)); if (d >= lo && d <= hi) n += .1; }
    COVER.set(key, n);
  }
  return COVER.get(key);
}
/* Damage a tower deals per second to a column of raiders passing through its reach, times the road it covers. */
export function worth(town, t, support = true) {
  const st = towerStats(town, t), targets = r => Math.max(1, 2 * r / SPACING);
  let dps = st.dmg * st.rate;
  if (st.pulse) dps *= Math.min(4, targets(st.range) / 2);
  else if (st.splash) dps *= targets(st.splash);
  if (st.poison) dps += st.poison * Math.min(1, st.rate * POISON_SECONDS) * targets(st.cloud) * 1.2; // poison gets past armor
  if (st.slow) dps *= 1 + st.slow * 2; // slowed raiders take longer to pass every tower
  if (st.fire) dps *= 1.35;
  let w = dps * cover(town, t.spot, st.minRange, st.range);
  // a slowing tower also gives the towers around it more time to shoot
  if (st.slow && support) for (const o of town.towers) if (o.spot !== t.spot && o.kind !== t.kind && dist(town.def.board.spots[o.spot], town.def.board.spots[t.spot]) < st.range + towerStats(town, o).range) w += st.slow * .5 * worth(town, o, false);
  return w;
}
/* What one more level of a building earns per coin it costs: the extra units it makes a second at today's market
   price (a flooded good pays little), less the inputs they use at their price. A building not yet built gets a
   bonus for what it opens up, and a bigger one when it makes a good the town's towers are built with. */
export function buildValue(game, town, id) {
  const b = BUILDINGS[id], L = town.level(id), now = output(town, id);
  town.buildings[id] = L + 1; const next = output(town, id); town.buildings[id] = L; if (!L) delete town.buildings[id];
  const mp = g => marketPrice(game, town, g);
  const net = mp(b.makes) - Object.keys(b.inputs).reduce((a, g) => a + uses(town, id, g) * mp(g), 0);
  const forTowers = Object.values(TOWERS).some(d => (d.goods[town.id] || {})[b.makes]);
  return ((next - now) * net + (L ? 0 : forTowers ? 2 : 2)) / cost(town, id);
}
/* Coins plus the goods at their base price. */
const price = c => c.coins + Object.entries(c.goods).reduce((a, [g, n]) => a + GOODS[g].price * n, 0);

/* Every purchase the defense could make now: { kind, spot, path, value per coin, can afford }. A new tower also uses up
   a pad, and pads are few, so a build is charged half of what the average tower has had spent on it so far: early on
   cheap towers fill pads, later a pad is worth saving for a strong tower. */
export function options(town) {
  const out = [], pad = town.towers.length ? .5 * town.towers.reduce((a, x) => a + x.spent, 0) / town.towers.length : 0;
  for (const t of town.towers) {
    const c = towerCost(town, t.kind, t.level), now = worth(town, t);
    const paths = t.level + 1 === PATH_LEVEL ? Object.keys(PATHS[t.kind]) : [t.path];
    for (const path of paths) {
      const gain = worth(town, { ...t, level: t.level + 1, path: t.level + 1 >= PATH_LEVEL ? path : null }) - now;
      out.push({ up: true, kind: t.kind, spot: t.spot, path, level: t.level, value: gain / price(c), can: canPay(town, c) });
    }
  }
  const empty = town.def.board.spots.map((_, i) => i).filter(i => !towerAt(town, i));
  for (const kind of Object.keys(TOWERS)) {
    if (!towerOpen(town, kind)) continue;
    const c = towerCost(town, kind, 0);
    for (const spot of empty) if (fitsSpot(town, spot, kind)) out.push({ up: false, kind, spot, level: 0, value: worth(town, { kind, spot, level: 1, path: null }) / (price(c) + (isPit(town, spot) ? 0 : pad)), can: canPay(town, c) });
  }
  return out.sort((a, b) => b.value - a.value);
}

/* The strategies (CLAUDE.md: more than one way to win). Each says how many towers it wants for the coming wave, the
   level it keeps them at, which defense buys it takes first, and whether the town or the defense gets the coins first.
     active: the steady player the pacing targets are set for.
     minmax: a few towers on the best pads, pushed to high levels and their paths.
     swarm: towers on every pad it can (a new one every wave or two), kept at low levels and raised evenly.
     economy: the town first while no raider got through in the last two waves, with the fewest towers that hold
       (each wave that lets a raider through raises its towers half a level for good).
     defense: towers first, the town gets what is left. */
export const STRATEGIES = {
  active: { want: w => 1 + Math.ceil(w / 3), level: w => 1.3 + w / 3 },
  minmax: { want: w => Math.min(6, 1 + Math.ceil(w / 5)), level: w => 2 + w / 2, ups: true },
  swarm: { want: w => 2 + Math.ceil(w / 1.5), level: w => 1 + w / 4, even: true },
  economy: { want: w => 1 + Math.ceil(w / 3.5), level: (w, r) => 1 + w / 3.3 + r.bump, eco: true },
  defense: { want: w => 1 + Math.ceil(w / 2.5), level: w => 1.5 + w / 2.8 },
};

/* Seconds a building may take to pay for itself and still come before the towers. */
export const PAYBACK = { active: 300, minmax: 300, swarm: 300, economy: 900, defense: 120 };

/* One player's run: every second, defend first when the defense is thin for the coming wave (the best affordable
   build or upgrade the strategy allows, by value), then research (the cheapest item that does not cost more than the
   next building), then (after the first boss) a foreman for a building at level 10 once it can pay for one, then the
   best-paying building. The economy player buys its next building before defending unless a raider got through in
   the last two waves. */
export function play(seed, minutes = MINUTES, strategy = 'active') {
  const S = STRATEGIES[strategy], g = newGame('balance-' + seed), t = g.town;
  const r = { seed, strategy, offer: null, signed: null, regain: null, life: {}, foremen: [], research: {}, firstResearch: null, firstTower: null, wave10: null, wave20: null, breaches: [], waveAt: {}, bought: {}, firstBuy: {}, top: [], dealt: {}, leakAt: -99, bump: 0 };
  g.bus.on('wave:start', () => { g.dealt = {}; });
  g.bus.on('leak', () => { if (r.leakAt !== t.wave) r.bump += .5; r.leakAt = t.wave; });
  g.bus.on('wave:clear', e => {
    if (e.wave === 10 && r.wave10 === null) r.wave10 = t.t;
    if (e.wave === 20 && r.wave20 === null) r.wave20 = t.t;
    const d = (g.dealt || {})[t.id] || {}, best = Object.entries(d).sort((a, b) => b[1] - a[1])[0];
    if (best && t.t <= 3600) { r.top.push([e.wave, best[0], Object.keys(d).length]); for (const [k, n] of Object.entries(d)) r.dealt[k] = (r.dealt[k] || 0) + n; }
  });
  g.bus.on('breach', e => r.breaches.push(e.wave));
  g.bus.on('charter:offer', () => { r.offer = t.t; });
  // the defense buys while it is short of the strategy's towers or levels for the coming wave (the economy player
  // also waits until a raider got through in the last two waves, once it has its first towers)
  // urgent: short of towers, a tower more than a level behind, or the vault below 60%
  const defend = (urgent = false) => {
    const w = t.wave, want = S.want(w), lv = S.level(w, r);
    if (t.towers.length >= want && !t.towers.some(x => x.level < lv)) return false;
    if (urgent && t.towers.length >= want && !t.towers.some(x => x.level < lv - 1.5) && t.vault.hp >= .6 * t.vault.max) return false;
    let opts = options(t).filter(o => o.can && (o.up ? o.level < lv : t.towers.length < want));
    if (S.even) { const low = Math.min(...t.towers.map(x => x.level)); opts = opts.filter(o => !o.up || o.level === low).sort((x, y) => (x.up - y.up) || (y.value - x.value)); }
    if (S.ups) opts.sort((x, y) => (y.up - x.up) || (y.value - x.value));
    const pick = opts[0];
    if (!pick) return false;
    const ok = pick.up ? upgradeTower(g, t, pick.spot, pick.path) : buildTower(g, t, pick.spot, pick.kind);
    if (!ok) return false;
    if (!pick.up) r.firstTower ??= t.t;
    r.bought[pick.kind] = (r.bought[pick.kind] || 0) + 1;
    if (t.t <= 3600) r.firstBuy[pick.kind] ??= Math.round(t.t / 60);
    return true;
  };
  // the town: research (the cheapest item that costs no more than the next building), then (after the first boss) a
  // foreman for a level-10 building, then the best-paying building. Returns true when it bought something.
  let best = null, bv = 0;
  const pickBuilding = () => {
    best = null; bv = 0;
    for (const id of t.def.buildings) {
      if (!unlocked(t, id)) continue;
      const v = buildValue(g, t, id);
      if (v > bv) { bv = v; best = id; }
    }
    // a building still locked counts toward the levels that open it: what it would earn, over its price plus theirs
    for (const id of t.def.buildings) {
      const need = missing(t, id);
      if (!need.length || t.level(id) || need.some(n => !unlocked(t, n.id))) continue;
      const total = cost(t, id) + need.reduce((a, n) => a + cost(t, n.id, n.level - t.level(n.id)), 0);
      const v = buildValue(g, t, id) * cost(t, id) / total, step = need.sort((a, b) => cost(t, a.id) - cost(t, b.id))[0].id;
      if (v > bv) { bv = v; best = step; }
    }
  };
  let saving = false;
  const grow = () => {
    if (!t.lab && !(saving && t.coins < cost(t, best))) { // while saving for a building that pays fast, research waits
      const item = itemsOf(t).filter(id => researchBlock(t, id) === null).sort((a, b) => researchCost(t, a) - researchCost(t, b))[0];
      if (item && (!best || researchCost(t, item) <= cost(t, best)) && startResearch(g, t, item)) { r.research[item] = (r.research[item] || 0) + 1; r.firstResearch ??= t.t; return true; }
    }
    // a foreman only for a building still worth raising (it pays back within 10 minutes): a flooded good is not
    const boss = t.bestWave >= 10 && t.def.buildings.find(id => canHire(t, id) && hireCost(t, id) <= t.coins && buildValue(g, t, id) * 600 > 1);
    if (boss && hireForeman(g, t, boss)) { r.foremen.push(boss + ' ' + (t.t / 60).toFixed(1)); return true; }
    return !!best && t.coins >= cost(t, best) && build(g, t, best);
  };
  for (let s = 0; s < minutes * 60 * 4; s++) {
    g.step(.25);
    if (s % (60 * 4) === 0 || s === minutes * 240 - 1) { r.waveAt[Math.round(s / 240)] = t.wave; r.life[Math.round(s / 240)] = [t.bestWave, Math.round(t.lifetime), deedsFor(t)]; }
    if (s % 4) continue;
    // the first charter: signed once it pays SIGN_AT deeds; then pick the first side of each open perk pair
    if (!r.signed && deedsFor(t) >= SIGN_AT) {
      r.signed = { at: t.t, wave: t.bestWave, coins: Math.round(t.lifetime), deeds: signCharter(g, t) };
      for (const p of PERKS) if (perkState(g, p.id) === 'open') pickPerk(g, p.id, 'a');
      continue;
    }
    if (r.signed && r.regain === null && t.bestWave >= r.signed.wave) r.regain = t.t - r.signed.at;
    // a building that pays for itself within the strategy's payback time comes before the towers
    pickBuilding();
    const safe = t.towers.length > 0 && t.wave - r.leakAt > 2;
    const pays = saving = t.towers.length > 0 && t.wave - r.leakAt > 1 && bv * PAYBACK[strategy] > 1; // not right after a leak
    if (((S.eco && safe) || pays) && grow()) continue;
    if (defend(pays)) continue;
    grow();
  }
  r.final = { wave: t.wave, best: t.bestWave, lifetime: Math.round(t.lifetime), towers: t.towers.map(x => x.kind + x.level + (x.path || '')), buildings: { ...t.buildings } };
  return r;
}

/* The strategy check (CLAUDE.md, Strategies must stay close): every strategy over the seeds, the median time to
   clear waves 10 and 20, and a miss when a strategy is more than 25% slower than the best one or breaches in waves
   1-3. Returns { rows, misses }. */
export const STRATEGY_MINUTES = 40, STRATEGY_SLACK = 1.25;
export function strategies(seeds = SEEDS) {
  const med = a => { const b = a.filter(x => x != null).sort((x, y) => x - y); return b.length * 2 <= a.length ? null : b[Math.floor(b.length / 2)]; };
  const rows = Object.keys(STRATEGIES).map(k => {
    const runs = []; for (let s = 1; s <= seeds; s++) runs.push(play(s, STRATEGY_MINUTES, k));
    const dealt = {}, bought = {};
    for (const r of runs) { for (const [a, n] of Object.entries(r.dealt)) dealt[a] = (dealt[a] || 0) + n; for (const [a, n] of Object.entries(r.bought)) bought[a] = (bought[a] || 0) + n; }
    return { strategy: k, runs, wave10: med(runs.map(r => r.wave10)), wave20: med(runs.map(r => r.wave20)), coins30: med(runs.map(r => r.life[30] && r.life[30][1])), early: runs.filter(r => r.breaches.some(w => w <= 3)).length, firstBreach: runs.map(r => r.breaches[0] ?? null), dealt, bought };
  });
  const misses = [];
  for (const key of ['wave10', 'wave20']) {
    const best = Math.min(...rows.map(x => x[key] ?? Infinity));
    for (const x of rows) if (x[key] === null || x[key] > best * STRATEGY_SLACK) misses.push(`${x.strategy}: ${key === 'wave10' ? 'wave 10' : 'wave 20'} at ${x[key] === null ? 'never' : (x[key] / 60).toFixed(1) + ' min'}, more than 25% behind the best (${(best / 60).toFixed(1)} min)`);
  }
  for (const x of rows) if (x.early) misses.push(`${x.strategy}: a breach in waves 1-3 on ${x.early} seed(s)`);
  return { rows, misses };
}

/* The variety check (M1 target): kinds never bought in the first hour, and whether one kind topped every wave. */
export function variety(runs) {
  const kinds = Object.keys(TOWERS), never = kinds.filter(k => runs.every(r => r.firstBuy[k] === undefined));
  const mixed = runs.flatMap(r => r.top.filter(([, , n]) => n > 1));
  const tops = new Set(mixed.map(([, k]) => k));
  return { never, oneKind: mixed.length > 0 && tops.size === 1 ? [...tops][0] : null, tops: [...tops] };
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/balance.js')) {
  const misses = [], runs = [];
  console.log('seed | first tower | wave 10 | breaches (waves) | wave at 10/20/30/40/60 min | lifetime coins');
  for (let s = 1; s <= SEEDS; s++) {
    const r = play(s); runs.push(r);
    const w10 = r.wave10 === null ? 'never' : (r.wave10 / 60).toFixed(1) + ' min';
    console.log(`${s} | ${r.firstTower === null ? 'never' : Math.round(r.firstTower) + ' s'} | ${w10} | ${r.breaches.join(',') || 'none'} | ${[10, 20, 30, 40, 60].map(m => r.waveAt[m] ?? '-').join('/')} | ${r.final.lifetime}`);
    if (r.firstTower === null || r.firstTower > 60) misses.push(`seed ${s}: first tower at ${r.firstTower} s (want under 60)`);
    if (r.wave10 === null || r.wave10 < 7 * 60 || r.wave10 > 9 * 60) misses.push(`seed ${s}: wave 10 at ${w10} (want 7-9 min)`);
    if (r.breaches.some(w => w <= 3)) misses.push(`seed ${s}: a breach in waves 1-3`);
    if (r.offer === null || r.offer < 35 * 60 || r.offer > 45 * 60) misses.push(`seed ${s}: the first charter offered at ${r.offer === null ? 'never' : (r.offer / 60).toFixed(1) + ' min'} (want 35-45 min)`);
  }
  const m = x => x === null ? 'never' : (x / 60).toFixed(1) + ' min';
  console.log('charter (offered, signed at best wave and coins, deeds, back to that wave after): ' + runs.map(r => 'seed ' + r.seed + ' ' + m(r.offer) + (r.signed ? ', signed ' + m(r.signed.at) + ' at wave ' + r.signed.wave + ' and ' + Math.round(r.signed.coins / 1000) + 'K for ' + r.signed.deeds + ', back in ' + m(r.regain) : ', not signed')).join(' | '));
  console.log('research levels (first started at): ' + runs.map(r => 'seed ' + r.seed + ' ' + (r.firstResearch === null ? 'never' : (r.firstResearch / 60).toFixed(1) + ' min') + ' ' + Object.entries(r.research).map(([k, n]) => k + ' ' + n).join(', ')).join(' | '));
  console.log('foremen hired (building, minute): ' + runs.map(r => 'seed ' + r.seed + ' ' + (r.foremen.join(', ') || 'none')).join(' | '));
  console.log('towers bought (first minute bought, in the first hour):');
  for (const r of runs) console.log(`  seed ${r.seed}: ` + Object.keys(TOWERS).map(k => `${k} ${r.bought[k] || 0}` + (r.firstBuy[k] !== undefined ? ` (min ${r.firstBuy[k]})` : '')).join(', '));
  console.log('most damage per wave (first hour): ' + runs.map(r => `seed ${r.seed} ` + r.top.map(([w, k]) => w + ':' + k).join(' ')).join(' | '));
  console.log(`strategies (median over ${SEEDS} seeds, ${STRATEGY_MINUTES} min each): strategy | wave 10 | wave 20 | coins at 30 min | first breach (wave) | buys by kind | damage by kind`);
  const st = strategies();
  for (const x of st.rows) {
    const tot = Object.values(x.dealt).reduce((a, b) => a + b, 0) || 1, mm = v => v === null ? 'never' : (v / 60).toFixed(1) + ' min';
    console.log(`  ${x.strategy} | ${mm(x.wave10)} | ${mm(x.wave20)} | ${x.coins30 === null ? '-' : Math.round(x.coins30 / 1000) + 'K'} | ${x.firstBreach.map(w => w ?? '-').join(',')} | `
      + Object.entries(x.bought).map(([k, n]) => k + ' ' + n).join(', ') + ' | ' + Object.entries(x.dealt).sort((a, b) => b[1] - a[1]).map(([k, n]) => k + ' ' + Math.round(100 * n / tot) + '%').join(', '));
  }
  misses.push(...st.misses);
  const v = variety(runs);
  console.log('variety (M1 target, not a release gate yet): ' + (v.never.length || v.oneKind ? 'MISS' : 'ok')
    + (v.never.length ? ' · never the best buy in the first hour: ' + v.never.join(', ') : '')
    + (v.oneKind ? ' · ' + v.oneKind + ' does the most damage in every wave' : ' · wave leaders: ' + v.tops.join(', ')));
  console.log(misses.length ? misses.map(m => 'FAIL ' + m).join('\n') : 'ok');
  process.exitCode = misses.length ? 1 : 0;
}
