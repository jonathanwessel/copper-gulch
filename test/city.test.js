// The Capital's city on the empire map (src/data/capital.js, CITY; models in src/assets/models/capital.js): one lot for
// every institution, every footprint on the plaza and clear of the others, and a model for each.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CITY } from '../src/data/capital.js';
import { INSTITUTIONS } from '../src/data/institutions.js';
import { SITES, CAPITAL, DIORAMA } from '../src/data/empire.js';
import { TOWNS } from '../src/data/towns/index.js';

// a footprint's corners on the map
const corners = s => {
  const c = Math.cos(s.ry || 0), n = Math.sin(s.ry || 0), out = [];
  for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const x = u * s.w / 2, z = v * s.d / 2;
    out.push([s.at[0] + x * c + z * n, s.at[1] - x * n + z * c]);
  }
  return out;
};
// two convex footprints overlap unless some edge's axis separates them (with a gap of `gap` map units)
function apart(a, b, gap) {
  const A = corners(a), B = corners(b);
  for (const P of [A, B]) for (let i = 0; i < 4; i++) {
    const [x1, z1] = P[i], [x2, z2] = P[(i + 1) % 4], L = Math.hypot(x2 - x1, z2 - z1), nx = -(z2 - z1) / L, nz = (x2 - x1) / L;
    const pa = A.map(([x, z]) => x * nx + z * nz), pb = B.map(([x, z]) => x * nx + z * nz);
    if (Math.max(...pa) + gap <= Math.min(...pb) || Math.max(...pb) + gap <= Math.min(...pa)) return true;
  }
  return false;
}

test('every institution has a lot in the city, and a model', () => {
  const ids = INSTITUTIONS.map(i => i.id), src = readFileSync(new URL('../src/assets/models/capital.js', import.meta.url), 'utf8');
  assert.deepEqual(Object.keys(CITY.lots).sort(), ids.slice().sort());
  for (const id of ids) assert.match(src, new RegExp('\\n  ' + id + '\\(k\\) \\{'), id + ' has a model');
});

test('the capitol, the board, every lot, lamp and tree stand on the plaza, apart from each other', () => {
  const small = (at, s) => ({ at, w: s, d: s });
  const all = { capitol: CITY.capitol, board: CITY.board, ...CITY.lots };
  CITY.lamps.forEach((p, i) => { all['lamp' + i] = small(p, .1); });
  CITY.trees.forEach((p, i) => { all['tree' + i] = small(p, .35); });
  for (const [id, s] of Object.entries(all)) for (const [x, z] of corners(s)) assert.ok(Math.hypot(x, z) <= CITY.plaza - .05, id + ' is on the plaza');
  const ids = Object.keys(all);
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) assert.ok(apart(all[ids[i]], all[ids[j]], .1), ids[i] + ' and ' + ids[j] + ' are apart');
});

test('the plaza stays clear of every town on the map', () => {
  for (const [id, at] of Object.entries(SITES)) {
    const b = TOWNS[id].board, w = b.cols * DIORAMA, d = b.rows * DIORAMA;
    // the nearest point of the town's board to the Capital
    const nx = Math.max(at[0] - w / 2, Math.min(CAPITAL[0], at[0] + w / 2)), nz = Math.max(at[1] - d / 2, Math.min(CAPITAL[1], at[1] + d / 2));
    assert.ok(Math.hypot(nx - CAPITAL[0], nz - CAPITAL[1]) > CITY.plaza + .5, id);
  }
});
