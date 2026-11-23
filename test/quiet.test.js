// Clarity fix 3b part 2 (PLAN.md M6a): a newcomer's quiet stretches after hour 1. Three causes, one test each:
// the Ridge's goal chain had no Steel Mill step, the Capital save sent the player away to rebuild towers in a town that
// lost while away, and an upgrade goal had no price the newcomer could save for.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../src/core/setup.js';
import { goalNow, goalText, goalContext, goalsOf } from '../src/core/goals.js';
import { towerCost } from '../src/core/defense.js';
import { foundTown } from '../src/core/empire.js';
import { fall, setHold } from '../src/core/defense.js';
import { cost } from '../src/core/economy.js';
import { goalNeed, goalTap, buildFirst, LOST_BUYS } from '../tools/firstplay.js';
import { foundCost } from '../src/core/tree.js';
import { Rng } from '../src/core/rng.js';
import { GOODS } from '../src/data/goods.js';
import { foundCapital } from '../src/core/capital.js';
import { textIssues } from '../tools/audit.js';
import { CAPITAL_DEF } from '../src/data/capital.js';

const ridgeGame = seed => {
  const g = newGame(seed, 'gulch'), t = g.town;
  t.bestWave = 20; t.coins = 1e6; foundTown(g, 'ridge'); t.coins = 1000;
  g.go('ridge');
  for (const id of ['r-quarry', 'r-mine', 'r-coal', 'r-furnace', 'r-pine']) g.shared.goals.done[id] = true;
  Object.assign(g.town.buildings, { rquarry: 5, ironmine: 5, colliery: 3 }); // what the furnace needs
  return g;
};

test('the Ridge strip walks to the Steel Mill and the Boiler Shop a level at a time', () => {
  const g = ridgeGame('qt1'), r = g.town;
  r.buildings.furnace = 1;
  let x = goalNow(g);
  assert.equal(x.id, 'r-steel>furnace', 'the Steel Mill lot is shut: the strip asks for the furnace level that opens it');
  assert.equal(goalText(g, r, x), 'Tap the Blast Furnace and upgrade it to level 3 to open the Steel Mill');
  assert.deepEqual(textIssues(goalText(g, r, x)), []);
  r.buildings.furnace = 3;
  x = goalNow(g);
  assert.equal(x.id, 'r-steel');
  assert.equal(x.need, cost(r, 'steelmill'), 'a new lot counts its price');
  r.buildings.steelmill = 1; g.step(.25);
  assert.ok(g.shared.goals.done['r-steel']);
  x = goalNow(g);
  assert.equal(x.id, 'r-boiler>steelmill');
  assert.equal(goalText(g, r, x), 'Tap the Steel Mill and upgrade it to level 3 to open the Boiler Shop');
});

test('the Capital save comes before going back to a town that lost while away', () => {
  const g = ridgeGame('qt2'), r = g.town, gulch = g.towns.gulch;
  r.bestWave = CAPITAL_DEF.found.wave; r.coins = 1000;
  gulch.wave = 25; gulch.bestWave = 25; fall(g, gulch, 'vault');
  assert.equal(gulch.waves.autoHold, true, 'the Gulch lost while away and holds');
  assert.equal(goalNow(g).id, 'next:capital:hold', 'the save leads, so the purse is not spent rebuilding the Gulch');
  setHold(g, r, true);
  assert.equal(goalNow(g).id, 'next:capital:coins');
  g.go('gulch');
  assert.equal(goalNow(g).id, 'next:capital:coins', 'in the Gulch it lost while away: it stays held while the save is on');
  g.go('ridge');
  r.coins = CAPITAL_DEF.found.coins;
  assert.equal(goalNow(g).id, 'next:capital:go');
  g.shared.capital.open = true;
  assert.equal(goalNow(g).id, 'resume', 'once the Capital stands, Resume waves here first');
  setHold(g, r, false);
  assert.equal(goalNow(g).id, 'resume-gulch', 'then the strip sends the player back to the Gulch');
  r.bestWave = 10; g.shared.capital.open = false;
  assert.equal(goalNow(g).id, 'resume-gulch', 'before the Capital is near, a loss elsewhere still comes first');
});

test('the newcomer saves for an upgrade goal at the price its card shows', () => {
  const g = ridgeGame('qt3'), r = g.town;
  r.buildings.furnace = 3; r.buildings.steelmill = 2;
  g.shared.goals.done['r-steel'] = true; g.shared.goals.done['r-boiler'] = true;
  const x = goalNow(g);
  assert.equal(x.id, 'r-steel5');
  assert.equal(x.need, undefined, 'the strip shows no count beside the level');
  assert.equal(goalNeed(g, r, x), cost(r, 'steelmill'), 'the card shows the next level\'s price');
  assert.equal(goalNeed(g, r, { id: 'x', need: 500 }), 500);
  assert.equal(goalNeed(g, r, null), null);
});

test('the Ridge strip asks for towers as its best wave climbs', () => {
  const g = ridgeGame('qt4'), r = g.town;
  Object.assign(r.buildings, { furnace: 3, steelmill: 5, boilershop: 5, rolling: 5, loco: 1 });
  g.towns.gulch.buildings.toolsmith = 1;
  for (const id of ['r-steel', 'r-boiler', 'r-steel5', 'r-rolling', 'r-tools', 'r-rolling5', 'r-boiler5', 'r-loco']) g.shared.goals.done[id] = true;
  r.towers.push({ kind: 'crossbow', spot: 0, level: 6, path: 'a' }, { kind: 'cannon', spot: 1, level: 3 });
  const at = () => { g.step(.25); const x = goalNow(g); return [x.id, x.at(goalContext(g, r))]; };
  r.bestWave = 12;
  assert.deepEqual(at(), ['r-up10', { tower: 0 }], 'the highest tower still under level 10');
  assert.equal(goalNeed(g, r, goalNow(g)), towerCost(r, 'crossbow', 6).coins, 'the newcomer saves for the upgrade its card shows');
  r.towers[0].level = 10; r.bestWave = 18;
  assert.deepEqual(at(), ['r-five5', { tower: 1 }]);
  for (let i = 2; i < 5; i++) r.towers.push({ kind: 'cannon', spot: i, level: 8 });
  r.towers[1].level = 5; r.bestWave = 22;
  assert.deepEqual(at(), ['r-five8', { tower: 1 }]);
  r.towers[1].level = 8; r.bestWave = 27;
  assert.deepEqual(at(), ['r-three10', { tower: 1 }]);
  r.towers[1].level = 10; r.towers[2].level = 10; r.bestWave = 31;
  assert.equal(at()[0], 'next:capital:hold', 'past wave 30 the Capital leads until it stands');
  g.shared.capital.open = true;
  assert.deepEqual(at(), ['r-up15', { tower: 0 }]);
  r.towers[0].level = 15; r.bestWave = 38;
  assert.deepEqual(at(), ['r-five10', { tower: 3 }]);
  for (const id of ['r-up10', 'r-five5', 'r-five8', 'r-three10', 'r-up15', 'r-five10']) assert.ok(goalsOf('ridge').some(x => x.id === id && !textIssues(x.text).length));
});

test('once the Capital stands, the strip asks for its first building, and the newcomer builds one', () => {
  const g = ridgeGame('qt5'), r = g.town;
  for (const x of goalsOf('ridge')) g.shared.goals.done[x.id] = true;
  r.buildings.furnace = 3; // pig iron to spare, so the board has offers
  r.bestWave = 40; r.coins = CAPITAL_DEF.found.coins; assert.ok(foundCapital(g)); g.step(.25);
  const c = goalNow(g);
  assert.equal(c.id, 'next:contract', 'first a contract, free to take');
  assert.deepEqual(textIssues(c.text), []);
  assert.ok(goalTap(g, r, new Rng('c')).run());
  assert.ok(g.shared.capital.active);
  const x = goalNow(g);
  assert.equal(x.id, 'next:institution');
  assert.equal(x.need, foundCost(g));
  assert.deepEqual(textIssues(x.text), []);
  r.coins = foundCost(g) - 1;
  assert.equal(goalTap(g, r, new Rng('i')), null, 'it cannot pay yet');
  r.coins = foundCost(g);
  const tap = goalTap(g, r, new Rng('i'));
  assert.ok(tap && tap.run());
  assert.equal(g.shared.tree.founded.length, 1);
  assert.notEqual((goalNow(g) || {}).id, 'next:institution');
});

test('after a loss the newcomer builds towers before it taps Resume waves, as the strip says', () => {
  const g = newGame('qt6', 'gulch'), t = g.town;
  t.wave = 12; t.bestWave = 12; t.waves.phase = 'wave'; fall(g, t, 'boss');
  assert.equal(goalNow(g).text, 'Build more towers, then tap Resume waves');
  t.coins = 1e5; for (const k of Object.keys(GOODS)) t.goods[k] = 1e4;
  assert.equal(buildFirst(g, t, new Rng('b'), 0), true, 'it can pay for a tower: it builds first');
  assert.equal(buildFirst(g, t, new Rng('b'), LOST_BUYS), false, 'then it resumes');
  t.coins = 0;
  assert.equal(buildFirst(g, t, new Rng('b'), 0), false, 'nothing it can pay for: it resumes');
});
