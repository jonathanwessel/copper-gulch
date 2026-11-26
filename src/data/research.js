/* Town research (GDD.md, Town research). Each item has levels; a level costs `cost` x GROWTH^level coins and takes
   TIME x TIME_GROWTH^level seconds. One item runs at a time per town.
   effects: what each level adds, as a named source on a stat (src/core/mods.js): a level adds `per` to the factor,
   so level 3 of +25% is x1.75. downside: effects that are the price of the item (shown on its card before buying).
   about and worse: what one level does, in plain words for the card (the writing rule in PLAN.md).
   opens: the best wave at which the item shows up (it stays hidden before), so something new opens late in a charter. */
export const RESEARCH = {
  saws: {
    name: 'Sharp Saws', town: 'gulch', max: 5, cost: 200,
    about: 'The Lumber Camp and the Sawmill work 25% faster.',
    effects: [{ stat: 'prod:camp', per: .25 }, { stat: 'prod:saw', per: .25 }],
  },
  shafts: {
    name: 'Deep Shafts', town: 'gulch', max: 5, cost: 400,
    about: 'The Copper Mine and the Clay Pit dig 25% faster.',
    effects: [{ stat: 'prod:mine', per: .25 }, { stat: 'prod:pit', per: .25 }],
  },
  walls: {
    name: 'Thick Walls', town: 'gulch', max: 5, cost: 300,
    about: 'Your vault can take 25% more hits.',
    effects: [{ stat: 'vault', per: .25 }],
  },
  gunsmith: {
    name: 'Gunsmith', town: 'gulch', max: 5, cost: 500,
    about: 'Every tower hits 15% harder.',
    effects: [{ stat: 'towerDmg', per: .15 }],
  },
  posters: {
    name: 'Wanted Posters', town: 'gulch', max: 5, cost: 600,
    about: 'Raiders drop 30% more coins when your towers beat them.',
    effects: [{ stat: 'bounty', per: .3 }],
  },
  stalls: {
    name: 'Market Stalls', town: 'gulch', max: 5, cost: 800,
    about: 'Everything you sell earns 10% more coins.',
    effects: [{ stat: 'price', per: .1 }],
  },
  furnaces: {
    name: 'Hot Furnaces', town: 'gulch', max: 2, cost: 1500,
    about: 'The Smelter and the Kiln work 60% faster.',
    worse: 'They use 1 more timber for each copper or brick.',
    effects: [{ stat: 'prod:smelter', per: .6 }, { stat: 'prod:kiln', per: .6 }],
    downside: [{ stat: 'use:smelter:timber', per: 1 }, { stat: 'use:kiln:timber', per: 1 }],
  },
  kegs: {
    name: 'Powder Kegs', town: 'gulch', max: 3, cost: 2500, opens: 26,
    about: 'Cannon and Mortar blasts are 20% wider.',
    effects: [{ stat: 'blast', per: .2 }],
  },
  // Iron Ridge
  drills: {
    name: 'Steam Drills', town: 'ridge', max: 5, cost: 300,
    about: 'The Quarry, the Iron Mine and the Coal Pit dig 25% faster.',
    effects: [{ stat: 'prod:rquarry', per: .25 }, { stat: 'prod:ironmine', per: .25 }, { stat: 'prod:colliery', per: .25 }],
  },
  hotblast: {
    name: 'Hot Blast', town: 'ridge', max: 5, cost: 1500,
    about: 'The Blast Furnace and the Steel Mill work 25% faster.',
    effects: [{ stat: 'prod:furnace', per: .25 }, { stat: 'prod:steelmill', per: .25 }],
  },
  plating: {
    name: 'Iron Plating', town: 'ridge', max: 5, cost: 500,
    about: 'Your vault can take 25% more hits.',
    effects: [{ stat: 'vault', per: .25 }],
  },
  rifling: {
    name: 'Rifled Barrels', town: 'ridge', max: 5, cost: 800,
    about: 'Every tower hits 15% harder.',
    effects: [{ stat: 'towerDmg', per: .15 }],
  },
  rewards: {
    name: 'Railroad Rewards', town: 'ridge', max: 5, cost: 900,
    about: 'Raiders drop 30% more coins when your towers beat them.',
    effects: [{ stat: 'bounty', per: .3 }],
  },
  depot: {
    name: 'Freight Depot', town: 'ridge', max: 5, cost: 1200,
    about: 'Everything you sell earns 10% more coins.',
    effects: [{ stat: 'price', per: .1 }],
  },
  bessemer: {
    name: 'Bessemer Converter', town: 'ridge', max: 2, cost: 4000,
    about: 'The Steel Mill works 60% faster.',
    worse: 'It burns one more coal for each steel it makes.',
    effects: [{ stat: 'prod:steelmill', per: .6 }],
    downside: [{ stat: 'use:steelmill:coal', per: 1 }],
  },
  // Iron Ridge, late: they show up as the Ridge climbs toward the Capital (clarity fix 3b part 1, PLAN.md M6a: the
  // careful bots went 54-73 minutes with nothing new between the Ridge's routes and the Capital, at waves 21-39)
  sights: {
    name: 'Telescope Sights', town: 'ridge', max: 2, cost: 6000, opens: 27,
    about: 'Every tower reaches 10% farther.',
    worse: 'They fire 15% slower.',
    effects: [{ stat: 'towerRange', per: .1 }],
    downside: [{ stat: 'towerRate', per: -.15 }],
  },
  hammers: {
    name: 'Steam Hammers', town: 'ridge', max: 3, cost: 10000, opens: 32,
    about: 'Every building here works 15% faster.',
    worse: 'Each building level costs 15% more.',
    effects: [{ stat: 'prod', per: .15 }],
    downside: [{ stat: 'cost:build', per: .15 }],
  },
  bounties: {
    name: 'Bounty Office', town: 'ridge', max: 2, cost: 15000, opens: 37,
    about: 'Raiders drop 40% more coins.',
    worse: 'Raiders have 10% more health.',
    effects: [{ stat: 'bounty', per: .4 }],
    downside: [{ stat: 'foeHp', per: .1 }],
  },
  // Silver Falls
  sieves: {
    name: 'Sand Sieves', town: 'falls', max: 5, cost: 1500,
    about: 'The Sand Pit and the Quartz Mine dig 25% faster.',
    effects: [{ stat: 'prod:sandpit', per: .25 }, { stat: 'prod:quartzmine', per: .25 }],
  },
  milldam: {
    name: 'Mill Dam', town: 'falls', max: 5, cost: 3000,
    about: 'The Water Wheel makes 25% more power.',
    effects: [{ stat: 'prod:waterwheel', per: .25 }],
  },
  annealing: {
    name: 'Annealing Ovens', town: 'falls', max: 5, cost: 6000,
    about: 'The Glassworks and the Wire Mill work 25% faster.',
    effects: [{ stat: 'prod:glassworks', per: .25 }, { stat: 'prod:wiremill', per: .25 }],
  },
  levee: {
    name: 'River Levee', town: 'falls', max: 5, cost: 2500,
    about: 'Your vault can take 25% more hits.',
    effects: [{ stat: 'vault', per: .25 }],
  },
  arclamps: {
    name: 'Arc Lamps', town: 'falls', max: 5, cost: 4000,
    about: 'Every tower hits 15% harder.',
    effects: [{ stat: 'towerDmg', per: .15 }],
  },
  patents: {
    name: 'Patent Office', town: 'falls', max: 5, cost: 5000,
    about: 'Everything you sell earns 10% more coins.',
    effects: [{ stat: 'price', per: .1 }],
  },
  livewires: {
    name: 'Live Wires', town: 'falls', max: 2, cost: 20000,
    about: 'The Dynamo Works and the Telegraph Works work 60% faster.',
    worse: 'They use twice the power.',
    effects: [{ stat: 'prod:dynamo', per: .6 }, { stat: 'prod:telegraph', per: .6 }],
    downside: [{ stat: 'use:dynamo:power', per: 1 }, { stat: 'use:telegraph:power', per: 1 }],
  },
  // Thunder Mesa (a first pass on prices, PLAN.md M6b part 1a)
  pumpjacks: {
    name: 'Pump Jacks', town: 'mesa', max: 5, cost: 15000,
    about: 'The Oil Derrick and the Rubber Farm work 25% faster.',
    effects: [{ stat: 'prod:derrick', per: .25 }, { stat: 'prod:rubberfarm', per: .25 }],
  },
  crushers: {
    name: 'Ore Crushers', town: 'mesa', max: 5, cost: 30000,
    about: 'The Bauxite Pit and the Aluminum Works work 25% faster.',
    effects: [{ stat: 'prod:bauxitepit', per: .25 }, { stat: 'prod:aluminum', per: .25 }],
  },
  cracking: {
    name: 'Cracking Towers', town: 'mesa', max: 5, cost: 60000,
    about: 'The Refinery and the Tire Works work 25% faster.',
    effects: [{ stat: 'prod:refinery', per: .25 }, { stat: 'prod:tireworks', per: .25 }],
  },
  stormwalls: {
    name: 'Storm Walls', town: 'mesa', max: 5, cost: 25000,
    about: 'Your vault can take 25% more hits.',
    effects: [{ stat: 'vault', per: .25 }],
  },
  searchlights: {
    name: 'Searchlights', town: 'mesa', max: 5, cost: 40000,
    about: 'Every tower shoots 10% faster.',
    effects: [{ stat: 'towerRate', per: .1 }],
  },
  leases: {
    name: 'Oil Leases', town: 'mesa', max: 5, cost: 50000,
    about: 'Everything you sell earns 10% more coins.',
    effects: [{ stat: 'price', per: .1 }],
  },
  assembly: {
    name: 'Assembly Line', town: 'mesa', max: 2, cost: 200000,
    about: 'Motors and airships are made 60% faster.',
    worse: 'Each motor burns twice the fuel.',
    effects: [{ stat: 'prod:motorworks', per: .6 }, { stat: 'prod:airshipworks', per: .6 }],
    downside: [{ stat: 'use:motorworks:fuel', per: 1 }],
  },
};

export const GROWTH = 3;        // each level costs this many times the last
export const TIME = 20;         // seconds for level 1
export const TIME_GROWTH = 2;   // each level takes this many times as long as the last
