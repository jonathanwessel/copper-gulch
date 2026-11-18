// One purse for the empire (owner decision, 2026-11-17): every town and outpost earns into the same coins and spends
// from them, a charter never touches them, and save v12 adds up the old per-town coins.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, loadGame } from '../src/core/setup.js';
import { encode, decode, migrate, SAVE_VERSION } from '../src/core/save.js';
import { build } from '../src/core/economy.js';
import { foundTown } from '../src/core/empire.js';
import { winOutpost } from '../src/core/outpost.js';
import { signCharter } from '../src/core/charter.js';
import { DEEDS } from '../src/data/perks.js';

const run = (g, seconds) => { for (let i = 0; i < seconds * 4; i++) g.step(.25); };

test('every town reads and spends the same coins', () => {
  const g = newGame('p1'), d = g.town;
  winOutpost(g, d);
  const gu = g.towns.gulch;
  assert.equal(d.coins, gu.coins);
  gu.coins = 1000;
  assert.equal(d.coins, 1000, 'one purse');
  assert.ok(build(g, gu, 'camp'));
  assert.ok(d.coins < 1000, 'a Gulch purchase spends what Dry Creek sees');
  assert.equal(g.shared.purse.coins, d.coins);
  assert.equal(Object.keys(gu.toJSON()).includes('coins'), false, 'a town does not save coins of its own');
});

test('a new town brings its start coins once; signing its charter keeps the purse', () => {
  const g = newGame('p2', 'gulch'), t = g.town;
  assert.equal(t.coins, t.def.start.coins);
  t.coins = 5e4; t.bestWave = DEEDS.wave; t.lifetime = DEEDS.coins;
  assert.ok(signCharter(g, t) > 0);
  assert.equal(t.coins, 5e4, 'no reset, no start coins again');
  assert.equal(t.lifetime, 0, 'what the town earned starts again (deeds count it)');
});

test('founding pays from the purse, and every town after it shares it', () => {
  const g = newGame('p3', 'gulch'), G = g.town;
  G.bestWave = 20; G.coins = 2e4;
  const r = foundTown(g, 'ridge');
  assert.ok(r);
  assert.equal(r.coins, G.coins);
  assert.equal(g.towns.pinehollow.coins, G.coins);
  run(g, 30);
  const sum = Object.values(g.towns).reduce((s, t) => s + t.lifetime, 0);
  assert.ok(Math.abs(g.earned - sum) < 1e-6, 'game.earned adds up every town');
});

test('the purse survives a save and load, and the loaded towns share it', () => {
  const g = newGame('p4', 'gulch');
  winOutpost(g, g.towns.drycreek || g.addTown('drycreek')); g.town.coins = 777;
  const back = loadGame(decode(encode(g, 1)).game);
  assert.equal(back.town.coins, 777);
  back.town.coins = 5;
  for (const t of Object.values(back.towns)) assert.equal(t.coins, 5);
});

test('save v12: the old per-town coins are added into one purse', () => {
  assert.ok(SAVE_VERSION >= 12);
  const old = { v: 11, at: 0, game: { shared: {}, towns: { drycreek: { id: 'drycreek', coins: 30 }, gulch: { id: 'gulch', coins: 1200 }, ridge: { id: 'ridge', coins: 70 } } } };
  const s = migrate(old);
  assert.deepEqual(s.game.shared.purse, { coins: 1300 });
  for (const t of Object.values(s.game.towns)) { assert.equal(t.coins, undefined); assert.equal(t.recent, 0); }
});

test('recent earnings fade over about five minutes', () => {
  const g = newGame('p5', 'gulch'), t = g.town;
  t.buildings = {}; t.recent = 1000;
  run(g, 300);
  assert.ok(t.recent > 300 && t.recent < 420, 'about a third after 5 minutes: ' + t.recent);
});
