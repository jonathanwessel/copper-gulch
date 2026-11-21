/* Every town and outpost, in the order they open. */
import { DRYCREEK } from './drycreek.js';
import { GULCH } from './gulch.js';
import { RIDGE } from './ridge.js';
import { PINEHOLLOW } from './pinehollow.js';
import { FALLS } from './falls.js';
import { SANDYBEND } from './sandybend.js';

export const TOWNS = { drycreek: DRYCREEK, gulch: GULCH, ridge: RIDGE, pinehollow: PINEHOLLOW, falls: FALLS, sandybend: SANDYBEND };
/* Is pad i of a board a mortar pit? board.pits lists them by index (pads added later go after the pits, so a saved
   tower keeps its pad, owner 2026-11-20); an older board without the list has its pits from board.far on. */
export const isPitSpot = (B, i) => (B.pits ? B.pits.includes(i) : i >= (B.far ?? B.spots.length));
export const TOWN_ORDER = ['drycreek', 'gulch', 'pinehollow', 'ridge', 'sandybend', 'falls'];
