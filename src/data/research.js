/* Town research (GDD.md, Town research). Each item has levels; a level costs `cost` x GROWTH^level coins and takes
   TIME x TIME_GROWTH^level seconds. One item runs at a time per town.
   effects: what each level adds, as a named source on a stat (src/core/mods.js): a level adds `per` to the factor,
   so level 3 of +25% is x1.75. downside: effects that are the price of the item (shown on its card before buying).
   about and worse: what one level does, in plain words for the card (the writing rule in PLAN.md). */
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
    about: 'Your vault takes 25% more hits before it breaks.',
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
    worse: 'They burn one more timber for each thing they make.',
    effects: [{ stat: 'prod:smelter', per: .6 }, { stat: 'prod:kiln', per: .6 }],
    downside: [{ stat: 'use:smelter:timber', per: 1 }, { stat: 'use:kiln:timber', per: 1 }],
  },
};

export const GROWTH = 3;        // each level costs this many times the last
export const TIME = 20;         // seconds for level 1
export const TIME_GROWTH = 2;   // each level takes this many times as long as the last
