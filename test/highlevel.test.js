// Past the second fork's level a tower's coin price grows slower (HIGH_LEVEL in src/data/towers.js, PLAN.md M6a): up to
// level 20 each level costs PER_LEVEL.coins times the last, after it HIGH_LEVEL.coins times, so a few towers pushed past
// their fork (the min-max way) are not a trap. Goods keep their own growth.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../src/core/setup.js';
import { towerCost } from '../src/core/defense.js';
import { PER_LEVEL, HIGH_LEVEL, FORK_LEVEL } from '../src/data/towers.js';

const ratio = (t, kind, L, part) => {
  const a = towerCost(t, kind, L), b = towerCost(t, kind, L + 1);
  return part === 'coins' ? b.coins / a.coins : Object.values(b.goods)[0] / Object.values(a.goods)[0];
};

test('the slower growth starts at the fork level', () => {
  assert.equal(HIGH_LEVEL.from, FORK_LEVEL);
  assert.ok(HIGH_LEVEL.coins < PER_LEVEL.coins);
});

test('coins grow 1.55 a level up to level 20 and 1.45 after it, goods 1.35 all the way', () => {
  const t = newGame('high', 'gulch').town;
  for (const kind of ['crossbow', 'cannon', 'frost', 'still']) {
    for (const L of [5, 12, 18]) assert.ok(Math.abs(ratio(t, kind, L, 'coins') - PER_LEVEL.coins) < .01, `${kind} ${L}`);
    for (const L of [20, 22, 26]) assert.ok(Math.abs(ratio(t, kind, L, 'coins') - HIGH_LEVEL.coins) < .01, `${kind} ${L}`);
    for (const L of [10, 22]) assert.ok(Math.abs(ratio(t, kind, L, 'goods') - PER_LEVEL.goods) < .02, `${kind} goods ${L}`);
  }
});

test('a level-26 tower costs much less than it did with one rate all the way', () => {
  const t = newGame('high', 'gulch').town, now = towerCost(t, 'cannon', 26).coins, at20 = towerCost(t, 'cannon', 20).coins;
  assert.ok(Math.abs(now / at20 - HIGH_LEVEL.coins ** 6) < .01);
  assert.ok(now < at20 * PER_LEVEL.coins ** 6 * .7);
});
