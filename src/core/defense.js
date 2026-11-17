/* Defense: raiders ride the road toward the vault in waves; towers on the spots beside the road shoot them.
   Everything is deterministic (the town's own random stream picks wave types and raiders) and hits land at once;
   the renderer draws the bolts, balls and clouds from the events this module emits:
     'shot' { town, tower, foe, kind, from, to, flight? }   'kill' { town, foe, coins }   'leak' { town, foe, hp }
     'land' { town, spot, at, splash, fire }       'tower:open' { town, kind }
     'wave:start' { town, wave, type, boss }       'wave:clear' { town, wave }   'breach' { town, wave, lost }
   A town's waves: town.wave is the wave running or coming next; town.waves holds the phase, timer, queue and foes,
   the lobbed shells still in the air (shells) and the burning ground Shrapnel leaves (fires).
   While the game catches up time away, defense rests (background battles arrive with Automation, M4). */
import { TOWERS, PATHS, PATH_LEVEL, SLOW_SECONDS, POISON_SECONDS, SELL_BACK, PER_LEVEL, FIRE } from '../data/towers.js';
import { FOES, WAVE_TYPES, WAVE } from '../data/foes.js';
import { makePath, pointAt, dist } from './path.js';
import { demand, output, buildingsOf } from './economy.js';
import { BUILDINGS } from '../data/buildings.js';

const PATH_CACHE = new WeakMap();
/* The town's road as a path that ends at the vault. */
export function roadOf(town) {
  const b = town.def.board;
  if (!PATH_CACHE.has(b)) PATH_CACHE.set(b, makePath([...b.road, b.vault]));
  return PATH_CACHE.get(b);
}

// --- towers: stats and costs -----------------------------------------------------------------------------------------
export function towerStats(town, t) {
  const d = TOWERS[t.kind], L = t.level, p = t.path ? PATHS[t.kind][t.path] : {};
  const s = {
    dmg: d.dmg * PER_LEVEL.dmg ** (L - 1) * (p.dmg || 1) * town.mods.factor('towerDmg'),
    rate: d.rate * PER_LEVEL.rate ** (L - 1) * (p.rate || 1) * town.mods.factor('towerRate'),
    range: (d.range + PER_LEVEL.range * (L - 1)) * (p.range || 1) * town.mods.factor('towerRange'),
    splash: (d.splash || 0) * (p.splash || 1), slow: d.slow || 0, pulse: !!d.pulse,
    poison: (d.poison || 0) * (p.poison || 1) * PER_LEVEL.dmg ** (L - 1) * town.mods.factor('towerDmg'),
    cloud: (d.cloud || 0) * (p.cloud || 1), freeze: !!p.freeze, brittle: p.brittle || 0, spread: !!p.spread,
    minRange: d.minRange || 0, flight: d.flight || 0, lob: !!d.lob, fire: !!p.fire,
  };
  return s;
}
/* Coins and goods to build (level 0 -> 1) or to raise a tower from level L to L + 1. */
export function towerCost(town, kind, L = 0) {
  const d = TOWERS[kind], goods = {};
  for (const [g, n] of Object.entries(d.goods[town.id] || {})) goods[g] = Math.ceil(n * PER_LEVEL.goods ** L);
  return { coins: Math.ceil(d.coins * PER_LEVEL.coins ** L * town.mods.factor('cost') * town.mods.factor(L ? 'cost:towerUp' : 'cost:towerNew')), goods };
}
export function canPay(town, c) { return town.coins + 1e-9 >= c.coins && Object.entries(c.goods).every(([g, n]) => town.has(g, n)); }
function pay(town, c) { town.coins -= c.coins; for (const [g, n] of Object.entries(c.goods)) town.goods[g] -= n; }
export const towerAt = (town, spot) => town.towers.find(t => t.spot === spot) || null;

/* Mortar pits: the far pads. board.spots lists the near pads first; from board.far on they are pits. */
export const isPit = (town, spot) => spot >= (town.def.board.far ?? town.def.board.spots.length);
export const pitSpots = town => town.def.board.spots.map((_, i) => i).filter(i => isPit(town, i));
/* Has the town opened this tower kind? (Most are open from the start; some open at a wave.) */
export const towerOpen = (town, kind) => !TOWERS[kind].opens || !!(town.flags && town.flags['open:' + kind]);
/* Can this kind stand on this spot? Pits take only long-range towers, and long-range towers go only in pits. */
export const fitsSpot = (town, spot, kind) => isPit(town, spot) === !!TOWERS[kind].long;

/* Build a tower on an empty spot. Returns true when built. */
export function buildTower(game, town, spot, kind) {
  if (!TOWERS[kind] || towerAt(town, spot) || !town.def.board.spots[spot] || !towerOpen(town, kind) || !fitsSpot(town, spot, kind)) return false;
  const c = towerCost(town, kind, 0);
  if (!canPay(town, c)) return false;
  pay(town, c);
  town.towers.push({ spot, kind, level: 1, path: null, cd: 0, spent: c.coins, pulses: 0 });
  game.bus.emit('tower:build', { town: town.id, spot, kind });
  return true;
}
/* Raise a tower one level. Reaching PATH_LEVEL needs a path ('a' or 'b'). */
export function upgradeTower(game, town, spot, path) {
  const t = towerAt(town, spot);
  if (!t) return false;
  if (t.level + 1 === PATH_LEVEL && !PATHS[t.kind][path]) return false;
  const c = towerCost(town, t.kind, t.level);
  if (!canPay(town, c)) return false;
  pay(town, c);
  t.level++; t.spent += c.coins;
  if (t.level === PATH_LEVEL) t.path = path;
  game.bus.emit('tower:upgrade', { town: town.id, spot, level: t.level, path: t.path });
  return true;
}
export function sellTower(game, town, spot) {
  const t = towerAt(town, spot);
  if (!t) return 0;
  const back = Math.floor(t.spent * SELL_BACK);
  town.towers = town.towers.filter(x => x !== t);
  town.coins += back;
  game.bus.emit('tower:sell', { town: town.id, spot, coins: back });
  return back;
}

// --- waves -------------------------------------------------------------------------------------------------------------
export function waveType(town, w) {
  if (w % WAVE.boss === 0 || w < 4) return 'mixed';
  const kinds = Object.keys(WAVE_TYPES).filter(k => w >= WAVE_TYPES[k].from);
  return town.rng.pick(kinds);
}
/* The raiders of wave w, in order. */
export function planWave(town, w, type) {
  const T = WAVE_TYPES[type], n = Math.max(4, Math.round(WAVE.count(w) * T.count));
  const mix = Object.fromEntries(Object.entries(T.mix).filter(([k]) => w >= FOES[k].from));
  const q = [];
  for (let i = 0; i < n; i++) q.push(Object.keys(mix).length ? town.rng.weighted(mix) : 'raider');
  if (w % WAVE.boss === 0) q.push('wagon');
  return q;
}
export function startWave(game, town) {
  const ws = town.waves;
  if (ws.phase !== 'break') return false;
  const w = town.wave, type = waveType(town, w);
  ws.phase = 'wave'; ws.type = type; ws.queue = planWave(town, w, type); ws.timer = 0; ws.gap = WAVE.gap(w) * WAVE_TYPES[type].gap;
  game.bus.emit('wave:start', { town: town.id, wave: w, type, boss: w % WAVE.boss === 0 });
  return true;
}
/* Hold the waves: the wave on the road finishes, but the next one does not start until released. */
export function setHold(game, town, on) {
  town.waves.hold = !!on;
  game.bus.emit('waves:hold', { town: town.id, hold: !!on });
}

/* Start the next wave now, for a bonus of coins for the time skipped. Returns the bonus, or -1 if not in a break. */
export function callEarly(game, town) {
  const ws = town.waves;
  if (ws.phase !== 'break') return -1;
  const bonus = Math.ceil(WAVE.bounty(town.wave) * ws.timer / 4);
  town.earn(bonus);
  startWave(game, town);
  return bonus;
}

function spawn(town, kind) {
  const ws = town.waves, f = FOES[kind], T = WAVE_TYPES[ws.type] || WAVE_TYPES.mixed;
  const hp = WAVE.hp(town.wave) * f.hp * T.hp * town.mods.factor('foeHp');
  ws.foes.push({ id: ws.nextId++, kind, hp, max: hp, s: 0, slow: 0, slowT: 0, frozenT: 0, poison: 0, poisonT: 0, brittle: 0 });
}

/* Damage dealt, by tower kind, per town: game.dealt[town][kind]. Not saved; the bots read it to see which towers
   do the work. */
function tally(game, town, by, n) {
  if (!by || !(n > 0)) return;
  const d = game.dealt || (game.dealt = {}), t = d[town.id] || (d[town.id] = {});
  t[by] = (t[by] || 0) + n;
}
function hurt(game, town, f, dmg, pierce = false, by = null) {
  const armor = pierce ? 0 : FOES[f.kind].armor, n = dmg * (1 - armor) * (1 + (f.slowT > 0 ? f.brittle : 0));
  tally(game, town, by, Math.min(Math.max(0, f.hp), n));
  f.hp -= n;
}

function kill(game, town, f) {
  const coins = WAVE.bounty(town.wave) * FOES[f.kind].bounty * town.mods.factor('income') * town.mods.factor('bounty');
  town.earn(coins);
  game.bus.emit('kill', { town: town.id, foe: f.id, kind: f.kind, coins });
}

/* One step of the battle. */
export function fight(game, town, dt) {
  const ws = town.waves, road = roadOf(town);
  if (ws.phase === 'break') {
    ws.timer = Math.max(0, ws.timer - dt);
    if (ws.timer <= 0 && !ws.hold) startWave(game, town); // held: the town keeps working, the next wave waits
    return;
  }
  // spawn
  ws.timer -= dt;
  while (ws.queue.length && ws.timer <= 0) { spawn(town, ws.queue.shift()); ws.timer += ws.gap; }
  // move, poison, leak
  for (const f of ws.foes) {
    if (f.poisonT > 0) { const n = f.poison * Math.min(dt, f.poisonT); tally(game, town, 'still', Math.min(Math.max(0, f.hp), n)); f.hp -= n; f.poisonT -= dt; }
    if (f.frozenT > 0) { f.frozenT -= dt; continue; }
    const slow = f.slowT > 0 ? f.slow : 0; f.slowT -= dt;
    f.s += FOES[f.kind].speed * WAVE.speed * (1 - slow) * dt;
    if (f.s >= road.length && f.hp > 0) {
      const hp = FOES[f.kind].leak;
      town.vault.hp -= hp; f.hp = 0; f.leaked = true;
      game.bus.emit('leak', { town: town.id, foe: f.id, hp });
    }
  }
  const pos = new Map(ws.foes.map(f => [f, pointAt(road, f.s)]));
  // lobbed shells land: splash where they come down, and Shrapnel leaves the ground burning
  const shells = ws.shells || (ws.shells = []), fires = ws.fires || (ws.fires = []);
  for (const sh of shells) {
    sh.t -= dt;
    if (sh.t > 1e-9) continue;
    for (const f of ws.foes) if (f.hp > 0 && dist(sh.at, pos.get(f)) <= sh.splash) hurt(game, town, f, sh.dmg, false, sh.by || 'mortar');
    if (sh.fire) fires.push({ at: sh.at, r: sh.splash, t: FIRE.seconds, dps: sh.dmg * FIRE.dps });
    game.bus.emit('land', { town: town.id, spot: sh.spot, at: sh.at, splash: sh.splash, fire: !!sh.fire });
  }
  ws.shells = shells.filter(sh => sh.t > 1e-9);
  for (const fi of fires) {
    const k = Math.min(dt, fi.t); fi.t -= dt;
    for (const f of ws.foes) if (f.hp > 0 && dist(fi.at, pos.get(f)) <= fi.r) {
      hurt(game, town, f, fi.dps * k, false, 'mortar');
      f.slow = Math.max(f.slowT > 0 ? f.slow : 0, FIRE.slow); f.slowT = Math.max(f.slowT, .5);
    }
  }
  ws.fires = ws.fires.filter(fi => fi.t > 1e-9);
  // towers
  for (const t of town.towers) {
    const st = towerStats(town, t), at = town.def.board.spots[t.spot];
    t.cd -= dt;
    while (t.cd <= 0) {
      const inReach = ws.foes.filter(f => { if (f.hp <= 0 || (st.lob && FOES[f.kind].air)) return false; const d = dist(at, pos.get(f)); return d <= st.range && d >= st.minRange; });
      if (!inReach.length) { t.cd = 0; break; }
      t.cd += 1 / st.rate;
      const target = inReach.reduce((a, b) => (b.s > a.s ? b : a)); // the one closest to the vault
      let to = pos.get(target);
      if (st.flight) { // a lobbed shell: aim where the target will be when it comes down, and hit on landing
        const lead = FOES[target.kind].speed * WAVE.speed * (1 - (target.slowT > 0 ? target.slow : 0)) * st.flight;
        to = pointAt(road, Math.min(road.length, target.s + (target.frozenT > 0 ? 0 : lead)));
        ws.shells.push({ spot: t.spot, by: t.kind, at: to, t: st.flight, dmg: st.dmg, splash: st.splash, fire: st.fire });
        game.bus.emit('shot', { town: town.id, spot: t.spot, kind: t.kind, foe: target.id, from: at, to, flight: st.flight });
        continue;
      }
      if (st.pulse) { // frost: chills everything in reach
        t.pulses = (t.pulses || 0) + 1;
        for (const f of inReach) {
          hurt(game, town, f, st.dmg, false, t.kind);
          f.slow = Math.max(f.slowT > 0 ? f.slow : 0, st.slow); f.slowT = SLOW_SECONDS; f.brittle = Math.max(f.brittle, st.brittle);
          if (st.freeze && t.pulses % 3 === 0 && !FOES[f.kind].boss) f.frozenT = .8;
        }
      } else if (st.splash) {
        for (const f of ws.foes) if (f.hp > 0 && dist(to, pos.get(f)) <= st.splash) hurt(game, town, f, st.dmg, false, t.kind);
      } else if (st.poison) {
        hurt(game, town, target, st.dmg, false, t.kind);
        for (const f of ws.foes) if (f.hp > 0 && dist(to, pos.get(f)) <= st.cloud) { f.poison = Math.max(f.poisonT > 0 ? f.poison : 0, st.poison); f.poisonT = POISON_SECONDS; f.spread = f.spread || st.spread; }
      } else hurt(game, town, target, st.dmg, false, t.kind);
      game.bus.emit('shot', { town: town.id, spot: t.spot, kind: t.kind, foe: target.id, from: at, to });
    }
  }
  // the fallen pay their bounty (a fever-carrier passes its poison on)
  for (const f of ws.foes) if (f.hp <= 0 && !f.leaked && !f.dead) {
    f.dead = true; kill(game, town, f);
    if (f.spread && f.poisonT > 0) for (const g of ws.foes) if (g.hp > 0 && dist(pos.get(f), pos.get(g)) <= 1) { g.poison = Math.max(g.poison, f.poison); g.poisonT = POISON_SECONDS; g.spread = true; }
  }
  ws.foes = ws.foes.filter(f => f.hp > 0);
  // the vault falls: lose a share of coins, fall back two waves, start again after a rest
  if (town.vault.hp <= 0) {
    const lost = Math.floor(town.coins * WAVE.breachLoss);
    town.coins -= lost;
    const from = town.wave;
    town.wave = Math.max(1, town.wave - WAVE.breachBack);
    Object.assign(ws, { phase: 'break', timer: WAVE.rest * 2, queue: [], foes: [], shells: [], fires: [] });
    town.vault.hp = town.vault.max;
    town.breaches = (town.breaches || 0) + 1;
    game.bus.emit('breach', { town: town.id, wave: from, lost });
    return;
  }
  if (!ws.queue.length && !ws.foes.length) {
    town.bestWave = Math.max(town.bestWave, town.wave);
    game.bus.emit('wave:clear', { town: town.id, wave: town.wave });
    town.wave++;
    Object.assign(ws, { phase: 'break', timer: WAVE.rest });
  }
}

/* The tower reserve: goods that auto-sell never sells, so the towers can be paid for once the coins are there.
   Per good it adds up the next upgrade of every tower that uses it (at level 4 that upgrade is the path choice), and
   the cheapest open tower that uses the good and still has a free pad it fits, and likewise for a free mortar pit.
   A good whose "Keep for towers" switch is off (town.reserveOff[good]) keeps nothing. Coins still gate every buy. */
export function towerReserve(town) {
  const keep = {};
  const add = c => { for (const [g, n] of Object.entries(c.goods)) keep[g] = (keep[g] || 0) + n; };
  for (const t of town.towers) add(towerCost(town, t.kind, t.level));
  const spots = town.def && town.def.board ? town.def.board.spots : [];
  const taken = new Set(town.towers.map(t => t.spot));
  for (const pit of [false, true]) {
    const free = spots.some((_, i) => !taken.has(i) && isPit(town, i) === pit);
    if (!free) continue;
    const cheapest = {}; // good -> the cheapest build that uses it
    for (const kind of Object.keys(TOWERS)) {
      if (!towerOpen(town, kind) || !!TOWERS[kind].long !== pit) continue;
      const c = towerCost(town, kind, 0);
      for (const g of Object.keys(c.goods)) if (!cheapest[g] || c.coins < cheapest[g].coins) cheapest[g] = c;
    }
    for (const [g, c] of Object.entries(cheapest)) keep[g] = (keep[g] || 0) + c.goods[g];
  }
  const off = town.reserveOff || {};
  for (const g of Object.keys(keep)) if (off[g]) delete keep[g];
  return keep;
}
/* Turn "Keep for towers" on or off for one good. */
export function setReserve(town, good, on) {
  town.reserveOff = town.reserveOff || {};
  if (on) delete town.reserveOff[good]; else town.reserveOff[good] = true;
  town.keep = towerReserve(town);
}
/* What a tower buy is still short of: [{ good, have, need, maker, seconds }]. maker is the building that makes the
   good (null if none); seconds is about how long until the yard has enough at today's rate after the workshops'
   own use (null when nothing is coming in). */
export function shortfall(town, c) {
  const out = [], use = demand(town);
  for (const [g, need] of Object.entries(c.goods)) {
    const have = town.goods[g] || 0;
    if (have + 1e-9 >= need) continue;
    const maker = buildingsOf(town).find(id => BUILDINGS[id].makes === g) || null;
    const net = maker ? output(town, maker) - (use[g] || 0) : 0;
    out.push({ good: g, have, need, maker, seconds: net > 1e-9 ? (need - have) / net : null });
  }
  return out;
}

/* The vault's full strength: research (Thick Walls) raises it. */
export const vaultMax = town => Math.round(WAVE.vault * town.mods.factor('vault'));
function syncVault(town) {
  const m = vaultMax(town), v = town.vault;
  if (v.max !== m) { v.hp = Math.max(1, v.hp + m - v.max); v.max = m; }
}

export const defense = {
  id: 'defense',
  init(town) {
    town.wave = 1;
    town.vault = { hp: WAVE.vault, max: WAVE.vault };
    town.waves = { phase: 'break', timer: WAVE.first, queue: [], foes: [], nextId: 1, type: 'mixed', gap: 1, hold: false, shells: [], fires: [] };
    town.reserveOff = {};
    town.keep = towerReserve(town);
  },
  load(town) { if (!town.waves) defense.init(town); town.reserveOff = town.reserveOff || {}; town.waves.shells = town.waves.shells || []; town.waves.fires = town.waves.fires || []; },
  /* Towers that open at a wave open once the town reaches it, and stay open. */
  opens(game, town) {
    for (const [k, d] of Object.entries(TOWERS)) if (d.opens && town.wave >= d.opens && !town.flags['open:' + k]) {
      town.flags['open:' + k] = true; game.bus.emit('tower:open', { town: town.id, kind: k });
    }
  },
  step(town, dt, game) {
    if (!town.def || !town.def.board) return;
    defense.opens(game, town);
    syncVault(town);
    town.keep = towerReserve(town);
    if (game.catching) return;
    fight(game, town, dt);
  },
  coarse(town) { syncVault(town); town.keep = towerReserve(town); },
};
