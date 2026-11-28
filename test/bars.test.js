// Clarity fix 8y: two raiders' health bars that would touch on screen are stacked with a gap, so two bars side by side
// never read as one long bar; a far bar keeps its place and a crowd stacks only a few high.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { barLift, BAR_GAP, BAR_STACK } from '../src/render/bar-plan.js';

const place = bars => {
  const px = [], py = [], pw = [], ph = [], out = [];
  for (const [x, y, w, h] of bars) { const l = barLift(x, y, w, h, px.length, px, py, pw, ph); px.push(x); py.push(y + l); pw.push(w); ph.push(h); out.push(l); }
  return out;
};
const touch = (a, b) => Math.abs(a[0] - b[0]) < (a[2] + b[2]) / 2 + BAR_GAP && Math.abs(a[1] - b[1]) < (a[3] + b[3]) / 2 + BAR_GAP;

test('two bars side by side get a gap, the far one stays put', () => {
  const bars = [[0, 1, .61, .1], [.62, 1, .61, .1]], l = place(bars);
  assert.equal(l[0], 0);
  assert.ok(l[1] > 0, 'the nearer bar rises');
  assert.ok(!touch(bars[0], [bars[1][0], bars[1][1] + l[1], .61, .1]), 'and no longer touches');
});
test('bars apart are left alone', () => {
  assert.deepEqual(place([[0, 1, .61, .1], [2, 1, .61, .1], [0, 3, .61, .1]]), [0, 0, 0]);
});
test('a crowd stacks only a few bars high', () => {
  const l = place(Array.from({ length: 12 }, (_, i) => [i * .05, 1, .61, .1]));
  assert.ok(Math.max(...l) <= (BAR_STACK - 1) * (.1 + BAR_GAP) * 1.5 + 1e-9, String(Math.max(...l)));
  assert.ok(new Set(l.map(x => x.toFixed(3))).size >= BAR_STACK, 'several heights');
});

// Clarity fix 8aa: bars side by side narrow over their own raiders instead of stepping up and to the side.
import { barPlan, BAR_NARROW } from '../src/render/bar-plan.js';
const drawn = (bars, plan) => bars.map(([x, y, w, h], i) => [x, y + plan[i].lift, w * plan[i].s, h]);
test('three raiders in a row keep each bar over its own raider, none touching', () => {
  const bars = [[0, 1, .61, .1], [.4, 1, .61, .1], [.8, 1, .61, .1]], plan = barPlan(bars), d = drawn(bars, plan);
  assert.deepEqual(plan.map(p => p.lift), [0, 0, 0], 'no bar rises');
  assert.ok(plan.every(p => p.s >= BAR_NARROW && p.s < 1), JSON.stringify(plan));
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) assert.ok(!touch(d[i], d[j]), i + ' ' + j);
});
test('raiders almost on top of each other still stack, and apart they keep full bars', () => {
  const bars = [[0, 1, .61, .1], [.05, 1, .61, .1]], plan = barPlan(bars), d = drawn(bars, plan);
  assert.ok(plan[1].lift > 0 && !touch(d[0], d[1]));
  assert.deepEqual(barPlan([[0, 1, .61, .1], [2, 1, .61, .1]]).map(p => [p.s, p.lift]), [[1, 0], [1, 0]]);
});
