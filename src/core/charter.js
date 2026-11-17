/* Charters and deeds (GDD.md, Charters and deeds). Signing a town's charter resets that town (coins, buildings,
   towers, waves, research, foremen, its switches) and pays deeds from its best wave and the coins earned since its
   last charter. Deeds are empire-wide and kept for good: each adds DEEDS.income to the coins earned in every town,
   as the named source "Deeds". The explainers seen and the game's stats are kept.
   Deed perks (src/data/perks.js) come in pairs; you pick one side once you hold enough deeds. A pick stays until the
   next charter, which clears every pick so you choose again.
   Empire-wide state: game.shared.charter = { deeds, signed, offered, perks: { pair: 'a' | 'b' }, last }.
   Events: 'charter:offer' { town, deeds }, 'charter:sign' { town, deeds, wave, coins }, 'perk:pick' { id, side }. */
import { DEEDS, PERKS, PERK } from '../data/perks.js';
import { Town } from './town.js';

const C = game => game.shared.charter;
export const deedsHeld = game => C(game).deeds;
export const charterOffered = game => !!C(game).offered;

/* Deeds the town's charter would pay now, and from what. */
export function deedParts(town) {
  const w = town.bestWave || 0, c = town.lifetime || 0;
  const wave = w >= DEEDS.wave ? 1 + Math.floor((w - DEEDS.wave) / DEEDS.waveStep) : 0;
  const coins = c >= DEEDS.coins ? 1 + Math.floor(Math.log10(c / DEEDS.coins) / Math.log10(DEEDS.coinStep) + 1e-9) : 0;
  return { wave, coins, total: wave + coins };
}
export const deedsFor = town => deedParts(town).total;
/* What earns the next deed: the next best wave and the next coins-earned mark. */
export function nextDeed(town) {
  const p = deedParts(town);
  return { wave: DEEDS.wave + p.wave * DEEDS.waveStep, coins: DEEDS.coins * DEEDS.coinStep ** p.coins };
}

/* A pair's state: 'locked' (too few deeds), 'open' (pick a side), or the side picked. */
export function perkState(game, id) {
  const c = C(game), p = PERK[id];
  if (c.perks[id]) return c.perks[id];
  return c.deeds >= p.need ? 'open' : 'locked';
}
/* Pairs waiting for a pick. */
export const perksToPick = game => PERKS.filter(p => perkState(game, p.id) === 'open').length;

/* Put the deeds and the picked perks on one town's stats. Safe to run again: it sets, never adds. */
export function applyCharter(game, town) {
  const c = C(game);
  town.mods.set('income', 'Deeds', { mul: 1 + DEEDS.income * c.deeds });
  for (const p of PERKS) for (const side of ['a', 'b']) for (const e of p[side].effects)
    town.mods.set(e.stat, p[side].name + ' perk', { mul: c.perks[p.id] === side ? e.mul : 1 });
}
export function applyAll(game) { for (const t of Object.values(game.towns)) applyCharter(game, t); }

/* Pick one side of a perk pair. Returns true when picked. */
export function pickPerk(game, id, side) {
  if (!PERK[id] || (side !== 'a' && side !== 'b') || perkState(game, id) !== 'open') return false;
  C(game).perks[id] = side;
  applyAll(game);
  game.bus.emit('perk:pick', { id, side });
  return true;
}

/* Start a town over, in place (the interface and the renderer keep their reference to it). Its random stream and
   clock carry on, so a new charter never replays the old one's dice. */
export function resetTown(game, town) {
  const keep = { id: town.id, def: town.def, rng: town.rng, t: town.t, charters: (town.charters || 0) + 1 };
  const fresh = new Town(town.id, { def: town.def });
  for (const k of Object.keys(town)) delete town[k];
  Object.assign(town, fresh, keep);
  for (const s of game.systems) if (s.init) s.init(town, game);
}

/* Sign the town's charter: pays its deeds, resets it and clears the perk picks. Returns the deeds paid (0: not yet). */
export function signCharter(game, town) {
  const n = deedsFor(town);
  if (n < 1) return 0;
  const c = C(game), wave = town.bestWave, coins = Math.round(town.lifetime);
  c.deeds += n; c.signed++; c.perks = {};
  c.last = { town: town.id, deeds: n, wave, coins };
  resetTown(game, town);
  applyAll(game);
  game.bus.emit('charter:sign', { town: town.id, deeds: n, wave, coins });
  return n;
}

export const charter = {
  id: 'charter',
  setup(game) { if (!game.shared.charter) game.shared.charter = { deeds: 0, signed: 0, offered: false, perks: {}, last: null }; },
  init(town, game) { applyCharter(game, town); },
  load(town, game) { const c = C(game); c.perks = c.perks || {}; applyCharter(game, town); },
  /* The charter is offered (and the Perks button appears) the first time a town's charter would pay a deed. */
  step(town, dt, game) {
    const c = C(game);
    if (c.offered) return;
    const n = deedsFor(town);
    if (n >= 1) { c.offered = true; game.bus.emit('charter:offer', { town: town.id, deeds: n }); }
  },
};
