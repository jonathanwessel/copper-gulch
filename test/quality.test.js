// Graphics quality: Auto steps up when frames have room as well as down when they are slow, never back onto a rung it
// had to leave, and old saved settings (before the pixel ratio was kept) still load (sharper models, owner 2026-11-22).
import test from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), clear: () => store.clear() } });
Object.defineProperty(globalThis, 'screen', { configurable: true, value: { width: 400, height: 860 } });
const Q = await import('../src/render/quality.js');
const { RUNGS, TIERS, rungOf, nextRung, FrameWatch, loadQuality, saveQuality } = Q;

const feed = (w, ms, seconds) => { const out = []; for (let t = 0; t < seconds; t += ms / 1000) { const m = w.push(ms / 1000); if (m) out.push(m); } return out; };

test('a phone starts on med at ratio 1.5 with the edge pass, sharper than before', () => {
  store.clear();
  const q = loadQuality();
  assert.equal(q.tier, 'med'); assert.equal(q.auto, true); assert.equal(q.ratio, 1.5); assert.equal(q.ceil, RUNGS.length - 1);
  assert.ok(TIERS.med.fxaa && TIERS.med.ratio > 1.35);
});

test('rungs go from cheapest to dearest and each tier and ratio finds its rung', () => {
  assert.equal(rungOf('low', 1), 0);
  assert.equal(rungOf('med', 1.5), 1);
  assert.equal(rungOf('med', 1.75), 2);
  assert.equal(rungOf('med', 2), 3);
  assert.equal(rungOf('high', 2), 4);
  assert.equal(rungOf('med', 1.6), 1, 'between rungs: the one under it');
  assert.equal(rungOf('med', 1.35), 1, 'under every med rung: the lowest med rung');
});

test('frames with room step up after 10 seconds, slow ones step down', () => {
  const w = new FrameWatch();
  assert.deepEqual(feed(w, 16, 11), [], 'not before 2 s of settling and 5 quick checks');
  assert.deepEqual(feed(w, 16, 2), ['up']);
  const s = new FrameWatch();
  assert.deepEqual(feed(s, 50, 9), ['down']);
  const mid = new FrameWatch();
  assert.deepEqual(feed(mid, 30, 60), [], 'between the two limits nothing moves');
});

test('right after a step up a smaller slowdown steps back', () => {
  const w = new FrameWatch();
  feed(w, 16, 12.1);
  assert.equal(w.trial, 6, 'on trial after the step up');
  assert.deepEqual(feed(w, 30, 7), ['down'], '30 ms frames on trial go back down');
});

test('a step down puts the ceiling under the rung it left, so Auto never bounces', () => {
  assert.deepEqual(nextRung(1, 'up', 4), { rung: 2, ceil: 4 });
  assert.deepEqual(nextRung(2, 'down', 4), { rung: 1, ceil: 1 });
  assert.equal(nextRung(1, 'up', 1), null, 'the rung it left is not tried again');
  assert.equal(nextRung(4, 'up', 4), null);
  assert.equal(nextRung(0, 'down', 4), null);
});

test('old saved settings load, and a hand-picked tier keeps its own ratio', () => {
  store.clear(); store.set('cg-gfx', JSON.stringify({ tier: 'med', auto: true }));
  assert.deepEqual(loadQuality(), { tier: 'med', auto: true, ratio: 1.5, ceil: RUNGS.length - 1 });
  saveQuality({ tier: 'med', auto: true, ratio: 1.75, ceil: 2 });
  assert.deepEqual(loadQuality(), { tier: 'med', auto: true, ratio: 1.75, ceil: 2 });
  store.set('cg-gfx', JSON.stringify({ tier: 'low', auto: false, ratio: 2 }));
  assert.equal(loadQuality().ratio, 1);
  store.set('cg-gfx', 'not json');
  assert.equal(loadQuality().tier, 'med');
});
