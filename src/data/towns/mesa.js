/* Thunder Mesa: the fourth town. Oil and flight: crude oil, bauxite and rubber, then fuel, aluminum and tires, then
   motors, automobiles and airships. Its Motor Works needs wire and its Airship Works dynamos from Silver Falls, and its
   Automobile Plant steel from Iron Ridge (src/core/economy.js, ship). Founding it takes the Rail Office's third upgrade
   (Mule Trains) as well as a wave and coins. The road came in part 1a and the sky lane with its airships in part 2b
   (PLAN.md M6b); the war wagon is its boss until the Sky pirate comes in part 2c, and its outpost (Tar Seep) in part 3. */
export const MESA = {
  id: 'mesa',
  name: 'Thunder Mesa',
  short: 'Thunder Mesa',
  era: 'Oil and flight',
  makesText: 'fuel, aluminum, tires, motors, automobiles and airships', // on the sheet that founds it
  goods: ['oil', 'bauxite', 'rubber', 'fuel', 'aluminum', 'tires', 'motors', 'autos', 'airships'],
  buildings: ['derrick', 'bauxitepit', 'rubberfarm', 'refinery', 'aluminum', 'tireworks', 'motorworks', 'autoplant', 'airshipworks'],
  top: 'airships',
  start: { coins: 600, buildings: { derrick: 1 } },
  imports: ['wire', 'dynamos', 'steel'], // wire and dynamos from Silver Falls, steel from Iron Ridge
  // Tar Seep, its outpost, ships in part 3 (PLAN.md M6b); until then the chain rule's outpost check reads `outpostSoon`
  outpost: null,
  outpostSoon: 'tarseep',
  // a first pass like the Falls' (70 s, rushMore 6); the probe in part 1a (tools/mesa-probe.js) checks wave 10
  // airships from wave 11, after the first boss (part 2b): every airEvery-th raider flies the sky lane, where only the Tesla Coil reaches it
  waves: { pace: 72, rushMore: 6, airEvery: 5, airFrom: 11 },
  boss: 'wagon',                   // the war wagon until the Sky pirate airship comes in part 2
  research: ['pumpjacks', 'crushers', 'cracking', 'stormwalls', 'searchlights', 'leases', 'assembly'], // src/data/research.js
  researchOpens: 'refinery',
  // founding it (src/core/empire.js): Silver Falls' best wave, deeds held, the Rail Office's third upgrade and coins from
  // the purse. Set in M6b part 1b (tools/mesa-road.js): the deeds take the Falls' charter (the empire holds 6 when the
  // Falls opens, and the charter pays 5-7 at its wave 44-47), the wave is the climb back after it, and the price is
  // about half an hour of the empire's income then (about 100K coins a minute). The first pass asked for 1B, which no
  // seed could save in 32 hours: the income stays flat at 70-300K a minute through the Falls era.
  found: { from: 'falls', wave: 45, deeds: 12, coins: 3e6, nodes: { transport: 3 }, shows: 25 },
  // The board: the road comes in through a red rock cut in the north-west and switches back across the town four
  // times (east, west, east, then west to the vault). Workshops stand in three rows of three between the passes; the
  // pads between them reach two passes, and the ones outside the bends reach the bend.
  board: {
    cols: 10, rows: 13,
    plots: {
      rubberfarm: [2, 2.4], bauxitepit: [5, 2.4], derrick: [8, 2.4],
      tireworks: [2, 6.4], aluminum: [5, 6.4], refinery: [8, 6.4],
      airshipworks: [2, 10.4], autoplant: [5, 10.4], motorworks: [8, 10.4],
    },
    road: [
      [.4, -6], [.4, -.2], [1, .4],                // out of the rock cut, then east
      [9, .4], [9.6, 1], [9.6, 3.8], [9, 4.4],     // the first pass and the east bend
      [1, 4.4], [.4, 5], [.4, 7.8], [1, 8.4],      // west, and the west bend
      [9, 8.4], [9.6, 9], [9.6, 11.8], [9, 12.4],  // east again
      [2, 12.4],                                   // west to the vault
    ],
    vault: [1, 12.4],
    // the sky lane (part 2b): airships come out of a storm cloud bank off the north-east corner and swing across the
    // town in a wide S, over the workshops, to the vault. They fly at sky.height; their shadows cross the ground.
    sky: {
      path: [[11.4, -4], [9.8, -1.8], [7.2, 1.2], [3, 3.4], [1.2, 5.6], [3, 8], [7.5, 9], [9.2, 10.8], [8, 13.6], [4, 14.2]],
      height: 1.7,
      entrance: { kind: 'cloud', mouth: [10, -2], portal: [11.4, -4], width: 3, hide: 2.2 },
    },
    entrance: { kind: 'canyon', mouth: [.4, -1.8], portal: [.4, -5.6], width: 2.4, hide: .6, pit: false, trestle: false, rise: 1.5, mesa: ['#8e4a3a', '#b8705a', '#7a3e32', '#c98a6c'] },
    spots: [
      [3.5, 2.4], [6.5, 2.4], [3.5, 6.4], [6.5, 6.4], [3.5, 10.4], [6.5, 10.4], // between the workshops: two passes each
      [11.4, 2.4], [11.4, 10.4], [-1.4, 6.4], [5, 14.4],                       // outside the bends and the last pass
      // mortar pits (their indexes are in `pits`): well back from the road, with several passes inside the Mortar's ring
      [13.4, 6.4], [5.6, -3.2], [8, 15.6], [-2, 9.8],
      // more pads along the outer sides of the road and its corners, none near where raiders come out of the rock cut
      [8.1, 13.55], [10.75, 11.85], [6.35, 13.55], [10.75, 3.85], [-.75, 7.85], [5, -1.4], [8.2, -1.4], [2.6, 14],
    ],
    crowd: 12,                     // normal towers up to this many cost the list price; each one after costs EXTRA_TOWER times the last (src/core/defense.js, towerCost)
    far: 10,
    pits: [10, 11, 12, 13],         // the mortar pits by index (the first is `far`); the pads after them are normal ones
    frame: { x: 5, z: 6.4, w: 13.6, d: 15.4 },
    look: { sand: '#c9a77e', sandD: '#ae8a60', dirt: '#6e5040', rut: '#4a3428', mesa: ['#8e4a3a', '#b8705a', '#7a3e32', '#c98a6c'] },
  },
};
