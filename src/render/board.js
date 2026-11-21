/* A town's board in 3D: the ground with its road and plots, mesas beyond, scenery, the vault, and a model on every
   plot (survey stakes until it is built, then the building at its milestone tier). Moving parts run while a building
   works, and chimneys smoke. `new Board(town, { lod })`: lod 'low' trims scenery for background boards and weak phones.
   The board reads the town; it never changes it. */
import * as THREE from 'three';
import { makeGround, makeMesas, polyDist, fbm, sstep, lerp } from './terrain.js';
import { rng, mergeStatic, Kit } from './kit.js';
import { makeBuilding, makeVault, makeStockpile, PROPS } from '../assets/models/gulch.js';
import { BUILDINGS } from '../data/buildings.js';
import { unlocked } from '../core/economy.js';
import { Entrance } from './entrance.js';
import { isPitSpot } from '../data/towns/index.js';
import '../assets/models/ridge.js'; // adds the Iron Ridge and Pine Hollow recipes to makeBuilding
import '../assets/models/falls.js'; // and the Silver Falls and Sandy Bend ones

// scratch objects reused every frame (no garbage for the collector to stutter on)
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _sc = new THREE.Vector3(), _pos = new THREE.Vector3();
export const tierOf = level => level >= 100 ? 4 : level >= 50 ? 3 : level >= 25 ? 2 : level >= 10 ? 1 : 0;
const MAXPUFF = 80;

export class Board {
  constructor(town, { lod = 'full' } = {}) {
    this.town = town; this.def = town.def.board; this.lod = lod;
    this.group = new THREE.Group(); this.group.name = 'board:' + town.id;
    this.bld = {}; this.pickables = [];
    const B = this.def, look = B.look, RIV = B.river ? B.river.path.concat([B.vault]) : null;
    const riverD = (x, z) => RIV ? polyDist(x, z, RIV).d : Infinity;
    const gates = [B.entrance, B.river && B.river.entrance].filter(Boolean);
    this.center = new THREE.Vector3(B.cols / 2, 0, B.rows / 2);
    const plots = Object.values(B.plots);
    const onPlot = (x, z, m = 1.05) => plots.some(([px, pz]) => Math.abs(x - px) < m && Math.abs(z - pz) < m);
    const outside = (x, z) => Math.max(0 - x, x - B.cols, -1 - z, z - B.rows, 0);
    const height = (x, z) => {
      const o = outside(x, z);
      let h = sstep(1.5, 8, o) * (fbm(x * .18, z * .18) * 2.8 + o * .07) + (fbm(x * .9, z * .9) - .5) * .08;
      const r = polyDist(x, z, B.road);
      if (r.d < .8) h = lerp(-.05, h, sstep(.5, .8, r.d));
      const rd = riverD(x, z);
      if (rd < 1.2) h = lerp(-.14, h, sstep(.55, 1.2, rd)); // the riverbed, a little under the water
      if (onPlot(x, z, 1.15)) h = Math.min(h, 0); // plots are level
      // so are the pads, and a wider floor round each mortar pit (its dead zone lies on it)
      (B.spots || []).forEach(([sx, sz], i) => { const pit = isPitSpot(B, i), d = Math.hypot(x - sx, z - sz), a = pit ? 1.7 : .8, b = pit ? 2.8 : 1.4; if (d < b) h = lerp(Math.min(h, 0), h, sstep(a, b, d)); });
      return h;
    };
    const sand = new THREE.Color(look.sand), sandD = new THREE.Color(look.sandD), dirt = new THREE.Color(look.dirt), rut = new THREE.Color(look.rut);
    // a plot's yard: the town's own ground, a little toward its dirt (review of 2026.11.20-6: a fixed orange on the gray
    // Ridge and Falls ground read as every building glowing at once); in Copper Gulch it is the old #c79b6b, near enough
    const pad = sand.clone().lerp(dirt, .28);
    const color = (x, z, c) => {
      c.copy(sand).lerp(sandD, fbm(x * .5 + 3, z * .5));
      if (onPlot(x, z)) c.lerp(pad, .7);
      const r = polyDist(x, z, B.road);
      if (r.d < 1.1) c.lerp(dirt, (1 - sstep(.6, 1.1, r.d)) * .5); // trampled verges; the road itself is a ribbon
      if (RIV) { const rd = riverD(x, z); if (rd < 1.4) c.lerp(GREEN, (1 - sstep(.7, 1.4, rd)) * .55); } // reeds and grass on the banks
    };
    this.ground = makeGround({ cx: B.cols / 2, cz: B.rows / 2, w: 64, d: 56, seg: lod === 'low' ? 72 : 112, height, color });
    this.group.add(this.ground, roadRibbon(B.road, [dirt, rut, sand.clone().lerp(dirt, .55)]));
    if (RIV) this.group.add(riverRibbon(RIV, look, (B.river.width || 1.1))), this.group.add(...bridges(B.road, RIV));
    const cx = B.cols / 2, cz = B.rows / 2;
    const scenery = [makeMesas([[cx - 16, cz - 17, 4.5], [cx - 11, cz - 21, 6], [cx + 9, cz - 18, 5], [cx + 20, cz - 11, 4], [cx - 22, cz - 5, 3.5], [cx + 23, cz + 3, 3], [cx - 21, cz + 9, 3]], look.mesa)];
    // scenery outside the yard, never on the road or a plot
    const R = rng(town.id.length * 31 + 5), n = lod === 'low' ? 14 : 46;
    for (let i = 0, placed = 0; i < n * 4 && placed < n; i++) {
      const x = -4 + R() * (B.cols + 8), z = -3 + R() * (B.rows + 6);
      const inGate = gates.some(e => Math.abs(x - e.mouth[0]) < e.width / 2 + 3.2 && z < e.mouth[1] + 1.4); // the canyon and its walls
      if (inGate || polyDist(x, z, B.road).d < 1.1 || riverD(x, z) < 1.3 || onPlot(x, z, 1.4) || Math.hypot(x - B.vault[0], z - B.vault[1]) < 1.4 || (B.spots || []).some(([sx, sz]) => Math.hypot(x - sx, z - sz) < .9)) continue;
      const kind = R() < .4 ? 'cactus' : R() < .55 ? 'rock' : R() < .7 ? 'shrub' : 'boulder', o = PROPS[kind](1, i * 13);
      o.position.set(x, Math.max(0, height(x, z)), z); o.rotation.y = R() * 6; o.scale.setScalar(.7 + R() * .6);
      scenery.push(o); placed++;
    }
    // all of it is static: one mesh per material instead of a draw call (and a shadow draw) per rock and cactus
    this.group.add(mergeStatic(scenery));
    scenery.forEach(disposeTree);
    this.vault = town.def.store === 'stockpile' ? makeStockpile() : makeVault(1); this.vault.position.set(B.vault[0], 0, B.vault[1]); this.vault.rotation.y = 0; this.group.add(this.vault);
    // where the raiders come from (every lane has one; see src/assets/models/entrances.js)
    this.entrances = gates.map(e => new Entrance(this, e));
    this.entrance = this.entrances[0] || null;
    // smoke puffs: one instanced mesh for the whole board
    this.puffs = []; this.smokeT = 0;
    this.smoke = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.09, 0), new THREE.MeshLambertMaterial({ color: '#ece6de', flatShading: true, transparent: true, opacity: .75, depthWrite: false }), MAXPUFF);
    this.smoke.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.smoke.count = 0; this.smoke.frustumCulled = false;
    this.group.add(this.smoke);
    // tap targets for towers (owner: towers were hard to tap): a tower is tall, so a tap on its top used to land on the
    // ground behind it. An invisible post a little wider and taller than a tower stands on every pad; pick.js tests the
    // posts of pads that have a tower (an empty pad is flat and found on the ground, and its post would hide what is
    // behind it). Buildings are tested by their own models, then the ground.
    this.hits = [];
    const hidden = new THREE.MeshBasicMaterial({ visible: false }), post = new THREE.CylinderGeometry(.62, .62, 1.6, 8); post.translate(0, .8, 0);
    (B.spots || []).forEach(([sx, sz], i) => { const m = new THREE.Mesh(post, hidden); m.position.set(sx, 0, sz); m.userData.spot = i; m.updateMatrixWorld(true); this.hits.push(m); this.group.add(m); });
    this.sync();
  }

  /* Make each plot's model match the town: rebuilt only when a plot's tier (or built/locked state) changes. */
  sync() { for (const id of Object.keys(this.def.plots)) this.place(id); }
  place(id) {
    const level = this.town.level(id), key = level > 0 ? 'b' + tierOf(level) : unlocked(this.town, id) ? 'lot' : 'lock';
    const cur = this.bld[id];
    if (cur && cur.key === key) { cur.level = level; return; }
    if (cur) { this.group.remove(cur.obj); this.pickables = this.pickables.filter(o => o.userData.plot !== id); disposeTree(cur.obj); }
    const b = level > 0 ? makeBuilding(BUILDINGS[id].model, tierOf(level)) : makeBuilding('_lot');
    const [x, z] = this.def.plots[id];
    b.obj.position.set(x, 0, z);
    if (key === 'lock') b.obj.scale.setScalar(.85);
    b.obj.traverse(o => { o.userData.plot = id; if (o.isMesh) this.pickables.push(o); });
    this.group.add(b.obj);
    this.bld[id] = { ...b, key, level, born: cur ? 0 : 1 };
  }
  /* What the camera frames at home: the town's frame from its data, or else every plot that is built or can be built. */
  focus() {
    if (this.def.frame) return this.def.frame;
    const xs = [], zs = [];
    for (const [id, [x, z]] of Object.entries(this.def.plots)) if (this.town.level(id) > 0 || unlocked(this.town, id)) { xs.push(x); zs.push(z); }
    if (!xs.length) { xs.push(this.center.x); zs.push(this.center.z); }
    let x0 = Math.min(...xs) - 1, x1 = Math.max(...xs) + 1;
    if (x1 - x0 < 8) { const c = (x0 + x1) / 2; x0 = Math.max(0, c - 4); x1 = x0 + 8; }
    // from the top of the yard down past the road and its far-side tower spots
    const z0 = Math.min(...zs) - 1, z1 = Math.max(...this.def.spots.map(s => s[1])) + .6;
    return { x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0 + .6, d: z1 - z0 };
  }
  /* The plot under a ground point, or null. */
  plotAt(x, z) {
    for (const [id, [px, pz]] of Object.entries(this.def.plots)) if (Math.abs(x - px) <= 1 && Math.abs(z - pz) <= 1) return id;
    return null;
  }
  /* The tower spot within reach of a ground point, or null. */
  spotAt(x, z, reach = .6) {
    let best = null, bd = reach;
    this.def.spots.forEach(([sx, sz], i) => { const d = Math.hypot(x - sx, z - sz); if (d < bd) { bd = d; best = i; } });
    return best;
  }
  /* A point above a plot's model, for labels. */
  anchor(id, out = new THREE.Vector3()) { const [x, z] = this.def.plots[id], b = this.bld[id]; return out.set(x, (b ? b.top : 1) + .3, z); }

  /* Animate: t is seconds; working(id) says whether a building is producing right now. */
  update(dt, t, working = () => true, view = null) {
    for (const e of this.entrances) e.update(dt, view);
    for (const [id, b] of Object.entries(this.bld)) {
      const on = b.level > 0 && working(id);
      for (const m of b.movers) {
        if (m.kind === 'spin' && on) m.node.rotation[m.axis] += m.speed * dt * .5;
        else if (m.kind === 'hot') m.node.visible = on;
        else if (m.kind === 'cart' && on) m.node.position.z = (m.z0 ??= m.node.position.z) + Math.sin(t * 1.6) * .14;
        else if (m.kind === 'hammer') m.node.rotation.z = on ? -Math.abs(Math.sin(t * 5)) * .9 : 0;
        else if (m.kind === 'flag') m.node.rotation.y = Math.sin(t * 3 + b.obj.position.x) * .3;
      }
      if (on && b.smoke.length && this.lod !== 'low') {
        b.puffT = (b.puffT || Math.random() * .7) - dt;
        if (b.puffT <= 0) {
          b.puffT = .7;
          for (const s of b.smoke) if (this.puffs.length < MAXPUFF) this.puffs.push({ p: b.obj.localToWorld(s.clone()), age: 0, drift: Math.random() * 6.28 });
        }
      }
    }
    // smoke: rises, swells, drifts, and shrinks away
    const m = _m, q = _q, sc = _sc, pos = _pos;
    this.puffs = this.puffs.filter(p => (p.age += dt) < 3.2);
    this.puffs.forEach((p, i) => {
      const a = p.age / 3.2, s = (.7 + a * 1.6) * (a > .6 ? (1 - a) / .4 : 1);
      pos.set(p.p.x + Math.sin(p.drift + a * 3) * .15 + a * .35, p.p.y + p.age * .42, p.p.z + Math.cos(p.drift) * .1);
      sc.setScalar(s); m.compose(pos, q, sc); this.smoke.setMatrixAt(i, m);
    });
    this.smoke.count = this.puffs.length; this.smoke.instanceMatrix.needsUpdate = true;
  }
  dispose() { disposeTree(this.group); }
}

const GREEN = new THREE.Color('#7f9150');
/* The river: a ribbon of water, darker in the middle where it runs deep, with pale foam along the banks. One mesh, no
   moving parts (the boats show the current). w is its width in board units. */
export function riverRibbon(pts, look, w = 1.1) {
  const water = new THREE.Color(look.water || '#3f7fa8'), deep = new THREE.Color(look.waterD || '#2f6488'), foam = new THREE.Color(look.foam || '#9cc8d8');
  const m = roadRibbon(pts, [water, deep, foam], w / 1.32, -.03, [[-.66, foam], [-.56, water], [-.3, water], [-.18, deep], [.18, deep], [.3, water], [.56, water], [.66, foam]]);
  m.name = 'river'; m.material.userData.own = true;
  return m;
}
/* A plank bridge wherever the road crosses the river: [mesh]. It arches up to BRIDGE over the water, high enough
   that boats and the steamer's hull pass under it (review of 2026.11.20-10: the steamer sailed through a 0.22 deck),
   and raiders on the road walk over it along the same curve (bridgeLift, used by src/render/battle.js). */
export const BRIDGE = .55;
/* How high the road stands at a point d from the river's middle: flat at BRIDGE over the water, easing down to the
   ground 1 away. */
export const bridgeLift = d => { const s = Math.min(1, Math.max(0, (1 - d) / .45)); return BRIDGE * s * s * (3 - 2 * s); };
export function bridges(road, river) {
  const out = [], step = .1, path = new THREE.CurvePath();
  for (let i = 0; i < road.length - 1; i++) path.add(new THREE.LineCurve3(new THREE.Vector3(road[i][0], 0, road[i][1]), new THREE.Vector3(road[i + 1][0], 0, road[i + 1][1])));
  const n = Math.ceil(path.getLength() / step), pts = path.getSpacedPoints(n);
  let run = null;
  const done = () => { if (run && run.length > 2) out.push(run); run = null; };
  for (const p of pts) { if (polyDist(p.x, p.z, river).d < 1) (run || (run = [])).push(p); else done(); }
  done();
  const k = new Kit(), lift = (x, z) => bridgeLift(polyDist(x, z, river).d);
  for (const r of out) {
    const a = r[0], b = r[r.length - 1], len = Math.hypot(b.x - a.x, b.z - a.z), ry = Math.atan2(b.x - a.x, b.z - a.z);
    const dx = Math.sin(ry), dz = Math.cos(ry), cx = Math.cos(ry), cz = -Math.sin(ry), segs = Math.max(4, Math.round(len / .16));
    for (let i = 0; i < segs; i++) {
      const t0 = i / segs * len, t1 = (i + 1) / segs * len, x0 = a.x + dx * t0, z0 = a.z + dz * t0, x1 = a.x + dx * t1, z1 = a.z + dz * t1;
      const h0 = lift(x0, z0), h1 = lift(x1, z1), sl = t1 - t0, rx = -Math.atan2(h1 - h0, sl), l = Math.hypot(sl, h1 - h0) + .02, mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, mh = (h0 + h1) / 2;
      k.box(mx, mh - .07, mz, 1.15, .07, l, 'woodL', { ry, rx });                                        // the deck
      k.box(mx, mh, mz, 1.2, .015, .05, 'woodD', { ry, ao: false });                                     // a plank
      for (const s of [-1, 1]) k.box(mx + cx * s * .56, mh + .17, mz + cz * s * .56, .04, .04, l, 'wood', { ry, rx }); // the rails
      if (i % 2 === 0) for (const s of [-1, 1]) k.box(x0 + cx * s * .55, -.1, z0 + cz * s * .55, .08, h0 + .37, .08, 'woodD'); // the posts
    }
    for (const s of [-1, 1]) k.box(b.x + cx * s * .55, -.1, b.z + cz * s * .55, .08, lift(b.x, b.z) + .37, .08, 'woodD');
  }
  return out.length ? [k.build()] : [];
}

/* The road: a flat ribbon of packed dirt along the polyline, with two dark wheel ruts and lighter edges; w scales
   its width (the empire map's routes are narrower). */
export function roadRibbon(pts, [dirt, rut, edge], w = 1, y = .015, cross = null) {
  const path = new THREE.CurvePath();
  for (let i = 0; i < pts.length - 1; i++) path.add(new THREE.LineCurve3(new THREE.Vector3(pts[i][0], 0, pts[i][1]), new THREE.Vector3(pts[i + 1][0], 0, pts[i + 1][1])));
  const n = Math.ceil(path.getLength() / .2), samples = path.getSpacedPoints(n);
  // smooth the corners a little so the road bends instead of kinking
  for (let pass = 0; pass < 3; pass++) for (let i = 1; i < samples.length - 1; i++) samples[i].lerp(samples[i - 1].clone().add(samples[i + 1]).multiplyScalar(.5), .5);
  // bands across the road: [offset from center, color]
  const bands = cross || [[-.66, edge], [-.52, dirt], [-.3, dirt], [-.24, rut], [-.17, dirt], [.17, dirt], [.24, rut], [.3, dirt], [.52, dirt], [.66, edge]];
  const pos = [], col = [], idx = [];
  samples.forEach((p, i) => {
    const a = samples[Math.max(0, i - 1)], b = samples[Math.min(samples.length - 1, i + 1)], dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1;
    const nx = -dz / L, nz = dx / L, j = ((i * 7919) % 13) / 13 * .06;
    for (const [o, c] of bands) { pos.push(p.x + nx * o * w, y, p.z + nz * o * w); col.push(c.r * (1 - j), c.g * (1 - j), c.b * (1 - j)); }
    if (i) { const w = bands.length, s0 = (i - 1) * w, s1 = i * w; for (let k = 0; k < w - 1; k++) idx.push(s0 + k, s0 + k + 1, s1 + k, s0 + k + 1, s1 + k + 1, s1 + k); } // counter-clockwise from above
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.receiveShadow = true; m.name = 'road';
  return m;
}

export function disposeTree(o) {
  o.traverse(n => { if (n.geometry) n.geometry.dispose(); if (n.material && n.material.userData && n.material.userData.own) n.material.dispose(); });
}
