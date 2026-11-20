/* Iron Ridge: the second town. Iron and rail: iron ore, coal and stone, then pig iron and steel, then rails, boilers
   and locomotives. Its Boiler Shop needs bricks and its Locomotive Works tools, both shipped in from Copper Gulch
   (src/core/economy.js, ship). Founding it opens Pine Hollow, the second outpost. */
export const RIDGE = {
  id: 'ridge',
  name: 'Iron Ridge',
  short: 'Iron Ridge',
  era: 'Iron and rail',
  makesText: 'iron, steel, rails, boilers and locomotives', // on the sheet that founds it (review of 2026.11.20-8: the Capital asks it for boilers and locomotives)
  goods: ['stone', 'iron', 'coal', 'pigiron', 'steel', 'rails', 'boilers', 'locos'],
  buildings: ['rquarry', 'ironmine', 'colliery', 'furnace', 'steelmill', 'rolling', 'boilershop', 'loco'],
  top: 'locos',
  start: { coins: 60, buildings: { rquarry: 1 } },
  imports: ['bricks', 'tools'],   // shipped in from Copper Gulch
  outpost: 'pinehollow',          // founding the Ridge opens this outpost too
  // waves a little further apart than the Gulch's 58 s: with one purse the Ridge spends what every town earns, and its
  // wave 10 came at 6.7 min (target 7-10, set 2026-11-17). Since Call now is never locked (owner rule) the empire's coins
  // let a few strong towers call every wave at once: 66 s apart, and a wave called right away brings up to 5 times its
  // raiders (rushMore, src/core/defense.js RUSH; the Gulch's is 2), so the strategies stay within 25% (minmax was 29% ahead; 3.5 until
  // 2026-11-18, when Deep Freeze stopped holding raiders for good and a seed reached wave 10 in 6.6 min)
  waves: { pace: 66, rushMore: 4 },
  boss: 'train',                  // wave 10, 20... bring the armored train
  research: ['drills', 'hotblast', 'plating', 'rifling', 'rewards', 'depot', 'bessemer'], // src/data/research.js
  researchOpens: 'furnace',
  // founding it (src/core/empire.js): the Gulch's best wave and the coins the Gulch pays
  found: { from: 'gulch', wave: 20, coins: 15000, shows: 15 },
  // The board: the line comes out of a railway tunnel in the north-east and switches back across the town four times
  // (west, east, west, east), so raiders pass every row of workshops twice. Workshops stand in three rows between the
  // passes; tower pads sit in the gaps between them, where one tower reaches two passes, and outside the bends.
  board: {
    cols: 10, rows: 13,
    plots: {
      rquarry: [2, 2.4], ironmine: [5, 2.4], colliery: [8, 2.4],
      furnace: [2, 6.4], steelmill: [5, 6.4], rolling: [8, 6.4],
      boilershop: [2, 10.4], loco: [5, 10.4],
    },
    road: [
      [9.6, -6], [9.6, -.2], [9, .4],              // out of the tunnel, then west
      [1, .4], [.4, 1], [.4, 3.8], [1, 4.4],       // the first pass and the west bend
      [9, 4.4], [9.6, 5], [9.6, 7.8], [9, 8.4],    // east, and the east bend
      [1, 8.4], [.4, 9], [.4, 11.8], [1, 12.4],    // west again
      [8, 12.4],                                   // east to the vault
    ],
    vault: [9, 12.4],
    entrance: { kind: 'tunnel', mouth: [9.6, -1.8], portal: [9.6, -5.6], width: 2.4, hide: .6 },
    spots: [
      [3.5, 2.4], [6.5, 2.4], [3.5, 6.4], [6.5, 6.4], [3.5, 10.4], [6.5, 10.4], // between the workshops: two passes each
      [8.4, 10.4],                                                             // beside the vault
      [-1.4, 2.4], [-1.4, 10.4], [11.4, 6.4], [11.4, 1.6], [5, 14.4],          // outside the bends and the last pass
      // mortar pits (from index `far` on): well back from the line, with several passes inside the Mortar's ring
      [-3.4, 6.4], [13.6, 3.6], [4.4, -3.2], [2, 15.6],
    ],
    far: 12,
    frame: { x: 5, z: 6.4, w: 13.6, d: 15.4 },
    look: { sand: '#b8ab92', sandD: '#9d8f77', dirt: '#6e6150', rut: '#4d4337', mesa: ['#6f6a62', '#8a8478', '#5d5850', '#9b9488'] },
  },
};
