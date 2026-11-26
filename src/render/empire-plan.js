/* The empire map's land, worked out without three.js so `node --test` can check it (PLAN.md M5b, the empire map;
   GDD.md, Empire map). src/render/empire-view.js draws what this plans.
     footprint(id)        a town's board on the map: its rect, and the corridor its entrance runs up (map units)
     toMap(id, [x, z])    a point on a town's board, on the map
     rectDist(x, z, r)    signed distance from a point to a rounded rect (negative inside)
     blockers(sites)      what a route or a prop must keep off: every board, entrance, the Capital's plaza, the river
     routeLine(a, b, B)   the road between two sites: a gentle curve from board edge to board edge that keeps off the rest
     spokeLine(id, B)     a place's road from the depot by its vault in to a station on the Capital's plaza
     linkLine(a, b, B)    the road goods take between two places: one spoke in, round the plaza, the other out
     mesaPlan(...)        varied mesas, buttes and spires round the map's edge, in the colors of the nearest town
     flavor(id, R, free)  the land that fits each town: pines, hoodoos, rock ridges, dunes, scrub
     fallsRiver()         the river that comes down the falls in the east and runs into Silver Falls
     creekBed()           the dry creek bed that winds away from Dry Creek's wash
   Everything is seeded: the same map every time. */
import { TOWNS } from '../data/towns/index.js';
import { SITES, CAPITAL, DIORAMA as S } from '../data/empire.js';
import { CITY } from '../data/capital.js';

export const SQUASH = .55; // an entrance on the map runs this share of its length on the board, so it never reaches the next town
const ENT_LEN = 9.5;       // how far an entrance model reaches past its mouth on the board (src/assets/models/entrances.js)

export function seeded(seed) { let s = (seed * 9301 + 49297) % 233280 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
const lerp = (a, b, t) => a + (b - a) * t;

/* Each board is turned on the map so its raiders' entrance (every entrance runs toward -z from its mouth) faces away
   from the Capital, and its vault inward (owner, 2026-11-22: "raiders always come from the perimeter"). The turn is
   three.js's rotation.y: a board point (x, z) from its middle lands at (x cos t + z sin t, z cos t - x sin t). */
export const turnOf = id => { const [x, z] = SITES[id], dx = x - CAPITAL[0], dz = z - CAPITAL[1]; return dx || dz ? Math.atan2(-dx, -dz) : 0; };
export const spin = (t, [x, z]) => { const c = Math.cos(t), s = Math.sin(t); return [x * c + z * s, z * c - x * s]; };
export const toMap = (id, [bx, bz]) => { const B = TOWNS[id].board, [x, z] = SITES[id], [dx, dz] = spin(turnOf(id), [(bx - B.cols / 2) * S, (bz - B.rows / 2) * S]); return [x + dx, z + dz]; };

/* How far each entrance model reaches on its board, from its mouth (board units: x left and right of the mouth, z
   back from it), measured from src/assets/models/entrances.js on 2026-11-21. The wash and the chute spread wide, the
   canyons run long. test/empire.test.js keeps the list complete; a reshaped model needs its numbers measured again
   (Box3 of ENTRANCES[kind](e).obj). */
export const ENT_BOX = {
  wash: { l: 9.1, r: 9.2, back: 7 }, canyon: { l: 3.2, r: 3.6, back: 10.8 }, tunnel: { l: 8.2, r: 8.4, back: 7.9 },
  chute: { l: 7.9, r: 8, back: 7.3 }, bend: { l: 4.9, r: 5, back: 6.2 }, riverbed: { l: 6.9, r: 6.9, back: 6.5 },
};
/* { rect: { x, z, hx, hz }, gates: [{ a: [x, z], b: [x, z], box }] } in map units. A gate runs from its mouth on the
   board (a) out to where its model ends (b, the model squashed to SQUASH of its length), and box is all the ground the
   model covers. Every entrance runs toward -z from its mouth. */
export function footprint(id) {
  const B = TOWNS[id].board, [x, z] = SITES[id];
  const rot = turnOf(id), rect = { x, z, hx: B.cols / 2 * S, hz: B.rows / 2 * S, rot };
  const gates = [B.entrance, B.river && B.river.entrance].filter(Boolean).map(e => {
    const [mx, mz] = e.mouth, E = ENT_BOX[e.kind] || { l: e.width / 2 + 2.2, r: e.width / 2 + 2.2, back: ENT_LEN }, back = E.back * SQUASH;
    // the box's middle on the map, and its half sizes in the board's own frame (it turns with the board)
    const [cx, cz] = toMap(id, [mx + (E.r - E.l) / 2, mz + (.3 - back) / 2]);
    return { a: toMap(id, [mx, mz]), b: toMap(id, [mx, mz - back]), box: { x: cx, z: cz, hx: (E.l + E.r) / 2 * S, hz: (back + .3) / 2 * S, rot } };
  });
  return { rect, gates };
}
export const gateDist = (x, z, g) => rectDist(x, z, g.box, .4);

export function rectDist(px, pz, r, round = 1) {
  // a turned rect (a turned board): the point in the rect's own frame
  if (r.rot) { const [lx, lz] = spin(-r.rot, [px - r.x, pz - r.z]); px = r.x + lx; pz = r.z + lz; }
  const rr = Math.min(round, r.hx, r.hz), qx = Math.abs(px - r.x) - (r.hx - rr), qz = Math.abs(pz - r.z) - (r.hz - rr);
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - rr;
}
export function segDist(px, pz, [ax, az], [bx, bz]) {
  const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L2));
  return Math.hypot(px - ax - dx * t, pz - az - dz * t);
}
export const polyDist = (px, pz, pts) => { let d = Infinity; for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, segDist(px, pz, pts[i], pts[i + 1])); return d; };

/* The river that comes over the falls (a cliff out east) and runs west, then south into Silver Falls' own river where
   it leaves the board's misty bend. Map units, from the falls to the town. */
export function fallsRiver() {
  // laid out in the board's own frame (the falls off to its right, the river into its bend) and turned with it
  const [sx, sz] = toMap('falls', TOWNS.falls.board.river.path[0]), t = turnOf('falls'), at = ([x, z]) => { const [dx, dz] = spin(t, [x, z]); return [sx + dx, sz + dz]; };
  return { pts: [[8.6, -1.2], [6.4, -1.6], [4.2, -1.8], [2.2, -1.6], [.6, -1.1], [0, -.4], [0, .3]].map(at), cliff: at([9.2, -1.2]), width: .8 };
}
/* The dry creek bed: out of Dry Creek's wash to the west and off toward the map's edge. */
export function creekBed() {
  // in the board's own frame, turned with it
  const g = footprint('drycreek').gates[0], [ex, ez] = g.b, t = turnOf('drycreek'), at = ([x, z]) => { const [dx, dz] = spin(t, [x, z]); return [ex + dx, ez + dz]; };
  return { pts: [[0, .4], [-.3, -.8], [-1.4, -1.9], [-3.2, -2.2], [-5.2, -1.6], [-7.4, -2.1], [-10, -1.5], [-13, -1.9]].map(at), width: .9 };
}

/* What routes and props keep off: { site: [[id, rect]], gates: [gate], plaza, river }. dist(x, z) is the distance to
   the nearest (negative inside), and hit(x, z, m, skip) says whether a point is within m of any but the sites in skip. */
export function blockers(sites) {
  const towns = sites.filter(s => TOWNS[s.id]).map(s => [s.id, footprint(s.id)]);
  const river = sites.some(s => s.id === 'falls') ? fallsRiver() : null, creek = sites.some(s => s.id === 'drycreek') ? creekBed() : null;
  const plaza = sites.find(s => s.capital);
  const hit = (x, z, m = 0, skip = []) => {
    for (const [id, f] of towns) {
      if (!skip.includes(id) && rectDist(x, z, f.rect) < m) return id;
      for (const g of f.gates) if (gateDist(x, z, g) < m) return id + ':gate';
    }
    if (plaza && !skip.includes('capital') && Math.hypot(x - plaza.at[0], z - plaza.at[1]) < CITY.plaza + .6 + m) return 'capital';
    return null;
  };
  return { towns, river, creek, plaza, hit };
}

/* The road between two sites: a curve from the edge of one board to the edge of the other that keeps off every other
   board, every entrance (its own too), and the Capital's plaza. Tries curves that leave each end in one of eight ways
   and keeps the shortest that touches nothing (or touches least). Returns { pts: [[x, z]], hits, len } (hits: sample
   points that still touch something, 0 when clear). The same pair always gets the same road. */
const ROUTES = new Map();
export function routeLine(a, b, B, step = .3, { own: keepOff = false } = {}) {
  const key = a.id + '|' + b.id + '|' + B.towns.map(t => t[0]).join() + (keepOff ? '|own' : '');
  if (ROUTES.has(key)) return ROUTES.get(key);
  const A = a.at, Bt = b.at, L = Math.hypot(Bt[0] - A[0], Bt[1] - A[1]) || 1;
  const own = (x, z) => { let n = 0; for (const [id, f] of B.towns) if (id === a.id || id === b.id) for (const g of f.gates) if (gateDist(x, z, g) < .45) n++; return n; };
  const inA = p => TOWNS[a.id] ? rectDist(p[0], p[1], footprint(a.id).rect) < -.15 : Math.hypot(p[0] - A[0], p[1] - A[1]) < (a.capital ? CITY.plaza : 1.6);
  const inB = p => TOWNS[b.id] ? rectDist(p[0], p[1], footprint(b.id).rect) < -.15 : Math.hypot(p[0] - Bt[0], p[1] - Bt[1]) < (b.capital ? CITY.plaza : 1.6);
  const dirs = [null, ...Array.from({ length: 8 }, (_, i) => i / 8 * Math.PI * 2)];
  let best = null;
  for (const d1 of dirs) for (const d2 of dirs) for (const r of [.3, .55, .85]) {
    if ((d1 === null) !== (d2 === null) || (d1 === null && r > .3)) continue;
    const c1 = d1 === null ? [lerp(A[0], Bt[0], 1 / 3), lerp(A[1], Bt[1], 1 / 3)] : [A[0] + Math.cos(d1) * L * r, A[1] + Math.sin(d1) * L * r];
    const c2 = d2 === null ? [lerp(A[0], Bt[0], 2 / 3), lerp(A[1], Bt[1], 2 / 3)] : [Bt[0] + Math.cos(d2) * L * r, Bt[1] + Math.sin(d2) * L * r];
    const raw = [], n = Math.ceil(L * 1.6 / step);
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = 1 - t, w0 = u * u * u, w1 = 3 * u * u * t, w2 = 3 * u * t * t, w3 = t * t * t;
      raw.push([w0 * A[0] + w1 * c1[0] + w2 * c2[0] + w3 * Bt[0], w0 * A[1] + w1 * c1[1] + w2 * c2[1] + w3 * Bt[1]]);
    }
    let i0 = 0, i1 = raw.length - 1;
    while (i0 < i1 && inA(raw[i0])) i0++;
    while (i1 > i0 && inB(raw[i1])) i1--;
    const pts = raw.slice(Math.max(0, i0 - 1), i1 + 2);
    let hits = 0, len = 0;
    for (let i = 0; i < pts.length; i++) {
      const [x, z] = pts[i];
      if (B.hit(x, z, .45, [a.id, b.id])) hits++;
      // a spoke keeps off its own board too, past its depot (an outpost's ran along its own edge)
      if (keepOff && i && TOWNS[a.id] && rectDist(x, z, footprint(a.id).rect) < .3) hits++;
      hits += own(x, z);
      if (i) len += Math.hypot(x - pts[i - 1][0], z - pts[i - 1][1]);
    }
    // a road that doubles back on itself (a loop) is no road: count sharp turns as hits
    for (let i = 2; i < pts.length; i++) {
      const ax = pts[i - 1][0] - pts[i - 2][0], az = pts[i - 1][1] - pts[i - 2][1], bx = pts[i][0] - pts[i - 1][0], bz = pts[i][1] - pts[i - 1][1];
      if (ax * bx + az * bz < 0) hits++;
    }
    const score = hits * 100 + len;
    if (!best || score < best.score) best = { pts, hits, len, score };
  }
  ROUTES.set(key, best);
  return best;
}

/* Spokes (the ring, part 1b; owner, 2026-11-22: "the connecting roads and trains come from the vaults"). Every place
   has one road in to the Capital: it leaves a depot just past its board's inner edge, level with its vault (an
   outpost's stockpile stands by its entrance, so its depot is in the middle of that edge), and ends at a station on the
   plaza's edge. Goods between two places ride one spoke in, round the plaza and the other spoke out, so every road on
   the map runs from a vault through the middle and none crosses a raider road. */
const DEPOT_OUT = .55;  // how far past the board's inner edge a depot stands (board units)
/* How far a road or rail bed reaches each side of its middle (map units), and how far land props keep from a route's
   middle besides their own size: past the bed with a little dirt between (the ring, part 1b review: the Ridge's rocks
   touched its rail when props kept .6 against a bed of .66). */
export const BED = .66;
export const ROUTE_CLEAR = .85;
export const STATION_R = () => CITY.plaza + .8; // a station's distance from the Capital's middle (map units): a rail bed reaches .66 each side of its middle, so it clears the plaza
export function depotOf(id) {
  const B = TOWNS[id].board, x0 = TOWNS[id].kind === 'outpost' ? B.cols / 2 : Math.max(.8, Math.min(B.cols - .8, B.vault[0]));
  // a board whose river runs out by its vault: the depot steps along the edge until it stands on dry ground (review of
  // 2026.11.24-5: Silver Falls' depot stood on the water)
  const wet = B.river ? B.river.path.concat([B.vault]) : null, clear = B.river ? (B.river.width || 1.1) / 2 + .7 : 0;
  for (const d of [0, -1, 1, -1.5, 1.5, -2, 2, -2.5, 2.5, -3, 3]) {
    const x = Math.max(.8, Math.min(B.cols - .8, x0 + d));
    if (!wet || polyDist(x, B.rows + DEPOT_OUT, wet) > clear) return toMap(id, [x, B.rows + DEPOT_OUT]);
  }
  return toMap(id, [x0, B.rows + DEPOT_OUT]);
}
const ringAt = a => [CAPITAL[0] + Math.sin(a) * STATION_R(), CAPITAL[1] + Math.cos(a) * STATION_R()];
const angleOf = ([x, z]) => Math.atan2(x - CAPITAL[0], z - CAPITAL[1]);
/* Where each place's station stands on the plaza's ring (an angle round the Capital): where its road meets the ring,
   spread so no two stand closer than STATION_GAP, or their trains and wagons would run side by side into the plaza
   (the ring, part 2: Silver Falls' and Sandy Bend's roads met the ring 0.9 apart, and their wagons turning there
   overlapped). Worked out once for a set of blockers. */
export const STATION_GAP = .5;
function stationAngles(B) {
  if (B.stations) return B.stations;
  const raw = B.towns.map(([id]) => {
    const r = routeLine({ id, at: depotOf(id) }, { id: 'capital', at: CAPITAL, capital: true }, B, .3, { own: true });
    const hit = r.pts.find(p => Math.hypot(p[0] - CAPITAL[0], p[1] - CAPITAL[1]) <= STATION_R()) || r.pts[r.pts.length - 1];
    return { id, a: angleOf(hit) };
  }).sort((x, y) => x.a - y.a);
  const wrap = d => { while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
  for (let pass = 0; pass < 40 && raw.length > 1; pass++) for (let i = 0; i < raw.length; i++) {
    const a = raw[i], b = raw[(i + 1) % raw.length], d = wrap(b.a - a.a);
    if (d < STATION_GAP) { const push = (STATION_GAP - d) / 2 + 1e-4; a.a -= push; b.a += push; }
  }
  B.stations = Object.fromEntries(raw.map(r => [r.id, r.a]));
  return B.stations;
}
/* One place's spoke: { pts (depot first, station last), hits, len, depot, station }. Its last stretch bends round to
   its station (radius and angle eased together, so it never cuts into the plaza). */
export function spokeLine(id, B) {
  const depot = depotOf(id), r = routeLine({ id, at: depot }, { id: 'capital', at: CAPITAL, capital: true }, B, .3, { own: true });
  const pts = [depot], R = STATION_R(), BEND = 1.4;
  for (const p of r.pts) {
    if (Math.hypot(p[0] - CAPITAL[0], p[1] - CAPITAL[1]) <= R + BEND) break;
    if (p === r.pts[0] || rectDist(p[0], p[1], footprint(id).rect) < 0) continue;
    pts.push(p);
  }
  const want = (stationAngles(B)[id] ?? angleOf(pts[pts.length - 1])), last = pts[pts.length - 1];
  const r0 = Math.hypot(last[0] - CAPITAL[0], last[1] - CAPITAL[1]), a0 = angleOf(last);
  let d = want - a0; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
  const n = Math.max(2, Math.ceil(Math.hypot(r0 - R, d * R) / .3));
  for (let i = 1; i <= n; i++) {
    const f = i / n, e = f * f * (3 - 2 * f), rr = r0 + (R - r0) * f, a = a0 + d * e;
    pts.push([CAPITAL[0] + Math.sin(a) * rr, CAPITAL[1] + Math.cos(a) * rr]);
  }
  const station = pts[pts.length - 1];
  return { pts, hits: r.hits, depot, station };
}
/* Round the plaza from one station to another, the short way. */
export function plazaArc(s1, s2, step = .3) {
  const a1 = angleOf(s1); let d = angleOf(s2) - a1;
  while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
  const n = Math.max(1, Math.ceil(Math.abs(d) * STATION_R() / step)), out = [];
  for (let i = 1; i < n; i++) out.push(ringAt(a1 + d * i / n));
  return out;
}
/* The whole road between two places: from's spoke in, round the plaza, to's spoke out. */
export function linkLine(from, to, B) {
  const a = spokeLine(from, B), b = spokeLine(to, B);
  return { pts: [...a.pts, ...plazaArc(a.station, b.station), ...b.pts.slice().reverse()], hits: a.hits + b.hits };
}

/* Mesas round the map's edge, every one a little different: a broad mesa, a tall butte, a thin spire, a two-step, or a
   long ridge. Each takes the colors of the town nearest it (Iron Ridge's grays, Pine Hollow's browns, the Gulch's reds).
   [{ x, z, s, kind, ry, sx, sz, h, colors }] */
const KINDS = ['mesa', 'butte', 'spire', 'step', 'ridge'];
export function mesaPlan(box, sites, seed = 41, n = 16) {
  const R = seeded(seed), cx = (box.x0 + box.x1) / 2, cz = (box.z0 + box.z1) / 2, out = [];
  const looks = sites.filter(s => TOWNS[s.id] && TOWNS[s.id].board.look.mesa).map(s => [s.at, TOWNS[s.id].board.look.mesa]);
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2 + R() * .25, rx = (box.x1 - box.x0) / 2 + 13 + R() * 9, rz = (box.z1 - box.z0) / 2 + 12 + R() * 7;
    const x = cx + Math.cos(a) * rx, z = cz + Math.sin(a) * rz, kind = KINDS[(i * 3 + Math.floor(R() * 2)) % KINDS.length];
    const s = kind === 'spire' ? 1 + R() * .8 : kind === 'butte' ? 1.8 + R() * 1.2 : 2.6 + R() * 2.6;
    const h = kind === 'spire' ? 4 + R() * 3 : kind === 'butte' ? 4 + R() * 2.5 : kind === 'ridge' ? 2 + R() * 1.5 : 2.5 + R() * 2.5;
    let near = null, nd = Infinity;
    for (const [[sx, sz], c] of looks) { const d = Math.hypot(x - sx, z - sz); if (d < nd && d < 17) { nd = d; near = c; } }
    out.push({ x, z, s, kind, h, ry: R() * Math.PI, sx: kind === 'ridge' ? 2.2 + R() : .8 + R() * .5, sz: kind === 'ridge' ? .55 : .8 + R() * .4, colors: near || ['#b35a3a', '#d98a55', '#a94f33', '#e0a46c'] });
  }
  return out;
}

/* The land that fits a town, as props round its board: [{ kind, x, z, s, ry }]. kind is one of pine (Pine Hollow),
   hoodoo (the Gulch's red rock pillars), crag (Iron Ridge's gray rock ridges), dune (Sandy Bend), sage (Dry Creek's
   scrub), reed (Silver Falls' green banks). free(x, z, m) says whether a spot is clear. */
export const FLAVOR = {
  pinehollow: { kind: 'pine', n: 46, from: .6, to: 6.5 },
  gulch: { kind: 'hoodoo', n: 9, from: .9, to: 4.5 },
  ridge: { kind: 'crag', n: 14, from: .9, to: 5.5 },
  sandybend: { kind: 'dune', n: 7, from: .8, to: 6 },
  drycreek: { kind: 'sage', n: 18, from: .6, to: 5.5 },
  falls: { kind: 'reed', n: 16, from: .5, to: 4.5 },
  mesa: { kind: 'hoodoo', n: 9, from: .9, to: 4.5 }, // Thunder Mesa's own red rock pillars, in its darker tones
};
export function flavor(id, free, seed = 7) {
  const F = FLAVOR[id];
  if (!F) return [];
  const R = seeded(seed + id.length * 13), { rect } = footprint(id), out = [];
  for (let i = 0; i < F.n * 30 && out.length < F.n; i++) {
    const a = R() * Math.PI * 2, d = F.from + R() * (F.to - F.from);
    // a point d out from the rect's edge in direction a (pushed out from the nearest edge point)
    // in the board's own frame, then turned with it
    const ex = Math.max(-rect.hx, Math.min(rect.hx, Math.cos(a) * (rect.hx + 3))), ez = Math.max(-rect.hz, Math.min(rect.hz, Math.sin(a) * (rect.hz + 3)));
    const [lx, lz] = spin(rect.rot || 0, [ex + Math.cos(a) * d, ez + Math.sin(a) * d]), x = rect.x + lx, z = rect.z + lz;
    const m = F.kind === 'dune' ? 1.2 : F.kind === 'crag' || F.kind === 'hoodoo' ? .8 : .35;
    if (!free(x, z, m)) continue;
    if (out.some(p => Math.hypot(p.x - x, p.z - z) < (F.kind === 'pine' ? .55 : F.kind === 'dune' ? 2.2 : 1.1))) continue;
    out.push({ kind: F.kind, x, z, s: .8 + R() * .6, ry: R() * Math.PI * 2 });
  }
  return out;
}

/* Where the surveyors camp on land not open yet: a tent, a fire and a tripod, set off the plot's middle. */
export const camp = at => ({ tent: [at[0] - 1.05, at[1] + .7], fire: [at[0] - .35, at[1] + 1.05], tripod: [at[0] + .9, at[1] - .55] });

/* A route is a dirt road until the Rail Office is founded at the Capital; then every route is laid with rails. */
export const routeKind = game => (game.shared && game.shared.tree && (game.shared.tree.founded || []).includes('transport') ? 'rail' : 'road');

/* A height bump for the dunes round Sandy Bend (0 far away). */
export function duneHeight(x, z) {
  const f = footprint('sandybend').rect, d = rectDist(x, z, f);
  if (d < .8 || d > 8) return 0;
  const k = Math.min(1, (d - .8) / 1.5) * Math.min(1, (8 - d) / 2);
  const s = Math.sin((x * .55 + z * .9) * 1.6 + Math.sin(z * .4) * 1.5);
  return k * Math.max(0, s) * .45;
}
export { lerp };
