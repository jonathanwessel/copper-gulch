/* The goal strip (GDD.md, Onboarding): one short goal at a time through the first 30 minutes, from the first Crossbow
   in Dry Creek into Copper Gulch. A goal counts as done the first time its done(c) is true, in any order, and stays
   done (src/core/goals.js keeps them in the save). The strip shows the first goal of the town in play that is not done
   and is ready(c). Text follows the writing rule: a short order that names the real thing to tap, no colons.
     town: the town the goal belongs to.   done(c), ready(c): read the context from src/core/goals.js.
     at(c): what to spotlight, as for explainers: { plot }, { spot }, { tower }, { el: css selector }; or nothing.
     kind: the tower to build. Once the card of the spotlit pad or building is open, the spotlight moves to its button. */
/* Dry Creek's goals before the win: once it is won, only Go to Copper Gulch is left to show. */
const early = (f = null) => c => !c.won && (!f || f(c));

export const GOALS = [
  // Dry Creek Outpost, where a new game starts
  { id: 'dc-tower', town: 'drycreek', text: 'Tap a stone pad and build a Crossbow', kind: 'crossbow', done: c => c.towers.length >= 1, ready: early(), at: c => ({ spot: c.freeSpot() }) },
  { id: 'dc-stone2', town: 'drycreek', text: 'Tap the Stone Camp, then tap Upgrade', done: c => c.lv('quarry') >= 2, ready: early(), at: () => ({ plot: 'quarry' }) },
  { id: 'dc-mine', town: 'drycreek', text: 'Tap Build to build the Mining Camp', done: c => c.lv('dmine') >= 1, ready: early(c => c.unlocked('dmine')), at: () => ({ plot: 'dmine' }) },
  { id: 'dc-three', town: 'drycreek', text: 'Build Crossbows on 3 stone pads', kind: 'crossbow', done: c => c.towers.length >= 3, ready: early(), at: c => ({ spot: c.freeSpot() }) },
  { id: 'dc-up', town: 'drycreek', text: 'Tap a Crossbow, then tap Upgrade', done: c => c.topLevel() >= 2, ready: early(), at: c => ({ tower: c.lowTower() }) },
  { id: 'dc-call', town: 'drycreek', text: 'Tap Call now for bonus coins and an early wave', done: c => c.called(), ready: early(c => c.towers.length >= 3 && c.bestWave >= 2), at: () => ({ el: '#callWave' }) },
  { id: 'dc-mine5', town: 'drycreek', text: 'Tap the Mining Camp and upgrade it to level 5', done: c => c.lv('dmine') >= 5, ready: early(c => c.lv('dmine') >= 1), at: () => ({ plot: 'dmine' }) },
  { id: 'dc-path', town: 'drycreek', text: 'Upgrade a Crossbow to level 5 and pick a path', done: c => c.pathed(), ready: early(), at: c => ({ tower: c.topTower() }) },
  { id: 'dc-win', town: 'drycreek', text: 'Beat wave 10 to open Copper Gulch', done: c => c.won },
  { id: 'dc-go', town: 'drycreek', text: 'Tap Copper Gulch at the top to go there', done: c => c.visited('gulch'), ready: c => c.won, at: () => ({ el: '#townChip [data-town="gulch"]' }) },
  // Copper Gulch
  { id: 'g-tower', town: 'gulch', text: 'Tap a stone pad and build a Crossbow', kind: 'crossbow', done: c => c.towers.length >= 1, at: c => ({ spot: c.freeSpot() }) },
  { id: 'g-camp3', town: 'gulch', text: 'Tap the Lumber Camp and upgrade it to level 3', done: c => c.lv('camp') >= 3, at: () => ({ plot: 'camp' }) },
  { id: 'g-mine', town: 'gulch', text: 'Tap Build to build the Copper Mine', done: c => c.lv('mine') >= 1, ready: c => c.unlocked('mine'), at: () => ({ plot: 'mine' }) },
  { id: 'g-cannon', town: 'gulch', text: 'Tap a stone pad and build a Cannon', kind: 'cannon', done: c => c.built('cannon'), ready: c => c.lv('mine') >= 1, at: c => ({ spot: c.freeSpot() }) },
  { id: 'g-camp5', town: 'gulch', text: 'Tap the Lumber Camp and upgrade it to level 5', done: c => c.lv('camp') >= 5, at: () => ({ plot: 'camp' }) },
  { id: 'g-saw', town: 'gulch', text: 'Tap Build to build the Sawmill', done: c => c.lv('saw') >= 1, ready: c => c.unlocked('saw'), at: () => ({ plot: 'saw' }) },
  { id: 'g-research', town: 'gulch', text: 'Tap Research and start one', done: c => c.researched(), ready: c => c.researchOpen, at: () => ({ el: '#researchBtn' }) },
  { id: 'g-pit', town: 'gulch', text: 'Tap Build to build the Clay Pit', done: c => c.lv('pit') >= 1, ready: c => c.unlocked('pit'), at: () => ({ plot: 'pit' }) },
  { id: 'g-frost', town: 'gulch', text: 'Tap a stone pad and build a Frost Lens', kind: 'frost', done: c => c.built('frost'), ready: c => c.lv('saw') >= 1 && c.lv('pit') >= 1, at: c => ({ spot: c.freeSpot() }) },
  { id: 'g-mine5', town: 'gulch', text: 'Tap the Copper Mine and upgrade it to level 5', done: c => c.lv('mine') >= 5, ready: c => c.lv('mine') >= 1, at: () => ({ plot: 'mine' }) },
  { id: 'g-smelter', town: 'gulch', text: 'Tap Build to build the Smelter', done: c => c.lv('smelter') >= 1, ready: c => c.unlocked('smelter'), at: () => ({ plot: 'smelter' }) },
  { id: 'g-path', town: 'gulch', text: 'Upgrade a tower to level 5 and pick a path', done: c => c.pathed(), at: c => ({ tower: c.topTower() }) },
  { id: 'g-wave10', town: 'gulch', text: 'Stop the war wagon at wave 10', done: c => c.bestWave >= 10 },
  { id: 'g-mortar', town: 'gulch', text: 'Tap a Mortar pit and build a Mortar', kind: 'mortar', done: c => c.built('mortar'), ready: c => c.open('mortar'), at: c => ({ spot: c.freePit() }) },
];
