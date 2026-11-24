/* Trains and wagons on the empire map's spokes (the ring, part 2; owner, 2026-11-22: "What happens to the train with
   the empire map tweaks?"). Pure: no three.js, no DOM, so test/trains.test.js steps it in node.

   Each place's spoke runs from the depot by its vault to a station on the Capital's plaza. A spoke has two lanes, one
   each way, and its vehicles shuttle on a timetable:
     - a train leaves the depot on the inbound lane, crosses to the other lane just before the station, waits at the
       platform while it is unloaded and loaded, and runs back. It has an engine at each end, so it never turns round;
     - a wagon does the same on a dirt road, but turns round in a half circle at the station;
     - a vehicle shows only once it is out of the depot's shed and vanishes only inside it, never in the open.
   Every vehicle on a spoke runs the same cycle, offset by a fixed headway that keeps them apart, and a slot of the
   timetable is switched on or off only while its vehicle is in the shed, so a busier spoke gets more vehicles without
   any jumping. trackOf(pts) lays out the lanes (the map draws its rails from the same lines), fleet() makes a spoke's
   timetable, stepFleet() moves it on and placeFleet() calls back once for every vehicle in view. */

import { wagonsFor } from '../core/map.js';

export const LANE = .28;          // each lane's distance from the spoke's middle (map units)
export const STEP = .15;          // the lanes' sample spacing
/* The depot's shed (drawn by empire-land.js depotModel): its roof reaches SHED down the road from the depot's point,
   and SHED_WIDE across. */
export const SHED = 1.08, SHED_WIDE = 1.12;
const CROSS = .9;                 // a train's crossover from one lane to the other, before the platform
const TRAIN_STOP = .35, WAGON_STOP = .85; // how far short of the spoke's end the front of a vehicle stops
/* speed (map units a second), the waits at the station and in the shed (seconds), and mouth: a vehicle whose middle is
   closer than this to the depot (along its lane) is inside the shed. The shed's roof (empire-land.js SHED) reaches past
   the mouth by the front of the longest vehicle, so nothing shows or goes away in the open. A wagon's mule walks ahead
   of it, so a wagon going in runs further under the roof before it goes (out: its mouth on the way out). */
export const KIND = {
  rail: { speed: 1.6, station: 2.8, depot: 1.6, mouth: .5, out: .5 },
  road: { speed: 1, station: 2.4, depot: 1.4, mouth: .32, out: .52 },
};
/* The vehicles as drawn (empire-view.js scales each model by its `scale`): half their length and width (map units),
   and how far their middle sits ahead of the point they are placed at. */
export const SHAPE = {
  engine: { scale: .9, half: .28, wide: .12, ahead: 0 },
  car: { scale: .9, half: .21, wide: .12, ahead: 0 },
  wagon: { scale: 1, half: .45, wide: .2, ahead: .23 },
};
const ENGINE_GAP = .5, CAR_GAP = .44, MAX_CARS = 4;

/* A polyline as a path: { pts, len, at(s, out) } with s the distance along it, clamped to its ends. at() writes x, z
   and yaw (the way the path runs, 0 = +z). */
export function pathOf(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const len = cum[cum.length - 1] || 0;
  const at = (s, out) => {
    s = Math.max(0, Math.min(len, s));
    let lo = 1, hi = cum.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < s) lo = m + 1; else hi = m; }
    const i = Math.max(1, lo), f = (s - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1), p0 = pts[i - 1], p1 = pts[i];
    out.x = p0[0] + (p1[0] - p0[0]) * f; out.z = p0[1] + (p1[1] - p0[1]) * f; out.yaw = Math.atan2(p1[0] - p0[0], p1[1] - p0[1]);
    return out;
  };
  return { pts, len, at };
}

/* The spoke's middle sampled every STEP, with a smoothed unit normal at each sample (pointing to the right of the
   way in). */
function sampled(pts) {
  const P = pathOf(pts), n = Math.max(2, Math.ceil(P.len / STEP)), o = {}, mid = [];
  for (let i = 0; i <= n; i++) { P.at(P.len * i / n, o); mid.push([o.x, o.z]); }
  // round the corners a little, as the road's ribbon does (board.js roadRibbon), so the lanes bend instead of kinking
  for (let pass = 0; pass < 4; pass++) for (let i = 1; i < mid.length - 1; i++) mid[i] = [(mid[i][0] + (mid[i - 1][0] + mid[i + 1][0]) / 2) / 2, (mid[i][1] + (mid[i - 1][1] + mid[i + 1][1]) / 2) / 2];
  const nor = mid.map((p, i) => {
    const a = mid[Math.max(0, i - 2)], b = mid[Math.min(mid.length - 1, i + 2)], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
    return [dz / L, -dx / L];
  });
  return { mid, nor, len: P.len, ds: P.len / n };
}
const lane = (S, d, i0 = 0, i1 = S.mid.length - 1) => { const out = []; for (let i = i0; i <= i1; i++) out.push([S.mid[i][0] + S.nor[i][0] * d, S.mid[i][1] + S.nor[i][1] * d]); return out; };

/* Where the depot's shed stands and the way it faces: at the depot's point, along the road's first stretch (the
   map draws it there, and the test checks every vehicle is under its roof when it shows or goes). */
export function shedOf(track) {
  const [x, z] = track.depot, m = track.mid[Math.min(track.mid.length - 1, Math.round(SHED * .8 / STEP))], L = Math.hypot(m[0] - x, m[1] - z) || 1;
  return { x, z, ux: (m[0] - x) / L, uz: (m[1] - z) / L, yaw: Math.atan2(m[0] - x, m[1] - z) };
}

/* How a train of n cars is laid out: the middle of each vehicle behind the front engine's (front engine, cars, back
   engine). */
export const consist = n => { const d = [0]; for (let i = 0; i < n; i++) d.push(ENGINE_GAP + i * CAR_GAP); d.push(d[d.length - 1] + ENGINE_GAP); return d; };

/* A spoke's lanes (pts: depot first, station last). For each kind: q, the way in (from the depot to where the vehicle
   waits), r, the way out (from there back into the depot), and lines, every stretch a vehicle can stand on (the rails
   are drawn on them, and the test checks no vehicle leaves them). */
export function trackOf(pts) {
  const S = sampled(pts), last = S.mid.length - 1, idx = s => Math.max(0, Math.min(last, Math.round(s / S.ds)));
  const inLane = lane(S, LANE), outLane = lane(S, -LANE);
  // trains: as many cars as the platform has room for, then the crossover just before it
  let cars = MAX_CARS;
  while (cars > 1 && S.len - TRAIN_STOP - consist(cars).at(-1) - SHAPE.engine.half - .3 - CROSS < KIND.rail.mouth + 1.2) cars--;
  const stop = idx(S.len - TRAIN_STOP), x1 = idx(S.len - TRAIN_STOP - consist(cars).at(-1) - SHAPE.engine.half - .3), x0 = idx(S.len - TRAIN_STOP - consist(cars).at(-1) - SHAPE.engine.half - .3 - CROSS);
  const cross = [inLane[x0], outLane[x1]];
  const railQ = [...inLane.slice(0, x0 + 1), ...outLane.slice(x1, stop + 1)], railR = outLane.slice(0, stop + 1).reverse();
  // wagons: in to the stop, then a half circle onto the other lane, and out
  const w = idx(S.len - WAGON_STOP), m = S.mid[w], nn = S.nor[w], t = [-nn[1], nn[0]], turn = [];
  for (let k = 0; k <= 8; k++) { const a = Math.PI * k / 8; turn.push([m[0] + nn[0] * LANE * Math.cos(a) + t[0] * LANE * Math.sin(a), m[1] + nn[1] * LANE * Math.cos(a) + t[1] * LANE * Math.sin(a)]); }
  const roadQ = inLane.slice(0, w + 1), roadR = [...turn, ...outLane.slice(0, w).reverse()];
  const rail = { q: pathOf(railQ), r: pathOf(railR), cars, crossAt: pathOf(inLane.slice(0, x0 + 1)).len, lines: [inLane.slice(0, x0 + 1), cross, outLane.slice(0, stop + 1), inLane.slice(x0)] };
  const road = { q: pathOf(roadQ), r: pathOf(roadR), cars: 0, lines: [roadQ, roadR] };
  return { len: S.len, depot: pts[0], station: pts[pts.length - 1], mid: S.mid, inLane, outLane, cross, rail, road };
}

/* The timetable of one spoke for one kind ('rail' or 'road'): one cycle of T seconds (in, wait, out, wait in the
   shed), with nmax slots a headway apart. */
export function fleet(track, kind) {
  const K = KIND[kind], L = track[kind], v = K.speed, len = kind === 'rail' ? consist(L.cars).at(-1) + 2 * SHAPE.engine.half : 2 * SHAPE.wagon.half;
  const tin = L.q.len / v, tout = L.r.len / v, T = tin + K.station + tout + K.depot;
  // the headway: the vehicle ahead waits at the station and clears the end stretch before the next one reaches it
  const end = kind === 'rail' ? L.q.len - L.crossAt : 0, clear = kind === 'rail' ? L.q.len - L.crossAt + .6 : Math.PI * LANE + .4;
  const hmin = K.station + (end + clear + len) / v + .6, nmax = Math.max(1, Math.floor(T / hmin));
  return { kind, t: 0, T, tin, tout, h: T / nmax, nmax, carCap: L.cars, slots: Array.from({ length: nmax }, () => ({ on: false, cars: 0 })) };
}
/* Which slots run when n vehicles are wanted: spread evenly round the cycle. */
export const pick = (n, nmax) => { const s = new Set(); for (let i = 0; i < Math.min(n, nmax); i++) s.add(Math.floor(i * nmax / Math.min(n, nmax))); return s; };
/* Start a timetable already running (when the map opens): the wanted slots are on, mid-cycle. */
export function startFleet(F, want, seed = 0) {
  F.t = (seed * .618 % 1) * F.T;
  const on = pick(want.count, F.nmax);
  F.slots.forEach((s, k) => { s.on = on.has(k); s.cars = Math.min(F.carCap, want.cars || 0); });
  return F;
}
/* Move a timetable on by dt seconds. want: { count, cars }. A slot takes up want only as its vehicle leaves the shed
   (its cycle starts over), so nothing is added or taken away in view. */
export function stepFleet(F, dt, want) {
  if (!(dt > 0)) return F;
  const on = pick(want.count, F.nmax);
  F.slots.forEach((s, k) => {
    const a = F.t - k * F.h, b = a + dt;
    if (Math.floor(b / F.T) !== Math.floor(a / F.T)) { s.on = on.has(k); s.cars = Math.min(F.carCap, want.cars || 0); }
  });
  F.t += dt;
  if (F.t > F.T * 1e4) F.t -= F.T * 1e4; // keeps the clock small; every slot's phase is unchanged
  return F;
}
/* Is any vehicle of this timetable out of the shed (or about to be)? */
export const busy = F => F.slots.some((s, k) => s.on && ((F.t - k * F.h) % F.T + F.T) % F.T < F.tin + KIND[F.kind].station + F.tout);

/* Call emit(part, x, z, yaw, load, id) for every vehicle in view. part: 'engine', 'car' or 'wagon'; yaw: the way the
   model's front faces; load: 'in' or 'out' for a car carrying goods (to the Capital, or back to the place), or null;
   id: the same for one vehicle all the way round, for the test. */
const _o = { x: 0, z: 0, yaw: 0 };
export function placeFleet(F, track, emit) {
  const K = KIND[F.kind], L = track[F.kind], v = K.speed, MOUTH = K.mouth;
  F.slots.forEach((s, k) => {
    if (!s.on) return;
    const tau = ((F.t - k * F.h) % F.T + F.T) % F.T;
    if (tau >= F.tin + K.station + F.tout) return; // in the shed
    const phase = tau < F.tin ? 'in' : tau < F.tin + K.station ? 'wait' : 'out';
    const wait = phase === 'wait' ? (tau - F.tin) / K.station : 0;
    // cars are loaded with what goes in on the way in, emptied at the station, and loaded with what goes back
    const load = phase === 'in' || (phase === 'wait' && wait < .35) ? 'in' : phase === 'out' || wait > .65 ? 'out' : null;
    if (F.kind === 'road') {
      const P = phase === 'out' ? L.r : L.q, s0 = phase === 'in' ? v * tau : phase === 'wait' ? L.q.len : v * (tau - F.tin - K.station);
      if (phase === 'in' ? s0 <= MOUTH : phase === 'out' && s0 >= L.r.len - K.out) return;
      P.at(s0, _o); emit('wagon', _o.x, _o.z, _o.yaw, null, k + ':0');
      return;
    }
    const d = consist(s.cars || 1), back = d.length - 1;
    for (let j = 0; j <= back; j++) {
      let x, P;
      if (phase === 'out') { P = L.r; x = d[j] + v * (tau - F.tin - K.station); if (x >= L.r.len - K.out) continue; }
      else { P = L.q; x = (phase === 'in' ? v * tau : L.q.len) - d[j]; if (x <= MOUTH) continue; }
      P.at(x, _o);
      // every vehicle faces the way in, the back engine the way out; on the way out the path runs outward
      let yaw = _o.yaw + (phase === 'out' ? Math.PI : 0);
      if (j === back) yaw += Math.PI;
      emit(j === 0 || j === back ? 'engine' : 'car', _o.x, _o.z, yaw, j === 0 || j === back ? null : load, k + ':' + j);
    }
  });
}

/* How many vehicles a spoke wants from the goods it moves (rate: goods a second on every link through it, both
   ways), and how many cars each train pulls. More goods, more vehicles, up to what the timetable has room for. */
export function wantFor(rate, F) {
  const n = wagonsFor(rate).count; // the same count the core gives a route (src/core/map.js)
  if (!n) return { count: 0, cars: 0 };
  return F.kind === 'rail' ? { count: Math.max(1, Math.round(n / 2)), cars: Math.min(MAX_CARS, 2 + Math.floor(n / 3)) } : { count: n, cars: 0 };
}
