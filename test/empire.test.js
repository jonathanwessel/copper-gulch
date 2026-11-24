// The empire map's land (PLAN.md M5b, the empire map): every road between two places keeps off every other board,
// every entrance and the Capital's plaza; the river, the creek and each town's own land keep clear too; the mesas
// differ; the surveyors camp stays inside its plot; routes become rails with the Rail Office.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOWNS } from '../src/data/towns/index.js';
import { SITES, CAPITAL, DIORAMA } from '../src/data/empire.js';
import { ENT_BOX, footprint, blockers, routeLine, spokeLine, fallsRiver, creekBed, flavor, FLAVOR, mesaPlan, camp, routeKind, polyDist, rectDist } from '../src/render/empire-plan.js';

const sites = [{ id: 'capital', at: CAPITAL, capital: true }, ...Object.entries(SITES).map(([id, at]) => ({ id, at }))];
const B = blockers(sites);

test('every entrance on every board has its measured size', () => {
  for (const [id, T] of Object.entries(TOWNS)) for (const e of [T.board.entrance, T.board.river && T.board.river.entrance].filter(Boolean)) assert.ok(ENT_BOX[e.kind], `${id}: no ENT_BOX for ${e.kind}`);
});

test('every road between two places keeps off the other boards, every entrance and the plaza', () => {
  for (const a of sites) for (const b of sites) {
    if (a.id >= b.id || a.capital || b.capital) continue;
    const r = routeLine(a, b, B);
    assert.equal(r.hits, 0, `${a.id} to ${b.id} touches something`);
    assert.ok(r.pts.length > 3, `${a.id} to ${b.id} has a road`);
    for (const [x, z] of r.pts) assert.ok(Math.hypot(x - CAPITAL[0], z - CAPITAL[1]) > 2.5, `${a.id} to ${b.id} crosses the plaza`);
    // it reaches both boards (it ends within a step of each board's edge)
    const end = (id, p) => rectDist(p[0], p[1], footprint(id).rect);
    assert.ok(end(a.id, r.pts[0]) < .5 && end(b.id, r.pts[r.pts.length - 1]) < .5, `${a.id} to ${b.id} stops short of a town`);
  }
});

test('the river and the dry creek keep off every board and entrance but their own', () => {
  const river = fallsRiver(), creek = creekBed();
  for (const [x, z] of river.pts.slice(0, -2)) assert.equal(B.hit(x, z, 0, ['falls']), null, `the river at ${x},${z}`);
  for (const [x, z] of creek.pts.slice(1)) assert.equal(B.hit(x, z, 0, ['drycreek']), null, `the creek at ${x},${z}`);
  // the river meets the board's own river where it leaves the misty bend
  const [sx, sz] = river.pts[river.pts.length - 1], f = footprint('falls').rect;
  assert.ok(rectDist(sx, sz, f) < 4, 'the river reaches Silver Falls');
});

test('every town has land that fits it, and none of it stands on a board, an entrance, a road or the water', () => {
  const river = fallsRiver(), creek = creekBed(), roads = [];
  // the roads the map draws: every place's spoke in to the Capital (the ring, part 1b)
  for (const id of Object.keys(SITES)) roads.push(spokeLine(id, B).pts);
  const free = (x, z, m) => !B.hit(x, z, m) && !roads.some(p => polyDist(x, z, p) < .6 + m) && polyDist(x, z, river.pts) > river.width * .6 + m && polyDist(x, z, creek.pts) > creek.width * .6 + m * .5;
  for (const id of Object.keys(SITES)) {
    const list = flavor(id, free);
    assert.ok(list.length >= FLAVOR[id].n * .6, `${id}: ${list.length} of ${FLAVOR[id].n}`);
    for (const p of list) assert.ok(free(p.x, p.z, 0), `${id}: a ${p.kind} on something`);
    assert.ok(list.every(p => p.kind === FLAVOR[id].kind));
  }
  assert.equal(FLAVOR.pinehollow.kind, 'pine'); assert.equal(FLAVOR.ridge.kind, 'crag'); assert.equal(FLAVOR.falls.kind, 'reed');
});

test('the mesas differ: every kind shows, and no two are the same', () => {
  const xs = Object.values(SITES).map(s => s[0]), zs = Object.values(SITES).map(s => s[1]);
  const box = { x0: Math.min(...xs) - 4, x1: Math.max(...xs) + 4, z0: Math.min(...zs) - 4, z1: Math.max(...zs) + 4.5 };
  const list = mesaPlan(box, sites);
  assert.ok(new Set(list.map(m => m.kind)).size >= 5);
  const keys = list.map(m => m.kind + m.s.toFixed(2) + m.h.toFixed(2));
  assert.equal(new Set(keys).size, keys.length);
  for (const m of list) for (const s of sites) if (TOWNS[s.id]) assert.ok(rectDist(m.x, m.z, footprint(s.id).rect) > 6, `a mesa by ${s.id}`);
  // they take the colors of the towns nearest them, so the land changes round the map
  assert.ok(new Set(list.map(m => m.colors)).size >= 3);
});

test('the surveyors camp stays inside its plot, each part apart', () => {
  const c = camp([0, 0]), parts = [c.tent, c.fire, c.tripod];
  for (const p of parts) assert.ok(Math.hypot(...p) < 1.6);
  for (const p of parts) for (const q of parts) if (p !== q) assert.ok(Math.hypot(p[0] - q[0], p[1] - q[1]) > .6);
});

test('routes are roads until the Rail Office is founded, then rails', () => {
  assert.equal(routeKind({ shared: { tree: { founded: ['bank'] } } }), 'road');
  assert.equal(routeKind({ shared: {} }), 'road');
  assert.equal(routeKind({ shared: { tree: { founded: ['bank', 'transport'] } } }), 'rail');
});

/* The ring (owner, 2026-11-22: "raiders always come from the perimeter"): every lane's entrance on the map runs away
   from the Capital, and every town's vault sits nearer the Capital than its board's middle. Seen red: before the turn the
   Gulch's, Dry Creek's, Silver Falls' and Sandy Bend's entrances faced the Capital. */
test('every entrance on the map points away from the Capital, and every vault faces in', async () => {
  const { toMap } = await import('../src/render/empire-plan.js');
  for (const id of Object.keys(SITES)) {
    const [sx, sz] = SITES[id], out = [sx - CAPITAL[0], sz - CAPITAL[1]], L = Math.hypot(...out);
    for (const g of footprint(id).gates) {
      const d = [g.b[0] - g.a[0], g.b[1] - g.a[1]], cos = (d[0] * out[0] + d[1] * out[1]) / (Math.hypot(...d) * L);
      assert.ok(cos > .9, `${id}: an entrance points ${Math.round(Math.acos(cos) * 180 / Math.PI)} degrees off outward`);
    }
    // an outpost's loop road ends by its entrance, so only a town's vault is checked
    if (TOWNS[id].kind === 'outpost') continue;
    const [vx, vz] = toMap(id, TOWNS[id].board.vault);
    assert.ok(Math.hypot(vx - CAPITAL[0], vz - CAPITAL[1]) < L, `${id}: its vault faces away from the Capital`);
  }
});

/* Spokes (the ring, part 1b; owner, 2026-11-22: "the connecting roads and trains come from the vaults"): every place's
   road leaves a depot by its vault on the board's inner edge and runs to a station on the plaza's edge, and no road
   crosses a board, a raider road or the plaza. Seen red: the roads of 2026.11.24-4 ran town to town, the Gulch's to
   Iron Ridge leaving the Gulch's side 5 away from its vault and never coming near the Capital. */
test('every road leaves a depot by its vault and runs in to the Capital', async () => {
  const { spokeLine, depotOf, linkLine, STATION_R, toMap } = await import('../src/render/empire-plan.js');
  for (const id of Object.keys(SITES)) {
    const s = spokeLine(id, B), d = depotOf(id), f = footprint(id).rect;
    // the depot stands just past the board's edge, on the side that faces the Capital
    assert.ok(rectDist(d[0], d[1], f) > 0 && rectDist(d[0], d[1], f) < .6, `${id}: its depot is not at its board's edge`);
    assert.ok(Math.hypot(d[0] - CAPITAL[0], d[1] - CAPITAL[1]) < Math.hypot(f.x - CAPITAL[0], f.z - CAPITAL[1]), `${id}: its depot faces away from the Capital`);
    if (TOWNS[id].kind !== 'outpost') { const [vx, vz] = toMap(id, TOWNS[id].board.vault); assert.ok(Math.hypot(vx - d[0], vz - d[1]) < 1, `${id}: its depot is far from its vault`); }
    // it stands on dry ground: Silver Falls' river runs out by its vault (review of 2026.11.24-5, the depot on the water)
    const TB = TOWNS[id].board;
    if (TB.river) { const wet = TB.river.path.concat([TB.vault]).map(p => toMap(id, p)); assert.ok(polyDist(d[0], d[1], wet) > (TB.river.width || 1.1) / 2 * DIORAMA + .4, `${id}: its depot stands on its river`); }
    // it starts at the depot and ends on the plaza's edge
    assert.deepEqual(s.pts[0], d);
    const e = s.pts[s.pts.length - 1]; assert.ok(Math.abs(Math.hypot(e[0] - CAPITAL[0], e[1] - CAPITAL[1]) - STATION_R()) < 1e-6, `${id}: its road stops short of the Capital`);
    // it touches no board, no raider road and not the plaza on the way
    for (const [x, z] of s.pts.slice(1, -1)) assert.equal(B.hit(x, z, .2, ['capital']), null, `${id}: its road at ${x.toFixed(1)},${z.toFixed(1)} touches ${B.hit(x, z, .2, ['capital'])}`);
    for (const [x, z] of s.pts) assert.ok(Math.hypot(x - CAPITAL[0], z - CAPITAL[1]) >= STATION_R() - 1e-6, `${id}: its road crosses the plaza`);
  }
  // goods between two places go in one spoke, round the plaza and out the other
  const l = linkLine('gulch', 'ridge', B);
  assert.deepEqual(l.pts[0], depotOf('gulch')); assert.deepEqual(l.pts[l.pts.length - 1], depotOf('ridge'));
  assert.ok(l.pts.some(([x, z]) => Math.hypot(x - CAPITAL[0], z - CAPITAL[1]) < STATION_R() + .01));
  for (let i = 1; i < l.pts.length; i++) assert.ok(Math.hypot(l.pts[i][0] - l.pts[i - 1][0], l.pts[i][1] - l.pts[i - 1][1]) < 1, 'a gap in the road');
});
