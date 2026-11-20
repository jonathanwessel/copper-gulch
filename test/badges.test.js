// Map badges never cover each other (the 2026.11.18-15 screenshots had the labels round the Capital piled up).
import test from 'node:test';
import assert from 'node:assert/strict';
import { liftBadges } from '../src/ui/map.js';

const overlap = (a, b) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 && a.y > b.y - b.h && a.y - a.h < b.y;

test('badges that would overlap are lifted, the lowest keeps its place', () => {
  const rs = [{ x: 200, y: 300, w: 90, h: 40 }, { x: 220, y: 310, w: 90, h: 40 }, { x: 180, y: 295, w: 80, h: 40 }];
  liftBadges(rs);
  assert.equal(rs[1].y, 310); // the lowest on screen (the nearest town) stays
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) assert.ok(!overlap(rs[i], rs[j]), `${i} and ${j} overlap`);
  for (const r of rs) assert.ok(r.y <= 310);
});

test('badges side by side are left alone', () => {
  const rs = [{ x: 100, y: 300, w: 80, h: 40 }, { x: 200, y: 300, w: 80, h: 40 }];
  liftBadges(rs);
  assert.deepEqual(rs.map(r => r.y), [300, 300]);
});

test('a badge lifted over one is lifted again over the next', () => {
  const rs = [{ x: 0, y: 100, w: 50, h: 20 }, { x: 0, y: 78, w: 50, h: 20 }, { x: 0, y: 99, w: 50, h: 20 }];
  liftBadges(rs);
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) assert.ok(!overlap(rs[i], rs[j]));
});

test('a badge that would be lifted under the top bar goes below instead', () => {
  const rs = [{ x: 100, y: 90, w: 80, h: 40 }, { x: 110, y: 70, w: 80, h: 40 }];
  liftBadges(rs, [{ l: 0, r: 400, b: 48 }]);
  assert.equal(rs[0].y, 90);
  assert.ok(rs[1].y - rs[1].h >= 90, 'moved below the badge it met');
  assert.ok(!overlap(rs[0], rs[1]));
});

test('a badge whose town is under the top bar sits just below it', () => {
  const rs = [{ x: 100, y: 30, w: 80, h: 40 }];
  liftBadges(rs, [{ l: 0, r: 400, b: 48 }]);
  assert.equal(rs[0].y, 90);
});

test('the open card\'s badge keeps its place over its town and the others move round it', () => {
  const sel = { x: 200, y: 280, w: 90, h: 40 }, rs = [{ x: 210, y: 300, w: 90, h: 40 }, sel];
  liftBadges(rs, [], 2, { first: sel });
  assert.deepEqual([sel.x, sel.y], [200, 280]);
  assert.ok(!overlap(rs[0], rs[1]));
});

test('a badge slides sideways when that moves it less than a lift (review of 2026.11.19-11)', () => {
  const rs = [{ x: 200, y: 300, w: 100, h: 40 }, { x: 270, y: 300, w: 100, h: 40 }];
  liftBadges(rs, [], 2, { W: 800 });
  assert.equal(rs[1].y, 300); // not lifted off its town
  assert.ok(rs[1].x >= 302 && rs[1].x <= 330, 'slid right beside it: ' + rs[1].x);
  assert.ok(!overlap(rs[0], rs[1]));
});

test('a slide never pushes a badge off the screen', () => {
  const rs = [{ x: 700, y: 300, w: 100, h: 40 }, { x: 740, y: 300, w: 100, h: 40 }];
  liftBadges(rs, [], 2, { W: 800 });
  for (const r of rs) assert.ok(r.x + r.w / 2 <= 800);
  assert.ok(!overlap(rs[0], rs[1]));
});
