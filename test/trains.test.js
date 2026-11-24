// Trains and wagons on the empire map (PLAN.md, the ring part 2; owner, 2026-11-22): every vehicle stays on its lane,
// shows up and goes away only inside its depot's shed, never jumps, and no two vehicles of different trains (or on
// different spokes) ever overlap, while the number of vehicles a spoke wants goes up and down.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SITES, CAPITAL } from '../src/data/empire.js';
import { blockers, spokeLine, polyDist } from '../src/render/empire-plan.js';
import { trackOf, fleet, startFleet, stepFleet, placeFleet, wantFor, busy, SHAPE, LANE, KIND, SHED, SHED_WIDE, shedOf } from '../src/render/empire-trains.js';

const sites = [{ id: 'capital', at: CAPITAL, capital: true }, ...Object.entries(SITES).map(([id, at]) => ({ id, at }))];
const B = blockers(sites);
const tracks = Object.fromEntries(Object.keys(SITES).map(id => [id, trackOf(spokeLine(id, B).pts)]));

const corners = (v) => {
  const S = SHAPE[v.part], fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), cx = v.x + fx * S.ahead, cz = v.z + fz * S.ahead;
  return { c: [cx, cz], ax: [[fx, fz], [fz, -fx]], h: [S.half, S.wide] };
};
// do two boxes on the ground overlap (separating axes)?
function overlap(a, b) {
  const A = corners(a), Bx = corners(b), d = [Bx.c[0] - A.c[0], Bx.c[1] - A.c[1]];
  for (const [ax] of [[A.ax[0]], [A.ax[1]], [Bx.ax[0]], [Bx.ax[1]]]) {
    const r = o => o.h[0] * Math.abs(o.ax[0][0] * ax[0] + o.ax[0][1] * ax[1]) + o.h[1] * Math.abs(o.ax[1][0] * ax[0] + o.ax[1][1] * ax[1]);
    if (Math.abs(d[0] * ax[0] + d[1] * ax[1]) > r(A) + r(Bx)) return false;
  }
  return true;
}

/* Is the whole vehicle under its depot's shed roof? (along the road from the depot's point, and across it) */
function sheltered(v, tr) {
  const { x: dx, z: dz, ux, uz } = shedOf(tr);
  const C = corners(v);
  for (const sa of [-1, 1]) for (const sb of [-1, 1]) {
    const x = C.c[0] + C.ax[0][0] * C.h[0] * sa + C.ax[1][0] * C.h[1] * sb - dx, z = C.c[1] + C.ax[0][1] * C.h[0] * sa + C.ax[1][1] * C.h[1] * sb - dz;
    const along = x * ux + z * uz, across = Math.abs(x * uz - z * ux);
    if (along > SHED + .01 || along < -.3 || across > SHED_WIDE / 2 + .01) return false;
  }
  return true;
}

/* Run every spoke's timetable for one kind, with the wanted number of vehicles going from the most to one and back,
   and collect what goes wrong. */
function run(kind, { seconds = 240, dt = 1 / 30, wants = null } = {}) {
  const F = {}, bad = [];
  const want = (id, t) => wants ? wants(id, t, F[id]) : wantFor(t < 80 || t > 160 ? 40 : .5, F[id]);
  for (const [id, tr] of Object.entries(tracks)) { F[id] = fleet(tr, kind); startFleet(F[id], want(id, 0), id.length); }
  let prev = {}, shown = 0;
  for (let i = 0, t = 0; t < seconds; i++, t += dt) {
    const now = {}, all = [];
    for (const [id, tr] of Object.entries(tracks)) {
      stepFleet(F[id], dt, want(id, t));
      placeFleet(F[id], tr, (part, x, z, yaw, load, vid) => {
        const v = { part, x, z, yaw, id: id + '/' + vid, train: id + '/' + vid.split(':')[0], spoke: id };
        now[v.id] = v; all.push(v); shown++;
        const off = Math.min(...tr[kind].lines.map(l => polyDist(x, z, l)));
        if (off > .02) bad.push(`${v.id} ${off.toFixed(3)} off its lane at ${t.toFixed(1)} s`);
      });
    }
    if (i) {
      for (const [vid, v] of Object.entries(now)) {
        const p = prev[vid], tr = tracks[v.spoke];
        if (!p) { if (!sheltered(v, tr)) bad.push(`${vid} showed up outside its depot's shed (${Math.hypot(v.x - tr.depot[0], v.z - tr.depot[1]).toFixed(2)} from it) at ${t.toFixed(1)} s`); }
        else { const m = Math.hypot(v.x - p.x, v.z - p.z); if (m > KIND[kind].speed * dt * 1.6 + .005) bad.push(`${vid} jumped ${m.toFixed(3)} at ${t.toFixed(1)} s`); }
      }
      for (const [vid, p] of Object.entries(prev)) if (!now[vid] && !sheltered(p, tracks[p.spoke])) bad.push(`${vid} vanished outside its depot's shed (${Math.hypot(p.x - tracks[p.spoke].depot[0], p.z - tracks[p.spoke].depot[1]).toFixed(2)} from it) at ${t.toFixed(1)} s`);
    }
    for (let a = 0; a < all.length; a++) for (let b = a + 1; b < all.length; b++) if (all[a].train !== all[b].train && overlap(all[a], all[b])) bad.push(`${all[a].id} overlaps ${all[b].id} at ${t.toFixed(1)} s`);
    prev = now;
  }
  return { bad: [...new Set(bad.map(s => s.replace(/ at [\d.]+ s$/, '')))].slice(0, 12).concat(bad.length ? [bad.length + ' in all'] : []), shown, F };
}

test('trains keep to their rails, show only out of the depot and never overlap', () => {
  const r = run('rail');
  assert.ok(r.shown > 1000, 'trains showed');
  assert.deepEqual(r.bad, []);
});

test('wagons keep to their road, show only out of the depot and never overlap', () => {
  const r = run('road');
  assert.ok(r.shown > 1000, 'wagons showed');
  assert.deepEqual(r.bad, []);
});

test('a busier spoke runs more vehicles, up to what its timetable holds, and each train fits its platform', () => {
  for (const [id, tr] of Object.entries(tracks)) for (const kind of ['rail', 'road']) {
    const F = fleet(tr, kind);
    assert.ok(F.nmax >= 1 && F.h * F.nmax <= F.T + 1e-9, `${id} ${kind}`);
    const lo = wantFor(.3, F), hi = wantFor(40, F);
    assert.ok(hi.count >= lo.count && lo.count >= 1, `${id} ${kind} wants`);
  }
  // the longest spoke takes more trains than the shortest
  const len = Object.entries(tracks).sort((a, b) => a[1].len - b[1].len);
  assert.ok(fleet(len.at(-1)[1], 'rail').nmax > fleet(len[0][1], 'rail').nmax);
  assert.equal(wantFor(0, fleet(len[0][1], 'rail')).count, 0, 'no goods, no trains');
});

test('a slot switches on or off only while its vehicle is in the shed', () => {
  // the wanted count drops to 0: vehicles already out finish their run, then the spoke goes quiet
  const tr = tracks.drycreek, F = startFleet(fleet(tr, 'rail'), { count: 3, cars: 3 }, 1);
  const seen = () => { let n = 0; placeFleet(F, tr, () => n++); return n; };
  stepFleet(F, 1, { count: 3, cars: 3 });
  const before = seen();
  assert.ok(before > 0);
  stepFleet(F, 1 / 30, { count: 0, cars: 0 });
  assert.equal(seen(), before, 'nothing vanished at once');
  for (let t = 0; t < F.T + 1; t += 1 / 30) stepFleet(F, 1 / 30, { count: 0, cars: 0 });
  assert.equal(seen(), 0);
  assert.equal(busy(F), false);
});
