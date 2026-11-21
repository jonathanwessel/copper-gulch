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
import { goalNow, goalContext } from '../src/core/goals.js';
import { build, cost, unlocked, missing, output, uses, buildingsOf, isOutpost, gridOf, onGrid, isGrid } from '../src/core/economy.js';
import { price as marketPrice } from '../src/core/market.js';
import { RUSH, rushOf, setHold, bestFactor, oldGround, buildTower, upgradeTower, towerCost, towerStats, canPay, towerAt, towerOpen, fitsSpot, roadOf, isPit, callEarly, bossWave, wavesOf, lanesOf } from '../src/core/defense.js';
import { pointAt, dist } from '../src/core/path.js';
import { BUILDINGS } from '../src/data/buildings.js';
import { GOODS } from '../src/data/goods.js';
import { TOWERS, PATHS, PATH_LEVEL, POISON_SECONDS } from '../src/data/towers.js';
import { itemsOf, researchBlock, researchCost, startResearch } from '../src/core/research.js';
import { canHire, hireCost, hireForeman, setForeman, foremanWait, nextGain, wanted } from '../src/core/foremen.js';
import { deedsFor, deedsHeld, signCharter, pickPerk, perkState } from '../src/core/charter.js';
import { PERKS } from '../src/data/perks.js';
import { FOES, WAVE_TYPES } from '../src/data/foes.js';
import { TOWNS } from '../src/data/towns/index.js';
import { canFound, foundTown } from '../src/core/empire.js';
import { canFoundCapital, foundCapital, capitalOf, takeContract } from '../src/core/capital.js';
import { CAPITAL_DEF } from '../src/data/capital.js';
import { foundCost, foundBlock, foundInstitution, nodeBlock, nodeCost, buyNode, founded } from '../src/core/tree.js';
import { INSTITUTIONS } from '../src/data/institutions.js';
import { encode, decode } from '../src/core/save.js';
import { loadGame } from '../src/core/setup.js';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? +process.argv[i + 1] : d; };
const SEEDS = arg('seeds', 6), MINUTES = arg('minutes', 90), SIGN_AT = arg('sign', 1), EMPIRE_SEEDS = arg('empire-seeds', 3);
let CALL = !process.argv.includes('--no-call');
export const setCall = on => { CALL = on; };
const SPACING = 1.1; // about how far apart raiders ride, in world units

/* Road units inside a ring [lo, hi] around a spot (memoized per board: spot numbers repeat across towns, and a run
   that played Iron Ridge first used to read the Ridge's numbers for the Gulch's pads). A river town counts the river
   too, each lane weighted by the share of raiders that ride it (every boatEvery-th raider comes by boat). */
const COVER = new WeakMap();
export function cover(town, spot, lo, hi) {
  const b = town.def.board, key = spot + ':' + lo.toFixed(2) + ':' + hi.toFixed(2);
  if (!COVER.has(b)) COVER.set(b, new Map());
  const m = COVER.get(b);
  if (!m.has(key)) {
    const lanes = lanesOf(town), p = b.spots[spot], boat = lanes.length > 1 ? 1 / (wavesOf(town).boatEvery || 3) : 0; let n = 0;
    lanes.forEach((r, i) => {
      const w = lanes.length > 1 ? (i ? boat : 1 - boat) : 1;
      for (let s = 0; s <= r.length; s += .1) { const d = dist(p, pointAt(r, s)); if (d >= lo && d <= hi) n += .1 * w; }
    });
    m.set(key, n);
  }
  return m.get(key);
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
/* The order a careful player hires foremen in: the buildings highest up the chain first (finished goods, then
   intermediate, then camps), so the workshops grow and the camps follow only when a workshop is short. */
export const hireOrder = town => buildingsOf(town).slice().reverse();
/* The power grid (Silver Falls): a careful player raises the Water Wheel instead when the grid is short now, or when the
   level it picked for a workshop on the grid would leave it short. */
export function gridFirst(town, id) {
  const wheel = (town.def.buildings || []).find(b => isGrid(BUILDINGS[b].makes));
  if (!wheel || !unlocked(town, wheel)) return id;
  if (gridOf(town).share < 1) return wheel;
  if (!id || !onGrid(id)) return id;
  const L = town.level(id); town.buildings[id] = L + 1; const after = gridOf(town).share; town.buildings[id] = L; if (!L) delete town.buildings[id];
  return after < 1 ? wheel : id;
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
     minmax: a few towers on the best pads, pushed to high levels and their paths, at most two Crossbows and two Mortars
       and one each of the other kinds (one Frost Lens and one Still since 2026.11.18-15: in Silver Falls, where every
       tower stands near level 15, its two lenses and two Crossbows took turns doing 37-39% of the damage, its Still near
       the vault doing none; in the Gulch one lens alone left two Stills at 41%)
       (with boss waves as gates it keeps up to 7 towers, and two high Cannons did 38-41% of its damage) (with one
       purse, small differences in coins at the Gulch's start sent it into three Crossbows and no Still, stuck at wave 20).
     swarm: towers on every pad it can (a new one every wave or two), kept at low levels and raised evenly.
     economy: the town first while no raider got through in the last two waves, with the fewest towers that hold
       (each wave that lets a raider through raises its towers half a level for good).
     defense: towers first, the town gets what is left. */
/* The active player, once a raider got through, keeps its towers GUARD.levels higher for the next GUARD.waves waves:
   with Call now never locked, a called wave that leaked left Dry Creek's vault at 40% for the bandit wagon (seed 2). */
export const GUARD = { waves: 3, levels: 1 };
/* Boss waves are gates: a boss that gets through drops the town back and holds its waves. The bot builds for RETRY
   seconds (its towers keep the GUARD levels), then taps Resume waves. */
export const RETRY = 20;
/* A careful player gets ready for a boss: its towers aim BOSS.prep levels higher while a boss wave is next or on the
   road. Each time that boss gets through it wants BOSS.retry levels more and one tower more, from then (the waves it
   dropped back to) until the boss is down. */
export const BOSS = { prep: 1, retry: 1 };
const bossExtra = (t, r, S = {}) => (bossWave(t, t.wave) ? S.prep ?? BOSS.prep : 0) + BOSS.retry * (r.bossLost || 0);
const guard = (w, r) => (r && w - r.leakAt <= GUARD.waves ? GUARD.levels : 0);
export const STRATEGIES = {
  active: { want: w => 1 + Math.ceil(w / 2.8), level: (w, r) => 1.4 + w / 2.9 + guard(w, r) },
  minmax: { want: w => Math.min(7, 1 + Math.ceil(w / 4)), level: w => 2 + w / 2, ups: true, most: 2, one: ['cannon', 'frost', 'still'] },
  swarm: { want: w => 2 + Math.ceil(w / 1.5), level: w => 1 + w / 4, even: true },
  economy: { want: w => 1 + Math.ceil(w / 3.5), level: (w, r) => 1.3 + w / 3.3 + r.bump, eco: true },
  defense: { want: w => 1 + Math.ceil(w / 2.5), level: w => 1.5 + w / 2.8 },
};

/* Seconds a building may take to pay for itself and still come before the towers. */
/* A buy this many times better, with its goods in the yard, is worth saving coins for. */
export const SAVE_FOR = 1.4, SAVE_GAP = 100; // and no more than this many coins away
// economy: 400 s (was 900; once the bots read each town's own pads right, at 900 its Gulch wave 10 came 27% behind)
export const PAYBACK = { active: 300, minmax: 300, swarm: 300, economy: 400, defense: 120 };
/* Calling the next wave early (Call now, M2 Skill pays): a careful player calls when the last wave was over within
   CALL_AGE of the town's wave pace (its towers are clearly ahead), nothing got through in the last two waves and the
   vault is above 60%. It never calls a boss wave early. The newcomer never calls (tools/firstplay.js) except once,
   when the goal strip asks. --no-call turns calling off, to see what it is worth. */
export const CALL_AGE = .45;
/* While saving for a new town the player holds the waves and buys only a building that pays for itself within
   SAVE_PAYBACK seconds. */
export const SAVE_PAYBACK = 120;
/* Once the first boss is down, it follows a goal that asks for a new tower kind when that tower is worth at least this
   share of its best pick (before that it plays for the boss: an early Cannon on seed 1 cost two calls and 1.4 min). */
export const GOAL_PICK = .6;

/* One player's run: every second, defend first when the defense is thin for the coming wave (the best affordable
   build or upgrade the strategy allows, by value), then research (the cheapest item that does not cost more than the
   next building), then (after the first boss) a foreman for a building at level 10 once it can pay for one, then the
   best-paying building. The economy player buys its next building before defending unless a raider got through in
   the last two waves. */
/* What the goal strip asks to build in this town, or in another town for a goal with there (the building, or while it
   is locked the cheapest level that opens it): { town, id }, or null. */
export function goalBuilding(game, town) {
  const gl = goalNow(game, false);
  if (!gl || game.town !== town) return null;
  if (gl.there) {
    const t = game.towns[gl.there[0]], id = gl.there[1];
    if (!t) return null;
    if (unlocked(t, id)) return { town: t, id };
    const need = missing(t, id).filter(n => unlocked(t, n.id)).sort((a, b) => cost(t, a.id) - cost(t, b.id));
    return need.length ? { town: t, id: need[0].id } : null;
  }
  const at = gl.at ? gl.at(goalContext(game, town)) || {} : {};
  return at.plot && BUILDINGS[at.plot] && unlocked(town, at.plot) ? { town, id: at.plot } : null;
}
/* With goals on (the Ridge), a careful player builds what the goal strip asks for once it can pay, and saves for it
   while the vault holds when its price is within GOAL_SAVE_MINUTES of what the purse earned in the last minute. */
export const GOAL_SAVE_MINUTES = 6;
export function play(seed, minutes = MINUTES, strategy = 'active', watch = null, { game = null, until = null, save = null, sign = true, signAt = SIGN_AT, tick = null, goals = false } = {}) {
  const S = STRATEGIES[strategy], g = game || newGame('balance-' + seed, 'gulch'), t = g.town, mine = e => e.town === t.id, offs = [];
  const on = (name, fn) => offs.push(g.bus.on(name, fn));
  const r = { seed, strategy, offer: null, signed: null, regain: null, life: {}, foremen: [], research: {}, firstResearch: null, firstTower: null, wave10: null, wave20: null, breaches: [], waveAt: {}, bought: {}, firstBuy: {}, top: [], dealt: {}, leakAt: -99, bump: 0, reach: {}, news: [] };
  on('wave:start', e => { if (mine(e)) g.dealt = {}; });
  // how long the last wave lasted, as a share of the wave pace (Call now skips what is left of it)
  r.lastAge = 1; r.calls = 0;
  on('wave:clear', e => { if (mine(e)) r.lastAge = t.waves.age / wavesOf(t).pace; });
  on('leak', e => { if (!mine(e)) return; if (r.leakAt !== t.wave) r.bump += .5; r.leakAt = t.wave; });
  on('breach', e => { if (mine(e) && e.why === 'boss') r.bossLost = (r.bossLost || 0) + 1; });
  on('wave:clear', e => { if (mine(e) && bossWave(t, e.wave)) r.bossLost = 0; });
  on('wave:clear', e => {
    if (!mine(e)) return;
    if (e.wave === 10 && r.wave10 === null) { r.wave10 = t.t; r.calls10 = r.calls; }
    if (e.wave === 20 && r.wave20 === null) r.wave20 = t.t;
    if (!r.signed) r.reach[e.wave] ??= t.t; // the first climb, to compare the charter's regain with
    const d = (g.dealt || {})[t.id] || {}, best = Object.entries(d).sort((a, b) => b[1] - a[1])[0];
    if (best && t.t <= 3600) { r.top.push([e.wave, best[0], Object.keys(d).length]); for (const [k, n] of Object.entries(d)) r.dealt[k] = (r.dealt[k] || 0) + n; }
  });
  on('breach', e => { if (mine(e)) { r.breaches.push(e.wave); (r.why ||= []).push(e.why); } });
  on('research:new', e => { if (mine(e) && !r.signed) r.news.push(t.t); });
  on('charter:offer', e => { if (mine(e)) r.offer = t.t; });
  // the defense buys while it is short of the strategy's towers or levels for the coming wave (the economy player
  // also waits until a raider got through in the last two waves, once it has its first towers)
  // urgent: short of towers, a tower more than a level behind, or the vault below 60%
  const defend = (urgent = false) => {
    const w = t.wave, want = S.want(w) + (r.bossLost || 0), lv = S.level(w, r) + bossExtra(t, r, S);
    // the goal strip asks for a kind it has not built yet (after the first boss): it builds one once it can pay, even
    // with all the towers it wants (seed 4 had a Mortar's coins and goods from minute 25 and its pads full, and built
    // none until minute 61: a player reads "Tap a Mortar pit and build a Mortar" and does it). Not swarm, which raises
    // every tower evenly: a lone new level-1 tower holds back all its upgrades (wave 20 at 21.2 min against 18.6)
    const gk0 = t.bestWave >= 10 && (goalNow(g, false) || {}).kind;
    if (gk0 && !S.even && !t.towers.some(x => x.kind === gk0)) {
      const o = options(t).find(o => !o.up && o.kind === gk0 && o.can);
      if (o && buildTower(g, t, o.spot, o.kind)) { r.bought[o.kind] = (r.bought[o.kind] || 0) + 1; if (t.t <= 3600) r.firstBuy[o.kind] ??= Math.round(t.t / 60); return true; }
    }
    if (t.towers.length >= want && !t.towers.some(x => x.level < lv)) return false;
    if (urgent && t.towers.length >= want && !t.towers.some(x => x.level < lv - 1.5) && t.vault.hp >= .6 * t.vault.max) return false;
    let opts = options(t).filter(o => o.can && (o.up ? o.level < lv : t.towers.length < want));
    if (S.even) { const low = Math.min(...t.towers.map(x => x.level)); opts = opts.filter(o => !o.up || o.level === low).sort((x, y) => (x.up - y.up) || (y.value - x.value)); }
    // a few strong towers, but no more than two of a kind (where only one kind can be built, Dry Creek, it keeps its
    // few towers: two Crossbows could not stop the bandit wagon once boss waves became gates)
    // An outpost with two kinds (Pine Hollow, Sandy Bend) lets it have half its towers of each: with one Cannon and two
    // Crossbows it stopped at 3 towers there, under its own count of 4-5 (2026.11.20-17: with more pads every other
    // strategy won Pine Hollow 40% sooner while it sat at 3)
    const nk = Object.keys(TOWERS).filter(k => towerOpen(t, k)).length, capOf = k => nk === 2 && isOutpost(t) ? Math.max(S.most, Math.ceil(want / 2)) : (S.one || []).includes(k) ? 1 : S.most;
    if (S.most && nk > 1) opts = opts.filter(o => o.up || t.towers.filter(x => x.kind === o.kind).length < capOf(o.kind));
    if (S.ups) opts.sort((x, y) => (y.up - x.up) || (y.value - x.value));
    let pick = opts[0];
    // when it adds a tower and the goal strip asks for a kind it has not built yet, it builds that kind (if it can pay)
    const gk = pick && !pick.up && t.bestWave >= 10 && (goalNow(g, false) || {}).kind;
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
    best = gridFirst(t, best);
  };
  let saving = false;
  const grow = () => {
    if (!t.lab && !(saving && t.coins < cost(t, best))) { // while saving for a building that pays fast, research waits
      const item = itemsOf(t).filter(id => researchBlock(t, id) === null).sort((a, b) => researchCost(t, a) - researchCost(t, b))[0];
      if (item && (!best || researchCost(t, item) <= cost(t, best)) && startResearch(g, t, item)) { r.research[item] = (r.research[item] || 0) + 1; r.firstResearch ??= t.t; return true; }
    }
    // a foreman along the chain, the building highest up it first (PLAN.md M4, Idle income grows), and only for one
    // whose next level is worth buying now (src/core/foremen.js, foremanWait): a camp flooding the market is not
    const boss = t.bestWave >= 10 && hireOrder(t).find(id => canHire(t, id) && hireCost(t, id) <= t.coins && !foremanWait(g, t, id));
    if (boss && hireForeman(g, t, boss)) { r.foremen.push(boss + ' ' + (t.t / 60).toFixed(1)); return true; }
    return !!best && t.coins >= cost(t, best) && build(g, t, best);
  };
  // the towers are clearly ahead: call the next wave now
  const ahead = () => {
    const ws = t.waves, w = t.wave;
    if (ws.phase !== 'break' || ws.hold || t.won || ws.timer < 2 || bossWave(t, w)) return false;
    // on old ground (waves the town beat before its charter) it calls as soon as the road is clear
    // a called wave comes bigger the earlier it is called (RUSH): it calls once the last wave's time, scaled up by that,
    // still fits under CALL_AGE
    return w - r.leakAt > 2 && t.vault.hp >= .6 * t.vault.max && (r.lastAge * (1 + RUSH.more * rushOf(t)) <= CALL_AGE || oldGround(t));
  };
  for (let s = 0; s < minutes * 60 * 4; s++) {
    g.step(.25);
    if (until && until(t)) { r.until = t.t; break; }
    if (CALL && !r.savingNow && ahead() && callEarly(g, t) >= 0) r.calls++;
    if (s % (60 * 4) === 0 || s === minutes * 240 - 1) { r.waveAt[Math.round(s / 240)] = t.wave; r.life[Math.round(s / 240)] = [t.bestWave, Math.round(t.lifetime), deedsFor(t)]; }
    if (watch && s % 240 === 0) watch(g, t, r);
    if (s % 4) continue;
    if (tick) tick(g, t, r);
    if (s % 240 === 0) { r.rate = Math.max(0, t.lifetime - (r.lastLife ?? t.lifetime)); r.lastLife = t.lifetime; r.all = Math.max(0, g.earned - (r.lastAll ?? g.earned)); r.lastAll = g.earned; } // coins earned in the last minute (this town, and every town into the purse)
    // the first charter: signed once it pays SIGN_AT deeds; then pick the first side of each open perk pair
    if (sign && !r.signed && deedsFor(t) >= signAt) {
      r.signed = { at: t.t, wave: t.bestWave, coins: Math.round(t.lifetime), deeds: signCharter(g, t) };
      r.leakAt = -99; r.lastAge = 1; r.bump = 0; // a new start: the old leaks are forgotten
      for (const p of PERKS) if (perkState(g, p.id) === 'open') pickPerk(g, p.id, 'a');
      continue;
    }
    if (r.signed && r.regain === null && t.bestWave >= r.signed.wave) r.regain = t.t - r.signed.at;
    // saving for something (founding the next town): only the defense buys, and only when it is short
    r.savingNow = !!(save && save(t, r));
    if (r.savingNow) {
      r.saving ??= t.t;
      for (const id of Object.keys(t.foremen)) setForeman(t, id, false); // foremen would spend the savings
      if (!t.waves.hold) setHold(g, t, true);
      pickBuilding();
      if (best && bv * SAVE_PAYBACK > 1 && t.coins >= cost(t, best)) build(g, t, best); // a building that pays for itself fast still helps the saving
      continue;
    }
    if (save && t.waves.hold) setHold(g, t, false);
    if (t.waves.autoHold) { r.heldAt ??= t.t; if (t.t - r.heldAt >= RETRY) { setHold(g, t, false); r.heldAt = null; r.retries = (r.retries || 0) + 1; } }
    if (r.saving && !r.savingNow) for (const id of Object.keys(t.foremen)) setForeman(t, id, true);
    // the goal strip asks for a building (with goals on, once the first boss is down): build it, or save for it
    if (goals && t.bestWave >= 10) {
      // not calm while a boss is next or beat it last time (the vault refills after a loss, so it would save for the goal
      // and never get ready for the boss: four lost trains at the Ridge's wave 20)
      const gb = goalBuilding(g, t), calm = t.towers.length > 0 && t.vault.hp >= .6 * t.vault.max && !bossWave(t, t.wave) && !(r.bossLost > 0);
      if (gb && calm) {
        if (t.coins >= cost(gb.town, gb.id)) { if (build(g, gb.town, gb.id)) continue; }
        else if (cost(gb.town, gb.id) <= GOAL_SAVE_MINUTES * (r.all || 0)) continue; // the vault holds: the towers wait
      }
    }
    // a building that pays for itself within the strategy's payback time comes before the towers
    pickBuilding();
    const boss = (bossWave(t, t.wave) && (S.prep ?? BOSS.prep) > 0) || r.bossLost > 0; // a boss is next, or beat it last time: the towers come first
    const safe = t.towers.length > 0 && t.wave - r.leakAt > 2 && !boss;
    const pays = saving = t.towers.length > 0 && t.wave - r.leakAt > 1 && !boss && bv * PAYBACK[strategy] > 1; // not right after a leak
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

/* M3, the empire run: the start of the game as in campaign(), then on into Iron Ridge. In the Gulch the player signs
   the first charter when it pays a deed (as above) and climbs back. Once the Gulch's best wave reaches the Ridge's mark
   and the price is no more than SAVE_MINUTES of the Gulch's income, it saves: it holds the Gulch's waves, switches its
   foremen off and buys only a building that pays for itself within SAVE_PAYBACK, until it can found the Ridge (at most
   GULCH_MINUTES). Then it plays Pine Hollow until it is won (at most OUTPOST_MINUTES) and the Ridge for RIDGE_MINUTES,
   with Dry Creek, Pine Hollow and the Gulch working in the background. Once a minute in the Ridge it looks at the
   Gulch for the goods it ships (tendImports). It never signs the Ridge's charter here.
   Times: found is play time from the new game; Pine Hollow's and the Ridge's times count from when the player gets
   there. Returns { dc, gulch, found, ph, ridge, game, goals, imports }. */
export const SAVE_MINUTES = 6, GULCH_MINUTES = 100, RIDGE_MINUTES = 90;
// M4, the Capital: after the Ridge's RIDGE_MINUTES the player plays on in the Ridge and, once its best wave reaches the
// Capital's mark and the price is no more than CAP_SAVE_MINUTES of what every town earns, saves for it the same way
// (at most CAP_MINUTES). Then it plays CAP_PLAY minutes more, always working on the contract that pays the most Influence.
// Institutions (M4): while it plays on, it founds the next institution (in TREE_ORDER) once its price is no more than
// TREE_SAVE_MINUTES of what every town earns, saving for it like the Capital, and buys the cheapest upgrade it can
// (ties in TREE_ORDER) as soon as it has the Influence. TREE_GAP: the minutes between upgrades over CAP_PLAY.
export const CAP_SAVE_MINUTES = 6, CAP_MINUTES = 120, CAP_PLAY = 120, TREE_SAVE_MINUTES = 10, TREE_GAP = [10, 15];
export const TREE_ORDER = ['market', 'bank', 'war', 'university', 'transport'];
/* M5, Silver Falls (falls: true, after the Capital): the player plays on in the Ridge, signs the Ridge's charter once it
   pays the deeds the Falls still needs (the town that pays the most deeds), climbs back to the Falls' wave and saves
   for its price like the Capital (at most FALLS_SAVE_MAX minutes), founds it, wins Sandy Bend (at most OUTPOST_MINUTES)
   and plays the Falls for FALLS_PLAY minutes with goals on, looking at the Gulch and the Ridge for the goods they ship
   once a minute (tendImports). It goes on filling contracts and buying Empire tree upgrades, and founds no
   institution while it saves. out.fallsSnap is the game as the player gets to the Falls (the strategy runs start from
   it). Times: fallsFound is play time from the new game; Sandy Bend's and the Falls' count from when the player gets
   there. */
export const FALLS_SAVE_MINUTES = 6, FALLS_SAVE_MAX = 300, FALLS_PLAY = 60;
/* The Falls' imports and grid while the player is there: per second from when each workshop is built, whether a
   shipped good held it up (run counts the seconds it did not), whether its own goods did (short), and the grid's share. */
export function fallsTick(t, imp) {
  const imports = t.def.imports || [];
  for (const id of t.def.buildings) {
    if (!t.level(id)) continue;
    const inp = BUILDINGS[id].inputs, need = Object.keys(inp).filter(g => !isGrid(g));
    if (onGrid(id)) { imp.grid = (imp.grid || 0) + gridOf(t).share; imp.gridN = (imp.gridN || 0) + 1; }
    if (!need.some(g => imports.includes(g))) continue;
    imp.built[id] = (imp.built[id] || 0) + 1;
    // held up by an input when there is less than a second of it on hand (a short grid alone is not the imports' fault)
    const low = t.starved[id] ? need.filter(g => (t.goods[g] || 0) < uses(t, id, g) * output(t, id)) : [];
    if (!low.some(g => imports.includes(g))) imp.run[id] = (imp.run[id] || 0) + 1;
    if (low.some(g => !imports.includes(g))) imp.short[id] = (imp.short[id] || 0) + 1;
  }
}
export function playFalls(seed, g, strategy, minutes, out) {
  const ft = g.towns.falls, imp = { run: {}, built: {}, short: {}, raised: [], at: {} }, from = ft.t;
  const offB = g.bus.on('build', e => { if (e.town === 'falls' && e.level === 1) imp.at[e.id] ??= ft.t - from; });
  const r = play(seed, minutes, strategy, null, { game: g, sign: false, goals: true, tick: (g2, t, r2) => {
    fallsTick(t, imp);
    if (Math.round(t.t) % 60 === 0) tendImports(g2, t, imp);
    if (out && out.pick) out.pick(g2, t, r2);
  } });
  offB();
  r.w10 = r.wave10 === null ? null : r.wave10 - from;
  r.imports = imp; r.from = from;
  return r;
}
export function empire(seed, strategy = 'active', { ridgeMinutes = RIDGE_MINUTES, gulchMinutes = GULCH_MINUTES, capital = false, falls = false } = {}) {
  const g = newGame('balance-' + seed), goals = {}, now = () => g.stats.steps * .25;
  const off = g.bus.on('goal:done', e => { goals[e.id] = now(); });
  const out = { dc: null, gulch: null, found: null, ph: null, ridge: null, game: g, goals, imports: null };
  out.dc = play(seed, OUTPOST_MINUTES, strategy, null, { game: g, until: t => t.won });
  out.dc.won = g.town.won ? out.dc.until : null;
  if (!g.town.won) { off(); return out; }
  g.go(g.town.def.opens);
  const R = TOWNS.ridge, price = R.found.coins;
  const save = (t, r) => !!r.savingNow || (!!r.signed && t.bestWave >= R.found.wave && price <= SAVE_MINUTES * (r.rate || 0));
  out.gulch = play(seed, gulchMinutes, strategy, null, { game: g, save, until: () => canFound(g, 'ridge') });
  const gt = g.towns.gulch;
  out.gulch.outpost = { wave: g.towns.drycreek.wave, breaches: g.towns.drycreek.breaches || 0, coins: Math.round(g.towns.drycreek.lifetime) };
  if (!canFound(g, 'ridge')) { off(); return out; }
  out.found = now(); out.held = out.gulch.saving === undefined ? 0 : out.gulch.until - out.gulch.saving;
  foundTown(g, 'ridge');
  setHold(g, gt, false); for (const id of Object.keys(gt.foremen)) setForeman(gt, id, true);
  g.go('pinehollow');
  const pt = g.towns.pinehollow; out.phFrom = pt.t;
  out.ph = play(seed, OUTPOST_MINUTES, strategy, null, { game: g, until: t => t.won, sign: false });
  out.ph.won = pt.won ? out.ph.until - out.phFrom : null;
  g.go('ridge');
  const rt = g.towns.ridge, imp = out.imports = { run: {}, built: {}, short: {}, raised: [], at: {} };
  out.ridgeFrom = rt.t;
  const offB = g.bus.on('build', e => { if (e.town === 'ridge' && e.level === 1) imp.at[e.id] = rt.t - out.ridgeFrom; });
  out.ridge = play(seed, ridgeMinutes, strategy, null, { game: g, sign: false, goals: true, tick: (g2, t, r) => {
    // the share of seconds each importing workshop is not held up by an import, from when it is built: a second it is
    // short counts against the imports only when the input it has least of (for what it uses) is shipped in. Time short
    // of the Ridge's own goods (steel, once the Rolling Mill and Locomotive Works use it too) is counted apart (short).
    for (const id of t.def.buildings) if (t.level(id) && Object.keys(BUILDINGS[id].inputs).some(x => (t.def.imports || []).includes(x))) {
      imp.built[id] = (imp.built[id] || 0) + 1;
      const inp = BUILDINGS[id].inputs, low = t.starved[id] && Object.keys(inp).sort((a, b) => (t.goods[a] || 0) / inp[a] - (t.goods[b] || 0) / inp[b])[0];
      if (!low || !(t.def.imports || []).includes(low)) imp.run[id] = (imp.run[id] || 0) + 1;
      if (low && !(t.def.imports || []).includes(low)) imp.short[id] = (imp.short[id] || 0) + 1;
    }
    if (Math.round(t.t) % 60 === 0) tendImports(g2, t, imp);
  } });
  offB();
  out.ridge.w10 = out.ridge.wave10 === null ? null : out.ridge.wave10 - out.ridgeFrom;
  if (capital) {
    const F = CAPITAL_DEF.found, cs = (t, r) => !!r.savingNow || (t.bestWave >= F.wave && F.coins <= CAP_SAVE_MINUTES * (r.all || 0));
    // with one purse, a foreman in any town spends the savings: while it saves, every town's foremen are switched off
    const others = Object.values(g.towns).filter(x => x !== rt);
    const hush = (g2, t, r) => { for (const x of others) for (const id of Object.keys(x.foremen || {})) setForeman(x, id, !r.savingNow); };
    out.capSave = play(seed, CAP_MINUTES, strategy, null, { game: g, sign: false, goals: true, save: cs, tick: hush, until: () => canFoundCapital(g) });
    if (foundCapital(g)) {
      out.capital = now(); out.capHeld = out.capSave.saving === undefined ? 0 : out.capSave.until - out.capSave.saving;
      setHold(g, rt, false); for (const x of Object.values(g.towns)) for (const id of Object.keys(x.foremen || {})) setForeman(x, id, true);
      const c = capitalOf(g), took = {}, tr = out.tree = { founded: [], nodes: [] }, at = () => now() - out.capital;
      const nextInst = () => TREE_ORDER.find(id => !founded(g, id));
      const pick = (g2, t, r) => {
        if (!c.active && c.offers.length) { const o = c.offers.slice().sort((a, b) => b.influence - a.influence || b.coins - a.coins)[0]; if (takeContract(g, o.id)) took[o.good] = (took[o.good] || 0) + 1; }
        const n = nextInst();
        if (n && !r.noInst && !foundBlock(g, n) && foundInstitution(g, n)) tr.founded.push([n, at()]);
        for (;;) {
          const id = TREE_ORDER.filter(x => !nodeBlock(g, x)).sort((a, b) => nodeCost(g, a) - nodeCost(g, b))[0];
          if (!id || !buyNode(g, id)) break;
          tr.nodes.push([id, at()]);
        }
        for (const x of others) for (const id of Object.keys(x.foremen || {})) setForeman(x, id, !r.savingNow);
        if (!r.savingNow && Math.round(t.t) % 60 === 0) tendTowns(g2, t, out.tended ||= []);
      };
      const ts = (t, r) => { const n = nextInst(); return !!n && foundBlock(g, n) === 'coins' && foundCost(g) <= TREE_SAVE_MINUTES * (r.all || 0); };
      play(seed, CAP_PLAY, strategy, null, { game: g, sign: false, goals: true, save: ts, tick: pick });
      out.contracts = { filled: c.filled, influence: c.earned, took };
      tr.gap = tr.nodes.length ? at() / tr.nodes.length : null; // minutes of play per upgrade over the window, in seconds
      out.pick = pick;
      if (falls) toFalls(seed, g, strategy, out, now);
    }
  }
  off();
  return out;
}
function toFalls(seed, g, strategy, out, now) {
  const F = TOWNS.falls.found, rt = g.towns.ridge;
  out.deedsBefore = deedsHeld(g);
  const short = () => Math.max(0, F.deeds - deedsHeld(g));
  const fs = (t, r) => !!r.savingNow || (short() === 0 && t.bestWave >= F.wave && F.coins <= FALLS_SAVE_MINUTES * (r.all || 0));
  // the institutions wait from here: the purse is for the Falls (r.noInst)
  out.fLog = [];
  const tick = (g2, t, r) => { r.noInst = true; out.pick(g2, t, r); if (Math.round(t.t) % 300 === 0) out.fLog.push([+(now() / 3600).toFixed(2), t.bestWave, Math.round((r.all || 0) / 1000)]); };
  out.fSave = play(seed, FALLS_SAVE_MAX, strategy, null, { game: g, sign: short() > 0, signAt: Math.max(1, short()), goals: true, save: fs, tick, until: () => canFound(g, 'falls') });
  out.fSigned = out.fSave.signed ? { at: out.fSave.signed.at, deeds: out.fSave.signed.deeds, wave: out.fSave.signed.wave } : null;
  if (!canFound(g, 'falls')) { out.fallsFound = null; return; }
  out.fallsFound = now(); out.fHeld = out.fSave.saving === undefined ? 0 : out.fSave.until - out.fSave.saving;
  foundTown(g, 'falls');
  setHold(g, rt, false); for (const x of Object.values(g.towns)) for (const id of Object.keys(x.foremen || {})) setForeman(x, id, true);
  g.go('sandybend');
  const sb = g.towns.sandybend, sbFrom = sb.t;
  out.sb = play(seed, OUTPOST_MINUTES, strategy, null, { game: g, until: t => t.won, sign: false, tick: out.pick });
  out.sb.won = sb.won ? out.sb.until - sbFrom : null;
  g.go('falls');
  out.fallsSnap = encode(g, 0);
  out.falls = playFalls(seed, g, strategy, FALLS_PLAY, out);
}
/* A strategy's run of the Falls from the active player's game as it got there (out.fallsSnap): FALLS_STRATEGY minutes
   with goals on and the imports tended. Returns the play() record with w10 and imports. */
export const FALLS_STRATEGY = 30;
export function fallsFrom(snap, seed, strategy, minutes = FALLS_STRATEGY) {
  const g = loadGame(decode(snap).game);
  return playFalls(seed, g, strategy, minutes, null);
}
/* Once the Capital stands, a careful player also looks after the towns it is not playing (PLAN.md M4, Idle income
   grows): once a minute, in each of them (outposts aside), it buys the one level that pays back fastest, if it pays
   back within TEND_PAYBACK at today's prices or a workshop is short of its good, and costs at most half the coins on
   hand; then it hires a foreman along the chain (hireOrder) where the next level is worth buying and the hire costs at
   most half the coins. Records "town building minute" in `log`. */
export const TEND_PAYBACK = 1800;
export function tendTowns(game, here, log = []) {
  for (const t of Object.values(game.towns)) {
    if (t === here || isOutpost(t) || !t.def.buildings) continue;
    const half = () => game.shared.purse.coins * .5;
    let best = null, bp = Infinity;
    for (const id of t.def.buildings) {
      if (!unlocked(t, id) || cost(t, id) > half() || (t.level(id) && t.starved[id])) continue; // short of inputs: a level makes nothing more
      const gain = nextGain(game, t, id), p = t.level(id) && wanted(game, t, BUILDINGS[id].makes) ? 0 : gain > 0 ? cost(t, id) / gain : Infinity;
      if (p < bp) { bp = p; best = id; }
    }
    if (best && bp <= TEND_PAYBACK && build(game, t, best)) log.push(t.id + ' ' + best + ' ' + (here.t / 60).toFixed(0));
    const hire = hireOrder(t).find(id => canHire(t, id) && hireCost(t, id) <= half() && !foremanWait(game, t, id));
    if (hire && hireForeman(game, t, hire)) log.push(t.id + ' foreman ' + hire + ' ' + (here.t / 60).toFixed(0));
  }
  return log;
}
/* A careful player raises the Gulch's makers when the Ridge runs short of what they ship: for each import a Ridge
   workshop is starved of, one level of the Gulch building that makes it, or of the building that feeds that one when it
   is itself short, if the Gulch can pay. */
export function tendImports(game, town, imp) {
  for (const good of town.def.imports || []) {
    // a workshop that uses the good is built, or everything that opens it is: the town that makes the good gets its
    // maker, first raising what opens it (the cheapest step first), as the goal strip asks
    const coming = town.def.buildings.some(id => BUILDINGS[id].inputs[good] && (town.level(id) || missing(town, id).every(n => town.level(n.id))));
    const src = game.towns[GOODS[good].town], mk = src && src.def.buildings.find(b => BUILDINGS[b].makes === good);
    if (coming && mk && !src.level(mk)) {
      const need = missing(src, mk).filter(n => unlocked(src, n.id)).sort((a, b) => cost(src, a.id) - cost(src, b.id));
      const id = need.length ? need[0].id : unlocked(src, mk) ? mk : null;
      if (id && src.coins >= cost(src, id) && build(game, src, id)) imp.raised.push(id + ' ' + (town.t / 60).toFixed(0));
      continue;
    }
    const users = town.def.buildings.filter(id => town.level(id) && BUILDINGS[id].inputs[good]);
    if (!users.some(id => town.starved[id]) || (town.goods[good] || 0) >= 1) continue;
    const from = game.towns[GOODS[good].town];
    if (!from) continue;
    let id = from.def.buildings.find(b => BUILDINGS[b].makes === good);
    for (let k = 0; k < 3 && id && from.level(id) && from.starved[id]; k++) {
      const short = Object.keys(BUILDINGS[id].inputs).sort((a, b) => (from.goods[a] || 0) - (from.goods[b] || 0))[0];
      const feeder = from.def.buildings.find(b => BUILDINGS[b].makes === short);
      if (!feeder) break;
      id = feeder;
    }
    if (id && unlocked(from, id) && from.coins >= cost(from, id) && build(game, from, id)) imp.raised.push(id + ' ' + (town.t / 60).toFixed(0));
  }
}

/* The goal strip check (M2, The first 30 minutes): the careful player finishes every goal within GOAL_MINUTES of a
   new game on every seed. Returns { rows: [{ id, text, times }], misses }. */
export const GOAL_MINUTES = 40;
export function goalCheck(camps, later = false) {
  const rows = GOALS.filter(x => !x.side && !!x.within === later).map(x => ({ id: x.id, text: x.text, within: x.within || GOAL_MINUTES, times: camps.map(c => c.goals[x.id] ?? null) }));
  const misses = [];
  for (const r of rows) {
    const late = r.times.map((t, i) => [t, camps[i].dc.seed]).filter(([t]) => t === null || t > r.within * 60);
    if (late.length) misses.push('goal ' + r.id + ' not done within ' + r.within + ' min on seed(s) ' + late.map(([, s]) => s).join(','));
  }
  return { rows, misses };
}

/* The Iron Ridge checks (M3, Bots for Iron Ridge and Pine Hollow) on empire runs: the active bot on every seed founds the
   Ridge at FOUND_MIN-FOUND_MAX minutes of play, wins Pine Hollow within PH_MAX minutes of getting there, clears the
   Ridge's wave 10 (the armored train) within RIDGE_W10 minutes of getting there with no breach in waves 1-3, and builds
   the Boiler Shop, which runs on Gulch bricks at least BOILER_RUN of the time, and the Locomotive Works within LOCO_MAX
   minutes of getting there, running on Gulch tools at least BOILER_RUN of the time. Every strategy's median founding time,
   Pine Hollow win and Ridge wave 10 is within 25% of the best one. Returns { rows, misses }. */
export const FOUND_MIN = 55, FOUND_MAX = 80, PH_MAX = 20, RIDGE_W10 = [7, 10], BOILER_RUN = .9, LOCO_MAX = 90;
export function empireCheck(runs) {
  const misses = [], med = a => { const b = a.filter(x => x != null).sort((x, y) => x - y); return b.length * 2 <= a.length ? null : b[Math.floor(b.length / 2)]; };
  const share = e => e.imports && e.imports.built.boilershop ? e.imports.run.boilershop / e.imports.built.boilershop : null;
  const phOf = e => e.ph ? e.game.towns.pinehollow.towers : null;
  const rows = Object.keys(STRATEGIES).map(k => {
    const rs = runs.filter(e => e.strategy === k);
    return {
      strategy: k, n: rs.length, found: med(rs.map(e => e.found)), held: med(rs.map(e => e.found === null ? null : e.held)),
      ph: med(rs.map(e => e.ph && e.ph.won)), w10: med(rs.map(e => e.ridge && e.ridge.w10)),
      boiler: med(rs.map(e => e.imports && e.imports.at.boilershop)), run: med(rs.map(share)),
      phTowers: med(rs.map(e => phOf(e) && phOf(e).length)),
      phLevel: med(rs.map(e => phOf(e) && phOf(e).reduce((a, x) => a + x.level, 0) / Math.max(1, phOf(e).length))),
    };
  });
  const m = x => x == null ? 'never' : (x / 60).toFixed(1) + ' min';
  for (const e of runs.filter(e => e.strategy === 'active')) {
    const s = e.dc.seed;
    nearWin(`seed ${s}: Iron Ridge founded at ${m(e.found)} (window ${FOUND_MIN}-${FOUND_MAX} min)`, e.found, [FOUND_MIN * 60, FOUND_MAX * 60]);
    nearWin(`seed ${s}: Iron Ridge wave 10 at ${m(e.ridge && e.ridge.w10)} (window ${RIDGE_W10.join('-')} min)`, e.ridge && e.ridge.w10, RIDGE_W10.map(x => x * 60));
    if (e.found === null || e.found < FOUND_MIN * 60 || e.found > FOUND_MAX * 60) misses.push(`seed ${s}: Iron Ridge founded at ${m(e.found)} of play (want ${FOUND_MIN}-${FOUND_MAX} min)`);
    if (!e.ph || e.ph.won === null || e.ph.won > PH_MAX * 60) misses.push(`seed ${s}: Pine Hollow won at ${m(e.ph && e.ph.won)} after getting there (want within ${PH_MAX} min)`);
    if (!e.ridge || e.ridge.w10 === null || e.ridge.w10 < RIDGE_W10[0] * 60 || e.ridge.w10 > RIDGE_W10[1] * 60) misses.push(`seed ${s}: Iron Ridge wave 10 at ${m(e.ridge && e.ridge.w10)} after getting there (want ${RIDGE_W10[0]}-${RIDGE_W10[1]} min)`);
    if (e.ridge && e.ridge.breaches.some(w => w <= 3)) misses.push(`seed ${s}: a breach in Iron Ridge's waves 1-3`);
    const b = e.imports && e.imports.built.boilershop;
    if (!b) misses.push(`seed ${s}: the Boiler Shop was never built in Iron Ridge`);
    else if (e.imports.run.boilershop / b < BOILER_RUN) misses.push(`seed ${s}: the Boiler Shop ran ${Math.round(100 * e.imports.run.boilershop / b)}% of the time (want ${Math.round(100 * BOILER_RUN)}%)`);
    const lb = e.imports && e.imports.built.loco, la = e.imports && e.imports.at.loco;
    if (!lb || la == null || la > LOCO_MAX * 60) misses.push(`seed ${s}: the Locomotive Works built at ${m(la)} after getting to Iron Ridge (want within ${LOCO_MAX} min)`);
    else if (e.imports.run.loco / lb < BOILER_RUN) misses.push(`seed ${s}: the Locomotive Works ran ${Math.round(100 * e.imports.run.loco / lb)}% of the time (want ${Math.round(100 * BOILER_RUN)}%)`);
  }
  const names = { found: 'Iron Ridge founded', ph: 'Pine Hollow won', w10: 'Ridge wave 10' };
  for (const key of ['found', 'ph', 'w10']) {
    const best = Math.min(...rows.map(x => x[key] ?? Infinity));
    for (const x of rows) nearMax(`${x.strategy}: ${names[key]} ${Math.round(100 * (x[key] / best - 1))}% behind the best (limit 25%)`, x[key] / best, STRATEGY_SLACK);
    for (const x of rows) if (x[key] === null || x[key] > best * STRATEGY_SLACK) misses.push(`${x.strategy}: ${names[key]} at ${m(x[key])}, more than 25% behind the best (${m(best)})`);
  }
  return { rows, misses };
}


/* The strategy check (CLAUDE.md, Strategies must stay close): every strategy over the seeds, the median time to
   clear waves 10 and 20, and a miss when a strategy is more than 25% slower than the best one or breaches in waves
   1-3. Returns { rows, misses }. */
/* The Capital (M4): every active seed builds it at CAP_AT minutes of play (2.5-4 h), and fills contracts after. */
export const CAP_AT = [150, 240];
export function capitalCheck(runs) {
  const misses = [];
  for (const e of runs) {
    if (e.capital == null) { misses.push('seed ' + e.dc.seed + ': the Capital was never built'); continue; }
    nearWin('seed ' + e.dc.seed + ': the Capital built at ' + (e.capital / 60).toFixed(0) + ' min (window ' + CAP_AT.join('-') + ')', e.capital, CAP_AT.map(x => x * 60));
    if (e.capital < CAP_AT[0] * 60 || e.capital > CAP_AT[1] * 60) misses.push('seed ' + e.dc.seed + ': the Capital built at ' + (e.capital / 60).toFixed(0) + ' min (want ' + CAP_AT.join('-') + ')');
    if (!e.contracts || e.contracts.filled < 1) misses.push('seed ' + e.dc.seed + ': no contract filled in ' + CAP_PLAY + ' min');
    // the Empire tree: an upgrade every TREE_GAP minutes for the active bot
    const gap = e.tree && e.tree.gap;
    if (gap == null || gap < TREE_GAP[0] * 60 || gap > TREE_GAP[1] * 60) misses.push('seed ' + e.dc.seed + ': an Empire tree upgrade every ' + (gap == null ? 'never' : (gap / 60).toFixed(1) + ' min') + ' (want ' + TREE_GAP.join('-') + ')');
  }
  return misses;
}

/* The Silver Falls checks (M5, Bots for Silver Falls and Sandy Bend) on the active empire runs (falls: true) and on the
   strategy runs of the Falls (fallsFrom, every strategy from the same arrival): every active seed founds the Falls at
   FALLS_AT minutes of play, wins Sandy Bend within SB_MAX minutes of getting there, clears the Falls' wave 10 (the
   steamer) FALLS_W10 minutes after getting there with no breach in waves 1-3, runs the Wire Mill on Gulch copper at
   least WIRE_RUN of the time and keeps the grid's share at WIRE_RUN or more on average; every strategy's median Falls
   wave 10 is within 25% of the best one; every tower kind is bought in the Falls by some strategy, and no one kind
   does the most damage in every wave there. Without a charter the Falls never opens (it needs 5 deeds, and the first
   charter pays 1), which is the "at least 2.5 times later" half of the M5 target. Returns { rows, misses }. */
export const FALLS_AT = [360, 600], SB_MAX = 20, FALLS_W10 = [7, 10], WIRE_RUN = .9;
export function fallsCheck(actives, strat) {
  const misses = [], m = x => x == null ? 'never' : (x / 60).toFixed(1) + ' min';
  const med = a => { const b = a.filter(x => x != null).sort((x, y) => x - y); return b.length * 2 <= a.length ? null : b[Math.floor(b.length / 2)]; };
  for (const e of actives) {
    const s = e.dc.seed, f = e.falls, im = f && f.imports;
    nearWin(`seed ${s}: Silver Falls founded at ${e.fallsFound == null ? 'never' : (e.fallsFound / 3600).toFixed(2) + ' h'} (window ${FALLS_AT[0] / 60}-${FALLS_AT[1] / 60} h)`, e.fallsFound, FALLS_AT.map(x => x * 60));
    if (f) nearWin(`seed ${s}: Silver Falls wave 10 at ${m(f.w10)} (window ${FALLS_W10.join('-')} min)`, f.w10, FALLS_W10.map(x => x * 60));
    if (e.fallsFound == null || e.fallsFound < FALLS_AT[0] * 60 || e.fallsFound > FALLS_AT[1] * 60) misses.push(`seed ${s}: Silver Falls founded at ${e.fallsFound == null ? 'never' : (e.fallsFound / 3600).toFixed(2) + ' h'} of play (want ${FALLS_AT[0] / 60}-${FALLS_AT[1] / 60} h)`);
    if (!e.sb || e.sb.won == null || e.sb.won > SB_MAX * 60) misses.push(`seed ${s}: Sandy Bend won at ${m(e.sb && e.sb.won)} after getting there (want within ${SB_MAX} min)`);
    if (!f) continue;
    if (f.w10 == null || f.w10 < FALLS_W10[0] * 60 || f.w10 > FALLS_W10[1] * 60) misses.push(`seed ${s}: Silver Falls wave 10 at ${m(f.w10)} after getting there (want ${FALLS_W10.join('-')} min)`);
    if (f.breaches.some(w => w <= 3)) misses.push(`seed ${s}: a breach in Silver Falls' waves 1-3`);
    const b = im.built.wiremill;
    if (!b) misses.push(`seed ${s}: the Wire Mill was never built in Silver Falls`);
    else if (im.run.wiremill / b < WIRE_RUN) misses.push(`seed ${s}: the Wire Mill ran on Gulch copper ${Math.round(100 * im.run.wiremill / b)}% of the time (want ${Math.round(100 * WIRE_RUN)}%)`);
    if (!im.gridN || im.grid / im.gridN < WIRE_RUN) misses.push(`seed ${s}: the grid gave ${im.gridN ? Math.round(100 * im.grid / im.gridN) : 0}% of the power on average (want ${Math.round(100 * WIRE_RUN)}%)`);
  }
  const rows = Object.keys(STRATEGIES).map(k => {
    const rs = strat.filter(x => x.strategy === k).map(x => x.r), dealt = {}, bought = {};
    for (const r of rs) { for (const [a, n] of Object.entries(r.dealt)) dealt[a] = (dealt[a] || 0) + n; for (const [a, n] of Object.entries(r.bought)) bought[a] = (bought[a] || 0) + n; }
    return { strategy: k, n: rs.length, w10: med(rs.map(r => r.w10)), early: rs.filter(r => r.breaches.some(w => w <= 3)).length, wave: med(rs.map(r => r.final.best)), dealt, bought, runs: rs };
  });
  const best = Math.min(...rows.map(x => x.w10 ?? Infinity));
  for (const x of rows) nearMax(`${x.strategy}: Silver Falls wave 10 ${Math.round(100 * (x.w10 / best - 1))}% behind the best (limit 25%)`, x.w10 / best, STRATEGY_SLACK);
  for (const x of rows) if (x.w10 === null || x.w10 > best * STRATEGY_SLACK) misses.push(`${x.strategy}: Silver Falls wave 10 at ${m(x.w10)}, more than 25% behind the best (${m(best)})`);
  for (const x of rows) if (x.early) misses.push(`${x.strategy}: a breach in Silver Falls' waves 1-3 on ${x.early} seed(s)`);
  const kinds = Object.keys(TOWERS).filter(k => TOWERS[k].goods.falls);
  for (const k of kinds) if (!rows.some(x => x.bought[k])) misses.push(`Silver Falls: no strategy ever builds a ${TOWERS[k].name || k}`);
  const tops = new Set(rows.flatMap(x => x.runs.flatMap(r => r.top.filter(([, , n]) => n > 1).map(([, k]) => k))));
  if (tops.size === 1) misses.push(`Silver Falls: ${[...tops][0]} does the most damage in every wave`);
  return { rows, misses, tops: [...tops] };
}

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
    for (const x of rows) nearMax(`${x.strategy}: ${key} ${Math.round(100 * (x[key] / best - 1))}% behind the best (limit 25%)`, x[key] / best, STRATEGY_SLACK);
    for (const x of rows) if (x[key] === null || x[key] > best * STRATEGY_SLACK) misses.push(`${x.strategy}: ${key === 'won' ? 'Dry Creek won' : key === 'wave10' ? 'wave 10' : 'wave 20'} at ${x[key] === null ? 'never' : (x[key] / 60).toFixed(1) + ' min'}, more than 25% behind the best (${(best / 60).toFixed(1)} min)`);
  }
  for (const x of rows) if (x.early) misses.push(`${x.strategy}: a breach in waves 1-3 on ${x.early} seed(s)`);
  for (const x of rows) if (x.dcEarly) misses.push(`${x.strategy}: a breach in Dry Creek's waves 1-3 on ${x.dcEarly} seed(s)`);
  return { rows, misses };
}

/* Tower balance (M2, fresh-eyes issue 2): no kind does more than SHARE_MAX of the damage for any strategy, and every
   kind does the most damage in some wave for at least one strategy. Returns the misses. `where` names the town for a
   run of another town (Silver Falls, since M5); lead: false leaves out the second check there (fallsCheck has its own:
   no one kind leads every wave). */
export const SHARE_MAX = .36; // "about 35%"
/* Gate margins (roadmap review, 2026-11-20): a gate within MARGIN of its limit prints a "close" line with the run's
   result, so the next change that tips it is expected, not a surprise (the economy Cannon sat at 35.4% against 36% for
   weeks before the new pads tipped it; idle seed 6 passed by 10%, then failed). */
export const MARGIN = .05, CLOSE = [];
export const nearMax = (what, v, max) => { if (v != null && Number.isFinite(v) && v <= max && v > max * (1 - MARGIN)) CLOSE.push(what); };
export const nearMin = (what, v, min) => { if (v != null && Number.isFinite(v) && v >= min && v < min * (1 + MARGIN)) CLOSE.push(what); };
export const nearWin = (what, v, [lo, hi]) => { nearMin(what, v, lo); nearMax(what, v, hi); };
export const printClose = () => { if (CLOSE.length) console.log([...new Set(CLOSE)].map(x => 'close ' + x).join(String.fromCharCode(10))); };
export function towerBalance(rows, where = '', lead = true) {
  const misses = [], led = new Set();
  for (const x of rows) {
    const tot = Object.values(x.dealt).reduce((a, b) => a + b, 0) || 1;
    for (const [k, n] of Object.entries(x.dealt)) nearMax(`${where ? where + ', ' : ''}${x.strategy}: ${k} does ${(100 * n / tot).toFixed(1)}% of the damage (limit ${Math.round(100 * SHARE_MAX)}%)`, n / tot, SHARE_MAX);
    for (const [k, n] of Object.entries(x.dealt)) if (n / tot > SHARE_MAX) misses.push(`${where ? where + ', ' : ''}${x.strategy}: ${k} does ${Math.round(100 * n / tot)}% of the damage (want at most ${Math.round(100 * SHARE_MAX)}%)`);
    for (const r of x.runs) for (const [, k, n] of r.top) if (n > 1) led.add(k);
  }
  if (lead) for (const k of Object.keys(TOWERS)) if (!led.has(k)) misses.push(`${k} never does the most damage in a wave, for any strategy`);
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
  const emp = [];
  for (const k of Object.keys(STRATEGIES)) for (let s = 1; s <= (k === 'active' ? SEEDS : EMPIRE_SEEDS); s++) { const e = empire(s, k, { capital: k === 'active', falls: k === 'active' }); e.strategy = k; emp.push(e); }
  const actives = emp.filter(e => e.strategy === 'active'), lg = goalCheck(actives, true);
  for (const r of lg.rows) console.log('  ' + r.id + ' | ' + r.times.map(t => t === null ? 'never' : (t / 60).toFixed(1)).join(' '));
  misses.push(...lg.misses);
  const mm = x => x == null ? 'never' : (x / 60).toFixed(1) + ' min';
  console.log('Iron Ridge (active): seed | charter signed | Ridge founded (play time) | waves held to save | Pine Hollow won (from getting there), breaches, towers | Ridge wave 10 (from getting there), breaches | Ridge wave at the end | Boiler Shop built, share of time running | Locomotive Works built, running | Gulch levels raised for the Ridge');
  for (const e of actives) {
    const ph = e.game.towns.pinehollow, rt = e.game.towns.ridge, im = e.imports;
    console.log(`${e.dc.seed} | ${e.gulch && e.gulch.signed ? mm(e.gulch.signed.at + e.dc.won) : 'no'} | ${mm(e.found)} | ${mm(e.held)} | ${mm(e.ph && e.ph.won)}, ${e.ph ? e.ph.breaches.join(',') || 'none' : '-'}, ${ph ? ph.towers.map(x => x.kind + x.level).join(' ') : '-'} | ${mm(e.ridge && e.ridge.w10)}, ${e.ridge ? e.ridge.breaches.join(',') || 'none' : '-'} | ${rt ? rt.wave : '-'} | ${im ? mm(im.at.boilershop) + ', ' + (im.built.boilershop ? Math.round(100 * im.run.boilershop / im.built.boilershop) + '% (short of its own goods ' + Math.round(100 * (im.short.boilershop || 0) / im.built.boilershop) + '%)' : '-') : '-'} | ${im ? mm(im.at.loco) + ', ' + (im.built.loco ? Math.round(100 * im.run.loco / im.built.loco) + '%' : '-') : '-'} | ${im ? im.raised.join(', ') || 'none' : '-'}`);
  }
  console.log('The Capital (active): seed | Ridge best wave when built | built (play time) | waves held to save | contracts filled in ' + CAP_PLAY + ' min | Influence | goods asked');
  for (const e of actives) console.log(`${e.dc.seed} | ${e.game.towns.ridge ? e.game.towns.ridge.bestWave : '-'} | ${e.capital == null ? 'never' : (e.capital / 3600).toFixed(2) + ' h'} | ${mm(e.capHeld)} | ${e.contracts ? e.contracts.filled : '-'} | ${e.contracts ? e.contracts.influence : '-'} | ${e.contracts ? Object.entries(e.contracts.took).map(([k, n]) => k + ' ' + n).join(', ') : '-'}`);
  console.log('The Empire tree (active, ' + CAP_PLAY + ' min after the Capital): seed | institutions founded (minute) | upgrades bought | minutes per upgrade | upgrades (minute)');
  for (const e of actives) if (e.tree) console.log(`${e.dc.seed} | ${e.tree.founded.map(([k, t]) => k + ' ' + (t / 60).toFixed(0)).join(', ')} | ${e.tree.nodes.length} | ${e.tree.gap == null ? '-' : (e.tree.gap / 60).toFixed(1)} | ${e.tree.nodes.map(([k, t]) => k + ' ' + (t / 60).toFixed(0)).join(', ')}`);
  misses.push(...capitalCheck(actives));
  const ec = empireCheck(emp);
  console.log(`Iron Ridge by strategy (median; active over ${SEEDS} seeds, the others over ${EMPIRE_SEEDS}): strategy | Ridge founded | waves held | Pine Hollow won | its towers, their level | Ridge wave 10 | Boiler Shop built | running`);
  for (const x of ec.rows) console.log(`  ${x.strategy} | ${mm(x.found)} | ${mm(x.held)} | ${mm(x.ph)} | ${x.phTowers ?? '-'}, ${x.phLevel == null ? '-' : x.phLevel.toFixed(1)} | ${mm(x.w10)} | ${mm(x.boiler)} | ${x.run == null ? '-' : Math.round(100 * x.run) + '%'}`);
  misses.push(...ec.misses);
  console.log('Silver Falls (active): seed | Ridge charter signed (play time), deeds, at wave | Falls founded (play time) | waves held to save | Sandy Bend won (from getting there), breaches | Falls wave 10 (from getting there), breaches | Falls best wave after ' + FALLS_PLAY + ' min | workshops built (minute) | Wire Mill on Gulch copper | grid share | levels raised elsewhere');
  const fstrat = [];
  for (const e of actives) {
    const f = e.falls, im = f && f.imports, cut = e.game.stats.steps; // the play time at the end, to turn the Ridge clock into play time
    console.log(`${e.dc.seed} | ${e.fSigned ? 'wave ' + e.fSigned.wave + ', ' + e.fSigned.deeds + ' deeds' : 'no'} | ${e.fallsFound == null ? 'never' : (e.fallsFound / 3600).toFixed(2) + ' h'} | ${mm(e.fHeld)} | ${mm(e.sb && e.sb.won)}, ${e.sb ? e.sb.breaches.join(',') || 'none' : '-'} | ${mm(f && f.w10)}, ${f ? f.breaches.filter(w => w <= 10).join(',') || 'none' : '-'} | ${f ? f.final.best : '-'} | ${im ? Object.entries(im.at).map(([k, t]) => k + ' ' + (t / 60).toFixed(0)).join(', ') : '-'} | ${im && im.built.wiremill ? Math.round(100 * im.run.wiremill / im.built.wiremill) + '%' : '-'} | ${im && im.gridN ? Math.round(100 * im.grid / im.gridN) + '%' : '-'} | ${im ? im.raised.join(', ') || 'none' : '-'}`);
    if (e.fallsSnap && e.dc.seed <= EMPIRE_SEEDS) for (const k of Object.keys(STRATEGIES)) fstrat.push({ strategy: k, seed: e.dc.seed, r: fallsFrom(e.fallsSnap, e.dc.seed, k) });
  }
  const fc = fallsCheck(actives, fstrat);
  console.log(`Silver Falls by strategy (median over ${EMPIRE_SEEDS} seeds, ${FALLS_STRATEGY} min from the active player's arrival): strategy | wave 10 | best wave | buys by kind | damage by kind`);
  for (const x of fc.rows) { const tot = Object.values(x.dealt).reduce((a, b) => a + b, 0) || 1; console.log(`  ${x.strategy} | ${mm(x.w10)} | ${x.wave ?? '-'} | ${Object.entries(x.bought).map(([k, n]) => k + ' ' + n).join(', ')} | ${Object.entries(x.dealt).sort((a, b) => b[1] - a[1]).map(([k, n]) => k + ' ' + Math.round(100 * n / tot) + '%').join(', ')}`); }
  console.log('Silver Falls wave leaders: ' + fc.tops.join(', '));
  misses.push(...fc.misses, ...towerBalance(fc.rows, 'Silver Falls', false));
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
  printClose(); // gates within 5% of their limit (Gate margins)
  process.exitCode = misses.length ? 1 : 0;
}
