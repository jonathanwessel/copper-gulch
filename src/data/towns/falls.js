/* Silver Falls: the third town. Electricity: sand and quartz, a Water Wheel that feeds the power grid, then glass and
   wire, then light bulbs, dynamos and telegraphs. Its Wire Mill needs copper from Copper Gulch, and its Dynamo Works
   and Telegraph Works steel and rails from Iron Ridge (src/core/economy.js, ship). Two lanes: raiders ride the road,
   and boats come down the river (board.river, lane 1 in src/core/defense.js). Founding it takes deeds as well as a
   wave and coins, and it opens Sandy Bend, the third outpost. */
export const FALLS = {
  id: 'falls',
  name: 'Silver Falls',
  short: 'Silver Falls',
  era: 'Electricity',
  makesText: 'glass, wire, light bulbs, dynamos and telegraphs', // on the sheet that founds it
  goods: ['sand', 'quartz', 'power', 'glass', 'wire', 'bulbs', 'dynamos', 'telegraphs'],
  buildings: ['sandpit', 'quartzmine', 'waterwheel', 'glassworks', 'wiremill', 'bulbworks', 'dynamo', 'telegraph'],
  top: 'telegraphs',
  start: { coins: 400, buildings: { sandpit: 1 } },
  imports: ['copper', 'steel', 'rails'], // copper from Copper Gulch, steel and rails from Iron Ridge
  outpost: 'sandybend',
  // 70 s apart (the Falls bots: at 66 s a called wave 10 came 7.0 min after getting there); every third raider comes by
  // boat (src/core/defense.js, planWave).
  waves: { pace: 70, rushMore: 6, boatEvery: 3 },
  boss: 'steamer',                 // wave 10, 20... bring the ironclad steamer down the river
  research: ['sieves', 'milldam', 'annealing', 'levee', 'arclamps', 'patents', 'livewires'], // src/data/research.js
  researchOpens: 'glassworks',
  // founding it (src/core/empire.js): Iron Ridge's best wave, coins from the purse, and deeds held (sign 1 or 2 charters).
  // Tuned 2026-11-18 by the Falls bots (tools/balance.js, toFalls): the Ridge's charter pays the deeds at its wave 48-49,
  // and it climbs back past 50 in about 35 minutes, then slowly, so wave 57 was the real wait (6-7 h of play). Wave 52 since
  // 2026.11.18-15: with group towers growing slower each level the charter pays at wave 45-47 and the climb back is slower.
  found: { from: 'ridge', wave: 52, coins: 1000000, deeds: 5, shows: 20 },
  // The board: the road comes in through a rock cut in the north-east and switches back across the town four times
  // (west, east, west, then east to the vault); the river comes round a misty bend under a broken bridge in the north
  // and winds down the middle of the town to the vault, under a bridge at each pass of the road. Workshops stand in
  // three rows between the passes, two more south of the vault. Pads between a workshop and the river reach two passes
  // of the road and the water.
  board: {
    cols: 10, rows: 13,
    plots: {
      sandpit: [2, 2.4], quartzmine: [8, 2.4],
      glassworks: [2, 6.4], waterwheel: [8, 6.4],
      wiremill: [2, 10.4], bulbworks: [8, 10.4],
      dynamo: [8, 12.6], telegraph: [8, 14.8],
    },
    road: [
      [9.6, -6], [9.6, -.2], [9, .4],              // out of the rock cut, then west
      [1, .4], [.4, 1], [.4, 3.8], [1, 4.4],       // the first pass and the west bend
      [9, 4.4], [9.6, 5], [9.6, 7.8], [9, 8.4],    // east, and the east bend
      [1, 8.4], [.4, 9], [.4, 11.8], [1, 12.4],    // west again
      [4.2, 12.4],                                 // east to the vault
    ],
    river: {
      path: [[5, -6], [5, 1.4], [4.6, 2.4], [4.6, 3.6], [5.4, 5.2], [5.4, 7.4], [4.6, 9], [4.6, 10.6], [5, 11.4]],
      entrance: { kind: 'bend', mouth: [5, -1.8], portal: [5, -5.6], width: 2.4, hide: .6 },
      width: 1.1,
    },
    vault: [5, 12.4],
    entrance: { kind: 'canyon', mouth: [9.6, -1.8], portal: [9.6, -5.6], width: 2.4, hide: .6 },
    spots: [
      [3.5, 2.4], [6.2, 2.4], [3.8, 6.4], [6.6, 6.4], [3.5, 10.4], [6.2, 10.4], // between a workshop and the river
      [3.4, 13.8], [6.2, 14.2],                                                // by the vault
      [-1.4, 2.4], [-1.4, 10.4], [11.4, 6.4], [11.4, 1.6],                     // outside the bends
      // mortar pits (from index `far` on): well back from the road and the river
      // 3 pits (was 4 until 2026.11.18-15: the east pit by the rock cut gave the Mortar the road first, and with it
      // half the Falls' damage; save v18 gives the pit by the vault its new number, src/core/save.js)
      // the north pit sits 1 back from where it was (2, -3.2), so it reaches less of both lanes as they come in
      [-3.4, 6.4], [3.6, 16.6], [2, -4.2],
    ],
    far: 12,
    frame: { x: 5, z: 6.8, w: 13.6, d: 16.4 },
    look: { sand: '#a9ad84', sandD: '#8f956c', dirt: '#7a6a4e', rut: '#56493a', water: '#3f7fa8', waterD: '#2f6488', foam: '#9cc8d8', mesa: ['#6f7a7c', '#8a9496', '#5d686a', '#9aa4a4'] },
  },
};
