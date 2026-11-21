/* Pine Hollow: the second outpost, opened with Iron Ridge (GDD.md, Outposts). A logging camp in the pines with a
   Logging Camp (timber) and a Clay Bank (clay), the Crossbow and the Cannon, on one road that loops round the camp.
   It sends its timber and clay to the town in play first, then to the other towns' workshops (more bricks in the Gulch
   for the Ridge's boilers). Waves 1 to 15 with the bandit wagon at 10 and 15; winning wave 15 is its goal. */
export const PINEHOLLOW = {
  id: 'pinehollow',
  kind: 'outpost',
  name: 'Pine Hollow',
  short: 'Pine Hollow',
  store: 'stockpile',
  era: 'Iron and rail',
  goods: ['timber', 'clay'],
  buildings: ['logcamp', 'claybank'],
  top: 'timber',
  start: { coins: 150, buildings: { logcamp: 1 } }, // founding the Ridge pays in a little, so the first towers come quickly
  imports: [],
  towers: ['crossbow', 'cannon'],
  boss: 'bandits',
  goal: 15,
  opens: null,
  raid: 120,
  // By the time it opens the Gulch floods the market with timber, so its raiders pay three times the usual bounty, and
  // its waves are a little softer than the Gulch's (the Ridge bot box, 2026-11-17).
  waves: { speed: .9, first: 30, pace: 60, bosses: [10, 15], bounty: w => 4.5 * 1.13 ** (w - 1), hp: w => 5.6 * 1.2 ** (w - 1) * (1 + w * .04) },
  // The road comes down a logging chute from the north, loops once counterclockwise round the two camps and ends at
  // the stockpile beside where the loop began.
  board: {
    cols: 8, rows: 9,
    plots: { logcamp: [5.1, 3.3], claybank: [2.1, 3.3] },
    road: [
      [3.6, -6], [3.6, .5],
      [.9, .5], [.1, 1.3], [.1, 6.7], [.9, 7.5],
      [6.3, 7.5], [7.1, 6.7], [7.1, 1.3], [6.3, .5], [5.6, .5],
    ],
    vault: [5, .5],
    entrance: { kind: 'chute', mouth: [3.6, -1.8], portal: [3.6, -5.6], width: 2.4, hide: .6 },
    spots: [
      [3.6, 2.2], [1.6, 5.9], [5.6, 5.9], [3.6, 5], [3.6, 9.2], [-1.9, 3.8], [9.1, 3.8],
      // more pads (owner, 2026-11-20: "Add more tower pads per map"), added at the end so a saved tower keeps its pad
      [1.6, 1.5], [1.6, -.5], [6.1, 1.8], [3.35, 6.5], // pads 7-10
    ],
    crowd: 7,                     // normal towers up to this many cost the list price; each one after costs EXTRA_TOWER times the last (src/core/defense.js, towerCost)
    far: 7,
    pits: [],                       // the mortar pits by index (the first is `far`); the pads after them are normal ones
    frame: { x: 3.6, z: 3.6, w: 12.5, d: 12 },
    look: { sand: '#bdb383', sandD: '#a1966a', dirt: '#7a5e40', rut: '#5a432c', mesa: ['#7d6a4a', '#9a8458', '#6b5a3e', '#a99a6a'] },
  },
};
