/* The empire map (GDD.md, Empire map): where each town and outpost sits, in map units. The Capital's site is in the
   middle (it is built in M4); towns ring it and each outpost sits out past the town it feeds. The map is taller than
   it is wide, so a phone sees it whole; a wide screen turns it on its side. Later towns add their place here. */
export const CAPITAL = [0, 0];
/* The ring (owner, 2026-11-22: "raiders always come from the perimeter"): five places for towns round the Capital,
   72 degrees apart on an oval taller than wide, and each outpost out past its town on a wider oval. A slot's angle runs
   clockwise from north (-z). The Gulch is north, Iron Ridge and Silver Falls south-west and south-east (a phone sees the south side nearer, so the busier pair sits there); the two side
   slots wait for Thunder Mesa and Radium Springs. Each board turns to face outward (src/render/empire-plan.js, turnOf). */
export const RING = { town: [9, 13.5], outpost: [16.5, 27] };
// the side slots sit at 80 and 280, not 72 and 288: at 72 Thunder Mesa's road met the Capital's plaza beside the Gulch's and
// Dry Creek's, and their wagons overlapped there (test/trains.test.js, 2026.11.26-5)
export const SLOTS = { gulch: 0, ridge: 216, falls: 144, mesa: 80, radium: 280 };
// Dry Creek stands further out than the others: the Gulch's canyon runs long toward it, and the Gulch's label sits
// between them on a phone
const DRY = [RING.outpost[0], RING.outpost[1] + 5];
const onRing = (deg, [rx, rz]) => { const r = deg * Math.PI / 180; return [+(Math.sin(r) * rx).toFixed(2), +(-Math.cos(r) * rz).toFixed(2)]; };
export const SITES = {
  drycreek: onRing(SLOTS.gulch, DRY),
  gulch: onRing(SLOTS.gulch, RING.town),
  ridge: onRing(SLOTS.ridge, RING.town),
  pinehollow: onRing(SLOTS.ridge, RING.outpost),
  falls: onRing(SLOTS.falls, RING.town),
  sandybend: onRing(SLOTS.falls, RING.outpost),
  mesa: onRing(SLOTS.mesa, RING.town),
};
export const DIORAMA = .58; // a town's board drawn on the map at this scale
