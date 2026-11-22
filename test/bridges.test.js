// Bridges that show the water, and a wave bar that agrees with the hold button (owner, 2026-11-22: "Shouldn't I see
// water under the bridge? Instead of a road on top of the water?", and a shot with "Wave 6 · Fighting" beside Resume
// waves). The road stops at the water's edge, each deck spans the water and a short ramp on each bank, and its posts
// stand in the water; the bar's word and the button come from one state.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOWNS } from '../src/data/towns/index.js';
import { waterCut, crossings, bridgePlan, along, RAMP } from '../src/render/bridge-plan.js';
import { polyDist, fallsRiver } from '../src/render/empire-plan.js';
import { waveBar, waveTimer } from '../src/ui/wave.js';

const boards = Object.entries(TOWNS).filter(([, T]) => T.board && T.board.river);

test('a town with a river has a bridge at every crossing, spanning the water with posts in it', () => {
  assert.ok(boards.length >= 1, 'Silver Falls has a river');
  for (const [id, T] of boards) {
    const B = T.board, river = B.river.path.concat([B.vault]), W = B.river.width || 1.1, wet = waterCut(river, W, 0);
    // every stretch of road on the water belongs to a crossing
    const onWater = along(B.road, .1).filter(([x, z]) => wet(x, z));
    const runs = crossings(B.road, river);
    assert.ok(runs.length >= 1, id + ' has a crossing');
    for (const p of onWater) assert.ok(runs.some(r => r.some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < .11)), id + ' road on the water at ' + p + ' has no bridge');
    for (const run of runs) {
      const P = bridgePlan(run, wet, { deckHalf: .5 });
      if (!P.wet) continue; // the road and the river both end at the vault: nothing to cross, no deck (src/render/board.js)
      assert.ok(P.deckHalf * 2 < 1.32, 'the deck is no wider than the road (1.32)');
      assert.ok(!wet(...P.a) && !wet(...P.b), id + ' both ends of the deck stand on the bank');
      assert.ok(P.len < 2 * RAMP + .5, id + ' the deck spans the water and a short ramp, not more (longer only where it crosses aslant) (' + P.len.toFixed(2) + ')');
      assert.ok(P.posts.length >= 2 && P.posts.every(([x, z]) => polyDist(x, z, river) < W / 2), id + ' the posts stand in the water');
      // the deck is drawn straight from end to end, so the road under it must be straight too (raiders walk the road)
      const off = Math.max(...run.map(([x, z]) => Math.abs((x - P.a[0]) * P.uz - (z - P.a[1]) * P.ux)));
      assert.ok(off < .08, id + ' the road bends under a deck by ' + off.toFixed(2));
    }
  }
});

test('the road is cut on the water and kept on the bank', () => {
  const B = TOWNS.falls.board, river = B.river.path.concat([B.vault]), W = B.river.width || 1.1, cut = waterCut(river, W);
  const pts = along(B.road, .1);
  assert.ok(pts.some(([x, z]) => cut(x, z)), 'some road lies over the water');
  for (const [x, z] of pts) {
    const d = polyDist(x, z, river);
    if (d < W / 2) assert.ok(cut(x, z), 'road on the water is cut');
    if (d > W / 2 + .1) assert.ok(!cut(x, z), 'road on the bank stays');
  }
});

test('a map route that crosses the river gets a bridge with posts in the water', () => {
  const river = fallsRiver(), [a, b] = [river.pts[2], river.pts[3]];
  const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
  const route = [[mx - dz / L * 3, mz + dx / L * 3], [mx + dz / L * 3, mz - dx / L * 3]]; // straight across
  const wet = waterCut(river.pts, river.width, 0), runs = crossings(route, river.pts, river.width / 2 + .18, .05);
  assert.equal(runs.length, 1);
  const P = bridgePlan(runs[0], wet, { deckHalf: .4, gap: .35 });
  assert.ok(P.posts.length >= 2 && P.posts.every(([x, z]) => wet(x, z)));
  assert.ok(!wet(...P.a) && !wet(...P.b));
});

test('the wave bar says On hold exactly when the button says Resume waves', () => {
  for (const phase of ['break', 'wave']) for (const hold of [false, true]) {
    const ws = { phase, hold, timer: 20, queue: [], foes: [] }, bar = waveBar(ws);
    assert.equal(bar.word === 'On hold', hold, phase + ' ' + hold);
    assert.equal(bar.button === 'Resume waves', hold);
    assert.equal(bar.word, waveTimer(ws));
  }
  assert.equal(waveBar({ phase: 'wave', hold: false }).word, 'Fighting');
  assert.equal(waveBar({ phase: 'wave', hold: true }).word, 'On hold'); // raiders still on the road, the next wave held
});

test('raiders rise only on a deck: the lift measures from the river path, never the leg into the vault', () => {
  for (const [id, T] of boards) {
    const B = T.board, full = B.river.path.concat([B.vault]), wet = waterCut(full, B.river.width || 1.1, 0);
    const decks = crossings(B.road, full).filter(r => bridgePlan(r, wet).wet), onDeck = (x, z) => decks.some(r => r.some(q => Math.hypot(q[0] - x, q[1] - z) < .11));
    for (const [x, z] of along(B.road, .1)) {
      const d = polyDist(x, z, B.river.path); // what src/render/battle.js and the townsfolk lift by
      if (d < RAMP) assert.ok(onDeck(x, z), id + ' raiders lifted off any deck at ' + x.toFixed(1) + ',' + z.toFixed(1));
      if (onDeck(x, z)) assert.ok(Math.abs(d - polyDist(x, z, full)) < 1e-9, id + ' the deck and the lift agree');
    }
  }
});
