/* Copper Gulch: the first town. Frontier era: wood, clay and copper, on one winding road. */
export const GULCH = {
  id: 'gulch',
  name: 'Copper Gulch',
  short: 'Copper Gulch',
  era: 'Frontier',
  goods: ['timber', 'ore', 'clay', 'planks', 'copper', 'bricks', 'tools', 'wagons'],
  buildings: ['camp', 'mine', 'pit', 'saw', 'smelter', 'kiln', 'toolsmith', 'wagonworks'],
  top: 'wagons',                  // the town's top good
  start: { coins: 20, buildings: { camp: 1 } }, // one Crossbow's coins, so the first goal waits only on timber (review of 2026.11.20-9: "Wait for 5 more coins" beside +0/s)
  imports: [],                    // goods shipped in from other towns (none: the Gulch is first)
  research: ['saws', 'shafts', 'walls', 'gunsmith', 'posters', 'stalls', 'furnaces', 'kegs'], // src/data/research.js
  researchOpens: 'saw',           // research opens when this building is built
  // The board, in world units (1 unit = 1 map cell; x east, z south toward the camera). Each plot is 2x2, centered.
  // The road winds through the town in three passes (down, up, down) with a switchback at each end, so raiders pass
  // the same towers again and again. Plots stand in two columns between the passes; tower spots sit between the
  // plots and inside the bends, where one tower reaches two passes. The vault is at the road's end.
  board: {
    cols: 9, rows: 12,
    plots: {
      camp: [2.5, 1.5], mine: [2.5, 4.5], pit: [2.5, 7.5], toolsmith: [2.5, 10.5],
      saw: [6.5, 1.5], smelter: [6.5, 4.5], kiln: [6.5, 7.5], wagonworks: [6.5, 10.5],
    },
    road: [
      [.4, -6], [.4, 11.6], [.9, 12.9], [2.45, 13.5], [4, 12.9], [4.5, 11.6], // down the west side, round the bottom bend
      [4.5, .4], [5, -.9], [6.55, -1.5], [8.1, -.9], [8.6, .4],               // up the middle, round the top bend
      [8.6, 10.8],                                                            // down the east side to the vault
    ],
    vault: [8.6, 11.8],
    // where raiders come from: a slot canyon with a mine portal; they stay hidden until `hide` units along the road
    entrance: { kind: 'canyon', mouth: [.4, -1.8], portal: [.4, -5.6], width: 2.6, hide: .6 },
    spots: [
      [2.5, 3], [2.5, 6], [2.5, 9], [6.5, 3], [6.5, 6], [6.5, 9],  // between the plots: each reaches two passes
      [2.45, 12.25], [6.55, -.25],                                 // inside the bends
      [-1.1, 4.5], [-1.1, 9], [10.1, 3], [10.1, 7.5],              // outside the first and last pass
      // mortar pits (from index `far` on): beyond the bends, too far from the road for a normal tower,
      // with the bend and two or three passes inside the Mortar's ring
      [3.8, -4], [10, -3.5], [6.8, 14.6], [-.8, 15.8],
    ],
    far: 12,
    // what the camera frames at home: the whole town, bends included
    frame: { x: 4.5, z: 6, w: 12.4, d: 15.4 },
    look: { sand: '#d8b382', sandD: '#bf9465', dirt: '#8c6242', rut: '#6a4630', mesa: ['#b35a3a', '#d98a55', '#a94f33', '#e0a46c'] },
  },
};
