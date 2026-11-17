// node tools/balance.js [--seeds 6] [--minutes 90]: plays the start of the game with a steady, sensible player (no
// waiting, no mistakes) straight on the simulation core: a new game in Dry Creek Outpost until it is won, then Copper
// Gulch from the moment it opens, with Dry Creek working in the background. It checks the pacing targets so far:
//   Dry Creek: the first tower under 1 minute, won in 8-12 minutes, no breach in waves 1-3;
//   Copper Gulch (counted from when it opens): wave 10 cleared in 7-9 minutes, no breach in waves 1-3, the first
//   charter offered at 35-45 minutes. The player signs the first charter once it pays a deed (--sign n: once it pays n), picks the
//   first side of every perk pair it can, and plays on; it reports how long the new charter takes to get back to the
//   old one's best wave.
// It calls the next wave early (Call now) when its towers are clearly ahead (CALL_AGE); --no-call turns that off.
// The player picks towers the way a careful player would: every open tower kind on every empty pad it fits (mortar
// pits included), and every upgrade, scored by damage per coin over the stretch of road that pad covers. It reports
// which kinds it bought and which kind did the most damage in each wave.
// Tower variety (a release gate since the M1 target): every tower kind is the best buy at some point in the first
// hour, and no single kind does the most damage in every wave.
// Prints a table per seed and "ok" or the misses.
import { newGame } from '../src/core/setup.js';
import { GOALS } from '../src/data/goals.js';
import { goalNow } from '../src/core/goals.js';
import { build, cost, unlocked, missing, output, uses } from '../src/core/economy.js';
import { price as marketPrice } from '../src/core/market.js';
import { bestFactor, oldGround, buildTower, upgradeTower, towerCost, towerStats, canPay, towerAt, towerOpen, fitsSpot, roadOf, isPit, callEarly, bossWave, wavesOf } from '../src/core/defense.js';
import { pointAt, dist } from '../src/core/path.js';
import { BUILDINGS } from '../src/data/buildings.js';
import { GOODS } from '../src/data/goods.js';
import { TOWERS, PATHS, PATH_LEVEL, POISON_SECONDS } from '../src/data/towers.js';
import { itemsOf, researchBlock, researchCost, startResearch } from '../src/core/research.js';
import { canHire, hireCost, hireForeman } from '../src/core/foremen.js';
import { deedsFor, signCharter, pickPerk, perkState } from '../src/core/charter.js';
import { PERKS } from '../src/data/perks.js';
import { FOES, WAVE_TYPES } from '../src/data/foes.js';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? +process.argv[i + 1] : d; };
const SEEDS = arg('seeds', 6), MINUTES = arg('minutes', 90), SIGN_AT = arg('sign', 1);
let CALL = !process.argv.includes('--no-call');
export const setCall = on => { CALL = on; };
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
/* The share of a tower kind's hit that lands on the coming wave: armor shrugs some off (poison gets past it) and the
   kind's best raiders take more (bestFactor), weighted by health and averaged over the wave kinds open at wave w. A
   boss wave adds its boss: the town's own wagon, in a wave of about count(w) raiders. */
export function hitShare(town, kind, w, poison = false) {
  const kinds = Object.values(WAVE_TYPES).filter(T => w >= T.from);
  const f = k => (poison ? 1 : 1 - FOES[k].armor) * (poison || kind !== 'still' ? bestFactor(kind, k) : 1);
  let hp = 0, a = 0;
  for (const T of kinds) { let h = 0, x = 0; for (const [k, n] of Object.entries(T.mix)) if (w >= FOES[k].from) { h += n * FOES[k].hp; x += n * FOES[k].hp * f(k); } if (h) { hp += 1; a += x / h; } }
  let share = hp ? a / hp : 1;
  if (bossWave(town, w)) { const b = (town.def && town.def.boss) || 'wagon', bh = FOES[b].hp, rest = wavesOf(town).count(w); share = (share * rest + bh * f(b)) / (rest + bh); }
  return share;
}
/* A careful player buys for the next few waves, not just the coming one, so the boss is seen coming (HORIZON waves). */
export const HORIZON = 5;
const ahead = (town, kind, w, poison) => { let a = 0; for (let k = 0; k < HORIZON; k++) a += hitShare(town, kind, w + k, poison); return a / HORIZON; };
/* Damage a tower deals per second to a column of raiders passing through its reach, times the road it covers. */
export function worth(town, t, support = true) {
  const st = towerStats(town, t), targets = r => Math.max(1, 2 * r / SPACING);
  // a raider carries one dose of poison and one chill, so towers of the same kind that reach the same road share it
  const share = 1 + town.towers.filter(o => o.kind === t.kind && o.spot !== t.spot && dist(town.def.board.spots[o.spot], town.def.board.spots[t.spot]) < st.range + towerStats(town, o).range).length;
  let dps = st.dmg * st.rate * ahead(town, t.kind, town.wave);
  if (st.pulse) dps *= Math.min(4, targets(st.range) / 2);
  else if (st.splash) dps *= targets(st.splash);
  if (st.poison) dps += st.poison * ahead(town, t.kind, town.wave, true) * Math.min(1, st.rate * POISON_SECONDS) * targets(st.cloud) / share; // past armor
  if (st.slow) dps *= 1 + st.slow * 2 / share; // slowed raiders take longer to pass every tower
  if (st.fire) dps *= 1.35;
  let w = dps * cover(town, t.spot, st.minRange, st.range);
  // a slowing tower also gives the towers around it more time to shoot
  if (st.slow && support) for (const o of town.towers) if (o.spot !== t.spot && o.kind !== t.kind && dist(town.def.board.spots[o.spot], town.def.board.spots[t.spot]) < st.range + towerStats(town, o).range) w += st.slow * .5 * worth(town, o, false) / share;
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

/* A new tower of a kind the town already has is worth a little less to a careful player, who keeps a mix of kinds
   for the different raiders (each one of that kind already standing takes MIX off, as 1 / (1 + MIX * n)). */
export const MIX = .3;
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
    const mix = 1 / (1 + MIX * town.towers.filter(x => x.kind === kind).length); // a careful player keeps a mix
    for (const spot of empty) if (fitsSpot(town, spot, kind)) out.push({ up: false, kind, spot, level: 0, value: mix * worth(town, { kind, spot, level: 1, path: null }) / (price(c) + (isPit(town, spot) ? 0 : pad)), can: canPay(town, c) });
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
/* A buy this many times better, with its goods in the yard, is worth saving coins for. */
export const SAVE_FOR = 1.4, SAVE_GAP = 100; // and no more than this many coins away
export const PAYBACK = { active: 300, minmax: 300, swarm: 300, economy: 900, defense: 120 };
/* Calling the next wave early (Call now, M2 Skill pays): a careful player calls when the last wave was over within
   CALL_AGE of the town's wave pace (its towers are clearly ahead), nothing got through in the last two waves and the
   vault is above 60%. It never calls a boss wave early. The newcomer never calls (tools/firstplay.js) except once,
   when the goal strip asks. --no-call turns calling off, to see what it is worth. */
export const CALL_AGE = .45;
/* Once the first boss is down, it follows a goal that asks for a new tower kind when that tower is worth at least this
   share of its best pick (before that it plays for the boss: an early Cannon on seed 1 cost two calls and 1.4 min). */
export const GOAL_PICK = .6;

/* One player's run: every second, defend first when the defense is thin for the coming wave (the best affordable
   build or upgrade the strategy allows, by value), then research (the cheapest item that does not cost more than the
   next building), then (after the first boss) a foreman for a building at level 10 once it can pay for one, then the
   best-paying building. The economy player buys its next building before defending unless a raider got through in
   the last two waves. */
export function play(seed, minutes = MINUTES, strategy = 'active', watch = null, { game = null, until = null } = {}) {
  const S = STRATEGIES[strategy], g = game || newGame('balance-' + seed, 'gulch'), t = g.town, mine = e => e.town === t.id, offs = [];
  const on = (name, fn) => offs.push(g.bus.on(name, fn));
  const r = { seed, strategy, offer: null, signed: null, regain: null, life: {}, foremen: [], research: {}, firstResearch: null, firstTower: null, wave10: null, wave20: null, breaches: [], waveAt: {}, bought: {}, firstBuy: {}, top: [], dealt: {}, leakAt: -99, bump: 0, reach: {}, news: [] };
  on('wave:start', e => { if (mine(e)) g.dealt = {}; });
  // how long the last wave lasted, as a share of the wave pace (Call now skips what is left of it)
  r.lastAge = 1; r.calls = 0;
  on('wave:clear', e => { if (mine(e)) r.lastAge = t.waves.age / wavesOf(t).pace; });
  on('leak', e => { if (!mine(e)) return; if (r.leakAt !== t.wave) r.bump += .5; r.leakAt = t.wave; });
  on('wave:clear', e => {
    if (!mine(e)) return;
    if (e.wave === 10 && r.wave10 === null) { r.wave10 = t.t; r.calls10 = r.calls; }
    if (e.wave === 20 && r.wave20 === null) r.wave20 = t.t;
    if (!r.signed) r.reach[e.wave] ??= t.t; // the first climb, to compare the charter's regain with
    const d = (g.dealt || {})[t.id] || {}, best = Object.entries(d).sort((a, b) => b[1] - a[1])[0];
    if (best && t.t <= 3600) { r.top.push([e.wave, best[0], Object.keys(d).length]); for (const [k, n] of Object.entries(d)) r.dealt[k] = (r.dealt[k] || 0) + n; }
  });
  on('breach', e => { if (mine(e)) r.breaches.push(e.wave); });
  on('research:new', e => { if (mine(e) && !r.signed) r.news.push(t.t); });
  on('charter:offer', e => { if (mine(e)) r.offer = t.t; });
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
    let pick = opts[0];
    // when it adds a tower and the goal strip asks for a kind it has not built yet, it builds that kind (if it can pay)
    const gk = pick && !pick.up && t.bestWave >= 10 && (goalNow(g) || {}).kind;
    if (gk && gk !== pick.kind && !t.towers.some(x => x.kind === gk)) { const o = opts.find(o => !o.up && o.kind === gk); if (o && o.value >= GOAL_PICK * pick.value) pick = o; }
    // a careful player saves for a much better new tower whose goods are already in the yard and whose coins are
    // nearly there, rather than build a weak one, while the vault is holding (returns true: the coins wait, the town
    // does not spend them either)
    if (!S.even && !S.ups && t.towers.length && t.vault.hp >= .6 * t.vault.max) {
      const ready = options(t).filter(o => !o.can && !o.up && t.towers.length < want && towerCost(t, o.kind, 0).coins <= t.coins + SAVE_GAP
        && Object.entries(towerCost(t, o.kind, 0).goods).every(([k, n]) => t.has(k, n)))[0];
      if (ready && (!pick || ready.value > SAVE_FOR * pick.value)) return true;
    }
    if (!pick) return false;
    const ok =pick.up ? upgradeTower(g, t, pick.spot, pick.path) : buildTower(g, t, pick.spot, pick.kind);
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
  // the towers are clearly ahead: call the next wave now
  const ahead = () => {
    const ws = t.waves, w = t.wave;
    if (ws.phase !== 'break' || ws.hold || t.won || ws.timer < 2 || bossWave(t, w)) return false;
    // on old ground (waves the town beat before its charter) it calls as soon as the road is clear
    return w - r.leakAt > 2 && t.vault.hp >= .6 * t.vault.max && (r.lastAge <= CALL_AGE || oldGround(t));
  };
  for (let s = 0; s < minutes * 60 * 4; s++) {
    g.step(.25);
    if (until && until(t)) { r.until = t.t; break; }
    if (CALL && ahead() && callEarly(g, t) >= 0) r.calls++;
    if (s % (60 * 4) === 0 || s === minutes * 240 - 1) { r.waveAt[Math.round(s / 240)] = t.wave; r.life[Math.round(s / 240)] = [t.bestWave, Math.round(t.lifetime), deedsFor(t)]; }
    if (watch && s % 240 === 0) watch(g, t, r);
    if (s % 4) continue;
    // the first charter: signed once it pays SIGN_AT deeds; then pick the first side of each open perk pair
    if (!r.signed && deedsFor(t) >= SIGN_AT) {
      r.signed = { at: t.t, wave: t.bestWave, coins: Math.round(t.lifetime), deeds: signCharter(g, t) };
      r.leakAt = -99; r.lastAge = 1; r.bump = 0; // a new start: the old leaks are forgotten
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
  for (const off of offs) off();
  r.final = { wave: t.wave, best: t.bestWave, lifetime: Math.round(t.lifetime), towers: t.towers.map(x => x.kind + x.level + (x.path || '')), buildings: { ...t.buildings } };
  return r;
}

/* The whole start of the game: a new game in Dry Creek Outpost, played until it is won (or for OUTPOST_MINUTES), then
   Copper Gulch from the moment it opens, with Dry Creek working and raided in the background. The Gulch's times count
   from when it opens (its own clock starts then). Returns { dc, gulch } (gulch is null if Dry Creek was never won). */
export const OUTPOST_MINUTES = 30;
export function campaign(seed, strategy = 'active', minutes = MINUTES) {
  const g = newGame('balance-' + seed), goals = {};
  // the goal strip: when each goal was done, in seconds from the new game
  const off = g.bus.on('goal:done', e => { goals[e.id] = g.stats.steps * .25; });
  const dc = play(seed, OUTPOST_MINUTES, strategy, null, { game: g, until: t => t.won });
  dc.won = g.town.won ? dc.until : null;
  if (!g.town.won) { off(); return { dc, gulch: null, game: g, goals }; }
  g.go(g.town.def.opens);
  const gulch = play(seed, minutes, strategy, null, { game: g });
  gulch.outpost = { wave: g.towns.drycreek.wave, breaches: g.towns.drycreek.breaches || 0, coins: Math.round(g.towns.drycreek.lifetime) };
  off();
  return { dc, gulch, game: g, goals };
}

/* The goal strip check (M2, The first 30 minutes): the careful player finishes every goal within GOAL_MINUTES of a
   new game on every seed. Returns { rows: [{ id, text, times }], misses }. */
export const GOAL_MINUTES = 40;
export function goalCheck(camps) {
  const rows = GOALS.map(x => ({ id: x.id, text: x.text, times: camps.map(c => c.goals[x.id] ?? null) }));
  const misses = [];
  for (const r of rows) {
    const late = r.times.map((t, i) => [t, camps[i].dc.seed]).filter(([t]) => t === null || t > GOAL_MINUTES * 60);
    if (late.length) misses.push('goal ' + r.id + ' not done within ' + GOAL_MINUTES + ' min on seed(s) ' + late.map(([, s]) => s).join(','));
  }
  return { rows, misses };
}

/* The strategy check (CLAUDE.md, Strategies must stay close): every strategy over the seeds, the median time to
   clear waves 10 and 20, and a miss when a strategy is more than 25% slower than the best one or breaches in waves
   1-3. Returns { rows, misses }. */
export const STRATEGY_MINUTES = 40, STRATEGY_SLACK = 1.25;
export function strategies(seeds = SEEDS) {
  const med = a => { const b = a.filter(x => x != null).sort((x, y) => x - y); return b.length * 2 <= a.length ? null : b[Math.floor(b.length / 2)]; };
  const rows = Object.keys(STRATEGIES).map(k => {
    const camps = []; for (let s = 1; s <= seeds; s++) camps.push(campaign(s, k, STRATEGY_MINUTES));
    const runs = camps.map(c => c.gulch).filter(Boolean), dcs = camps.map(c => c.dc);
    const dealt = {}, bought = {};
    for (const r of runs) { for (const [a, n] of Object.entries(r.dealt)) dealt[a] = (dealt[a] || 0) + n; for (const [a, n] of Object.entries(r.bought)) bought[a] = (bought[a] || 0) + n; }
    return { strategy: k, runs, won: med(dcs.map(r => r.won)), dcEarly: dcs.filter(r => r.breaches.some(w => w <= 3)).length, dcBought: dcs.reduce((a, r) => a + (r.bought.crossbow || 0), 0) / seeds, dcLevel: med(dcs.map(r => r.final.towers.reduce((a, x) => a + parseInt(x.replace(/\D+/g, ''), 10), 0) / Math.max(1, r.final.towers.length))), wave10: med(runs.map(r => r.wave10)), wave20: med(runs.map(r => r.wave20)), coins30: med(runs.map(r => r.life[30] && r.life[30][1])), early: runs.filter(r => r.breaches.some(w => w <= 3)).length, firstBreach: runs.map(r => r.breaches[0] ?? null), dealt, bought };
  });
  const misses = [];
  for (const key of ['won', 'wave10', 'wave20']) {
    const best = Math.min(...rows.map(x => x[key] ?? Infinity));
    for (const x of rows) if (x[key] === null || x[key] > best * STRATEGY_SLACK) misses.push(`${x.strategy}: ${key === 'won' ? 'Dry Creek won' : key === 'wave10' ? 'wave 10' : 'wave 20'} at ${x[key] === null ? 'never' : (x[key] / 60).toFixed(1) + ' min'}, more than 25% behind the best (${(best / 60).toFixed(1)} min)`);
  }
  for (const x of rows) if (x.early) misses.push(`${x.strategy}: a breach in waves 1-3 on ${x.early} seed(s)`);
  for (const x of rows) if (x.dcEarly) misses.push(`${x.strategy}: a breach in Dry Creek's waves 1-3 on ${x.dcEarly} seed(s)`);
  return { rows, misses };
}

/* Tower balance (M2, fresh-eyes issue 2): no kind does more than SHARE_MAX of the damage for any strategy, and every
   kind does the most damage in some wave for at least one strategy. Returns the misses. */
export const SHARE_MAX = .36; // "about 35%"
export function towerBalance(rows) {
  const misses = [], led = new Set();
  for (const x of rows) {
    const tot = Object.values(x.dealt).reduce((a, b) => a + b, 0) || 1;
    for (const [k, n] of Object.entries(x.dealt)) if (n / tot > SHARE_MAX) misses.push(`${x.strategy}: ${k} does ${Math.round(100 * n / tot)}% of the damage (want at most ${Math.round(100 * SHARE_MAX)}%)`);
    for (const r of x.runs) for (const [, k, n] of r.top) if (n > 1) led.add(k);
  }
  for (const k of Object.keys(TOWERS)) if (!led.has(k)) misses.push(`${k} never does the most damage in a wave, for any strategy`);
  return misses;
}
/* The charter's payoff (M2, fresh-eyes issue 3): a signed town gets back to its old best wave in REGAIN_MAX of the
   first climb or less (the median over the seeds; no seed over REGAIN_SEED), and something new opens between minute
   NEW_FROM and the first charter offer. */
export const REGAIN_MAX = .5, REGAIN_SEED = .67, NEW_FROM = 23;
export function charterPayoff(runs) {
  const misses = [], shares = [];
  for (const r of runs) {
    if (!r.signed) { misses.push(`seed ${r.seed}: the charter was never signed`); continue; }
    if (r.regain === null) { misses.push(`seed ${r.seed}: never got back to wave ${r.signed.wave} after the charter`); continue; }
    const k = r.regain / r.reach[r.signed.wave]; shares.push(k);
    if (k > REGAIN_SEED) misses.push(`seed ${r.seed}: back to wave ${r.signed.wave} in ${Math.round(100 * k)}% of the first climb (want at most ${Math.round(100 * REGAIN_SEED)}%)`);
    const late = r.news.filter(t => t >= NEW_FROM * 60 && (r.offer === null || t <= r.offer));
    if (!late.length) misses.push(`seed ${r.seed}: nothing new opens between minute ${NEW_FROM} and the charter offer`);
  }
  const med = shares.sort((a, b) => a - b)[Math.floor(shares.length / 2)];
  if (med > REGAIN_MAX) misses.push(`the median regain is ${Math.round(100 * med)}% of the first climb (want at most ${Math.round(100 * REGAIN_MAX)}%)`);
  return misses;
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
  const m = x => x === null ? 'never' : (x / 60).toFixed(1) + ' min';
  console.log('Dry Creek Outpost: seed | first tower | won | waves called early | breaches (waves) | Crossbows bought | camp levels');
  const camps = [];
  for (let s = 1; s <= SEEDS; s++) {
    const c = campaign(s); camps.push(c); const d = c.dc;
    console.log(`${s} | ${d.firstTower === null ? 'never' : Math.round(d.firstTower) + ' s'} | ${m(d.won)} | ${d.calls} | ${d.breaches.join(',') || 'none'} | ${d.bought.crossbow || 0} | ${Object.entries(d.final.buildings).map(([k, n]) => k + ' ' + n).join(', ')}`);
    if (d.firstTower === null || d.firstTower > 60) misses.push(`seed ${s}: Dry Creek's first tower at ${d.firstTower} s (want under 60)`);
    if (d.won === null || d.won < 8 * 60 || d.won > 12 * 60) misses.push(`seed ${s}: Dry Creek won at ${m(d.won)} (want 8-12 min)`);
    if (d.breaches.some(w => w <= 3)) misses.push(`seed ${s}: a breach in Dry Creek's waves 1-3`);
    if (!c.gulch) misses.push(`seed ${s}: Copper Gulch never opened`);
  }
  console.log('Copper Gulch, from when it opens, with Dry Creek running: seed | first tower | wave 10 | waves called early by wave 10 | breaches (waves) | wave at 10/20/30/40/60 min | lifetime coins (from Dry Creek) | Dry Creek after (breaches, coins)');
  for (const c of camps) {
    if (!c.gulch) continue;
    const r = c.gulch, s = c.dc.seed; runs.push(r);
    const w10 = r.wave10 === null ? 'never' : (r.wave10 / 60).toFixed(1) + ' min';
    console.log(`${s} | ${r.firstTower === null ? 'never' : Math.round(r.firstTower) + ' s'} | ${w10} | ${r.calls10 ?? r.calls} | ${r.breaches.join(',') || 'none'} | ${[10, 20, 30, 40, 60].map(m => r.waveAt[m] ?? '-').join('/')} | ${r.final.lifetime} (${Math.round(c.game.towns.gulch.fromOutposts)}) | ${r.outpost.breaches}, ${r.outpost.coins}`);
    if (r.firstTower === null || r.firstTower > 60) misses.push(`seed ${s}: first tower at ${r.firstTower} s (want under 60)`);
    if (r.wave10 === null || r.wave10 < 7 * 60 || r.wave10 > 9 * 60) misses.push(`seed ${s}: wave 10 at ${w10} (want 7-9 min)`);
    if (r.breaches.some(w => w <= 3)) misses.push(`seed ${s}: a breach in waves 1-3`);
    if (r.offer === null || r.offer < 35 * 60 || r.offer > 45 * 60) misses.push(`seed ${s}: the first charter offered at ${r.offer === null ? 'never' : (r.offer / 60).toFixed(1) + ' min'} (want 35-45 min)`);
  }
  const gc = goalCheck(camps);
  console.log('goals (minutes from a new game, per seed):');
  for (const r of gc.rows) console.log('  ' + r.id + ' | ' + r.times.map(t => t === null ? 'never' : (t / 60).toFixed(1)).join(' '));
  misses.push(...gc.misses);
  console.log('charter (offered, signed at best wave and coins, deeds, back to that wave after): ' + runs.map(r => 'seed ' + r.seed + ' ' + m(r.offer) + (r.signed ? ', signed ' + m(r.signed.at) + ' at wave ' + r.signed.wave + ' and ' + Math.round(r.signed.coins / 1000) + 'K for ' + r.signed.deeds + ', back in ' + m(r.regain) + (r.regain !== null ? ' (' + Math.round(100 * r.regain / r.reach[r.signed.wave]) + '% of the first climb)' : '') : ', not signed')).join(' | '));
  console.log('research levels (first started at): ' + runs.map(r => 'seed ' + r.seed + ' ' + (r.firstResearch === null ? 'never' : (r.firstResearch / 60).toFixed(1) + ' min') + ' ' + Object.entries(r.research).map(([k, n]) => k + ' ' + n).join(', ')).join(' | '));
  console.log('foremen hired (building, minute): ' + runs.map(r => 'seed ' + r.seed + ' ' + (r.foremen.join(', ') || 'none')).join(' | '));
  console.log('towers bought (first minute bought, in the first hour):');
  for (const r of runs) console.log(`  seed ${r.seed}: ` + Object.keys(TOWERS).map(k => `${k} ${r.bought[k] || 0}` + (r.firstBuy[k] !== undefined ? ` (min ${r.firstBuy[k]})` : '')).join(', '));
  console.log('most damage per wave (first hour): ' + runs.map(r => `seed ${r.seed} ` + r.top.map(([w, k]) => w + ':' + k).join(' ')).join(' | '));
  console.log(`strategies (median over ${SEEDS} seeds; Dry Creek, then ${STRATEGY_MINUTES} min of the Gulch): strategy | Dry Creek won | Crossbows there, their level | wave 10 | wave 20 | coins at 30 min | first breach (wave) | buys by kind | damage by kind`);
  const st = strategies();
  for (const x of st.rows) {
    const tot = Object.values(x.dealt).reduce((a, b) => a + b, 0) || 1, mm = v => v === null ? 'never' : (v / 60).toFixed(1) + ' min';
    console.log(`  ${x.strategy} | ${mm(x.won)} | ${x.dcBought.toFixed(0)}, ${x.dcLevel === null ? '-' : x.dcLevel.toFixed(1)} | ${mm(x.wave10)} | ${mm(x.wave20)} | ${x.coins30 === null ? '-' : Math.round(x.coins30 / 1000) + 'K'} | ${x.firstBreach.map(w => w ?? '-').join(',')} | `
      + Object.entries(x.bought).map(([k, n]) => k + ' ' + n).join(', ') + ' | ' + Object.entries(x.dealt).sort((a, b) => b[1] - a[1]).map(([k, n]) => k + ' ' + Math.round(100 * n / tot) + '%').join(', '));
  }
  misses.push(...st.misses, ...towerBalance(st.rows), ...charterPayoff(runs));
  console.log('new before the charter (minute): ' + runs.map(r => 'seed ' + r.seed + ' ' + (r.news.map(t => (t / 60).toFixed(1)).join(', ') || 'none')).join(' | '));
  const v = variety(runs);
  if (v.never.length) misses.push('variety: never the best buy in the first hour: ' + v.never.join(', '));
  if (v.oneKind) misses.push('variety: ' + v.oneKind + ' does the most damage in every wave');
  console.log('variety: ' + (v.never.length || v.oneKind ? 'MISS' : 'ok')
    + (v.never.length ? ' · never the best buy in the first hour: ' + v.never.join(', ') : '')
    + (v.oneKind ? ' · ' + v.oneKind + ' does the most damage in every wave' : ' · wave leaders: ' + v.tops.join(', ')));
  console.log(misses.length ? misses.map(m => 'FAIL ' + m).join('\n') : 'ok');
  process.exitCode = misses.length ? 1 : 0;
}
