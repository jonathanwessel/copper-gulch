/* Dry Creek Outpost: where the game starts (GDD.md, Outposts). A frontier camp with two raw-goods camps and the
   Crossbow alone, on one short road that loops once around the camp. Winning wave 10 opens Copper Gulch; after that
   the outpost keeps working on its own, fights light raids, and sends its goods to the town in play. */
export const DRYCREEK = {
  id: 'drycreek',
  kind: 'outpost',
  name: 'Dry Creek Outpost',
  short: 'Dry Creek',              // on the town chip
  store: 'stockpile',             // what raiders ride for, in words and on the board (a town's is the vault)
  era: 'Frontier',
  goods: ['ore', 'stone'],
  buildings: ['quarry', 'dmine'],
  top: 'ore',
  start: { coins: 20, buildings: { quarry: 1 } },
  imports: [],
  towers: ['crossbow'],           // only these tower kinds can be built here
  boss: 'bandits',                // wave 10 brings the bandit wagon (a small boss)
  goal: 10,                       // clearing this wave wins the outpost
  opens: 'gulch',                 // and opens this town
  raid: 120,                      // once won: seconds from one light raid to the next (wave-10 strength, no boss)
  waves: { speed: .9, first: 30, pace: 80 }, // overrides of WAVE (src/data/foes.js): a short road, and waves far enough apart that a player who never calls one early wins in 13-15 min
  // The road comes down the dry wash from the north, loops once clockwise around the camp and ends at the stockpile
  // (the vault), beside the point where the loop began. Pads sit inside the corners of the loop, between the two camps
  // and outside each side. No mortar pits: outposts never have a Mortar.
  board: {
    cols: 8, rows: 9,
    plots: { quarry: [2.1, 3.3], dmine: [5.1, 3.3] },
    road: [
      [3.6, -6], [3.6, .5],                                  // down the wash to the camp
      [6.3, .5], [7.1, 1.3], [7.1, 6.7], [6.3, 7.5],         // east, then down the east side
      [.9, 7.5], [.1, 6.7], [.1, 1.3], [.9, .5], [1.6, .5],  // along the bottom, up the west side and into the stockpile
    ],
    vault: [2.2, .5],                                        // the stockpile, where the loop closes
    entrance: { kind: 'wash', mouth: [3.6, -1.8], portal: [3.6, -5.6], width: 2.4, hide: .6 },
    spots: [
      [3.6, 2.2],                  // between the camps, below where the road comes in
      [1.6, 5.9], [5.6, 5.9],      // inside the bottom corners: each reaches two sides of the loop
      [3.6, 9.2],                  // outside the bottom
      [-1.9, 3.8], [9.1, 3.8],     // outside the west and east sides
    ],
    far: 6,                        // no mortar pits
    frame: { x: 3.6, z: 3.6, w: 12.5, d: 12 },
    look: { sand: '#dcc08f', sandD: '#c4a06e', dirt: '#93704c', rut: '#6e5036', mesa: ['#a8705a', '#c99a6c', '#9a6650', '#d8b282'] },
  },
};
