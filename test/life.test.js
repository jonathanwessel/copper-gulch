// The town's life (PLAN.md M5b, Towns part 2): townsfolk walks and tumbleweed lanes never cross a pad, a building,
// the vault, the river off the bridge or an entrance, on every board, and most buildings can reach each other.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOWNS } from '../src/data/towns/index.js';
import { WalkGrid, walkNodes, tumbleLane, blocker, PAD_GAP, seeded as rng } from '../src/render/life-plan.js';

const clearPath = (K, pts) => {
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], n = Math.ceil(Math.hypot(bx - ax, bz - az) / .05);
    for (let s = 0; s <= n; s++) if (K.blocked(ax + (bx - ax) * s / n, az + (bz - az) * s / n)) return false;
  }
  return true;
};

for (const [id, T] of Object.entries(TOWNS)) {
  test(`life on ${id}: walks between buildings stay clear of pads and buildings`, () => {
    const B = T.board, K = blocker(B), grid = new WalkGrid(B), nodes = walkNodes(B, () => true, grid);
    assert.ok(nodes.length >= Object.keys(B.plots).length * .7, `${id}: most plots have a clear door (${nodes.length})`);
    let ok = 0, all = 0;
    for (const a of nodes) for (const b of nodes) {
      if (a === b) continue;
      all++;
      const r = grid.route(a.at, b.at);
      if (!r) continue;
      ok++;
      assert.ok(clearPath(K, r), `${id}: the walk ${a.id} to ${b.id} crosses something`);
      for (const [x, z] of r) for (const [sx, sz] of B.spots) assert.ok(Math.hypot(x - sx, z - sz) >= PAD_GAP, `${id}: a corner on a pad`);
    }
    assert.ok(ok === all, `${id}: ${ok} of ${all} walks found`);
  });
  test(`life on ${id}: tumbleweeds find clear lanes`, () => {
    const B = T.board, K = blocker(B), r = rng(5);
    let found = 0;
    for (let i = 0; i < 20; i++) { const l = tumbleLane(B, r, K); if (l) { found++; assert.ok(clearPath(K, [l.from, l.to]), `${id}: a lane crosses something`); } }
    assert.ok(found >= 10, `${id}: ${found} of 20 lanes`);
  });
}
