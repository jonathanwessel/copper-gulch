/* Sandy Bend: the third outpost, opened with Silver Falls (GDD.md, Outposts). A camp on a dry riverbed with a Sand
   Wash (sand) and Quartz Diggings (quartz), the Crossbow and the Cannon, on one road that loops round the camp. Its
   sand and quartz go to the town in play first, then to the other towns' workshops. Waves 1 to 15 with the bandit
   wagon at 10 and 15; winning wave 15 is its goal. Numbers follow Pine Hollow until the Falls bot box tunes them. */
export const SANDYBEND = {
  id: 'sandybend',
  kind: 'outpost',
  name: 'Sandy Bend',
  short: 'Sandy Bend',
  store: 'stockpile',
  era: 'Electricity',
  goods: ['sand', 'quartz'],
  buildings: ['sandwash', 'quartzdig'],
  top: 'sand',
  start: { coins: 150, buildings: { sandwash: 1 } },
  imports: [],
  towers: ['crossbow', 'cannon'],
  boss: 'bandits',
  goal: 15,
  opens: null,
  raid: 120,
  waves: { speed: .9, first: 30, pace: 60, bosses: [10, 15], bounty: w => 4.5 * 1.13 ** (w - 1), hp: w => 5.6 * 1.2 ** (w - 1) * (1 + w * .04) },
  // The road comes up a dry riverbed from the north under a fallen water tower, loops once clockwise round the two
  // camps and ends at the stockpile beside where the loop began.
  board: {
    cols: 8, rows: 9,
    plots: { sandwash: [2.1, 3.3], quartzdig: [5.1, 3.3] },
    road: [
      [3.6, -6], [3.6, .5],
      [6.3, .5], [7.1, 1.3], [7.1, 6.7], [6.3, 7.5],
      [.9, 7.5], [.1, 6.7], [.1, 1.3], [.9, .5], [1.6, .5],
    ],
    vault: [2.2, .5],
    entrance: { kind: 'riverbed', mouth: [3.6, -1.8], portal: [3.6, -5.6], width: 2.4, hide: .6 },
    spots: [
      [3.6, 2.2], [1.6, 5.9], [5.6, 5.9], [3.6, 5], [3.6, 9.2], [-1.9, 3.8], [9.1, 3.8],
    ],
    far: 7,
    frame: { x: 3.6, z: 3.6, w: 12.5, d: 12 },
    look: { sand: '#e3cf9a', sandD: '#c9b47e', dirt: '#a88a5a', rut: '#7a6240', mesa: ['#c9a46a', '#dcb97c', '#b08e58', '#e6c890'] },
  },
};
