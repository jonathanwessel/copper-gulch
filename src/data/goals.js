import { RIDGE } from './towns/ridge.js';

/* The goal strip (GDD.md, Onboarding): one short goal at a time through the first 30 minutes, from the first Crossbow
   in Dry Creek into Copper Gulch. A goal counts as done the first time its done(c) is true, in any order, and stays
   done (src/core/goals.js keeps them in the save). The strip shows the first goal of the town in play that is not done
   and is ready(c). Text follows the writing rule: a short order that names the real thing to tap, no colons.
     town: the town the goal belongs to.   done(c), ready(c): read the context from src/core/goals.js.
     at(c): what to spotlight, as for explainers: { plot }, { spot }, { tower }, { el: css selector }; or nothing.
     wait: a tower kind. While it can't be paid yet, the strip says what to wait for (goalText in src/core/goals.js).
     kind: the tower to build. Once the card of the spotlit pad or building is open, the spotlight moves to its button.
     doneText: what the strip says once it is done, beside the green Done tag ("Sand Pit is level 4").
     there: [town, building] for a goal done in another town (the bots read it).
     at(c).go: the place the goal sends the player to; the spotlight is on the back button when it goes there, else on Map. */
const goTo = id => c => ({ el: c.back === id ? '#backBtn' : '#mapBtn', go: id });
/* Dry Creek's goals before the win: once it is won, only Go to Copper Gulch is left to show. */
const early = (f = null) => c => !c.won && (!f || f(c));
/* Founding Iron Ridge (M3): once the Gulch has beaten the Ridge's wave, the strip says to hold the waves and save its
   price, then to open the map, tap Iron Ridge and Start. */
const ridgeWave = c => c.bestWave >= RIDGE.found.wave && !c.founded('ridge');
/* Iron Ridge (M3, the Locomotive Works on Gulch tools): the way to its top workshop. The Locomotive Works uses tools,
   so once the Rolling Mill stands the strip sends the player to Copper Gulch for a Toolsmith. within: RIDGE_GOAL. */
const RIDGE_GOAL = 185;
const ridgeTools = c => c.lvIn('gulch', 'toolsmith') >= 1;
/* Silver Falls (M5): within FALLS_GOAL minutes of a new game, the top of the Falls' 6-10 h window. */
const FALLS_GOAL = 600;
/* Thunder Mesa (M6b part 1b): within MESA_GOAL minutes of a new game, the top of the Mesa's 20-30 h window and the
   hour the player plays there (tools/mesa-road.js checks them). */
const MESA_GOAL = 1860;

export const GOALS = [
  // Dry Creek Outpost, where a new game starts
  { id: 'dc-tower', town: 'drycreek', text: 'Tap a stone pad and build a Crossbow', doneText: 'Crossbow built', kind: 'crossbow', wait: 'crossbow', done: c => c.towers.length >= 1, ready: early(), at: c => ({ spot: c.freeSpot() }) },
  // nothing pays before wave 1's raiders fall, so the step after the first Crossbow needs no coins: calling wave 1 is
  // free (it never brings more raiders) and pays bonus coins at once (clarity fix 4, review 3: "0 / 12" at +0/s)
  { id: 'dc-first', town: 'drycreek', text: 'Tap Call now to start wave 1 and get bonus coins', doneText: 'Wave 1 called', done: c => c.called() || c.started(), ready: early(c => c.towers.length >= 1), at: () => ({ el: '#callWave' }) },
  { id: 'dc-stone2', town: 'drycreek', text: 'Tap the Stone Camp, then tap Upgrade', doneText: 'Stone Camp is level 2', done: c => c.lv('quarry') >= 2, ready: early(), at: () => ({ plot: 'quarry' }) },
  { id: 'dc-mine', town: 'drycreek', text: 'Tap the Copper Camp lot, then tap Build', doneText: 'Copper Camp built', done: c => c.lv('dmine') >= 1, ready: early(c => c.unlocked('dmine')), at: () => ({ plot: 'dmine' }) },
  { id: 'dc-three', town: 'drycreek', text: 'Build Crossbows on 3 stone pads', doneText: '3 Crossbows built', kind: 'crossbow', done: c => c.towers.length >= 3, count: c => [c.towers.length, 3], ready: early(), at: c => ({ spot: c.freeSpot() }) },
  { id: 'dc-up', town: 'drycreek', text: 'Tap a Crossbow, then tap Upgrade', doneText: 'Crossbow is level 2', done: c => c.topLevel() >= 2, ready: early(), at: c => ({ tower: c.lowTower() }) },
  { id: 'dc-call', town: 'drycreek', text: 'Tap Call now for bonus coins and an early wave', doneText: 'Wave called early', done: c => c.called(), ready: early(c => c.towers.length >= 3 && c.bestWave >= 2), at: () => ({ el: '#callWave' }) },
  { id: 'dc-mine5', town: 'drycreek', text: 'Tap the Copper Camp and upgrade it to level 5', doneText: 'Copper Camp is level 5', done: c => c.lv('dmine') >= 5, ready: early(c => c.lv('dmine') >= 1), at: () => ({ plot: 'dmine' }) },
  { id: 'dc-path', town: 'drycreek', text: 'Upgrade a Crossbow to level 5 and pick a path', doneText: 'Crossbow path picked', done: c => c.pathed(), ready: early(), at: c => ({ tower: c.topTower() }) },
  { id: 'dc-win', town: 'drycreek', text: 'Beat wave 10 to open Copper Gulch', doneText: 'Copper Gulch is open', done: c => c.won },
  { id: 'dc-go', town: 'drycreek', text: 'Tap Map, then tap Copper Gulch', doneText: 'You are in Copper Gulch', done: c => c.visited('gulch'), ready: c => c.won, at: goTo('gulch'), away: true },
  // Copper Gulch
  { id: 'g-tower', town: 'gulch', text: 'Tap a stone pad and build a Crossbow', doneText: 'Crossbow built', kind: 'crossbow', wait: 'crossbow', done: c => c.towers.length >= 1, at: c => ({ spot: c.freeSpot() }) },
  { id: 'g-camp3', town: 'gulch', text: 'Tap the Lumber Camp and upgrade it to level 3', doneText: 'Lumber Camp is level 3', done: c => c.lv('camp') >= 3, at: () => ({ plot: 'camp' }) },
  { id: 'g-mine', town: 'gulch', text: 'Tap the Copper Mine lot, then tap Build', doneText: 'Copper Mine built', done: c => c.lv('mine') >= 1, ready: c => c.unlocked('mine'), at: () => ({ plot: 'mine' }) },
  { id: 'g-cannon', town: 'gulch', text: 'Tap a stone pad and build a Cannon', doneText: 'Cannon built', kind: 'cannon', done: c => c.built('cannon'), ready: c => c.lv('mine') >= 1, at: c => ({ spot: c.freeSpot() }) },
  { id: 'g-camp5', town: 'gulch', text: 'Tap the Lumber Camp and upgrade it to level 5', doneText: 'Lumber Camp is level 5', done: c => c.lv('camp') >= 5, at: () => ({ plot: 'camp' }) },
  { id: 'g-saw', town: 'gulch', text: 'Tap the Sawmill lot, then tap Build', doneText: 'Sawmill built', done: c => c.lv('saw') >= 1, ready: c => c.unlocked('saw'), at: () => ({ plot: 'saw' }) },
  { id: 'g-research', town: 'gulch', text: 'Tap Research and start one', doneText: 'Research started', done: c => c.researched(), ready: c => c.researchOpen, at: () => ({ el: '#researchBtn' }) },
  { id: 'g-pit', town: 'gulch', text: 'Tap the Clay Pit lot, then tap Build', doneText: 'Clay Pit built', done: c => c.lv('pit') >= 1, ready: c => c.unlocked('pit'), at: () => ({ plot: 'pit' }) },
  { id: 'g-frost', town: 'gulch', text: 'Tap a stone pad and build a Frost Lens', doneText: 'Frost Lens built', kind: 'frost', done: c => c.built('frost'), ready: c => c.lv('saw') >= 1 && c.lv('pit') >= 1, at: c => ({ spot: c.freeSpot() }) },
  { id: 'g-mine5', town: 'gulch', text: 'Tap the Copper Mine and upgrade it to level 5', doneText: 'Copper Mine is level 5', done: c => c.lv('mine') >= 5, ready: c => c.lv('mine') >= 1, at: () => ({ plot: 'mine' }) },
  { id: 'g-smelter', town: 'gulch', text: 'Tap the Smelter lot, then tap Build', doneText: 'Smelter built', done: c => c.lv('smelter') >= 1, ready: c => c.unlocked('smelter'), at: () => ({ plot: 'smelter' }) },
  { id: 'g-path', town: 'gulch', text: 'Upgrade a tower to level 5 and pick a path', doneText: 'Tower path picked', done: c => c.pathed(), at: c => ({ tower: c.topTower() }) },
  { id: 'g-wave10', town: 'gulch', text: 'Stop the war wagon at wave 10', doneText: 'War wagon stopped', done: c => c.bestWave >= 10 },
  { id: 'g-mortar', town: 'gulch', text: 'Tap a Mortar pit and build a Mortar', doneText: 'Mortar built', kind: 'mortar', done: c => c.built('mortar'), ready: c => c.open('mortar'), at: c => ({ spot: c.freePit() }) },
  // later goals: within (minutes from a new game) is how soon the careful bot must do them (tools/balance.js)
  // one act, with the coins as have / need, and the spotlight on the coins it counts (review of 2026.11.19-12; of 2026.11.19-8:
  // "Tap Hold waves and save 15K coins" joined two acts, and "Tap Hold waves to save coins" read as if holding saved coins)
  // the hold is its own step, so the save step can point at the coins it counts (review of 2026.11.19-12: the save goal
  // spotlit Hold waves while it said save coins)
  // (a hold after a lost boss does not count: Resume waves comes first, then this step)
  { id: 'g-hold', town: 'gulch', text: 'Tap Hold waves while you save for Iron Ridge', doneText: 'Waves on hold', done: c => c.heldByPlayer() || c.founded('ridge'), ready: c => ridgeWave(c) && !c.canFound('ridge'), at: () => ({ el: '#holdWaves' }), within: 85 },
  { id: 'g-save', town: 'gulch', text: 'Save coins to open Iron Ridge', doneText: 'Iron Ridge is open', need: RIDGE.found.coins, done: c => c.founded('ridge'), ready: c => ridgeWave(c) && !c.canFound('ridge'), at: () => ({ el: '#coins' }), within: 85 },
  { id: 'g-tools', town: 'gulch', text: 'Tap the Toolsmith lot, then tap Build', doneText: 'Toolsmith built', done: c => c.lv('toolsmith') >= 1, ready: c => c.lvIn('ridge', 'rolling') >= 1, at: () => ({ plot: 'toolsmith' }), within: RIDGE_GOAL },
  { id: 'g-found', town: 'gulch', text: 'Tap Map, then tap Iron Ridge to start it', doneText: 'Iron Ridge is open', done: c => c.founded('ridge'), ready: c => ridgeWave(c) && c.canFound('ridge'), at: goTo('ridge'), away: true, within: 85 },
  // Iron Ridge
  // the steps to the Blast Furnace (review of 2026.11.20-9: Iron Ridge opened with no goal strip, the furnace was locked)
  { id: 'r-quarry', town: 'ridge', text: 'Tap the Quarry and upgrade it to level 5', doneText: 'Quarry is level 5', done: c => c.lv('rquarry') >= 5 || c.lv('colliery') >= 1 || c.lv('furnace') >= 1, at: () => ({ plot: 'rquarry' }), within: RIDGE_GOAL },
  { id: 'r-mine', town: 'ridge', text: 'Tap the Iron Mine and upgrade it to level 5', doneText: 'Iron Mine is level 5', done: c => c.lv('ironmine') >= 5 || c.lv('furnace') >= 1, ready: c => c.unlocked('ironmine'), at: () => ({ plot: 'ironmine' }), within: RIDGE_GOAL },
  { id: 'r-coal', town: 'ridge', text: 'Tap the Coal Pit and upgrade it to level 3', doneText: 'Coal Pit is level 3', done: c => c.lv('colliery') >= 3 || c.lv('furnace') >= 1, ready: c => c.unlocked('colliery'), at: () => ({ plot: 'colliery' }), within: RIDGE_GOAL },
  { id: 'r-furnace', town: 'ridge', text: 'Tap the Blast Furnace lot, then tap Build', doneText: 'Blast Furnace built', done: c => c.lv('furnace') >= 1, ready: c => c.unlocked('furnace'), at: () => ({ plot: 'furnace' }), within: RIDGE_GOAL },
  // Pine Hollow (Evaluation 2): the newcomer never went there, since nothing on the strip sent it. Once the first
  // workshop stands, the Ridge's strip sends the player to win Pine Hollow (and its bounties), then back.
  // the Ridge's climb (clarity fix 3b part 2): every Ridge goal was a building, so the newcomer met its wave-10 boss with
  // every tower at level 1 and lost it for 30 minutes, and the climbs to waves 30 and 52 had nothing on the strip but
  // the wave. Tower goals that show up as the best wave climbs.
  { id: 'r-path', town: 'ridge', text: 'Upgrade a tower to level 5 and pick a path', doneText: 'Tower path picked', done: c => c.pathed(), ready: c => c.bestWave >= 7, at: c => ({ tower: c.topTower() }), within: RIDGE_GOAL },
  { id: 'r-pine', town: 'ridge', text: 'Tap Map, then tap Pine Hollow', doneText: 'Pine Hollow won', done: c => c.wonIn('pinehollow'), ready: c => c.lv('furnace') >= 1 && c.founded('pinehollow'), at: goTo('pinehollow'), away: true, within: RIDGE_GOAL },
  { id: 'r-up10', town: 'ridge', text: 'Upgrade a tower to level 10', doneText: 'A tower is level 10', done: c => c.towers.filter(t => t.level >= 10).length >= 1, ready: c => c.bestWave >= 12, at: c => ({ tower: c.upTo(10) }), within: RIDGE_GOAL },
  { id: 'r-five5', town: 'ridge', text: 'Upgrade 5 towers to level 5', doneText: '5 towers are level 5', done: c => c.towers.filter(t => t.level >= 5).length >= 5, count: c => [c.towers.filter(t => t.level >= 5).length, 5], ready: c => c.bestWave >= 17, at: c => ({ tower: c.upTo(5) }), within: RIDGE_GOAL },
  { id: 'r-five8', town: 'ridge', text: 'Upgrade 5 towers to level 8', doneText: '5 towers are level 8', done: c => c.towers.filter(t => t.level >= 8).length >= 5, count: c => [c.towers.filter(t => t.level >= 8).length, 5], ready: c => c.bestWave >= 22, at: c => ({ tower: c.upTo(8) }), within: RIDGE_GOAL },
  { id: 'r-three10', town: 'ridge', text: 'Upgrade 3 towers to level 10', doneText: '3 towers are level 10', done: c => c.towers.filter(t => t.level >= 10).length >= 3, count: c => [c.towers.filter(t => t.level >= 10).length, 3], ready: c => c.bestWave >= 27, at: c => ({ tower: c.upTo(10) }), within: RIDGE_GOAL },
  // one tower at 15 for the last waves before the Capital (31 until clarity fix 3b part 2b: on seeds 4-5 the newcomer
  // climbed 27 to 30 for 11-12 minutes with nothing new, its upgrades spread over 23 towers, and one tower at 15 got
  // seed 2 past its wall at wave 29); past wave 30 the Capital leads the strip until it stands, so r-five10 comes after it
  { id: 'r-up15', town: 'ridge', text: 'Upgrade a tower to level 15', doneText: 'A tower is level 15', done: c => c.towers.filter(t => t.level >= 15).length >= 1, ready: c => c.bestWave >= 28, at: c => ({ tower: c.upTo(15) }), within: RIDGE_GOAL },
  { id: 'r-five10', town: 'ridge', text: 'Upgrade 5 towers to level 10', doneText: '5 towers are level 10', done: c => c.towers.filter(t => t.level >= 10).length >= 5, count: c => [c.towers.filter(t => t.level >= 10).length, 5], ready: c => c.bestWave >= 38, at: c => ({ tower: c.upTo(10) }), within: RIDGE_GOAL },
  // the Steel Mill had no goal (clarity fix 3b part 2): on seed 2 the newcomer never built one, so the Boiler Shop and every
  // later Ridge goal stayed shut and the strip read "Reach wave 30" for 40 minutes. A lot still shut asks for the level
  // that opens it (stepFor), so these two walk the furnace and the mill up a level at a time.
  { id: 'r-steel', town: 'ridge', text: 'Tap the Steel Mill lot, then tap Build', doneText: 'Steel Mill built', done: c => c.lv('steelmill') >= 1, at: () => ({ plot: 'steelmill' }), within: RIDGE_GOAL },
  { id: 'r-boiler', town: 'ridge', text: 'Tap the Boiler Shop lot, then tap Build', doneText: 'Boiler Shop built', done: c => c.lv('boilershop') >= 1, at: () => ({ plot: 'boilershop' }), within: RIDGE_GOAL },
  { id: 'r-steel5', town: 'ridge', text: 'Tap the Steel Mill and upgrade it to level 5', doneText: 'Steel Mill is level 5', done: c => c.lv('steelmill') >= 5, ready: c => c.lv('steelmill') >= 1, at: () => ({ plot: 'steelmill' }), within: RIDGE_GOAL },
  { id: 'r-rolling', town: 'ridge', text: 'Tap the Rolling Mill lot, then tap Build', doneText: 'Rolling Mill built', done: c => c.lv('rolling') >= 1, ready: c => c.unlocked('rolling'), at: () => ({ plot: 'rolling' }), within: RIDGE_GOAL },
  { id: 'r-tools', town: 'ridge', text: 'Tap Map, Copper Gulch, then build a Toolsmith', doneText: 'Toolsmith built in Copper Gulch', done: ridgeTools, ready: c => c.lv('rolling') >= 1, at: goTo('gulch'), there: ['gulch', 'toolsmith'], within: RIDGE_GOAL },
  { id: 'r-rolling5', town: 'ridge', text: 'Tap the Rolling Mill and upgrade it to level 5', doneText: 'Rolling Mill is level 5', done: c => c.lv('rolling') >= 5, ready: c => c.lv('rolling') >= 1, at: () => ({ plot: 'rolling' }), within: RIDGE_GOAL },
  { id: 'r-boiler5', town: 'ridge', text: 'Tap the Boiler Shop and upgrade it to level 5', doneText: 'Boiler Shop is level 5', done: c => c.lv('boilershop') >= 5, ready: c => c.lv('boilershop') >= 1, at: () => ({ plot: 'boilershop' }), within: RIDGE_GOAL },
  { id: 'r-loco', town: 'ridge', text: 'Tap the Locomotive Works lot, then tap Build', doneText: 'Locomotive Works built', done: c => c.lv('loco') >= 1, ready: c => c.unlocked('loco'), at: () => ({ plot: 'loco' }), within: RIDGE_GOAL },
  // Pine Hollow: a few towers, the Clay Bank, the win, then back to Iron Ridge
  { id: 'p-tower', town: 'pinehollow', text: 'Tap a stone pad and build a Crossbow', doneText: 'Crossbow built', kind: 'crossbow', wait: 'crossbow', done: c => c.towers.length >= 1, ready: early(), at: c => ({ spot: c.freeSpot() }), within: RIDGE_GOAL },
  { id: 'p-clay', town: 'pinehollow', text: 'Tap the Clay Bank lot, then tap Build', doneText: 'Clay Bank built', done: c => c.lv('claybank') >= 1, ready: early(c => c.unlocked('claybank')), at: () => ({ plot: 'claybank' }), within: RIDGE_GOAL },
  { id: 'p-three', town: 'pinehollow', text: 'Build Crossbows on 3 stone pads', doneText: '3 Crossbows built', kind: 'crossbow', done: c => c.towers.length >= 3, count: c => [c.towers.length, 3], ready: early(), at: c => ({ spot: c.freeSpot() }), within: RIDGE_GOAL },
  { id: 'p-win', town: 'pinehollow', text: 'Beat wave 15 to win Pine Hollow', doneText: 'Pine Hollow won', done: c => c.won, within: RIDGE_GOAL },
  { id: 'p-back', town: 'pinehollow', text: 'Tap Map, then tap Iron Ridge', doneText: 'Back in Iron Ridge', done: c => c.won && !c.inPlay, ready: c => c.won, at: goTo('ridge'), away: true, within: RIDGE_GOAL },
  // Sandy Bend (review of 2026.11.20-8: it had no goal strip): a few towers, the Quartz Diggings, the win, then back to
  // Silver Falls. side: no bot is sent here, so the bots' goal timing check leaves these out (tools/balance.js goalCheck).
  { id: 's-tower', town: 'sandybend', side: true, text: 'Tap a stone pad and build a Crossbow', doneText: 'Crossbow built', kind: 'crossbow', wait: 'crossbow', done: c => c.towers.length >= 1, ready: early(), at: c => ({ spot: c.freeSpot() }) },
  { id: 's-quartz', town: 'sandybend', side: true, text: 'Tap the Quartz Diggings lot, then tap Build', doneText: 'Quartz Diggings built', done: c => c.lv('quartzdig') >= 1, ready: early(c => c.unlocked('quartzdig')), at: () => ({ plot: 'quartzdig' }) },
  { id: 's-three', town: 'sandybend', side: true, text: 'Build Crossbows on 3 stone pads', doneText: '3 Crossbows built', kind: 'crossbow', done: c => c.towers.length >= 3, count: c => [c.towers.length, 3], ready: early(), at: c => ({ spot: c.freeSpot() }) },
  { id: 's-win', town: 'sandybend', side: true, text: 'Beat wave 15 to win Sandy Bend', doneText: 'Sandy Bend won', done: c => c.won },
  { id: 's-back', town: 'sandybend', side: true, text: 'Tap Map, then tap Silver Falls', doneText: 'Back in Silver Falls', done: c => c.won && !c.inPlay, ready: c => c.won, at: goTo('falls'), away: true },
  // Silver Falls (M5): the way up its chain to the Telegraph Works. The Wire Mill uses Gulch copper and the Dynamo and
  // Telegraph Works use Ridge steel and rails, so a missing maker there sends the player to that town.
  { id: 'f-sand4', town: 'falls', text: 'Tap the Sand Pit and upgrade it to level 4', doneText: 'Sand Pit is level 4', done: c => c.lv('sandpit') >= 4, at: () => ({ plot: 'sandpit' }), within: FALLS_GOAL },
  { id: 'f-wheel', town: 'falls', text: 'Tap the Water Wheel lot, then tap Build', doneText: 'Water Wheel built', done: c => c.lv('waterwheel') >= 1, ready: c => c.unlocked('waterwheel'), at: () => ({ plot: 'waterwheel' }), within: FALLS_GOAL },
  { id: 'f-glass', town: 'falls', text: 'Tap the Glassworks lot, then tap Build', doneText: 'Glassworks built', done: c => c.lv('glassworks') >= 1, ready: c => c.unlocked('glassworks'), at: () => ({ plot: 'glassworks' }), within: FALLS_GOAL },
  { id: 'f-wheel5', town: 'falls', text: 'Tap the Water Wheel and upgrade it to level 5', doneText: 'Water Wheel is level 5', done: c => c.lv('waterwheel') >= 5, ready: c => c.lv('glassworks') >= 1, at: () => ({ plot: 'waterwheel' }), within: FALLS_GOAL },
  { id: 'f-wire', town: 'falls', text: 'Tap the Wire Mill lot, then tap Build', doneText: 'Wire Mill built', done: c => c.lv('wiremill') >= 1, ready: c => c.unlocked('wiremill'), at: () => ({ plot: 'wiremill' }), within: FALLS_GOAL },
  { id: 'f-copper', town: 'falls', text: 'Tap Map, Copper Gulch, then build a Smelter', doneText: 'Smelter built in Copper Gulch', done: c => c.lvIn('gulch', 'smelter') >= 1, ready: c => c.lv('wiremill') >= 1, at: goTo('gulch'), there: ['gulch', 'smelter'], within: FALLS_GOAL },
  { id: 'f-bulbs', town: 'falls', text: 'Tap the Bulb Works lot, then tap Build', doneText: 'Bulb Works built', done: c => c.lv('bulbworks') >= 1, ready: c => c.unlocked('bulbworks'), at: () => ({ plot: 'bulbworks' }), within: FALLS_GOAL },
  { id: 'f-dynamo', town: 'falls', text: 'Tap the Dynamo Works lot, then tap Build', doneText: 'Dynamo Works built', done: c => c.lv('dynamo') >= 1, ready: c => c.unlocked('dynamo'), at: () => ({ plot: 'dynamo' }), within: FALLS_GOAL },
  { id: 'f-steel', town: 'falls', text: 'Tap Map, Iron Ridge, then build a Steel Mill', doneText: 'Steel Mill built in Iron Ridge', done: c => c.lvIn('ridge', 'steelmill') >= 1, ready: c => c.lv('dynamo') >= 1, at: goTo('ridge'), there: ['ridge', 'steelmill'], within: FALLS_GOAL },
  { id: 'f-rails', town: 'falls', text: 'Tap Map, Iron Ridge, then build a Rolling Mill', doneText: 'Rolling Mill built in Iron Ridge', done: c => c.lvIn('ridge', 'rolling') >= 1, ready: c => c.unlocked('telegraph'), at: goTo('ridge'), there: ['ridge', 'rolling'], within: FALLS_GOAL },
  // Thunder Mesa (PLAN.md M6b, part 1a): the way up its chain to the Airship Works. The Motor Works uses Falls wire, the
  // Automobile Plant Ridge steel and the Airship Works Falls dynamos, so a missing maker there sends the player to that
  // town. The active player's road there (tools/mesa-road.js) checks each within MESA_GOAL.
  { id: 'm-derrick4', town: 'mesa', within: MESA_GOAL, text: 'Tap the Oil Derrick and upgrade it to level 4', doneText: 'Oil Derrick is level 4', done: c => c.lv('derrick') >= 4, at: () => ({ plot: 'derrick' }) },
  { id: 'm-bauxite', town: 'mesa', within: MESA_GOAL, text: 'Tap the Bauxite Pit lot, then tap Build', doneText: 'Bauxite Pit built', done: c => c.lv('bauxitepit') >= 1, ready: c => c.unlocked('bauxitepit'), at: () => ({ plot: 'bauxitepit' }) },
  { id: 'm-refinery', town: 'mesa', within: MESA_GOAL, text: 'Tap the Refinery lot, then tap Build', doneText: 'Refinery built', done: c => c.lv('refinery') >= 1, ready: c => c.unlocked('refinery'), at: () => ({ plot: 'refinery' }) },
  { id: 'm-aluminum', town: 'mesa', within: MESA_GOAL, text: 'Tap the Aluminum Works lot, then tap Build', doneText: 'Aluminum Works built', done: c => c.lv('aluminum') >= 1, ready: c => c.lv('refinery') >= 1, at: () => ({ plot: 'aluminum' }) },
  { id: 'm-rubber', town: 'mesa', within: MESA_GOAL, text: 'Tap the Rubber Farm lot, then tap Build', doneText: 'Rubber Farm built', done: c => c.lv('rubberfarm') >= 1, ready: c => c.lv('aluminum') >= 1, at: () => ({ plot: 'rubberfarm' }) },
  { id: 'm-tires', town: 'mesa', within: MESA_GOAL, text: 'Tap the Tire Works lot, then tap Build', doneText: 'Tire Works built', done: c => c.lv('tireworks') >= 1, ready: c => c.lv('rubberfarm') >= 1, at: () => ({ plot: 'tireworks' }) },
  { id: 'm-motors', town: 'mesa', within: MESA_GOAL, text: 'Tap the Motor Works lot, then tap Build', doneText: 'Motor Works built', done: c => c.lv('motorworks') >= 1, ready: c => c.lv('aluminum') >= 1, at: () => ({ plot: 'motorworks' }) },
  { id: 'm-wire', town: 'mesa', within: MESA_GOAL, text: 'Tap Map, Silver Falls, then build a Wire Mill', doneText: 'Wire Mill built in Silver Falls', done: c => c.lvIn('falls', 'wiremill') >= 1, ready: c => c.lv('motorworks') >= 1, at: goTo('falls'), there: ['falls', 'wiremill'] },
  { id: 'm-autos', town: 'mesa', within: MESA_GOAL, text: 'Tap the Automobile Plant lot, then tap Build', doneText: 'Automobile Plant built', done: c => c.lv('autoplant') >= 1, ready: c => c.lv('motorworks') >= 1, at: () => ({ plot: 'autoplant' }) },
  { id: 'm-steel', town: 'mesa', within: MESA_GOAL, text: 'Tap Map, Iron Ridge, then build a Steel Mill', doneText: 'Steel Mill built in Iron Ridge', done: c => c.lvIn('ridge', 'steelmill') >= 1, ready: c => c.lv('autoplant') >= 1, at: goTo('ridge'), there: ['ridge', 'steelmill'] },
  { id: 'm-airships', town: 'mesa', within: MESA_GOAL, text: 'Tap the Airship Works lot, then tap Build', doneText: 'Airship Works built', done: c => c.lv('airshipworks') >= 1, ready: c => c.lv('motorworks') >= 1, at: () => ({ plot: 'airshipworks' }) },
  { id: 'm-dynamo', town: 'mesa', within: MESA_GOAL, text: 'Tap Map, Silver Falls, then build a Dynamo Works', doneText: 'Dynamo Works built in Silver Falls', done: c => c.lvIn('falls', 'dynamo') >= 1, ready: c => c.lv('airshipworks') >= 1, at: goTo('falls'), there: ['falls', 'dynamo'] },
  { id: 'f-telegraph', town: 'falls', text: 'Tap the Telegraph Works lot, then tap Build', doneText: 'Telegraph Works built', done: c => c.lv('telegraph') >= 1, ready: c => c.unlocked('telegraph'), at: () => ({ plot: 'telegraph' }), within: FALLS_GOAL },
];
