/* Tar Seep: the fourth outpost, opened with Thunder Mesa (GDD.md, Outposts; PLAN.md M6b part 3). A camp on a black
   seep of crude with an Oil Well (crude oil) and a Rubber Grove (rubber), the Crossbow and the Cannon, on one road that
   loops round the camp. Its oil and rubber go to the town in play first, then to the other towns' workshops (the
   Mesa's Refinery and Tire Works). Waves 1 to 15 with the bandit wagon at 10 and 15; winning wave 15 is its goal.
   Numbers follow Sandy Bend's, which the Falls bots tuned (won in 10-11 minutes); tools/mesa-road.js checks the win. */
export const TARSEEP = {
  id: 'tarseep',
  kind: 'outpost',
  name: 'Tar Seep',
  short: 'Tar Seep',
  store: 'stockpile',
  era: 'Oil and flight',
  goods: ['oil', 'rubber'],
  buildings: ['oilwell', 'rubbergrove'],
  top: 'oil',
  start: { coins: 150, buildings: { oilwell: 1 } },
  imports: [],
  towers: ['crossbow', 'cannon'],
  boss: 'bandits',
  goal: 15,
  opens: null,
  raid: 120,
  waves: { speed: .9, first: 30, pace: 60, bosses: [10, 15], bounty: w => 4.5 * 1.13 ** (w - 1), hp: w => 5.6 * 1.2 ** (w - 1) * (1 + w * .04) },
  // The road comes up a gully from the north under a leaning oil derrick, loops once clockwise round the two camps and
  // ends at the stockpile beside where the loop began (Sandy Bend's loop, which the pad and map rules already pass).
  board: {
    cols: 8, rows: 9,
    plots: { oilwell: [2.1, 3.3], rubbergrove: [5.1, 3.3] },
    road: [
      [3.6, -6], [3.6, .5],
      [6.3, .5], [7.1, 1.3], [7.1, 6.7], [6.3, 7.5],
      [.9, 7.5], [.1, 6.7], [.1, 1.3], [.9, .5], [1.6, .5],
    ],
    vault: [2.2, .5],
    entrance: { kind: 'gully', mouth: [3.6, -1.8], portal: [3.6, -5.6], width: 2.4, hide: .6 },
    spots: [
      [3.6, 2.2], [1.6, 5.9], [5.6, 5.9], [3.6, 4.8], [3.6, 9.2], [-1.9, 3.8], [9.1, 3.8],
      [5.4, 1.65], [5.6, -.65], [1.25, 1.8], [3.35, 6.35],
    ],
    crowd: 7,                     // normal towers up to this many cost the list price; each one after costs EXTRA_TOWER times the last (src/core/defense.js, towerCost)
    far: 7,
    pits: [],                       // outposts have no mortar pits
    frame: { x: 3.6, z: 3.6, w: 12.5, d: 12 },
    look: { sand: '#b8a07c', sandD: '#9c845f', dirt: '#5a4636', rut: '#33281f', mesa: ['#6e4c3a', '#8a6248', '#5a3d2e', '#a07a5a'] },
  },
};
