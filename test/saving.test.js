// Clarity fix 2 (PLAN.md M6a): a coin goal says how soon it is ready if the player saves, from the empire's income
// over the last minute, and the newcomer bot saves the same way (tools/firstplay.js, GOAL_SAVE).
import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../src/core/setup.js';
import { earnRate, readyIn, readyWords, EARN_WINDOW } from '../src/core/goals.js';
import { textIssues } from '../tools/audit.js';

test('the time words count whole minutes, then hours in steps of 5 minutes', () => {
  assert.equal(readyWords(readyIn(136, 500, 4.55)), 'about 2 min to go');
  assert.equal(readyWords(60), 'about 1 min to go');
  assert.equal(readyWords(61), 'about 2 min to go');
  assert.equal(readyWords(30), 'under a minute to go');
  assert.equal(readyWords(3599), 'about 60 min to go');
  assert.equal(readyWords(3601), 'about 1 h 5 min to go');
  assert.equal(readyWords(7200), 'about 2 h to go');
  assert.equal(readyWords(40000), 'over 10 hours to go');
  assert.equal(readyWords(null), '');
});
test('no time when the goal is paid for or nothing comes in', () => {
  assert.equal(readyIn(500, 500, 3), null);
  assert.equal(readyIn(10, 500, 0), null);
  assert.equal(readyWords(readyIn(10, 500, 0)), '');
});
test('the ready words are plain', () => {
  for (const s of [30, 75, 600, 3599, 5000, 40000]) assert.deepEqual(textIssues(readyWords(s)), [], readyWords(s));
});
test('the earn rate follows the empire over the last minute and starts over after a charter', () => {
  const g = newGame('save1', 'gulch'), hist = [];
  let lifetime = 0;
  Object.defineProperty(g, 'earned', { get: () => lifetime, configurable: true });
  for (let s = 0; s <= 4 * 120; s++) { g.stats.steps = s; lifetime = s * .25 * 3; earnRate(g, hist); }
  assert.ok(Math.abs(earnRate(g, hist) - 3) < 1e-6, 'three coins a second');
  assert.ok(hist[hist.length - 1][0] - hist[0][0] <= EARN_WINDOW + .25, 'only the last minute');
  lifetime = 0; g.stats.steps++;
  assert.equal(earnRate(g, hist), 0, 'a drop in coins earned starts the rate over');
});
