/* A little life on a town's board (PLAN.md M5b, Towns part 2): townsfolk walking between the buildings, a freight
   wagon on the road between waves, tumbleweeds rolling with the wind, and birds circling high. All of it is pooled:
   one instanced mesh per kind (the wagon is one small group), made once and moved every frame, so nothing is made or
   thrown away while it runs. None of it is in board.pickables or board.hits, so pick.js never finds it and a tap goes
   through to the pad or building behind. The walks and lanes come from src/render/life-plan.js, which keeps them off
   every pad, building, the vault, the river and the entrances. During a wave the townsfolk stay indoors and the wagon
   leaves the road, so nothing on the road is mistaken for a raider. How much shows depends on the graphics tier. */
import * as THREE from 'three';
import { Kit, MAT } from './kit.js';
import { WalkGrid, walkNodes, tumbleLane, blocker, seeded } from './life-plan.js';
import { makePath, pointAt } from '../core/path.js';

// how many of each by graphics tier (the wagon is one); low keeps a few, so a weak phone still sees a town that lives
export const LIFE = {
  low: { folk: 3, weeds: 1, birds: 0, wagon: true },
  med: { folk: 8, weeds: 2, birds: 4, wagon: true },
  high: { folk: 12, weeds: 3, birds: 6, wagon: true },
};
const MAXF = 12, MAXW = 3, MAXB = 6;
const SIZE = 1.15; // a person, a little over life size next to the buildings, so they read as people on a phone (review of 2026.11.21-3)
const SHIRTS = ['#c9543f', '#5b8bc0', '#e8b84a', '#6aa067', '#efe6d2', '#9a6bc0', '#8a5532', '#4f6a92'];

// one geometry from kit parts (solid parts only), for an instanced mesh
function geo(make) {
  const k = new Kit({ aoH: .45 }); make(k);
  const g = k.build({ cast: false }).children[0].geometry;
  return g;
}
// a townsperson's clothes (white, tinted per person) and the rest of them (skin, hat, boots: never tinted)
const clothes = () => geo(k => {
  k.box(-.035, .0, 0, .05, .14, .06, '#d8d0c4'); k.box(.035, 0, 0, .05, .14, .06, '#d8d0c4'); // trousers
  k.box(0, .14, 0, .13, .13, .08, '#ffffff');                                                    // shirt
  k.box(-.08, .15, 0, .03, .11, .04, '#ffffff'); k.box(.08, .15, 0, .03, .11, .04, '#ffffff');  // sleeves
});
const person = () => geo(k => {
  k.box(-.035, -.005, .005, .055, .03, .075, 'black'); k.box(.035, -.005, .005, .055, .03, .075, 'black'); // boots
  k.box(0, .27, 0, .08, .08, .08, 'skin');                                                     // head
  k.cyl(0, .34, 0, .085, .015, 'bark', { seg: 8, ao: false }); k.cyl(0, .35, 0, .045, .045, 'bark', { seg: 8, ao: false }); // hat
});
const weedGeo = () => geo(k => {
  k.ball(0, 0, 0, .1, '#8a6438', { det: 1, ao: false });
  for (let i = 0; i < 6; i++) k.torus(0, 0, 0, .14 + (i % 3) * .015, .011, i % 2 ? '#b08850' : '#9a7444', { rx: i * 1.1, ry: i * .7, rs: 3, ts: 9, ao: false });
});
// a bird: two thin wings in a shallow V; scaling y flaps them
const birdGeo = () => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, .045, -.22, .07, -.02, 0, 0, -.045, 0, 0, .045, 0, 0, -.045, .22, .07, -.02], 3));
  return g;
};
// the freight wagon: a blue bed under a cream cover and a pair of horses (the bandits' wagon is brown and patched)
function wagonModel() {
  const root = new THREE.Group(); root.name = 'life:wagon';
  const body = new Kit({ aoH: .6 });
  body.box(0, .17, -.15, .36, .06, .56, 'woodD'); body.box(0, .23, -.15, .36, .1, .56, '#4f6f9a');
  body.cyl(0, .33, -.42, .17, .46, 'cream', { rx: Math.PI / 2, seg: 10 });
  for (const z of [-.4, -.2, 0]) body.torus(0, .33, z, .18, .012, 'woodD', { ts: 10 });
  body.box(0, .25, .17, .26, .04, .1, 'wood'); body.box(0, .36, .16, .1, .14, .08, '#6aa067'); body.box(0, .48, .16, .07, .07, .07, 'skin'); body.cyl(0, .53, .16, .08, .015, 'bark', { seg: 8 });
  for (const sx of [-1, 1]) { // two horses side by side
    const x = sx * .09;
    body.box(x, .2, .48, .09, .12, .28, sx < 0 ? 'woodD' : 'bark', { ao: false }); body.box(x, .28, .64, .06, .12, .07, sx < 0 ? 'woodD' : 'bark', { rx: -.5, ao: false }); body.box(x, .35, .7, .055, .06, .12, sx < 0 ? 'woodD' : 'bark', { ao: false });
    for (const [lx, lz] of [[-.03, .38], [.03, .38], [-.03, .58], [.03, .58]]) body.box(x + lx, 0, lz, .025, .2, .03, 'bark', { ao: false });
  }
  for (const sx of [-1, 1]) body.box(sx * .17, .2, .3, .015, .015, .3, 'woodL', { ao: false });
  root.add(body.build({ cast: false }));
  root.userData.wheels = [];
  for (const z of [-.33, .05]) { // an axle and its two wheels turn together
    const k = new Kit({ ao: false });
    for (const sx of [-1, 1]) { k.torus(sx * .2, 0, 0, .11, .018, 'woodD', { ry: Math.PI / 2, rs: 3, ts: 10 }); k.box(sx * .2, -.1, -.01, .012, .2, .02, 'wood'); k.box(sx * .2, -.01, -.1, .012, .02, .2, 'wood'); }
    const axle = k.build({ cast: false }); axle.position.set(0, .12, z); root.add(axle); root.userData.wheels.push(axle);
  }
  return root;
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
const HIDE = new THREE.Matrix4().makeScale(0, 0, 0);

export class Life {
  /* board: the Board; height(x, z): the ground there; roadY(x, z): how high the road stands (bridges). */
  constructor(board, height, roadY = () => 0, tier = 'med') {
    this.board = board; this.B = board.def; this.height = height; this.roadY = roadY;
    this.group = new THREE.Group(); this.group.name = 'life';
    this.R = seeded(board.town.id.length * 97 + 11);
    this.K = blocker(this.B); this.grid = null; this.routes = new Map(); this.nodes = [];
    const mesh = (g, mat, n) => { const m = new THREE.InstancedMesh(g, mat, n); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; m.castShadow = false; m.receiveShadow = false; this.group.add(m); return m; };
    this.cloth = mesh(clothes(), MAT.solid, MAXF); this.cloth.name = 'life:folk';
    this.body = mesh(person(), MAT.solid, MAXF);
    for (let i = 0; i < MAXF; i++) this.cloth.setColorAt(i, _c.set(SHIRTS[i % SHIRTS.length]));
    this.cloth.instanceColor.needsUpdate = true;
    this.weedM = mesh(weedGeo(), MAT.solid, MAXW); this.weedM.name = 'life:weeds';
    const birdMat = new THREE.MeshBasicMaterial({ color: '#2b2428', side: THREE.DoubleSide }); birdMat.userData.own = true;
    this.birdM = mesh(birdGeo(), birdMat, MAXB); this.birdM.name = 'life:birds';
    for (const m of [this.cloth, this.body, this.weedM, this.birdM]) for (let i = 0; i < m.count; i++) m.setMatrixAt(i, HIDE); // nothing shows until placed
    this.folk = Array.from({ length: MAXF }, (_, i) => ({ i, at: null, walk: null, s: 0, wait: this.R() * 3, speed: .42 + this.R() * .2, ph: this.R() * 6, yaw: 0, side: (i % 2 ? 1 : -1) * (.06 + this.R() * .1) }));
    this.lanes = []; this.laneTries = 0; // tumbleweed lanes, found one try a frame and kept (perf: a full search was a hitch)
    this.routeT = 0;
    // the first tumbleweed rolls as soon as a lane is found, while the town opens: the first one on screen cost a frame of
    // 117 ms on the software GPU of tools/perf.js however it was warmed (perf drift box, 2026.11.26-9), and a stall then
    // lands before any raider walks, not mid-wave six seconds in
    this.weeds = Array.from({ length: MAXW }, (_, i) => ({ lane: null, s: 0, wait: (w => i ? w : 0)(2 + this.R() * 6), speed: 1.1 + this.R() * .6, r: .12, ph: this.R() * 6, roll: 0 }));
    const c = board.center, b = this.B;
    this.birds = Array.from({ length: MAXB }, (_, i) => ({ cx: c.x + (this.R() - .5) * b.cols * .5, cz: c.z + (this.R() - .5) * b.rows * .5, r: 3.5 + this.R() * 5, y: 3.2 + this.R() * 1.4, w: (.16 + this.R() * .14) * (i % 3 ? 1 : -1), a: this.R() * 6.28, ph: this.R() * 6 }));
    // the wagon rides the road from just inside the entrance to a stop before the vault, and back
    const road = [...this.B.road, this.B.vault];
    this.lane = makePath(road);
    this.wagon = { obj: wagonModel(), s: 0, dir: 1, state: 'gone', wait: 0, scale: 0, yaw: 0, speed: .75, first: true };
    this.wagon.obj.visible = false; this.group.add(this.wagon.obj);
    this.start = (this.B.entrance && this.B.entrance.hide) || 0; this.stop = Math.max(this.start + 2, this.lane.length - 1.6);
    this.setTier(tier);
    this.sync(() => false);
  }
  /* The graphics tier changed: show more or less. */
  setTier(tier) { this.n = LIFE[tier] || LIFE.med; this.tier = tier; }
  /* Which plots have a building: the walks are worked out again (lazily, one a frame) when that changes. */
  sync(built) {
    const key = Object.keys(this.B.plots).filter(built).join();
    if (key === this.key) return;
    this.key = key;
    if (!this.grid) this.grid = new WalkGrid(this.B);
    this.nodes = walkNodes(this.B, built, this.grid);
    // a person's walk goes on; their next one starts from a door that still exists
  }
  route(a, b) {
    const k = a.id + '>' + b.id;
    if (!this.routes.has(k)) {
      if (this.budget <= 0) return undefined; // not this frame
      this.budget--; this.routeT = 0;
      const pts = this.grid.route(a.at, b.at);
      this.routes.set(k, pts ? this.walkOf(pts) : null);
    }
    return this.routes.get(k);
  }
  walkOf(pts) { const p = makePath(pts); p.h = pts.map(([x, z]) => Math.max(-.05, this.height(x, z))); return p; }

  /* dt, t: seconds; fighting: a wave is on the road. */
  update(dt, t, fighting) {
    // a new walk is worked out at most every 0.4 s, and a tumbleweed lane tried once a frame, so neither is a hitch
    this.routeT += dt; this.budget = this.routeT >= .4 ? 1 : 0;
    if (this.lanes.length < 4 && this.laneTries < 400 && this.n.weeds) {
      this.laneTries++;
      const l = tumbleLane(this.B, this.R, this.K, 1);
      if (l) { l.L = Math.hypot(l.to[0] - l.from[0], l.to[1] - l.from[1]); l.h = []; for (let s = 0; s <= l.L + 1; s += 1) { const k = Math.min(1, s / l.L); l.h.push(Math.max(-.05, this.height(l.from[0] + (l.to[0] - l.from[0]) * k, l.from[1] + (l.to[1] - l.from[1]) * k))); } this.lanes.push(l); }
    }
    const R = this.R, n = this.n;
    // townsfolk: walk a route, go in at the door, come out a little later for another. Each keeps their slot (and shirt);
    // a mesh draws only up to its last one out, and not at all when everyone is indoors (perf: an idle draw still costs)
    let lastF = -1, lastW = -1;
    for (const f of this.folk) {
      if (f.i >= Math.min(n.folk, this.nodes.length + 1) || this.nodes.length < 2) { this.cloth.setMatrixAt(f.i, HIDE); this.body.setMatrixAt(f.i, HIDE); f.walk = null; continue; }
      if (!f.walk) {
        f.wait -= dt;
        if (f.wait > 0 || fighting) { this.cloth.setMatrixAt(f.i, HIDE); this.body.setMatrixAt(f.i, HIDE); continue; }
        const from = (f.at && this.nodes.find(x => x.id === f.at)) || this.nodes[Math.floor(R() * this.nodes.length)];
        const to = this.nodes.filter(x => x !== from)[Math.floor(R() * (this.nodes.length - 1))];
        const w = to && this.route(from, to);
        if (w === undefined) { f.at = from.id; continue; } // worked out next frame
        if (!w) { f.at = to.id; f.wait = 1; continue; }
        f.walk = w; f.s = f.first === undefined ? R() * w.length * .8 : 0; f.first = 1; f.to = to.id; f.out = 1;
      }
      // when raiders come, everyone out of doors is gone within a second (review of 2026.11.21-3: people still on the road
      // while it read Fighting could be taken for raiders)
      if (fighting) f.out = Math.max(0, f.out - dt * 1.2);
      f.s += dt * f.speed * (fighting ? 2 : 1);
      const w = f.walk;
      if (f.out <= 0) { f.at = f.to; f.walk = null; f.wait = 2 + R() * 4; this.cloth.setMatrixAt(f.i, HIDE); this.body.setMatrixAt(f.i, HIDE); continue; }
      if (f.s >= w.length) { f.at = f.to; f.walk = null; f.wait = 2 + R() * 6; this.cloth.setMatrixAt(f.i, HIDE); this.body.setMatrixAt(f.i, HIDE); continue; }
      let [x, z] = pointAt(w, f.s); const [x2, z2] = pointAt(w, Math.min(w.length, f.s + .2));
      // each keeps to their own side of the way, so two on one walk pass instead of standing in each other
      const L = Math.hypot(x2 - x, z2 - z) || 1, off = f.side * Math.min(1, f.s / .5, (w.length - f.s) / .5);
      const nx = (z2 - z) / L, nz = -(x2 - x) / L; x += nx * off; z += nz * off;
      let seg = 1; while (seg < w.cum.length - 1 && w.cum[seg] < f.s) seg++;
      const k = (f.s - w.cum[seg - 1]) / ((w.cum[seg] - w.cum[seg - 1]) || 1), y = w.h[seg - 1] + (w.h[seg] - w.h[seg - 1]) * k;
      const want = Math.atan2(x2 - x, z2 - z); let da = want - f.yaw; da = Math.atan2(Math.sin(da), Math.cos(da)); f.yaw += da * Math.min(1, dt * 8);
      const grow = Math.min(1, f.s / .3, (w.length - f.s) / .3, f.out) * SIZE; // in and out of the door
      f.ph += dt * f.speed * 22;
      _p.set(x, y + Math.abs(Math.sin(f.ph)) * .02, z); _e.set(0, f.yaw, Math.sin(f.ph) * .06); _q.setFromEuler(_e); _s.setScalar(Math.max(.001, grow));
      _m.compose(_p, _q, _s); this.cloth.setMatrixAt(f.i, _m); this.body.setMatrixAt(f.i, _m); lastF = f.i;
    }
    for (const m of [this.cloth, this.body]) { m.count = lastF + 1; m.visible = lastF >= 0; if (m.visible) m.instanceMatrix.needsUpdate = true; }
    // tumbleweeds: roll east with the wind in gusts, bouncing, then rest a while before the next
    this.weeds.forEach((w, i) => {
      if (i >= n.weeds) { this.weedM.setMatrixAt(i, HIDE); w.lane = null; return; }
      if (!w.lane) {
        w.wait -= dt;
        if (w.wait > 0) { this.weedM.setMatrixAt(i, HIDE); return; }
        const l = this.lanes.length && this.lanes[Math.floor(R() * this.lanes.length)];
        if (!l) { w.wait = 1; this.weedM.setMatrixAt(i, HIDE); return; }
        w.lane = l; w.s = 0; w.L = l.L;
      }
      const gust = .55 + .45 * Math.sin(t * .7 + w.ph) + .2 * Math.sin(t * 2.3 + w.ph * 2);
      const v = w.speed * Math.max(.25, gust); w.s += v * dt; w.roll += v * dt / w.r;
      if (w.s >= w.L) { w.lane = null; w.wait = 4 + R() * 10; this.weedM.setMatrixAt(i, HIDE); return; }
      const k = w.s / w.L, x = w.lane.from[0] + (w.lane.to[0] - w.lane.from[0]) * k, z = w.lane.from[1] + (w.lane.to[1] - w.lane.from[1]) * k;
      const hk = Math.min(w.lane.h.length - 1.001, w.s), hi = Math.floor(hk), y = w.lane.h[hi] + (w.lane.h[hi + 1] - w.lane.h[hi]) * (hk - hi) + w.r + Math.abs(Math.sin(w.s * 1.9 + w.ph)) * .14 * Math.min(1, gust + .3);
      const fade = Math.min(1, w.s / 1.2, (w.L - w.s) / 1.2);
      _p.set(x, y, z); _e.set(0, 0, -w.roll, 'YXZ'); _q.setFromEuler(_e); _s.setScalar(Math.max(.001, fade));
      _m.compose(_p, _q, _s); this.weedM.setMatrixAt(i, _m); lastW = i;
    });
    this.weedM.count = lastW + 1; this.weedM.visible = lastW >= 0; if (this.weedM.visible) this.weedM.instanceMatrix.needsUpdate = true;
    // birds: wide slow circles high over the town, flapping a few beats, then gliding
    this.birds.forEach((b, i) => {
      if (i >= n.birds) { this.birdM.setMatrixAt(i, HIDE); return; }
      b.a += b.w * dt;
      const x = b.cx + Math.cos(b.a) * b.r, z = b.cz + Math.sin(b.a) * b.r, y = b.y + Math.sin(t * .4 + b.ph) * .3;
      const flapping = Math.sin(t * .45 + b.ph) > -.2, flap = flapping ? Math.sin(t * 11 + b.ph) : .35;
      const yaw = Math.atan2(-Math.sin(b.a) * Math.sign(b.w), Math.cos(b.a) * Math.sign(b.w));
      _p.set(x, y, z); _e.set(0, yaw, Math.sign(b.w) * .25, 'YXZ'); _q.setFromEuler(_e); _s.set(1, flap, 1);
      _m.compose(_p, _q, _s); this.birdM.setMatrixAt(i, _m);
    });
    this.birdM.count = Math.min(MAXB, n.birds); this.birdM.visible = n.birds > 0;
    this.birdM.instanceMatrix.needsUpdate = true;
    this.updateWagon(dt, fighting);
  }
  updateWagon(dt, fighting) {
    const W = this.wagon, o = W.obj;
    if (!this.n.wagon) { o.visible = false; return; }
    if (fighting && W.state !== 'gone') W.state = 'leave'; // off the road before the raiders reach it
    if (W.state === 'gone') {
      W.wait -= dt; o.visible = false;
      if (W.wait > 0 || fighting) return;
      W.state = 'drive'; W.dir = 1; W.s = this.start; W.scale = 1;
      if (W.first) { W.first = false; W.s = this.start + (this.stop - this.start) * (.25 + this.R() * .5); W.yaw = Math.atan2(...((a, b) => [b[0] - a[0], b[1] - a[1]])(pointAt(this.lane, W.s), pointAt(this.lane, W.s + .3))); } // a town opens with its wagon on the way in
    }
    if (W.state === 'leave') { W.scale -= dt * 2.5; if (W.scale <= 0) { W.state = 'gone'; W.wait = 8 + this.R() * 10; o.visible = false; return; } }
    if (W.state === 'stop') { W.wait -= dt; if (W.wait <= 0) { W.state = 'drive'; W.dir = -1; } }
    else if (W.state === 'drive') {
      W.s += W.dir * W.speed * dt;
      if (W.dir > 0 && W.s >= this.stop) { W.s = this.stop; W.state = 'stop'; W.wait = 5 + this.R() * 4; }
      if (W.dir < 0 && W.s <= this.start) { W.state = 'gone'; W.wait = 14 + this.R() * 14; o.visible = false; return; }
    }
    const [x, z] = pointAt(this.lane, W.s), [x2, z2] = pointAt(this.lane, W.s + .3 * (W.dir || 1));
    const want = Math.atan2(x2 - x, z2 - z); let da = want - W.yaw; da = Math.atan2(Math.sin(da), Math.cos(da));
    W.yaw += da * Math.min(1, dt * (W.state === 'stop' ? 1.5 : 5));
    o.visible = true;
    o.position.set(x, this.roadY(x, z), z); o.rotation.y = W.yaw; o.scale.setScalar(Math.max(.001, W.scale));
    if (W.state === 'drive') for (const w of o.userData.wheels) w.rotation.x += W.dir * W.speed * dt / .11;
  }
  dispose() { this.group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.userData.own) o.material.dispose(); }); }
}
