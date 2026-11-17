// Skill pays (PLAN.md M2): waves come on a clock, and Call now lets a strong defense go faster than the clock. The
// careful bot calls waves early when its towers are clearly ahead; the newcomer calls only when the goal strip asks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, loadGame } from '../src/core/setup.js';
import { callEarly, buildTower } from '../src/core/defense.js';
import { goalNow, goalContext } from '../src/core/goals.js';
import { GOALS } from '../src/data/goals.js';
import { CALL_AGE } from '../tools/balance.js';
import { goalTap } from '../tools/firstplay.js';
import { Rng } from '../src/core/rng.js';
import { textIssues } from '../tools/audit.js';

const step = (g, n = 1) => { for (let i = 0; i < n; i++) g.step(.25); };

test('Call now counts the calls in the town, and the count survives a save', () => {
  const g = newGame('call1', 'gulch'), t = g.town;
  assert.ok(callEarly(g, t) > 0);
  assert.equal(t.flags.called, 1);
  assert.equal(callEarly(g, t), -1, 'not during a wave');
  assert.equal(t.flags.called, 1);
  const back = loadGame(JSON.parse(JSON.stringify(g.toJSON())));
  assert.equal(back.towns.gulch.flags.called, 1);
});

test('the call goal shows in Dry Creek once 3 Crossbows stand and a wave is beaten, and spotlights Call now', () => {
  const g = newGame('call2'), t = g.town, goal = GOALS.find(x => x.id === 'dc-call');
  assert.ok(goal, 'Dry Creek has a goal for Call now');
  assert.ok(!goal.ready(goalContext(g, t)), 'not before there is a defense');
  t.coins = 1e4; t.goods.stone = 1e4;
  for (const s of [0, 1, 2]) assert.ok(buildTower(g, t, s, 'crossbow'));
  t.bestWave = 2;
  assert.ok(goal.ready(goalContext(g, t)));
  assert.equal(goal.at(goalContext(g, t)).el, '#callWave');
  assert.ok(!goal.done(goalContext(g, t)));
  callEarly(g, t);
  assert.ok(goal.done(goalContext(g, t)));
  step(g);
  assert.ok(g.shared.goals.done['dc-call']);
  assert.deepEqual(textIssues(goal.text), [], 'the goal follows the writing rule');
});

test('the newcomer taps Call now only in a break, when the strip asks', () => {
  const g = newGame('call3'), t = g.town, rng = new Rng('x');
  t.coins = 1e4; t.goods.stone = 1e4;
  for (const s of [0, 1, 2]) buildTower(g, t, s, 'crossbow');
  t.bestWave = 2;
  for (const id of ['dc-tower', 'dc-stone2', 'dc-mine', 'dc-three', 'dc-up']) g.shared.goals.done[id] = true;
  assert.equal(goalNow(g).id, 'dc-call');
  const tap = goalTap(g, t, rng);
  assert.equal(tap.what, 'call');
  assert.ok(tap.run());
  assert.equal(goalTap(g, t, rng), null, 'no call during a wave');
});

test('the careful bot calls only when the last wave was over well inside the wave pace', () => {
  assert.ok(CALL_AGE > 0 && CALL_AGE < 1);
});
