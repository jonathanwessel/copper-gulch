// The idle bot's own parts (tools/idle.js, M4): leaving switches every open switch on and resumes held towns, and the
// purse meter files every coin spent under who spent it, with the share of the coins on hand it took.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../src/core/setup.js';
import { foundTown } from '../src/core/empire.js';
import { foundCapital } from '../src/core/capital.js';
import { foundInstitution } from '../src/core/tree.js';
import { buildTower, setHold } from '../src/core/defense.js';
import { build } from '../src/core/economy.js';
import { autoOn } from '../src/core/automation.js';
import { CAPITAL_DEF } from '../src/data/capital.js';
import { leave, meter, idleCheck, trade, ceiling, BLOCK, TRADE_HOLD } from '../tools/idle.js';
import { GOODS } from '../src/data/goods.js';

function empire(seed, inst = ['war', 'university']) {
  const g = newGame(seed, 'gulch'), gu = g.town;
  gu.bestWave = 20; gu.coins = 1e9;
  foundTown(g, 'ridge'); g.active = 'gulch';
  for (const t of Object.values(g.towns)) if (t.waves) t.waves.hold = true;
  g.towns.ridge.bestWave = CAPITAL_DEF.found.wave;
  foundCapital(g);
  for (const id of inst) foundInstitution(g, id);
  return g;
}

test('leaving turns every open switch on in every town and resumes held waves, but leaves a lost boss to Keep trying the boss', () => {
  const g = empire('i1', ['war']), gu = g.towns.gulch, rt = g.towns.ridge;
  rt.waves.hold = true; rt.waves.autoHold = true; rt.lost = { why: 'boss', wave: 10, back: 8, coins: 0, at: 0, away: true };
  assert.deepEqual(leave(g), ['towers', 'retry'], 'Auto-research waits for the University');
  for (const t of [gu, rt]) assert.ok(autoOn(g, t, 'towers') && autoOn(g, t, 'retry') && !autoOn(g, t, 'research'));
  assert.equal(gu.waves.hold, false, 'held by hand: resumed');
  assert.equal(rt.waves.hold, true, 'a lost boss waits for a stronger tower');
});

test('the meter files Auto-towers buys with their share of the purse, and stop puts the purse back', () => {
  const g = empire('i2'), t = g.towns.gulch;
  for (const k of ['timber', 'ore', 'copper', 'bricks', 'tools', 'planks', 'clay']) { t.goods[k] = 1e6; t.sell[k] = false; }
  assert.ok(buildTower(g, t, 2, 'crossbow'));
  t.coins = 5000; leave(g); setHold(g, t, true);
  const m = meter(g);
  g.step(.25);
  assert.equal(m.buys.towers.n, 1, 'Auto-towers raised the Crossbow');
  assert.ok(m.buys.towers.top > 0 && m.buys.towers.top <= .5 + 1e-9);
  assert.equal(m.top.kind, 'towers');
  build(g, t, 'camp'); // a tap outside any system
  assert.equal(m.buys.other.n, 1);
  const before = g.shared.purse.coins;
  m.stop();
  assert.equal(g.shared.purse.coins, before);
  g.shared.purse.coins += 1; assert.equal(t.coins, before + 1, 'the purse is a plain field again');
  assert.equal(typeof trade(g), 'number');
});

test('the idle check: the second half and the last 3 hours earn more, sales hold, and no purchase over half the coins', () => {
  const run = (incomes, share = .5, sales = incomes.map(() => 10), contracts = incomes.map(() => 0)) => ({ seed: 1, capital: 3 * 3600, hours: incomes.map((i, k) => ({ income: i, sales: sales[k], trade: sales[k] + contracts[k] })), top: { kind: 'towers', share, town: 'ridge' } });
  const up = [4, 3, 4, 3, 3, 4, 5, 3, 5, 5, 6, 5]; // a dip in the second block is fine: 21 then 29, and 11 then 16
  assert.equal(BLOCK, 3);
  assert.deepEqual(idleCheck([run(up)]), []);
  assert.equal(idleCheck([run([4, 4, 4, 3, 3, 3])]).length, 2, 'the second half and the last block earned less');
  // the careful player's last contract pays 16 in hour 1: counted, hours 1-6 (37) would beat hours 7-12 (29)
  const big = up.map((x, k) => k ? x : x + 16), paid = up.map((_, k) => k ? 0 : 16);
  assert.equal(idleCheck([run(big, .5, undefined, paid)]).length, 0, 'a contract left over is not counted');
  assert.equal(idleCheck([run(big)]).length, 2, 'the same coins from anything else are');
  assert.equal(idleCheck([run(up, .5, up.map((_, k) => k === 5 ? 10 * TRADE_HOLD - .1 : 10))]).length, 1, 'sales fell');
  assert.equal(idleCheck([run(up, .6)]).length, 1);
  assert.equal(idleCheck([{ ...run([1, 2, 3]), capital: 5 * 3600 }]).length, 1);
});

test('the market ceiling is every good price times depth, with the price bonuses', () => {
  const g = newGame('i3', 'gulch');
  const want = Object.values(GOODS).reduce((a, x) => a + x.price * x.depth, 0);
  assert.ok(Math.abs(ceiling(g) - want) < 1e-9);
});
