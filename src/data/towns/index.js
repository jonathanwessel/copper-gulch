/* Every town and outpost, in the order they open. */
import { DRYCREEK } from './drycreek.js';
import { GULCH } from './gulch.js';
import { RIDGE } from './ridge.js';
import { PINEHOLLOW } from './pinehollow.js';
import { FALLS } from './falls.js';
import { SANDYBEND } from './sandybend.js';
import { MESA } from './mesa.js';

export const TOWNS = { drycreek: DRYCREEK, gulch: GULCH, ridge: RIDGE, pinehollow: PINEHOLLOW, falls: FALLS, sandybend: SANDYBEND, mesa: MESA };
/* Is pad i of a board a mortar pit? board.pits lists them by index (pads added later go after the pits, so a saved
   tower keeps its pad, owner 2026-11-20); an older board without the list has its pits from board.far on. */
export const isPitSpot = (B, i) => (B.pits ? B.pits.includes(i) : i >= (B.far ?? B.spots.length));
export const TOWN_ORDER = ['drycreek', 'gulch', 'pinehollow', 'ridge', 'sandybend', 'falls', 'mesa'];
/* A board's lanes in the order the battle numbers them (src/core/defense.js, lanesOf): the road, then the river where
   there is one (boats), then the sky where there is one (airships, Thunder Mesa from M6b part 2b). Each is
   { key, line, entrance }: its points before the vault, and the entrance its raiders stay hidden in. */
const LANES = new WeakMap();
export function laneDefs(B) {
  if (!LANES.has(B)) LANES.set(B, [{ key: 'road', line: B.road, entrance: B.entrance },
    ...(B.river ? [{ key: 'river', line: B.river.path, entrance: B.river.entrance }] : []),
    ...(B.sky ? [{ key: 'sky', line: B.sky.path, entrance: B.sky.entrance }] : [])]);
  return LANES.get(B);
}
/* How far along each lane its raiders stay hidden inside its entrance. */
export const laneHides = B => laneDefs(B).map(l => (l.entrance && l.entrance.hide) || 0);
/* The number of a lane by its key on this board (-1 when the board has none). */
export const laneIndex = (B, key) => laneDefs(B).findIndex(l => l.key === key);
