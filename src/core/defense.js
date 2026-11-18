/* Defense: raiders ride the road toward the vault in waves; towers on the spots beside the road shoot them.
   Everything is deterministic (the town's own random stream picks wave types and raiders) and hits land at once;
   the renderer draws the bolts, balls and clouds from the events this module emits:
     'shot' { town, tower, foe, kind, from, to, flight? }   'kill' { town, foe, coins }   'leak' { town, foe, hp }
     'land' { town, spot, at, splash, fire }       'tower:open' { town, kind }
     'wave:start' { town, wave, type, boss }       'wave:clear' { town, wave }
     'breach' { town, wave, lost, why: 'vault' | 'boss', back, held, away }   (held: the town now holds its waves; away: it
     was out of play or catching up)
   A town's waves: town.wave is the wave running or coming next; town.waves holds the phase, timer, queue and foes,
   the lobbed shells still in the air (shells) and the burning ground Shrapnel leaves (fires).
   Every town keeps playing when the player is not looking at it (owner rule, 2026-11-17): out of play its waves run
   step by step like the town in play, and during the coarse chunks of time away (src/core/clock.js) skirmish() plays
   each wave through a copy of the town and applies the result. Boss waves are gates (owner rule, 2026-11-17): a boss
   wave is beaten only when its boss is killed; a boss that gets through loses the wave like a fallen vault, in play or
   away. A town that loses its boss wave, or its vault while away, holds its own waves (waves.autoHold) until the
   player taps Resume waves or Call now there.
   A won outpost (town.won, src/core/outpost.js) keeps fighting: its raids stay at its last wave's strength without the
   boss, one every town.def.raid seconds, and a breach there takes part of its goods, never its waves. */
import { TOWERS, PATHS, PATH_LEVEL, SLOW_SECONDS, POISON_SECONDS, SELL_BACK, PER_LEVEL, FIRE, FREEZE } from '../data/towers.js';
import { FOES, WAVE_TYPES, WAVE } from '../data/foes.js';
import { makePath, pointAt, dist } from './path.js';
import { demand, output, buildingsOf } from './economy.js';
import { BUILDINGS } from '../data/buildings.js';
import { Town } from './town.js';
import { STEP } from './clock.js';

/* The wave settings for a town: WAVE (src/data/foes.js) with the town's own overrides (town.def.waves). */
const WAVES = new WeakMap();
export function wavesOf(town) {
  const d = town && town.def;
  if (!d || !d.waves) return WAVE;
  if (!WAVES.has(d)) WAVES.set(d, { ...WAVE, ...d.waves });
  return WAVES.get(d);
}
/* Is wave w a boss wave here? A town may list its boss waves (waves.bosses); otherwise every WAVE.boss-th wave.
   A won outpost's light raids never bring its boss again. */
export const bossWave = (town, w) => { const W = wavesOf(town); return !town.won && (W.bosses ? W.bosses.includes(w) : w % W.boss === 0); };
/* Share of each good in its stockpile a won outpost loses when raiders break in (its waves never drop back). */
export const RAID_LOSS = .25;

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
    splash: (d.splash || 0) * (p.splash || 1) * town.mods.factor('blast'), slow: d.slow || 0, pulse: !!d.pulse,
    poison: (d.poison || 0) * (p.poison || 1) * PER_LEVEL.poison ** (L - 1) * town.mods.factor('towerDmg'),
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
/* Is this tower kind built in this town at all? (An outpost lists its few kinds in town.def.towers.) */
export const towerIn = (town, kind) => !!TOWERS[kind] && !(town.def && town.def.towers && !town.def.towers.includes(kind));
/* Has the town opened this tower kind? (Most are open from the start; some open at a wave.) */
export const towerOpen = (town, kind) => towerIn(town, kind) && (!TOWERS[kind].opens || !!(town.flags && town.flags['open:' + kind]));
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
  if (bossWave(town, w) || w < 4) return 'mixed';
  const kinds = Object.keys(WAVE_TYPES).filter(k => w >= WAVE_TYPES[k].from);
  return town.rng.pick(kinds);
}
/* The raiders of wave w, in order. */
export function planWave(town, w, type) {
  const T = WAVE_TYPES[type], n = Math.max(4, Math.round(wavesOf(town).count(w) * T.count));
  const mix = Object.fromEntries(Object.entries(T.mix).filter(([k]) => w >= FOES[k].from));
  const q = [];
  for (let i = 0; i < n; i++) q.push(Object.keys(mix).length ? town.rng.weighted(mix) : 'raider');
  if (bossWave(town, w)) q.push((town.def && town.def.boss) || 'wagon');
  return q;
}
export function startWave(game, town, rush = 0) {
  const ws = town.waves;
  if (ws.phase !== 'break') return false;
  const w = town.wave, type = waveType(town, w);
  const q = planWave(town, w, type), boss = bossWave(town, w) ? q.pop() : null, n = q.length;
  // a called wave brings more raiders (RUSH.more): copies of its own, in order, so the random stream is untouched
  for (let i = 0, extra = Math.round(n * (wavesOf(town).rushMore ?? RUSH.more) * rush); i < extra; i++) q.push(q[i % n]);
  if (boss) q.push(boss);
  ws.phase = 'wave'; ws.type = type; ws.queue = q; ws.timer = 0; ws.age = 0; ws.gap = wavesOf(town).gap(w) * WAVE_TYPES[type].gap;
  game.bus.emit('wave:start', { town: town.id, wave: w, type, boss: bossWave(town, w) });
  return true;
}
/* Hold the waves: the wave on the road finishes, but the next one does not start until released. */
export function setHold(game, town, on) {
  town.waves.hold = !!on;
  if (!on) town.waves.autoHold = false;
  game.bus.emit('waves:hold', { town: town.id, hold: !!on });
}

/* Call now is never locked (owner rule, 2026-11-17): the player decides when the next wave comes, at any moment of a
   break. oldGround: a wave the town beat before its last charter (town.record is the best wave of every charter before
   this one, kept when the charter resets the town), where its towers hit harder so a signed town races back. */
export const oldGround = town => town.wave <= (town.record || 0);
/* A wave called early comes bigger: calling in the last RUSH.free share of the wait is free, and the share skipped
   beyond that (rush, 0 to 1) brings (1 + RUSH.more x rush) times its raiders. A wave lasts about as long as its raiders
   take to ride out, so a bigger wave takes longer and racing saves less time (tougher raiders did not: a strong
   defense killed them as fast). The bonus for the time skipped is RUSH.bonus of the old one (bounty x seconds / 4).
   This, not a locked button, keeps a strong defense from racing far ahead of the others (CLAUDE.md, strategies stay
   close). The first wave and waves the town beat before its charter come at their normal strength however early. */
export const RUSH = { more: 2, free: .4, bonus: .5 };
export const rushOf = town => (town.wave === 1 && !town.bestWave) || oldGround(town) ? 0 : Math.min(1, Math.max(0, town.waves.timer / wavesOf(town).pace - (wavesOf(town).rushFree ?? RUSH.free)) / (1 - (wavesOf(town).rushFree ?? RUSH.free)));
/* On old ground the towers also hit OLD_GROUND times harder (the named source "Waves you beat before" on tower damage, so the
   tower card's breakdown shows it), so those waves fall fast and the town can call the next one at once. */
export const OLD_GROUND = { dmg: 3 };
export const canCall = town => town.waves.phase === 'break';
/* Start the next wave now, for a bonus of coins for the time skipped. Returns the bonus, or -1 when no break is on
   (a wave is already on the road). town.flags.called counts the calls (the goal strip asks for one). */
export function callEarly(game, town) {
  const ws = town.waves;
  if (!canCall(town)) return -1;
  if (ws.autoHold) setHold(game, town, false); // a town that held its own waves after a loss starts again
  const bonus = Math.ceil(wavesOf(town).bounty(town.wave) * ws.timer / 4 * RUSH.bonus);
  town.earn(bonus, false, 'call');
  town.flags.called = (town.flags.called || 0) + 1;
  startWave(game, town, rushOf(town));
  return bonus;
}

/* A boss's base health at wave w: it grows slower than the wave's (WAVE.bossGrowth), from the wave-10 health. */
export const bossHp = (W, w) => w <= 10 ? W.hp(w) : W.hp(10) * (W.hp(w) / W.hp(10)) ** (W.bossGrowth ?? 1);
function spawn(town, kind) {
  const ws = town.waves, f = FOES[kind], T = WAVE_TYPES[ws.type] || WAVE_TYPES.mixed;
  const W = wavesOf(town), base = f.boss ? bossHp(W, town.wave) : W.hp(town.wave);
  const hp = base * f.hp * T.hp * town.mods.factor('foeHp');
  ws.foes.push({ id: ws.nextId++, kind, hp, max: hp, s: 0, slow: 0, slowT: 0, frozenT: 0, poison: 0, poisonT: 0, brittle: 0 });
}

/* Damage dealt, by tower kind, per town: game.dealt[town][kind]. Not saved; the bots read it to see which towers
   do the work. */
function tally(game, town, by, n) {
  if (!by || !(n > 0)) return;
  const d = game.dealt || (game.dealt = {}), t = d[town.id] || (d[town.id] = {});
  t[by] = (t[by] || 0) + n;
}
/* How much harder a tower kind hits this raider kind (TOWERS[kind].best): by raider kind, then 'boss', then 'armored'. */
export function bestFactor(kind, foe) {
  const b = TOWERS[kind] && TOWERS[kind].best, F = FOES[foe];
  if (!b || !F) return 1;
  return b[foe] || (F.boss && b.boss) || (F.armor > 0 && b.armored) || 1;
}
function hurt(game, town, f, dmg, pierce = false, by = null) {
  const armor = pierce ? 0 : FOES[f.kind].armor, n = dmg * (1 - armor) * (1 + (f.slowT > 0 ? f.brittle : 0)) * (by && by !== 'still' ? bestFactor(by, f.kind) : 1);
  tally(game, town, by, Math.min(Math.max(0, f.hp), n));
  f.hp -= n;
}

function kill(game, town, f) {
  const coins = wavesOf(town).bounty(town.wave) * FOES[f.kind].bounty * town.mods.factor('income') * town.mods.factor('bounty');
  town.earn(coins, false, 'bounty');
  game.bus.emit('kill', { town: town.id, foe: f.id, kind: f.kind, coins });
}

/* Is the town away from the player? Out of play, or any town while time away is caught up. */
export const away = (game, town) => !!game.catching || (!!game.active && game.active !== town.id);
/* Every town keeps playing while away (owner rule, 2026-11-17), except one with no towers yet: it waits for the player,
   so a town just opened is never raided before it has had a look. A won outpost keeps its light raids whatever it has. */
export const waitsAway = (game, town) => away(game, town) && !town.towers.length && !town.won;

/* One step of the battle. */
export function fight(game, town, dt) {
  const ws = town.waves, road = roadOf(town);
  if (ws.phase === 'break') {
    if (waitsAway(game, town)) return;
    ws.timer = Math.max(0, ws.timer - dt);
    if (ws.timer <= 0 && !ws.hold) startWave(game, town); // held: the town keeps working, the next wave waits
    return;
  }
  // spawn
  ws.timer -= dt; ws.age = (ws.age || 0) + dt;
  while (ws.queue.length && ws.timer <= 0) { spawn(town, ws.queue.shift()); ws.timer += ws.gap; }
  // move, poison, leak
  for (const f of ws.foes) {
    if (f.poisonT > 0) { const n = f.poison * Math.min(dt, f.poisonT); tally(game, town, 'still', Math.min(Math.max(0, f.hp), n)); f.hp -= n; f.poisonT -= dt; }
    if (f.thawT > 0) f.thawT -= dt;
    if (f.frozenT > 0) { f.frozenT -= dt; continue; }
    const slow = f.slowT > 0 ? f.slow : 0; f.slowT -= dt;
    f.s += FOES[f.kind].speed * wavesOf(town).speed * (1 - slow) * dt;
    if (f.s >= road.length && f.hp > 0) {
      const hp = FOES[f.kind].leak;
      town.vault.hp -= hp; f.hp = 0; f.leaked = true;
      if (FOES[f.kind].boss) ws.bossLeaked = true;
      game.bus.emit('leak', { town: town.id, foe: f.id, hp, boss: !!FOES[f.kind].boss });
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
        const lead = FOES[target.kind].speed * wavesOf(town).speed * (1 - (target.slowT > 0 ? target.slow : 0)) * st.flight;
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
          if (st.freeze && t.pulses % 3 === 0 && !FOES[f.kind].boss && !(f.thawT > 0)) { f.frozenT = FREEZE.seconds; f.thawT = FREEZE.seconds + FREEZE.again; }
        }
      } else if (st.splash) {
        for (const f of ws.foes) if (f.hp > 0 && dist(to, pos.get(f)) <= st.splash) hurt(game, town, f, st.dmg, false, t.kind);
      } else if (st.poison) {
        hurt(game, town, target, st.dmg, false, t.kind);
        for (const f of ws.foes) if (f.hp > 0 && dist(to, pos.get(f)) <= st.cloud) { f.poison = Math.max(f.poisonT > 0 ? f.poison : 0, st.poison * bestFactor(t.kind, f.kind)); f.poisonT = POISON_SECONDS; f.spread = f.spread || st.spread; }
      } else hurt(game, town, target, st.dmg, false, t.kind);
      game.bus.emit('shot', { town: town.id, spot: t.spot, kind: t.kind, foe: target.id, from: at, to });
    }
  }
  // the fallen pay their bounty (a fever-carrier passes its poison on)
  for (const f of ws.foes) if (f.hp <= 0 && !f.leaked && !f.dead) {
    f.dead = true; kill(game, town, f);
    if (f.spread && f.poisonT > 0) for (const g of ws.foes) if (g.hp > 0 && dist(pos.get(f), pos.get(g)) <= 1) { g.poison = Math.max(g.poisonT > 0 ? g.poison : 0, f.poison / bestFactor('still', f.kind) * bestFactor('still', g.kind)); g.poisonT = POISON_SECONDS; g.spread = true; }
  }
  ws.foes = ws.foes.filter(f => f.hp > 0);
  if (town.vault.hp <= 0) { fall(game, town, 'vault'); return; }
  if (!ws.queue.length && !ws.foes.length) waveEnd(game, town);
}

/* The town loses: its vault fell (why 'vault'), or its boss got through (why 'boss', the boss gate).
   A won outpost: raiders carry off part of each good and its waves stay. A town: it loses a share of the purse, but
   never more than it earned in about the last 5 minutes (GDD.md, Vault), and drops back breachBack waves. A town away,
   or any town that lost its boss, then holds its own waves (autoHold), so it pays the loss once, not in a loop; in play
   the player decides when to try the boss again. */
export function fall(game, town, why = 'vault') {
  const ws = town.waves;
  town.vault.hp = town.vault.max;
  town.breaches = (town.breaches || 0) + 1;
  if (town.won) {
    const took = {};
    for (const g of Object.keys(town.goods)) { took[g] = town.goods[g] * RAID_LOSS; town.goods[g] -= took[g]; }
    Object.assign(ws, { phase: 'break', timer: town.def.raid || 120, queue: [], foes: [], shells: [], fires: [], bossLeaked: false });
    game.bus.emit('breach', { town: town.id, wave: town.wave, lost: 0, goods: took, why, back: town.wave, held: false });
    return;
  }
  const lost = Math.floor(Math.min(town.coins * wavesOf(town).breachLoss, town.recent || 0));
  town.coins -= lost;
  const from = town.wave;
  town.wave = Math.max(1, town.wave - wavesOf(town).breachBack);
  Object.assign(ws, { phase: 'break', timer: wavesOf(town).rest * 2, queue: [], foes: [], shells: [], fires: [], bossLeaked: false });
  const gone = away(game, town), held = gone || why === 'boss';
  if (held) { ws.hold = true; ws.autoHold = true; town.lost = { why, wave: from, back: town.wave, coins: lost, at: town.t, away: gone }; }
  game.bus.emit('breach', { town: town.id, wave: from, lost, why, back: town.wave, held, away: gone });
}

/* The last raider is gone. A boss that got through means the wave is lost (boss waves are gates); otherwise the wave
   is beaten and the next one comes after the wave pace. */
function waveEnd(game, town) {
  const ws = town.waves;
  if (ws.bossLeaked && !town.won) { fall(game, town, 'boss'); return; }
  ws.bossLeaked = false;
  town.bestWave = Math.max(town.bestWave, town.wave);
  game.bus.emit('wave:clear', { town: town.id, wave: town.wave });
  if (town.won) { Object.assign(ws, { phase: 'break', timer: Math.max(wavesOf(town).rest, (town.def.raid || 120) - (ws.age || 0)) }); return; } // light raids
  town.wave++;
  Object.assign(ws, { phase: 'break', timer: Math.max(wavesOf(town).rest, wavesOf(town).pace - (ws.age || 0)) });
}

// --- the background battle -------------------------------------------------------------------------------------------
/* A wave played out on a copy of the town, step by step, with a vault that never falls: what died and what got
   through, in order, with the time of each (seconds from the wave's start). The same wave against the same towers
   always plays out the same way, so runs are kept per town data and reused (a won outpost's raids repeat all day). */
const RUNS = new WeakMap();
const RUN_KEEP = 48;
const runKey = town => {
  const ws = town.waves, m = town.mods;
  return [town.wave, ws.type, ws.gap, ws.queue.join(','), ...['towerDmg', 'towerRate', 'towerRange', 'blast', 'foeHp'].map(k => m.factor(k).toFixed(6)),
    town.towers.map(t => t.spot + t.kind + t.level + (t.path || '')).join(',')].join('|');
};
export function waveRun(town) {
  const runs = RUNS.get(town.def) || new Map(), key = runKey(town);
  RUNS.set(town.def, runs);
  if (runs.has(key)) return runs.get(key);
  const c = Town.fromJSON(town.toJSON(), town.def);
  c.vault = { hp: 1e15, max: 1e15 };
  Object.assign(c.waves, { foes: [], shells: [], fires: [], age: 0, timer: 0, bossLeaked: false });
  for (const t of c.towers) t.cd = 0;
  const run = { ev: [], age: 0, dealt: {} };
  const g = { active: c.id, catching: false, dealt: {}, bus: { emit(type, e) {
    if (type === 'kill') run.ev.push([c.waves.age, 'k', e.kind]);
    else if (type === 'leak') run.ev.push([c.waves.age, 'l', e.hp, e.boss]);
  } } };
  for (let n = 0; c.waves.phase === 'wave' && n < 20000; n++) fight(g, c, STEP);
  run.age = c.waves.age || 0;
  run.dealt = g.dealt[c.id] || {};
  if (runs.size >= RUN_KEEP) runs.delete(runs.keys().next().value);
  runs.set(key, run);
  return run;
}
/* Play a wave that has just started (startWave) from its run: bounties paid, raiders that get through hit the vault,
   and the wave ends as fight() would end it. Returns the seconds it took. */
function playRun(game, town, run) {
  const ws = town.waves;
  ws.queue = []; ws.foes = []; ws.shells = []; ws.fires = [];
  for (const [t, what, x, boss] of run.ev) {
    if (what === 'k') { kill(game, town, { id: 0, kind: x }); continue; }
    town.vault.hp -= x;
    if (boss) ws.bossLeaked = true;
    if (town.vault.hp <= 0) { fall(game, town, 'vault'); return t; }
  }
  for (const [k, n] of Object.entries(run.dealt)) tally(game, town, k, n);
  ws.age = run.age;
  waveEnd(game, town);
  return run.age;
}
/* dt seconds of a town's waves in one go (the coarse chunks of time away). A wave already on the road finishes step by
   step; then each break counts down, and each wave that starts is played from its run. A wave that runs past the end
   of the chunk is owed (waves.owe) by the next chunk. */
export function skirmish(game, town, dt) {
  const ws = town.waves;
  let left = dt - (ws.owe || 0);
  ws.owe = 0;
  for (let guard = 0; left > 1e-9 && guard < 500; guard++) {
    if (ws.phase === 'wave') { for (let n = 0; ws.phase === 'wave' && n < 8000; n++) { fight(game, town, STEP); left -= STEP; } continue; }
    if (waitsAway(game, town)) return;
    const use = Math.min(left, ws.timer);
    ws.timer = Math.max(0, ws.timer - use); left -= use;
    if (ws.timer > 1e-9 || ws.hold) return;
    if (!startWave(game, town)) return;
    left -= playRun(game, town, waveRun(town));
  }
  if (left < 0) ws.owe = -left;
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
export const vaultMax = town => Math.round(wavesOf(town).vault * town.mods.factor('vault'));
function syncVault(town) {
  const m = vaultMax(town), v = town.vault;
  if (v.max !== m) { v.hp = Math.max(1, v.hp + m - v.max); v.max = m; }
}

export const defense = {
  id: 'defense',
  init(town) {
    town.wave = 1;
    town.vault = { hp: wavesOf(town).vault, max: wavesOf(town).vault };
    town.waves = { phase: 'break', timer: wavesOf(town).first, queue: [], foes: [], nextId: 1, type: 'mixed', gap: 1, hold: false, shells: [], fires: [], age: 0 };
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
    town.mods.set('towerDmg', 'Bonus on waves you beat before', { mul: oldGround(town) ? OLD_GROUND.dmg : 1 });
    town.keep = towerReserve(town);
    town.waves.owe = 0;
    fight(game, town, dt);
  },
  coarse(town, dt, game) {
    if (!town.def || !town.def.board) return;
    defense.opens(game, town);
    syncVault(town);
    town.mods.set('towerDmg', 'Bonus on waves you beat before', { mul: oldGround(town) ? OLD_GROUND.dmg : 1 });
    skirmish(game, town, dt);
    town.keep = towerReserve(town);
  },
};
