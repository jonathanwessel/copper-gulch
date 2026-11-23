/* Call to arms (GDD.md, Late-game depth). Pure: no DOM, no three.js, no Math.random.
   Opened in every town by the War Office's ARMS.opens-th upgrade at the Capital. A call sends every built building's
   workers onto the road for ARMS.seconds: they stand by the road next to their building (armsPosts) and shoot the
   raider nearest the vault in reach (src/core/defense.js, fight). While they fight the town's buildings make nothing
   (src/core/economy.js, produce). Then the town waits until ARMS.cooldown seconds have passed since the call.
   State: town.arms = { t, cd, clock } (seconds the militia still fights, seconds until it can be called again, and the
   shot clock). Save v24.
   Events: 'arms:call' { town, workers, seconds }, 'arms:end' { town }. */
import { ARMS } from '../data/arms.js';
import { BUILDINGS } from '../data/buildings.js';
import { founded, nodesOf } from './tree.js';
import { output, buildingsOf, isGrid, demand } from './economy.js';
import { price } from './market.js';
import { armsPosts, wavesOf } from './defense.js';

export { armsPosts };
const state = town => town.arms || (town.arms = { t: 0, cd: 0, clock: 0 });
/* Is Call to arms open (the War Office's upgrade bought)? */
export const armsOpen = game => !!(game.shared && game.shared.tree) && founded(game, 'war') && nodesOf(game, 'war') >= ARMS.opens;
/* Can this place call at all (it has a road and at least one building with workers)? */
export const armsHere = town => !!(town.def && town.def.board && town.def.board.road) && armsPosts(town).some(p => town.level(p.id) > 0);
export const armsFighting = town => state(town).t > 1e-9;
/* Seconds until the town can call again (0 when it can). */
export const armsWait = town => Math.max(0, state(town).cd);
/* Why a call cannot go now: 'closed' (the War Office upgrade is not bought), 'none' (no building has workers yet),
   'fighting' (out already), 'wait' (cooling down), or null. */
export function armsBlock(game, town) {
  if (!armsOpen(game)) return 'closed';
  if (!armsHere(town)) return 'none';
  if (armsFighting(town)) return 'fighting';
  if (armsWait(town) > 1e-9) return 'wait';
  return null;
}
/* The workers who would come out: one group per built building, [{ id, level, at, s, hit }], hit as damage a shot. */
export function militia(town) {
  const base = wavesOf(town).hp(Math.max(1, town.wave)) * town.mods.factor('foeHp');
  return armsPosts(town).filter(p => town.level(p.id) > 0).map(p => ({ ...p, level: town.level(p.id), hit: base * shotShare(town.level(p.id)) }));
}
/* One worker group's shot as a share of a plain raider's health this wave, from its building's level. */
export const shotShare = L => ARMS.hit * Math.min(ARMS.most, (Math.max(1, L) / 10) ** ARMS.grow);
/* What the town would not make while the militia fights: { goods: { good: units }, coins } where goods is every
   building's output and coins is what the part its own workshops do not use up would sell for at today's prices (the
   lost production, shown before the tap). */
export function armsLoss(game, town, seconds = ARMS.seconds) {
  const goods = {}, use = demand(town); let coins = 0;
  for (const id of buildingsOf(town)) {
    const g = BUILDINGS[id].makes; if (isGrid(g)) continue;
    const n = output(town, id) * seconds;
    if (n > 0) goods[g] = (goods[g] || 0) + n;
  }
  for (const [g, n] of Object.entries(goods)) coins += Math.max(0, n - (use[g] || 0) * seconds) * price(game, town, g);
  return { goods, coins };
}
/* One building's workers by the road, as their card shows them and the tests read them (roadmap review 2026.11.22-9:
   anything that moves can be tapped): the building they came from, its level, the seconds of the call left (out: they
   are on the road now), and what that building does not make in those seconds (lost units of its good; 0 for power,
   which no one sells). null for an id that is not a building. */
export function workerStatus(town, id) {
  const b = BUILDINGS[id];
  if (!b) return null;
  const a = state(town), L = town.level(id) || 0, left = a.t > 1e-9 && L > 0 ? a.t : 0;
  return { id, name: b.name, level: L, left, out: left > 0, good: b.makes, lost: left > 0 && !isGrid(b.makes) ? output(town, id) * left : 0 };
}
/* Call the workers to arms. Returns true when they came out. */
export function callToArms(game, town) {
  if (armsBlock(game, town)) return false;
  const a = state(town);
  a.t = ARMS.seconds; a.cd = ARMS.cooldown; a.clock = 0;
  town.flags.armed = (town.flags.armed || 0) + 1;
  game.bus.emit('arms:call', { town: town.id, workers: militia(town).length, seconds: ARMS.seconds });
  return true;
}

function tick(game, town, dt) {
  const a = state(town);
  if (a.cd > 0) a.cd = Math.max(0, a.cd - dt);
  if (a.t > 0) { a.t = Math.max(0, a.t - dt); if (a.t <= 1e-9) { a.t = 0; game.bus.emit('arms:end', { town: town.id }); } }
}

export const arms = {
  id: 'arms',
  init(town) { state(town); },
  load(town) { const a = state(town); a.t = +a.t || 0; a.cd = +a.cd || 0; a.clock = +a.clock || 0; },
  step(town, dt, game) { tick(game, town, dt); },
};
