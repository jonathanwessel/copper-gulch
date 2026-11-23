// Clarity fix 3b part 2b (PLAN.md M6a): a newcomer's last two waits before and after the Capital. The Capital's gate
// passing is news the player sees once, and while the save for the Capital's first building is short a contract always
// runs, since each one pays toward it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../src/core/setup.js';
import { foundTown } from '../src/core/empire.js';
import { goalNow, goalsOf } from '../src/core/goals.js';
import { foundCapital, claim } from '../src/core/capital.js';
import { foundCost } from '../src/core/tree.js';
import { goalTap } from '../tools/firstplay.js';
import { Rng } from '../src/core/rng.js';
import { CAPITAL_DEF } from '../src/data/capital.js';

const ridgeGame = seed => {
  const g = newGame(seed, 'gulch'), gu = g.town;
  gu.bestWave = 40; gu.coins = 1e7;
  assert.ok(foundTown(g, 'ridge'));
  g.go('ridge');
  return g;
};

test('the Capital\'s gate passing is said once, when its town beats the wave', () => {
  const g = ridgeGame('cr1'), r = g.town, said = [];
  g.bus.on('capital:ready', e => said.push(e));
  r.bestWave = CAPITAL_DEF.found.wave - 1; g.step(.25);
  assert.equal(said.length, 0, 'not before the wave');
  r.bestWave = CAPITAL_DEF.found.wave; g.step(.25); g.step(.25);
  assert.equal(said.length, 1);
  assert.deepEqual(said[0], { town: 'ridge', coins: CAPITAL_DEF.found.coins });
  r.bestWave = 0; g.step(.25); r.bestWave = CAPITAL_DEF.found.wave + 2; g.step(.25);
  assert.equal(said.length, 1, 'a charter that climbs back does not say it again');
  const again = newGame('cr1b', 'gulch');
  again.shared.capital.told = true; again.towns.gulch.bestWave = 40; again.towns.gulch.coins = 1e7;
  assert.ok(foundTown(again, 'ridge'));
  const heard = []; again.bus.on('capital:ready', e => heard.push(e));
  again.towns.ridge.bestWave = 40; again.step(.25);
  assert.equal(heard.length, 0, 'a save that said it keeps it said');
});

test('while the Capital\'s first building is short of coins, the strip keeps a contract running', () => {
  const g = ridgeGame('cr3'), r = g.town;
  for (const x of goalsOf('ridge')) g.shared.goals.done[x.id] = true;
  r.buildings.furnace = 3; r.bestWave = 40; r.coins = CAPITAL_DEF.found.coins;
  assert.ok(foundCapital(g)); g.step(.25);
  const cp = g.shared.capital;
  assert.equal(goalNow(g).id, 'next:contract');
  assert.ok(goalTap(g, r, new Rng('a')).run());
  assert.equal(goalNow(g).id, 'next:institution', 'a contract runs: the strip counts the coins');
  const a = cp.active, maker = g.towns[a.town];
  maker.goods[a.good] = (maker.goods[a.good] || 0) + a.need * 10;
  claim(g, maker); g.step(.25);
  assert.equal(cp.filled, 1);
  r.coins = 0;
  if (!cp.offers.length) g.step(30);
  assert.equal(goalNow(g).id, 'next:contract', 'short of coins and no contract: take another');
  r.coins = foundCost(g);
  assert.equal(goalNow(g).id, 'next:institution', 'the coins are there: build it');
});
