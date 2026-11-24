// Clarity fix 3b part 2d (PLAN.md M6a): the save for the Capital's first building with both towns at a boss wall. The
// first building costs less than the ones after it, and while it is saved for, a town that lost its boss while away
// stays held: the strip does not send the player back there to spend the save, and says Resume once it stands.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../src/core/setup.js';
import { foundTown } from '../src/core/empire.js';
import { goalNow, goalsOf, savingFor, capitalSaving, firstSave } from '../src/core/goals.js';
import { foundCapital } from '../src/core/capital.js';
import { foundCost, foundInstitution } from '../src/core/tree.js';
import { FOUND, INSTITUTIONS } from '../src/data/institutions.js';
import { CAPITAL_DEF } from '../src/data/capital.js';
import { needsYou } from '../src/core/map.js';

// Iron Ridge past its goals with the Capital founded, the player in the Ridge, the Gulch held after a loss away
const capitalGame = (seed, why = 'boss') => {
  const g = newGame(seed, 'gulch'), gu = g.town;
  gu.bestWave = 40; gu.coins = 1e7;
  assert.ok(foundTown(g, 'ridge'));
  g.go('ridge');
  const r = g.town;
  for (const x of goalsOf('ridge')) g.shared.goals.done[x.id] = true;
  for (const x of goalsOf('gulch')) g.shared.goals.done[x.id] = true;
  r.bestWave = 40; r.coins = CAPITAL_DEF.found.coins;
  assert.ok(foundCapital(g));
  r.coins = 1000;
  gu.waves.hold = true; gu.waves.autoHold = true;
  gu.lost = { why, wave: why === 'boss' ? 30 : 27, back: 28, coins: 0, at: 0, away: true };
  return { g, gu, r };
};

test('the first building costs less than the ones after it, and the later prices are unchanged', () => {
  const { g, r } = capitalGame('fs1');
  assert.equal(foundCost(g), FOUND.first);
  assert.ok(FOUND.first < FOUND.coins);
  r.coins = FOUND.first;
  assert.ok(foundInstitution(g, INSTITUTIONS[0].id));
  assert.equal(foundCost(g), FOUND.coins * FOUND.growth, 'the second one costs what it did');
});

test('while the first building is saved for, a town that lost its boss away stays held', () => {
  const { g, gu } = capitalGame('fs2');
  assert.ok(firstSave(g));
  assert.ok(capitalSaving(g, gu) && savingFor(g, gu), 'it saves');
  const s = goalNow(g);
  assert.ok(!/^resume-/.test(s.id), 'the strip does not send the player back to resume it: ' + s.id);
  assert.match(s.id, /^next:(contract|institution)$/);
  assert.ok(needsYou(g, 'gulch'), 'the Map still shows it lost');
});

test('once the first building stands, the strip sends the player back to resume it', () => {
  const { g, gu, r } = capitalGame('fs3');
  r.coins = foundCost(g);
  assert.ok(!firstSave(g), 'the coins are there, so the save is over');
  assert.ok(foundInstitution(g, INSTITUTIONS[0].id));
  assert.ok(!capitalSaving(g, gu));
  assert.equal(goalNow(g).id, 'resume-gulch');
});

test('a town that lost a plain wave away is not held by the save', () => {
  const { g, gu } = capitalGame('fs4', 'vault');
  assert.ok(firstSave(g));
  assert.ok(!capitalSaving(g, gu));
  assert.equal(goalNow(g).id, 'resume-gulch');
});

test('a town that lost its boss in play is asked to resume as before', () => {
  const { g, gu } = capitalGame('fs5');
  gu.lost.away = false;
  g.go('gulch');
  assert.ok(!capitalSaving(g, gu));
  assert.equal(goalNow(g).id, 'resume');
});
