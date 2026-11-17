// The core: seeded streams, fixed steps, the bus, named multipliers with caps, towns, saves and the game loop.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rng, hashSeed } from '../src/core/rng.js';
import { Clock, STEP, OFFLINE_FINE, OFFLINE_MAX } from '../src/core/clock.js';
import { Bus } from '../src/core/events.js';
import { Mods, CAPS } from '../src/core/mods.js';
import { Town } from '../src/core/town.js';
import { encode, decode, migrate, SAVE_VERSION } from '../src/core/save.js';
import { Game } from '../src/core/game.js';

test('rng: same seed, same stream; different seeds differ; state restores', () => {
  const a = new Rng('gulch'), b = new Rng('gulch'), c = new Rng('ridge');
  const xa = Array.from({ length: 50 }, () => a.next()), xb = Array.from({ length: 50 }, () => b.next());
  assert.deepEqual(xa, xb);
  assert.notDeepEqual(xa, Array.from({ length: 50 }, () => c.next()));
  const s = a.state, more = [a.next(), a.next()], r = Rng.from(s);
  assert.deepEqual([r.next(), r.next()], more);
  assert.notEqual(hashSeed('a'), hashSeed('b'));
});

test('rng: values stay in range and spread evenly', () => {
  const r = new Rng(7), bins = new Array(10).fill(0);
  for (let i = 0; i < 20000; i++) { const x = r.next(); assert.ok(x >= 0 && x < 1); bins[Math.floor(x * 10)]++; }
  for (const n of bins) assert.ok(n > 1700 && n < 2300, 'bin ' + n);
  for (let i = 0; i < 1000; i++) { const k = r.int(6); assert.ok(Number.isInteger(k) && k >= 0 && k < 6); }
  const w = { a: 1, b: 3 }, cnt = { a: 0, b: 0 };
  for (let i = 0; i < 8000; i++) cnt[r.weighted(w)]++;
  assert.ok(Math.abs(cnt.b / cnt.a - 3) < .35, JSON.stringify(cnt));
});

test('rng: a fork does not move its parent and is its own stream', () => {
  const a = new Rng(3), b = new Rng(3);
  const f = a.fork('waves');
  assert.equal(a.next(), b.next());
  assert.notEqual(f.next(), new Rng(3).fork('market').next());
});

test('clock: whole fixed steps, the remainder kept, long frames clamped', () => {
  const c = new Clock(); let n = 0;
  assert.equal(c.advance(0.6, () => n++), 2);
  assert.ok(Math.abs(c.bank - 0.1) < 1e-9);
  c.advance(0.15, () => n++); assert.equal(n, 3);
  c.advance(30, () => n++); assert.equal(n, 3 + 4); // one frame feeds at most a second
  assert.ok(Math.abs(c.t - 7 * STEP) < 1e-9);
});

test('clock: catch-up steps the first stretch finely, then in coarse chunks, up to a day', () => {
  const c = new Clock(); let fine = 0, coarse = 0, coarseSec = 0;
  const r = c.catchUp(3600, () => fine++, dt => { coarse++; coarseSec += dt; }, 60);
  assert.equal(fine, OFFLINE_FINE / STEP);
  assert.ok(Math.abs(coarseSec - (3600 - OFFLINE_FINE)) < 1e-6);
  assert.equal(r.coarse, coarse);
  const r2 = new Clock().catchUp(10 * 86400, () => {}, () => {}, 600);
  assert.equal(r2.seconds, OFFLINE_MAX);
});

test('bus: on, once, off and the * listener, in order', () => {
  const b = new Bus(), got = [];
  const off = b.on('x', d => got.push('a' + d));
  b.once('x', d => got.push('b' + d));
  b.on('*', (n, d) => got.push('*' + n + d));
  b.emit('x', 1); b.emit('x', 2); off(); b.emit('x', 3);
  assert.deepEqual(got, ['a1', 'b1', '*x1', 'a2', '*x2', '*x3']);
});

test('mods: named sources multiply and add, explain lists every part', () => {
  const m = new Mods();
  m.set('prod', 'research:saw', { mul: 1.2 });
  m.set('prod', 'deeds', { mul: 1.5 });
  m.set('prod', 'foreman', { add: 1 });
  const e = m.explain('prod', 2);
  assert.deepEqual(e.parts.map(p => p.source), ['deeds', 'foreman', 'research:saw']);
  assert.ok(Math.abs(e.value - 3 * 1.8) < 1e-9);
  assert.equal(e.capped, false);
  m.set('prod', 'deeds', { mul: 1 }); m.remove('prod', 'foreman'); // factor 1 removes a source
  assert.ok(Math.abs(m.factor('prod') - 1.2) < 1e-9);
  m.clear('research:');
  assert.equal(m.factor('prod'), 1);
});

test('mods: every stat has a published cap and the total stays inside it', () => {
  const m = new Mods();
  m.set('towerRate', 'a', { mul: 10 });
  assert.equal(m.factor('towerRate'), CAPS.towerRate.max);
  assert.equal(m.explain('towerRate').capped, true);
  m.set('cost', 'a', { mul: .001 });
  assert.equal(m.factor('cost'), CAPS.cost.min);
  assert.throws(() => m.set('made-up', 'a', { mul: 2 }), /No published cap/);
});

test('town: earn, spend, goods, and a JSON round trip that keeps the random stream', () => {
  const t = new Town('gulch', { seed: 's' });
  t.earn(100); assert.equal(t.spend(30), true); assert.equal(t.spend(1000), false);
  assert.equal(t.coins, 70); assert.equal(t.lifetime, 100);
  t.addGood('timber', 5); t.addGood('timber', -9); assert.equal(t.goods.timber, 0);
  t.mods.set('prod', 'x', { mul: 2 }); t.rng.next();
  const u = Town.fromJSON(JSON.parse(JSON.stringify(t.toJSON())));
  assert.deepEqual(u.toJSON(), t.toJSON());
  assert.equal(u.rng.next(), t.rng.next());
  assert.equal(u.mods.factor('prod'), 2);
});

// a toy system: a mine that makes ore and a market that sells it at a random price
const toy = {
  id: 'toy',
  init(t) { t.goods.ore = 0; },
  step(t, dt) { t.addGood('ore', dt * t.mods.value('prod', 1)); if (t.goods.ore >= 5) { t.earn(t.goods.ore * t.rng.range(1, 2)); t.goods.ore = 0; } },
  coarse(t, dt) { t.earn(dt * 1.5); },
};

test('game: the same seed and inputs give the same game, step for step', () => {
  const run = () => { const g = new Game({ seed: 'det', systems: [toy] }); g.addTown('gulch'); for (let i = 0; i < 200; i++) g.advance(1 / 60 * (1 + (i % 3))); return g.toJSON(); };
  assert.deepEqual(run(), run());
  const g = new Game({ seed: 'other', systems: [toy] }); g.addTown('gulch'); for (let i = 0; i < 200; i++) g.advance(1 / 60 * (1 + (i % 3)));
  assert.notDeepEqual(g.toJSON().towns.gulch.rng, run().towns.gulch.rng);
});

test('game: a save loads and continues exactly like the original', () => {
  const g = new Game({ seed: 'save', systems: [toy] }); g.addTown('gulch');
  for (let i = 0; i < 100; i++) g.advance(.1);
  const text = encode(g, 1234), s = decode(text);
  assert.equal(s.v, SAVE_VERSION); assert.equal(s.at, 1234);
  const h = Game.fromJSON(s.game, { systems: [toy] });
  for (let i = 0; i < 100; i++) { g.advance(.1); h.advance(.1); }
  assert.deepEqual(h.toJSON(), g.toJSON());
});

test('game: catch-up earns while away and reports it', () => {
  const g = new Game({ seed: 'away', systems: [toy] }); g.addTown('gulch');
  const r = g.catchUp(2 * 3600);
  assert.ok(r.earned.gulch > 0);
  assert.equal(r.fine, OFFLINE_FINE / STEP);
  assert.ok(Math.abs(g.clock.t - 2 * 3600) < 1e-6);
});

test('save: old shapes migrate, newer and damaged saves are refused', () => {
  const bare = { seed: 'x', towns: {} };
  assert.deepEqual(migrate(bare), { v: 1, at: 0, game: bare });
  assert.throws(() => migrate({ v: SAVE_VERSION + 1, game: {} }), /newer version/);
  assert.throws(() => decode('{nope'), /damaged/);
});
