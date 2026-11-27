// Owner request (2026-11-20): "Add more tower pads per map." About 50% more pads on every map, added at the end of
// board.spots so a saved tower keeps its pad, each one clear of the road, the plots, the vault and the other pads, and
// far enough apart to tap on a phone. Mortar pits are listed by index in board.pits.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOWNS, TOWN_ORDER, isPitSpot } from '../src/data/towns/index.js';
import { newGame } from '../src/core/setup.js';
import { isPit, fitsSpot } from '../src/core/defense.js';

const segDist = (x, z, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], L = dx * dx + dz * dz, t = L ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L)) : 0; return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz); };
const polyD = (x, z, P) => { let d = Infinity; for (let i = 0; i + 1 < P.length; i++) d = Math.min(d, segDist(x, z, P[i], P[i + 1])); return d; };
// the pads every map had before 2026.11.20-17, in order: a saved tower's spot index must still mean the same pad
// (Thunder Mesa came after the pads box, so all its pads are new: 0 before)
const BEFORE = { drycreek: 6, pinehollow: 7, sandybend: 7, gulch: 16, ridge: 16, falls: 15, mesa: 0, tarseep: 0 };
// (the look pass, 2026.11.21-2, moved Pine Hollow's first pad back from the Logging Camp: the same pad, a
// third of a step over)
const FIRST = { gulch: [2.5, 3], ridge: [3.5, 2.4], falls: [3.5, 2.4], mesa: [3.5, 2.4], drycreek: [3.6, 2.2], pinehollow: [3.6, 1.85], sandybend: [3.6, 2.2], tarseep: [3.6, 2.2] };

test('every map has about half again as many pads: outposts 10-11, towns 22-24', () => {
  for (const id of TOWN_ORDER) {
    const n = TOWNS[id].board.spots.length, out = TOWNS[id].kind === 'outpost';
    assert.ok(out ? n >= 10 && n <= 11 : n >= 22 && n <= 24, id + ' has ' + n + ' pads');
    assert.ok(n >= BEFORE[id] * 1.4, id + ': at least 40% more than ' + BEFORE[id]);
  }
});

test('the old pads keep their index, so a saved tower stays on its pad', () => {
  for (const id of TOWN_ORDER) {
    const B = TOWNS[id].board;
    assert.deepEqual(B.spots[0], FIRST[id], id);
    for (let i = 0; i < BEFORE[id]; i++) assert.equal(isPitSpot(B, i), i >= B.far && i < BEFORE[id], id + ' pad ' + i + ' is what it was');
  }
});

test('each pad is clear of the road, the river, the plots, the vault and every other pad', () => {
  for (const id of TOWN_ORDER) {
    const B = TOWNS[id].board;
    B.spots.forEach(([x, z], i) => {
      // a footing (0.5 across its middle) stays off the road's light edge (0.66 from its middle): review of 2026.11.20-17,
      // pads looked pressed against the road
      assert.ok(polyD(x, z, [...B.road, B.vault]) >= 1.149, id + ' pad ' + i + ' sits on the edge of the road');
      if (B.river) assert.ok(polyD(x, z, B.river.path) >= 1.05, id + ' pad ' + i + ' is in the river');
      for (const [p, [px, pz]] of Object.entries(B.plots)) assert.ok(Math.max(Math.abs(x - px), Math.abs(z - pz)) >= 1.35, id + ' pad ' + i + ' is on the ' + p + ' lot'); // the Falls' pad 3 has sat 1.4 from the Water Wheel since it opened
      assert.ok(Math.hypot(x - B.vault[0], z - B.vault[1]) >= 1.45, id + ' pad ' + i + ' is on the vault');
      // 1.5 units is about 48 px on a phone at the home view, so two pads never share a tap
      for (let j = 0; j < i; j++) assert.ok(Math.hypot(x - B.spots[j][0], z - B.spots[j][1]) >= 1.5, id + ' pads ' + j + ' and ' + i + ' are too close');
    });
  }
});

test('outposts have no pits, towns 3 to 5, and only the Mortar builds on one', () => {
  for (const id of TOWN_ORDER) {
    const B = TOWNS[id].board, pits = B.spots.map((_, i) => i).filter(i => isPitSpot(B, i));
    if (TOWNS[id].kind === 'outpost') assert.equal(pits.length, 0, id);
    else assert.ok(pits.length >= 3 && pits.length <= 5, id + ' has ' + pits.length + ' pits');
  }
  const g = newGame('pads1', 'gulch'), t = g.town, B = t.def.board;
  for (let i = 0; i < B.spots.length; i++) {
    assert.equal(isPit(t, i), B.pits.includes(i));
    assert.equal(fitsSpot(t, i, 'crossbow'), !B.pits.includes(i), 'pad ' + i);
  }
});

test('towers past the old pad count cost 25% more coin and goods each; Mortars and upgrades do not', async () => {
  const { towerCost, buildTower, crowdFactor } = await import('../src/core/defense.js');
  const { EXTRA_TOWER, TOWERS } = await import('../src/data/towers.js');
  const { crowdLine } = await import('../src/ui/play.js');
  const { EXPLAINERS } = await import('../src/data/explainers.js');
  assert.equal(EXTRA_TOWER, 1.25);
  const g = newGame('pads2', 'gulch'), t = g.town, B = t.def.board; t.coins = g.shared.purse.coins = 1e9;
  for (const k of ['timber', 'ore', 'clay', 'planks', 'copper', 'bricks', 'tools']) t.goods[k] = 1e6;
  const list = towerCost(t, 'crossbow', 0);
  const normal = B.spots.map((_, i) => i).filter(i => !B.pits.includes(i));
  for (let n = 0; n < B.crowd; n++) { assert.equal(crowdFactor(t, 'crossbow'), 1, 'tower ' + (n + 1)); assert.ok(buildTower(g, t, normal[n], 'crossbow')); }
  assert.equal(crowdLine(t), 'You have 12 towers here. Each new tower costs more.');
  const next = towerCost(t, 'crossbow', 0);
  assert.equal(next.coins, Math.ceil(TOWERS.crossbow.coins * t.mods.factor('cost') * t.mods.factor('cost:towerNew') * 1.25));
  for (const [g, n] of Object.entries(list.goods)) assert.equal(next.goods[g], Math.ceil(n * 1.25), g + ' costs 25% more too');
  assert.ok(buildTower(g, t, normal[B.crowd], 'crossbow'));
  assert.ok(Math.abs(crowdFactor(t, 'crossbow') - 1.25 ** 2) < 1e-9);
  assert.equal(crowdFactor(t, 'mortar'), 1, 'a Mortar is never crowded');
  assert.deepEqual(towerCost(t, 'crossbow', 1), (() => { const g2 = newGame('pads3', 'gulch'); return towerCost(g2.town, 'crossbow', 1); })(), 'an upgrade costs the same');
  const e = EXPLAINERS.find(x => x.id === 'crowd');
  assert.ok(e.when({ crowded: true, t: 5 }) && !e.when({ crowded: false, t: 5 }));
  assert.match(e.say({ towerCount: 12 }), /^You have 12 towers here\. Each new tower costs more than the one before\./);
  for (const id of TOWN_ORDER) assert.ok(TOWNS[id].board.crowd >= 6 && TOWNS[id].board.crowd < TOWNS[id].board.spots.length, id);
});

// Raiders leave a lane's entrance bunched, so a pad right by it lets a group tower hit them all at once: a Frost Lens
// by the Falls' river mouth, then by its rock cut, did 40-46% of the damage in the bots (2026.11.20-17). New pads in a town
// with the Frost Lens keep 2.5 back from the first 3 units of every lane past its mouth. The Gulch's pads 16 and 17
// stand nearer and the bots measured them fine (frost 16-30% for every strategy), so they are listed.
const NEAR_OK = { gulch: [16, 17] };
function stretch(path, mouth, len) {
  let best = 0, bd = Infinity;
  for (let i = 0; i + 1 < path.length; i++) { const d = segDist(mouth[0], mouth[1], path[i], path[i + 1]); if (d < bd) { bd = d; best = i; } }
  const pts = [mouth]; let left = len, cur = mouth;
  for (let i = best + 1; i < path.length && left > 0; i++) {
    const p = path[i], d = Math.hypot(p[0] - cur[0], p[1] - cur[1]);
    if (d >= left) { const k = left / d; pts.push([cur[0] + (p[0] - cur[0]) * k, cur[1] + (p[1] - cur[1]) * k]); left = 0; } else { pts.push(p); left -= d; cur = p; }
  }
  return pts;
}
test('new pads keep back from where a lane comes out of its entrance, in a town with the Frost Lens', async () => {
  const { TOWERS } = await import('../src/data/towers.js');
  for (const id of TOWN_ORDER) {
    const T = TOWNS[id], B = T.board;
    if (!TOWERS.frost.goods[id] || (T.towers && !T.towers.includes('frost'))) continue;
    const lanes = [stretch(B.road, B.entrance.mouth, 3)];
    if (B.river) lanes.push(stretch(B.river.path, B.river.entrance.mouth, 3));
    B.spots.forEach(([x, z], i) => {
      if (i < (BEFORE[id] ?? 0) || isPitSpot(B, i) || (NEAR_OK[id] || []).includes(i)) return;
      for (const s of lanes) for (let k = 0; k + 1 < s.length; k++) assert.ok(segDist(x, z, s[k], s[k + 1]) >= 2.5, id + ' pad ' + i + ' is by an entrance');
    });
  }
});
