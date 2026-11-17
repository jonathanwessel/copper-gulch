/* Defense: raiders ride the road toward the vault in waves; towers on the spots beside the road shoot them.
   Everything is deterministic (the town's own random stream picks wave types and raiders) and hits land at once;
   the renderer draws the bolts, balls and clouds from the events this module emits:
     'shot' { town, tower, foe, kind, from, to }   'kill' { town, foe, coins }   'leak' { town, foe, hp }
     'wave:start' { town, wave, type, boss }       'wave:clear' { town, wave }   'breach' { town, wave, lost }
   A town's waves: town.wave is the wave running or coming next; town.waves holds the phase, timer, queue and foes.
   While the game catches up time away, defense rests (background battles arrive with Automation, M4). */
import { TOWERS, PATHS, PATH_LEVEL, SLOW_SECONDS, POISON_SECONDS, SELL_BACK, PER_LEVEL } from '../data/towers.js';
import { FOES, WAVE_TYPES, WAVE } from '../data/foes.js';
import { makePath, pointAt, dist } from './path.js';

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
  };
  return s;
}
/* Coins and goods to build (level 0 -> 1) or to raise a tower from level L to L + 1. */
export function towerCost(town, kind, L = 0) {
  const d = TOWERS[kind], goods = {};
  for (const [g, n] of Object.entries(d.goods[town.id] || {})) goods[g] = Math.ceil(n * PER_LEVEL.goods ** L);
  return { coins: Math.ceil(d.coins * PER_LEVEL.coins ** L * town.mods.factor('cost')), goods };
}
export function canPay(town, c) { return town.coins + 1e-9 >= c.coins && Object.entries(c.goods).every(([g, n]) => town.has(g, n)); }
function pay(town, c) { town.coins -= c.coins; for (const [g, n] of Object.entries(c.goods)) town.goods[g] -= n; }
export const towerAt = (town, spot) => town.towers.find(t => t.spot === spot) || null;

/* Build a tower on an empty spot. Returns true when built. */
export function buildTower(game, town, spot, kind) {
  if (!TOWERS[kind] || towerAt(town, spot) || !town.def.board.spots[spot]) return false;
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

function hurt(game, town, f, dmg, pierce = false) {
  const armor = pierce ? 0 : FOES[f.kind].armor;
  f.hp -= dmg * (1 - armor) * (1 + (f.slowT > 0 ? f.brittle : 0));
}

function kill(game, town, f) {
  const coins = WAVE.bounty(town.wave) * FOES[f.kind].bounty * town.mods.factor('income');
  town.earn(coins);
  game.bus.emit('kill', { town: town.id, foe: f.id, kind: f.kind, coins });
}

/* One step of the battle. */
export function fight(game, town, dt) {
  const ws = town.waves, road = roadOf(town);
  if (ws.phase === 'break') {
    ws.timer -= dt;
    if (ws.timer <= 0) startWave(game, town);
    return;
  }
  // spawn
  ws.timer -= dt;
  while (ws.queue.length && ws.timer <= 0) { spawn(town, ws.queue.shift()); ws.timer += ws.gap; }
  // move, poison, leak
  for (const f of ws.foes) {
    if (f.poisonT > 0) { f.hp -= f.poison * Math.min(dt, f.poisonT); f.poisonT -= dt; }
    if (f.frozenT > 0) { f.frozenT -= dt; continue; }
    const slow = f.slowT > 0 ? f.slow : 0; f.slowT -= dt;
    f.s += FOES[f.kind].speed * WAVE.speed * (1 - slow) * dt;
    if (f.s >= road.length && f.hp > 0) {
      const hp = FOES[f.kind].leak;
      town.vault.hp -= hp; f.hp = 0; f.leaked = true;
      game.bus.emit('leak', { town: town.id, foe: f.id, hp });
    }
  }
  // towers
  const pos = new Map(ws.foes.map(f => [f, pointAt(road, f.s)]));
  for (const t of town.towers) {
    const st = towerStats(town, t), at = town.def.board.spots[t.spot];
    t.cd -= dt;
    while (t.cd <= 0) {
      const inReach = ws.foes.filter(f => f.hp > 0 && dist(at, pos.get(f)) <= st.range);
      if (!inReach.length) { t.cd = 0; break; }
      t.cd += 1 / st.rate;
      const target = inReach.reduce((a, b) => (b.s > a.s ? b : a)); // the one closest to the vault
      const to = pos.get(target);
      if (st.pulse) { // frost: chills everything in reach
        t.pulses = (t.pulses || 0) + 1;
        for (const f of inReach) {
          hurt(game, town, f, st.dmg);
          f.slow = Math.max(f.slowT > 0 ? f.slow : 0, st.slow); f.slowT = SLOW_SECONDS; f.brittle = Math.max(f.brittle, st.brittle);
          if (st.freeze && t.pulses % 3 === 0 && !FOES[f.kind].boss) f.frozenT = .8;
        }
      } else if (st.splash) {
        for (const f of ws.foes) if (f.hp > 0 && dist(to, pos.get(f)) <= st.splash) hurt(game, town, f, st.dmg);
      } else if (st.poison) {
        hurt(game, town, target, st.dmg);
        for (const f of ws.foes) if (f.hp > 0 && dist(to, pos.get(f)) <= st.cloud) { f.poison = Math.max(f.poisonT > 0 ? f.poison : 0, st.poison); f.poisonT = POISON_SECONDS; f.spread = f.spread || st.spread; }
      } else hurt(game, town, target, st.dmg);
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
    Object.assign(ws, { phase: 'break', timer: WAVE.rest * 2, queue: [], foes: [] });
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

/* Goods the town keeps for its next tower: the most any one build or upgrade it could make next would need. */
export function towerReserve(town) {
  const keep = {};
  const add = c => { for (const [g, n] of Object.entries(c.goods)) keep[g] = Math.max(keep[g] || 0, n); };
  for (const kind of Object.keys(TOWERS)) add(towerCost(town, kind, 0));
  for (const t of town.towers) add(towerCost(town, t.kind, t.level));
  return keep;
}

export const defense = {
  id: 'defense',
  init(town) {
    town.wave = 1;
    town.vault = { hp: WAVE.vault, max: WAVE.vault };
    town.waves = { phase: 'break', timer: WAVE.first, queue: [], foes: [], nextId: 1, type: 'mixed', gap: 1 };
    town.keep = towerReserve(town);
  },
  load(town) { if (!town.waves) defense.init(town); },
  step(town, dt, game) {
    if (!town.def || !town.def.board) return;
    town.keep = towerReserve(town);
    if (game.catching) return;
    fight(game, town, dt);
  },
  coarse(town) { town.keep = towerReserve(town); },
};
