// Clarity fix 5 (PLAN.md M6a, review 5): losses and holds speak, from one source. A town that needs the player shows it
// the same way on the Map button's dot, the back button's dot, its map label (a red word or a red dot) and the goal
// strip's step to go there, all read from needsYou (src/core/map.js). A boss fight with few hits left keeps the strip
// on the fight. Clarity fix 3b part 2c: a goal for one tower counts that tower's price as have / need.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../src/core/setup.js';
import { goalNow, goalText, goalContext, bossFight, FIGHT_LOW } from '../src/core/goals.js';
import { setHold, fall, buildTower, towerCost, towerAt, startWave } from '../src/core/defense.js';
import { needsYou, mapDot, siteState } from '../src/core/map.js';
import { stateNeeds, stateWord } from '../src/ui/state.js';
import { dots } from '../src/core/reveal.js';
import { GOALS } from '../src/data/goals.js';
import { goalTower, goalNeed } from '../tools/firstplay.js';

const rich = t => { t.coins = 1e9; for (const k of ['timber', 'ore', 'copper', 'bricks', 'tools', 'planks', 'clay', 'stone', 'pigiron', 'steel', 'coal']) { t.goods[k] = 1e6; t.sell[k] = false; } };
function empire(seed) {
  const g = newGame(seed, 'gulch');
  for (const x of GOALS) if (x.town === 'gulch' && !x.within) g.shared.goals.done[x.id] = true;
  g.town.bestWave = 25; g.town.wave = 25;
  g.addTown('ridge'); g.addTown('pinehollow');
  return g;
}
// what the map label marks: a red state word, or a red dot beside a word that does not say it (src/ui/map.js)
const labelMarks = (g, id) => stateNeeds(siteState(g, id)) || (!!needsYou(g, id) && !stateNeeds(siteState(g, id)));
// every place agrees: the label marks it exactly when it needs you, and the Map dot is on when any other place does
function agree(g) {
  for (const id of Object.keys(g.towns)) assert.equal(labelMarks(g, id), !!needsYou(g, id), id + ': label and needsYou');
  const others = Object.keys(g.towns).filter(id => id !== g.active && needsYou(g, id));
  if (others.length) assert.equal(mapDot(g, g.active), true, 'Map dot for ' + others);
  assert.deepEqual(Object.keys(dots(g, g.town).towns).sort(), others.sort(), 'the dots explainer reads the same towns');
  const s = goalNow(g);
  if (s && /^resume-/.test(s.id)) assert.equal(needsYou(g, s.id.slice(7)), 'lost', 'the strip sends you only to a town that needs you');
}

test('a town that lost while away: red On hold on its label, a dot on Map and the strip sends you there', () => {
  const g = empire('n1'), t = g.towns.ridge;
  g.active = 'gulch';
  t.wave = 12; fall(g, t, 'vault');
  assert.equal(needsYou(g, 'ridge'), 'lost');
  assert.equal(stateWord(siteState(g, 'ridge')), 'On hold');
  assert.equal(stateNeeds(siteState(g, 'ridge')), true);
  assert.equal(mapDot(g, 'gulch'), true);
  assert.equal(goalNow(g).id, 'resume-ridge');
  agree(g);
});

test('a town the player held for no saving goal needs them, a town held to save does not', () => {
  const g = empire('n2'), r = g.towns.ridge;
  setHold(g, r, true);
  assert.equal(needsYou(g, 'ridge'), 'hold');
  assert.equal(mapDot(g, 'gulch'), true, 'the Map dot shows the held Ridge');
  agree(g);
  setHold(g, r, false);
  // the Gulch holds to save for a town it opens: its label says On hold in the plain color and Map has no dot for it
  const g2 = newGame('n3', 'gulch'), t = g2.town;
  for (const x of GOALS) if (x.town === 'gulch' && !x.within) g2.shared.goals.done[x.id] = true;
  t.bestWave = 20; t.wave = 20; setHold(g2, t, true);
  g2.addTown('pinehollow'); g2.active = 'pinehollow';
  assert.equal(needsYou(g2, 'gulch'), null);
  assert.equal(stateWord(siteState(g2, 'gulch')), 'On hold');
  assert.equal(stateNeeds(siteState(g2, 'gulch')), false);
  agree(g2);
});

test('a place raided while you were elsewhere gets a red dot on its label and on Map, until you look', () => {
  const g = empire('n4'), r = g.towns.ridge;
  rich(r); buildTower(g, r, 0, 'crossbow');
  r.breaches = 1; r.flags.breachSeen = 0;
  assert.equal(needsYou(g, 'ridge'), 'raided');
  assert.equal(labelMarks(g, 'ridge'), true);
  agree(g);
  r.flags.breachSeen = 1;
  assert.equal(needsYou(g, 'ridge'), null);
  agree(g);
});

test('a boss fight with few hits left keeps the strip on the fight, naming the cheapest tower to raise', () => {
  const g = empire('n5'), t = g.town;
  rich(t);
  buildTower(g, t, 0, 'crossbow'); buildTower(g, t, 1, 'crossbow');
  t.towers[0].level = 6; t.towers[1].level = 2;
  t.wave = 30; startWave(g, t);
  assert.notEqual(t.waves.phase, 'break');
  t.vault.hp = t.vault.max;
  assert.equal(bossFight(g, t), false, 'a full vault: the strip goes on as before');
  t.vault.hp = Math.floor(FIGHT_LOW * t.vault.max);
  assert.equal(bossFight(g, t), true);
  const s = goalNow(g);
  assert.equal(s.id, 'fight');
  assert.equal(goalText(g, t, s), 'Stop the war wagon. Tap a tower and upgrade it');
  assert.equal(s.at(goalContext(g, t)).tower, t.towers[1].spot, 'the level 2 tower costs least to raise');
  assert.equal(goalNow(g, false) && goalNow(g, false).id === 'fight', false, 'the careful bots read the strip only for what to build');
});

test('the newcomer saving for a goal that names one tower saves for that tower, not another, when the vault is low', () => {
  const g = empire('n6'), r = g.towns.ridge;
  g.active = 'ridge'; rich(r);
  for (const x of GOALS) if (x.town === 'ridge' && x.id !== 'r-up15') g.shared.goals.done[x.id] = true;
  buildTower(g, r, 0, 'crossbow'); r.towers[0].level = 12; r.bestWave = 28; r.wave = 28;
  const s = goalNow(g);
  assert.equal(s.id, 'r-up15');
  assert.equal(goalTower(g, r, s), true, 'the goal names the tower to raise');
  assert.equal(goalNeed(g, r, s), towerCost(r, 'crossbow', 12).coins, 'it saves for the next level its card shows');
  assert.equal(goalTower(g, r, GOALS.find(x => x.id === 'r-loco')), false, 'a building goal names no tower');
});
