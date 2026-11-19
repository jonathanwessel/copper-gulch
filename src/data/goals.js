import { RIDGE } from './towns/ridge.js';

/* The goal strip (GDD.md, Onboarding): one short goal at a time through the first 30 minutes, from the first Crossbow
   in Dry Creek into Copper Gulch. A goal counts as done the first time its done(c) is true, in any order, and stays
   done (src/core/goals.js keeps them in the save). The strip shows the first goal of the town in play that is not done
   and is ready(c). Text follows the writing rule: a short order that names the real thing to tap, no colons.
     town: the town the goal belongs to.   done(c), ready(c): read the context from src/core/goals.js.
     at(c): what to spotlight, as for explainers: { plot }, { spot }, { tower }, { el: css selector }; or nothing.
     wait: a tower kind. While it can't be paid yet, the strip says what to wait for (goalText in src/core/goals.js).
     kind: the tower to build. Once the card of the spotlit pad or building is open, the spotlight moves to its button.
     there: [town, building] for a goal done in another town (the bots read it).
     at(c).go: the place the goal sends the player to; the spotlight is on the back button when it goes there, else on Map. */
const goTo = id => c => ({ el: c.back === id ? '#backBtn' : '#mapBtn', go: id });
/* Dry Creek's goals before the win: once it is won, only Go to Copper Gulch is left to show. */
const early = (f = null) => c => !c.won && (!f || f(c));
/* Founding Iron Ridge (M3): once the Gulch has beaten the Ridge's wave, the strip says to hold the waves and save its
   price, then to open the map, tap Iron Ridge and Start. */
const ridgePrice = RIDGE.found.coins / 1000 + 'K';
const ridgeWave = c => c.bestWave >= RIDGE.found.wave && !c.founded('ridge');
/* Iron Ridge (M3, the Locomotive Works on Gulch tools): the way to its top workshop. The Locomotive Works uses tools,
   so once the Rolling Mill stands the strip sends the player to Copper Gulch for a Toolsmith. within: RIDGE_GOAL. */
const RIDGE_GOAL = 185;
const ridgeTools = c => c.lvIn('gulch', 'toolsmith') >= 1;
/* Silver Falls (M5): within FALLS_GOAL minutes of a new game, the top of the Falls' 6-10 h window. */
const FALLS_GOAL = 600;

export const GOALS = [
  // Dry Creek Outpost, where a new game starts
  { id: 'dc-tower', town: 'drycreek', text: 'Tap a stone pad and build a Crossbow', kind: 'crossbow', wait: 'crossbow', done: c => c.towers.length >= 1, ready: early(), at: c => ({ spot: c.freeSpot() }) },
  { id: 'dc-stone2', town: 'drycreek', text: 'Tap the Stone Camp, then tap Upgrade', done: c => c.lv('quarry') >= 2, ready: early(), at: () => ({ plot: 'quarry' }) },
  { id: 'dc-mine', town: 'drycreek', text: 'Tap the Mining Camp, then tap Build', done: c => c.lv('dmine') >= 1, ready: early(c => c.unlocked('dmine')), at: () => ({ plot: 'dmine' }) },
  { id: 'dc-three', town: 'drycreek', text: 'Build Crossbows on 3 stone pads', kind: 'crossbow', done: c => c.towers.length >= 3, ready: early(), at: c => ({ spot: c.freeSpot() }) },
  { id: 'dc-up', town: 'drycreek', text: 'Tap a Crossbow, then tap Upgrade', done: c => c.topLevel() >= 2, ready: early(), at: c => ({ tower: c.lowTower() }) },
  { id: 'dc-call', town: 'drycreek', text: 'Tap Call now for bonus coins and an early wave', done: c => c.called(), ready: early(c => c.towers.length >= 3 && c.bestWave >= 2), at: () => ({ el: '#callWave' }) },
  { id: 'dc-mine5', town: 'drycreek', text: 'Tap the Mining Camp and upgrade it to level 5', done: c => c.lv('dmine') >= 5, ready: early(c => c.lv('dmine') >= 1), at: () => ({ plot: 'dmine' }) },
  { id: 'dc-path', town: 'drycreek', text: 'Upgrade a Crossbow to level 5 and pick a path', done: c => c.pathed(), ready: early(), at: c => ({ tower: c.topTower() }) },
  { id: 'dc-win', town: 'drycreek', text: 'Beat wave 10 to open Copper Gulch', done: c => c.won },
  { id: 'dc-go', town: 'drycreek', text: 'Tap Map, Copper Gulch, then Play Copper Gulch', done: c => c.visited('gulch'), ready: c => c.won, at: goTo('gulch'), away: true },
  // Copper Gulch
  { id: 'g-tower', town: 'gulch', text: 'Tap a stone pad and build a Crossbow', kind: 'crossbow', wait: 'crossbow', done: c => c.towers.length >= 1, at: c => ({ spot: c.freeSpot() }) },
  { id: 'g-camp3', town: 'gulch', text: 'Tap the Lumber Camp and upgrade it to level 3', done: c => c.lv('camp') >= 3, at: () => ({ plot: 'camp' }) },
  { id: 'g-mine', town: 'gulch', text: 'Tap the Copper Mine, then tap Build', done: c => c.lv('mine') >= 1, ready: c => c.unlocked('mine'), at: () => ({ plot: 'mine' }) },
  { id: 'g-cannon', town: 'gulch', text: 'Tap a stone pad and build a Cannon', kind: 'cannon', done: c => c.built('cannon'), ready: c => c.lv('mine') >= 1, at: c => ({ spot: c.freeSpot() }) },
  { id: 'g-camp5', town: 'gulch', text: 'Tap the Lumber Camp and upgrade it to level 5', done: c => c.lv('camp') >= 5, at: () => ({ plot: 'camp' }) },
  { id: 'g-saw', town: 'gulch', text: 'Tap the Sawmill, then tap Build', done: c => c.lv('saw') >= 1, ready: c => c.unlocked('saw'), at: () => ({ plot: 'saw' }) },
  { id: 'g-research', town: 'gulch', text: 'Tap Research and start one', done: c => c.researched(), ready: c => c.researchOpen, at: () => ({ el: '#researchBtn' }) },
  { id: 'g-pit', town: 'gulch', text: 'Tap the Clay Pit, then tap Build', done: c => c.lv('pit') >= 1, ready: c => c.unlocked('pit'), at: () => ({ plot: 'pit' }) },
  { id: 'g-frost', town: 'gulch', text: 'Tap a stone pad and build a Frost Lens', kind: 'frost', done: c => c.built('frost'), ready: c => c.lv('saw') >= 1 && c.lv('pit') >= 1, at: c => ({ spot: c.freeSpot() }) },
  { id: 'g-mine5', town: 'gulch', text: 'Tap the Copper Mine and upgrade it to level 5', done: c => c.lv('mine') >= 5, ready: c => c.lv('mine') >= 1, at: () => ({ plot: 'mine' }) },
  { id: 'g-smelter', town: 'gulch', text: 'Tap the Smelter, then tap Build', done: c => c.lv('smelter') >= 1, ready: c => c.unlocked('smelter'), at: () => ({ plot: 'smelter' }) },
  { id: 'g-path', town: 'gulch', text: 'Upgrade a tower to level 5 and pick a path', done: c => c.pathed(), at: c => ({ tower: c.topTower() }) },
  { id: 'g-wave10', town: 'gulch', text: 'Stop the war wagon at wave 10', done: c => c.bestWave >= 10 },
  { id: 'g-mortar', town: 'gulch', text: 'Tap a Mortar pit and build a Mortar', kind: 'mortar', done: c => c.built('mortar'), ready: c => c.open('mortar'), at: c => ({ spot: c.freePit() }) },
  // later goals: within (minutes from a new game) is how soon the careful bot must do them (tools/balance.js)
  { id: 'g-save', town: 'gulch', text: 'Tap Hold waves and save ' + ridgePrice + ' coins for Iron Ridge', done: c => c.founded('ridge'), ready: c => ridgeWave(c) && !c.canFound('ridge'), at: () => ({ el: '#holdWaves' }), within: 85 },
  { id: 'g-tools', town: 'gulch', text: 'Tap the Toolsmith, then tap Build', done: c => c.lv('toolsmith') >= 1, ready: c => c.lvIn('ridge', 'rolling') >= 1, at: () => ({ plot: 'toolsmith' }), within: RIDGE_GOAL },
  { id: 'g-found', town: 'gulch', text: 'Tap Map, Iron Ridge, then Start Iron Ridge', done: c => c.founded('ridge'), ready: c => ridgeWave(c) && c.canFound('ridge'), at: goTo('ridge'), away: true, within: 85 },
  // Iron Ridge
  { id: 'r-furnace', town: 'ridge', text: 'Tap the Blast Furnace, then tap Build', done: c => c.lv('furnace') >= 1, ready: c => c.unlocked('furnace'), at: () => ({ plot: 'furnace' }), within: RIDGE_GOAL },
  { id: 'r-boiler', town: 'ridge', text: 'Tap the Boiler Shop, then tap Build', done: c => c.lv('boilershop') >= 1, ready: c => c.unlocked('boilershop'), at: () => ({ plot: 'boilershop' }), within: RIDGE_GOAL },
  { id: 'r-steel5', town: 'ridge', text: 'Tap the Steel Mill and upgrade it to level 5', done: c => c.lv('steelmill') >= 5, ready: c => c.lv('steelmill') >= 1, at: () => ({ plot: 'steelmill' }), within: RIDGE_GOAL },
  { id: 'r-rolling', town: 'ridge', text: 'Tap the Rolling Mill, then tap Build', done: c => c.lv('rolling') >= 1, ready: c => c.unlocked('rolling'), at: () => ({ plot: 'rolling' }), within: RIDGE_GOAL },
  { id: 'r-tools', town: 'ridge', text: 'Go to Copper Gulch and build a Toolsmith there', done: ridgeTools, ready: c => c.lv('rolling') >= 1, at: goTo('gulch'), there: ['gulch', 'toolsmith'], within: RIDGE_GOAL },
  { id: 'r-rolling5', town: 'ridge', text: 'Tap the Rolling Mill and upgrade it to level 5', done: c => c.lv('rolling') >= 5, ready: c => c.lv('rolling') >= 1, at: () => ({ plot: 'rolling' }), within: RIDGE_GOAL },
  { id: 'r-boiler5', town: 'ridge', text: 'Tap the Boiler Shop and upgrade it to level 5', done: c => c.lv('boilershop') >= 5, ready: c => c.lv('boilershop') >= 1, at: () => ({ plot: 'boilershop' }), within: RIDGE_GOAL },
  { id: 'r-loco', town: 'ridge', text: 'Tap the Locomotive Works, then tap Build', done: c => c.lv('loco') >= 1, ready: c => c.unlocked('loco'), at: () => ({ plot: 'loco' }), within: RIDGE_GOAL },
  // Silver Falls (M5): the way up its chain to the Telegraph Works. The Wire Mill uses Gulch copper and the Dynamo and
  // Telegraph Works use Ridge steel and rails, so a missing maker there sends the player to that town.
  { id: 'f-sand4', town: 'falls', text: 'Tap the Sand Pit and upgrade it to level 4', done: c => c.lv('sandpit') >= 4, at: () => ({ plot: 'sandpit' }), within: FALLS_GOAL },
  { id: 'f-wheel', town: 'falls', text: 'Tap the Water Wheel, then tap Build', done: c => c.lv('waterwheel') >= 1, ready: c => c.unlocked('waterwheel'), at: () => ({ plot: 'waterwheel' }), within: FALLS_GOAL },
  { id: 'f-glass', town: 'falls', text: 'Tap the Glassworks, then tap Build', done: c => c.lv('glassworks') >= 1, ready: c => c.unlocked('glassworks'), at: () => ({ plot: 'glassworks' }), within: FALLS_GOAL },
  { id: 'f-wheel5', town: 'falls', text: 'Tap the Water Wheel and upgrade it to level 5', done: c => c.lv('waterwheel') >= 5, ready: c => c.lv('glassworks') >= 1, at: () => ({ plot: 'waterwheel' }), within: FALLS_GOAL },
  { id: 'f-wire', town: 'falls', text: 'Tap the Wire Mill, then tap Build', done: c => c.lv('wiremill') >= 1, ready: c => c.unlocked('wiremill'), at: () => ({ plot: 'wiremill' }), within: FALLS_GOAL },
  { id: 'f-copper', town: 'falls', text: 'Go to Copper Gulch and build a Smelter there', done: c => c.lvIn('gulch', 'smelter') >= 1, ready: c => c.lv('wiremill') >= 1, at: goTo('gulch'), there: ['gulch', 'smelter'], within: FALLS_GOAL },
  { id: 'f-bulbs', town: 'falls', text: 'Tap the Bulb Works, then tap Build', done: c => c.lv('bulbworks') >= 1, ready: c => c.unlocked('bulbworks'), at: () => ({ plot: 'bulbworks' }), within: FALLS_GOAL },
  { id: 'f-dynamo', town: 'falls', text: 'Tap the Dynamo Works, then tap Build', done: c => c.lv('dynamo') >= 1, ready: c => c.unlocked('dynamo'), at: () => ({ plot: 'dynamo' }), within: FALLS_GOAL },
  { id: 'f-steel', town: 'falls', text: 'Go to Iron Ridge and build a Steel Mill there', done: c => c.lvIn('ridge', 'steelmill') >= 1, ready: c => c.lv('dynamo') >= 1, at: goTo('ridge'), there: ['ridge', 'steelmill'], within: FALLS_GOAL },
  { id: 'f-rails', town: 'falls', text: 'Go to Iron Ridge and build a Rolling Mill there', done: c => c.lvIn('ridge', 'rolling') >= 1, ready: c => c.unlocked('telegraph'), at: goTo('ridge'), there: ['ridge', 'rolling'], within: FALLS_GOAL },
  { id: 'f-telegraph', town: 'falls', text: 'Tap the Telegraph Works, then tap Build', done: c => c.lv('telegraph') >= 1, ready: c => c.unlocked('telegraph'), at: () => ({ plot: 'telegraph' }), within: FALLS_GOAL },
];
