// The empire map's land (PLAN.md M5b, the empire map): every road between two places keeps off every other board,
// every entrance and the Capital's plaza; the river, the creek and each town's own land keep clear too; the mesas
// differ; the surveyors camp stays inside its plot; routes become rails with the Rail Office.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOWNS } from '../src/data/towns/index.js';
import { SITES, CAPITAL } from '../src/data/empire.js';
import { ENT_BOX, footprint, blockers, routeLine, fallsRiver, creekBed, flavor, FLAVOR, mesaPlan, camp, routeKind, polyDist, rectDist } from '../src/render/empire-plan.js';

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
  for (const a of sites) for (const b of sites) if (a.id < b.id && !a.capital && !b.capital) roads.push(routeLine(a, b, B).pts);
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
