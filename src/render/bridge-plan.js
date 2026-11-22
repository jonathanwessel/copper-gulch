/* Where the road crosses the river, and how a bridge stands there: pure numbers, no three.js, so tests can check every
   bridge on every board (owner, 2026-11-22: "Shouldn't I see water under the bridge? Instead of a road on top of the
   water?"). The road ribbon is cut wherever it would lie on the water (waterCut), so the river runs unbroken under each
   deck, and the deck spans only the water and a short ramp on each bank, on posts that stand in the water. */
import { polyDist } from './empire-plan.js';

/* A point is on the water when it lies within the river's half width (plus a hair, so no sliver of road shows on the
   foam). Used to cut the road ribbon, the trampled ground tint and a map route's ties. */
export const waterCut = (river, width, pad = .03) => (x, z) => polyDist(x, z, river) < width / 2 + pad;

/* The road's points every `step` along it, as [x, z]. */
export function along(road, step = .1) {
  const out = [];
  for (let i = 0; i < road.length - 1; i++) {
    const [ax, az] = road[i], [bx, bz] = road[i + 1], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / step));
    for (let k = 0; k < n; k++) out.push([ax + (bx - ax) * k / n, az + (bz - az) * k / n]);
  }
  out.push(road[road.length - 1]);
  return out;
}

/* How far from the river's middle a town bridge reaches: flat over the water (0.55 each side), then a ramp down to the
   bank (a ramp of 0.45 rose 0.55 and read as a wall at each end, 2026-11-22). */
export const RAMP = 1.2;
/* Every crossing: the runs of road points within `reach` of the river's middle (the deck and its ramps). */
export function crossings(road, river, reach = RAMP, step = .1) {
  const runs = []; let run = null;
  for (const p of along(road, step)) {
    if (polyDist(p[0], p[1], river) < reach) (run || (run = [])).push(p);
    else if (run) { if (run.length > 2) runs.push(run); run = null; }
  }
  if (run && run.length > 2) runs.push(run);
  return runs;
}

/* One bridge's plan from its run: the deck from a to b (len, ry, its unit direction and sideways), its half width, and
   the posts: pairs at both edges where the run is over the water, about `gap` apart, always at least one pair.
   wet(x, z) says whether a point is on the water. */
export function bridgePlan(run, wet, { deckHalf = .5, gap = .45 } = {}) {
  const a = run[0], b = run[run.length - 1], dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz) || 1;
  const ux = dx / len, uz = dz / len, sx = uz, sz = -ux; // along, and to the side
  const ts = [];
  for (let t = 0; t <= len; t += .05) if (wet(a[0] + ux * t, a[1] + uz * t)) ts.push(t);
  const posts = [];
  if (ts.length) {
    const t0 = ts[0], t1 = ts[ts.length - 1], n = Math.max(1, Math.round((t1 - t0) / gap));
    // where the river runs aslant, a post at the deck's edge can land on the bank: only posts in the water stay, and
    // the middle pair moves in under the deck until it stands in the water
    const at = (t, s, o) => [a[0] + ux * t + sx * s * o, a[1] + uz * t + sz * s * o, t];
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? (t0 + t1) / 2 : t0 + (t1 - t0) * (i + .5) / n;
      for (const s of [-1, 1]) { const p = at(t, s, deckHalf - .05); if (wet(p[0], p[1])) posts.push(p); }
    }
    if (posts.length < 2) for (let o = deckHalf - .1; o > .05 && posts.length < 2; o -= .05) {
      const t = (t0 + t1) / 2, p = [at(t, -1, o), at(t, 1, o)];
      if (p.every(q => wet(q[0], q[1]))) posts.push(...p);
    }
  }
  return { a, b, len, ry: Math.atan2(dx, dz), ux, uz, sx, sz, deckHalf, posts, wet: ts.length ? [ts[0], ts[ts.length - 1]] : null };
}

/* Where a deck at height h casts its shadow on the water, from the town's sun (town-view.js puts it 8 west, 12 up
   and 7 south of the middle): the offset on the ground. */
export const shadowShift = h => [h * 8 / 12, -h * 7 / 12];
