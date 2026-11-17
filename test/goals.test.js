// The goal strip (PLAN.md M2, The first 30 minutes): one goal at a time from the first Crossbow in Dry Creek into
// Copper Gulch, done in any order, kept in the save, and finished by the careful bot within the first 40 minutes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, loadGame } from '../src/core/setup.js';
import { goalNow, goalsOf, goalContext, goalText } from '../src/core/goals.js';
import { winOutpost } from '../src/core/outpost.js';
import { buildTower } from '../src/core/defense.js';
import { build } from '../src/core/economy.js';
import { migrate, SAVE_VERSION } from '../src/core/save.js';
import { GOALS } from '../src/data/goals.js';
import { campaign, goalCheck } from '../tools/balance.js';
import { textIssues } from '../tools/audit.js';

const step = (g, n = 1) => { for (let i = 0; i < n; i++) g.step(.25); };
const rich = t => { t.coins = 1e6; for (const k of Object.keys(t.goods)) t.goods[k] = 1e4; t.goods.stone = 1e4; t.goods.ore = 1e4; };

test('a new game shows the first Crossbow goal, and building one moves the strip on', () => {
  const g = newGame('goal1'), t = g.town;
  assert.equal(goalNow(g).id, 'dc-tower');
  assert.deepEqual(goalNow(g).at(goalContext(g, t)), { spot: 0 });
  rich(t);
  const seen = []; g.bus.on('goal:done', e => seen.push(e.id));
  assert.ok(buildTower(g, t, 0, 'crossbow'));
  step(g);
  assert.deepEqual(seen, ['dc-tower']);
  assert.equal(goalNow(g).id, 'dc-stone2');
  assert.deepEqual(goalNow(g).at(goalContext(g, t)), { plot: 'quarry' });
});

test('goals count in any order, and a goal that is not ready yet is passed over', () => {
  const g = newGame('goal2'), t = g.town;
  rich(t);
  build(g, t, 'quarry'); build(g, t, 'quarry'); // the Stone Camp to level 2 before any tower
  step(g);
  assert.equal(goalNow(g).id, 'dc-tower');
  assert.ok(g.shared.goals.done['dc-stone2']);
  buildTower(g, t, 0, 'crossbow'); step(g);
  assert.equal(goalNow(g).id, 'dc-mine', 'skips the Stone Camp goal already done');
  // Go to Copper Gulch waits for the win
  assert.ok(!GOALS.find(x => x.id === 'dc-go').ready(goalContext(g, t)));
});

test('winning Dry Creek asks for Copper Gulch, and going there finishes Dry Creek and starts the Gulch goals', () => {
  const g = newGame('goal3'), t = g.town;
  for (const x of goalsOf('drycreek')) if (!['dc-win', 'dc-go'].includes(x.id)) g.shared.goals.done[x.id] = true;
  assert.equal(goalNow(g).id, 'dc-win');
  winOutpost(g, t); step(g);
  assert.equal(goalNow(g).id, 'dc-go');
  assert.deepEqual(goalNow(g).at(goalContext(g, t)), { el: '#townChip [data-town="gulch"]' });
  g.go('gulch'); step(g);
  assert.ok(g.shared.goals.done['dc-go']);
  assert.equal(goalNow(g).id, 'g-tower');
  g.go('drycreek');
  assert.equal(goalNow(g), null, 'every Dry Creek goal is done');
});

test('the Mortar goal waits until the Mortar opens, and points at a free Mortar pit', () => {
  const g = newGame('goal4', 'gulch'), t = g.town;
  for (const x of goalsOf('gulch')) if (x.id !== 'g-mortar') g.shared.goals.done[x.id] = true;
  assert.equal(goalNow(g), null);
  t.flags['open:mortar'] = true;
  assert.equal(goalNow(g).id, 'g-mortar');
  assert.deepEqual(goalNow(g).at(goalContext(g, t)), { spot: t.def.board.far });
});

test('the save keeps the goals done, and save v10 skips them for a game already under way', () => {
  const g = newGame('goal5'), t = g.town;
  rich(t); buildTower(g, t, 0, 'crossbow'); step(g);
  const back = loadGame(JSON.parse(JSON.stringify(g.toJSON())));
  assert.ok(back.shared.goals.done['dc-tower']);
  assert.equal(goalNow(back).id, 'dc-stone2');
  assert.ok(SAVE_VERSION >= 10);
  // a v9 game in the Gulch, before its first war wagon: Dry Creek's goals are done, the Gulch's still show
  const early = migrate({ v: 9, at: 0, game: { towns: { gulch: { id: 'gulch', bestWave: 4 } }, shared: {} } });
  assert.equal(early.v, SAVE_VERSION);
  for (const x of goalsOf('drycreek')) assert.ok(early.game.shared.goals.done[x.id]);
  assert.equal(early.game.shared.goals.off, false);
  // past wave 10, or after a charter: no goals at all
  const late = migrate({ v: 9, at: 0, game: { towns: { gulch: { id: 'gulch', bestWave: 14 } }, shared: {} } });
  assert.equal(late.game.shared.goals.off, true);
  const signed = migrate({ v: 9, at: 0, game: { towns: { gulch: { id: 'gulch', bestWave: 2 } }, shared: { charter: { signed: 1 } } } });
  assert.equal(signed.game.shared.goals.off, true);
  // a v9 game still in Dry Creek keeps every goal
  const fresh = migrate({ v: 9, at: 0, game: { towns: { drycreek: { id: 'drycreek' } }, shared: {} } });
  assert.deepEqual(fresh.game.shared.goals.done, {});
});

test('the first Crossbow goal says what to wait for until a Crossbow can be paid', () => {
  const g = newGame('goalwait', 'gulch'), t = g.town, gl = goalNow(g);
  assert.equal(gl.id, 'g-tower');
  t.coins = 15; t.goods.timber = 5;
  assert.equal(goalText(g, t, gl), 'Wait for 5 more coins and 3 more timber, then tap a stone pad');
  t.coins = 20;
  assert.equal(goalText(g, t, gl), 'Wait for 3 more timber, then tap a stone pad');
  assert.deepEqual(textIssues(goalText(g, t, gl)), []);
  t.coins = 20; t.goods.timber = 8;
  assert.equal(goalText(g, t, gl), 'Tap a stone pad and build a Crossbow');
  const d = newGame('goalwait2'); d.town.coins = 0;
  assert.match(goalText(d, d.town, goalNow(d)), /^Wait for \d+ more coins and \d+ more stone, then tap a stone pad$/);
});

test('goal text is short and follows the writing rule', () => {
  const ids = new Set();
  for (const x of GOALS) {
    assert.ok(!ids.has(x.id), 'one id each'); ids.add(x.id);
    assert.ok(x.text.length <= 48, x.id + ' fits the strip on a phone');
    assert.ok(!/[:;.]/.test(x.text), x.id + ' has no colon, semicolon or period');
    assert.deepEqual(textIssues(x.text), []);
  }
});

test('the careful bot finishes every goal within the first 40 minutes', () => {
  const camps = [1, 2].map(s => campaign(s, 'active', 30));
  const { misses } = goalCheck(camps);
  assert.deepEqual(misses, []);
});
