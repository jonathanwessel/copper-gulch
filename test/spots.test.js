// Map labels sit beside their towns, not on them (M6a, two fresh-eyes reviews of 2026.11.21-5: on a phone the labels
// covered the Capital, the falls and most of Iron Ridge).
import test from 'node:test';
import assert from 'node:assert/strict';
import { spotBadges, coverShare, badgeBox, gapTo } from '../src/ui/map.js';

const box = (l, t, r, b) => ({ l, t, r, b, x: (l + r) / 2, y: (t + b) / 2 });
const hits = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;

test('a lone label goes beside its town and covers none of it', () => {
  const boxes = { ridge: box(150, 300, 250, 380) }, rs = [{ id: 'ridge', x: 200, y: 320, w: 120, h: 24 }];
  spotBadges(rs, boxes, { W: 400, H: 800 });
  assert.equal(coverShare(badgeBox(rs[0]), boxes.ridge), 0);
});

test('towns stacked up a phone: no label covers a third of its own town or any town\'s middle', () => {
  // the home view on a phone: towns in a column, labels wider than the towns
  const boxes = { pinehollow: box(230, 200, 330, 270), ridge: box(200, 320, 300, 390), capital: box(205, 395, 265, 430), falls: box(240, 470, 330, 560), gulch: box(30, 420, 150, 560) };
  const rs = Object.keys(boxes).map(id => ({ id, x: boxes[id].x, y: boxes[id].t + 20, w: 130, h: 24 }));
  spotBadges(rs, boxes, { W: 400, H: 860, avoid: [{ l: 0, t: 0, r: 400, b: 90 }] });
  for (const r of rs) {
    assert.ok(coverShare(badgeBox(r), boxes[r.id], 400, 860) <= 1 / 3, r.id + ' covers ' + coverShare(badgeBox(r), boxes[r.id]));
    for (const [id, q] of Object.entries(boxes)) { const m = badgeBox(r); assert.ok(!(q.x > m.l && q.x < m.r && q.y > m.t && q.y < m.b), r.id + ' covers the middle of ' + id); }
    assert.ok(badgeBox(r).t >= 90, r.id + ' under the top bar');
  }
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) assert.ok(!hits(badgeBox(rs[i]), badgeBox(rs[j])), rs[i].id + ' and ' + rs[j].id + ' overlap');
});

test('a label keeps its side while the map moves a little', () => {
  const last = {}, boxes = { gulch: box(150, 300, 250, 380) }, r = { id: 'gulch', x: 200, y: 320, w: 120, h: 24 };
  spotBadges([r], boxes, { last });
  const side = last.gulch;
  for (let d = 1; d < 30; d += 3) {
    const q = { ...r, x: 200 + d, y: 320 + d }, b2 = { gulch: box(150 + d, 300 + d, 250 + d, 380 + d) };
    spotBadges([q], b2, { last });
    assert.equal(q.side, side);
  }
});

test('labels stay on the screen', () => {
  const boxes = { drycreek: box(-40, 600, 60, 700) }, rs = [{ id: 'drycreek', x: 10, y: 620, w: 140, h: 40 }];
  spotBadges(rs, boxes, { W: 400, H: 800 });
  const m = badgeBox(rs[0]);
  assert.ok(m.l >= 0 && m.r <= 400 && m.t >= 0 && m.b <= 800);
});

test('a label sits nearer its own place than any other, so it never reads as the wrong town (review of 2026.11.21-6)', () => {
  // a small surveyed plot just right of a big town, as Silver Falls by the Gulch's loop on a phone
  const boxes = { gulch: box(20, 420, 160, 600), falls: box(250, 500, 310, 560), ridge: box(200, 320, 300, 390), capital: box(205, 395, 265, 430) };
  const rs = Object.keys(boxes).map(id => ({ id, x: boxes[id].x, y: boxes[id].t + 10, w: 120, h: 24 }));
  spotBadges(rs, boxes, { W: 400, H: 860, avoid: [{ l: 0, t: 0, r: 400, b: 90 }] });
  for (const r of rs) {
    const me = badgeBox(r), own = gapTo(me, boxes[r.id]);
    for (const [id, q] of Object.entries(boxes)) if (id !== r.id) assert.ok(gapTo(me, q) >= own, r.id + ' sits nearer ' + id);
  }
});

// the ring, part 1c (2026-11-24): labels keep to the outside of the ring, off the middle where every spoke meets
test('a town label takes the side away from the Capital when both are free', async () => {
  const { inwardness } = await import('../src/ui/map.js');
  // a town below the Capital on screen, nothing else near: its old place over its far side points straight at the
  // Capital (seen red: with no hub the label takes it, inwardness 1)
  const hub = { x: 200, y: 250 }, boxes = { ridge: box(150, 400, 250, 460), capital: box(180, 235, 220, 265) };
  const rs = [{ id: 'ridge', x: 200, y: 400, w: 110, h: 24 }];
  spotBadges(rs, boxes, { W: 400, H: 800, hub });
  assert.ok(inwardness({ x: rs[0].x, y: rs[0].y - 12 }, boxes.ridge, hub) <= .5, 'ridge took ' + rs[0].side);
});

test('a place mostly off the screen or under the card counts as out of view', async () => {
  const { inView } = await import('../src/ui/map.js');
  assert.equal(inView(box(100, 100, 200, 200), 400, 800), 1);
  assert.equal(inView(box(-100, 100, 100, 200), 400, 800), .5);
  assert.ok(inView(box(100, 450, 200, 550), 400, 800, { l: 10, t: 480, r: 390, b: 800 }) < .5);
  assert.equal(inView(box(100, 100, 200, 200), 400, 800, { l: 10, t: 480, r: 390, b: 800 }), 1);
});
