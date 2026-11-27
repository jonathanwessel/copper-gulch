/* The battle on a board: stone pads on the empty tower spots, the towers (their heads turn to their target), the
   raiders walking the road with health bars, and the shots, blasts, frost rings and poison clouds, drawn from the
   defense events. Reads the town; never changes it.
   Smooth motion: the simulation moves in 0.25 s steps, so each raider is drawn between its last two simulated
   places by the clock's alpha (how far into the next step it is) instead of jumping four times a second.
   Effects come from pools: meshes and their materials are made once and reused, never made per hit.
   Mortar pits (the far pads) get a ring of sandbags instead of a stone pad. A Mortar's shell flies a high arc for its
   flight time while a red ring on the ground closes in on where it will land; Shrapnel's burning ground is drawn from
   the town's fires, one pooled disc each. */
import * as THREE from 'three';
import { makeFoe, makeTower } from '../assets/models/units.js';
import { part, mergeStatic } from './kit.js';
import { lanesOf, speedOf } from '../core/defense.js';
import { isPitSpot } from '../data/towns/index.js';
import { polyDist } from './terrain.js';
import { bridgeLift } from './board.js';
import { pointAt } from '../core/path.js';
import { FOES } from '../data/foes.js';
import { FIRE } from '../data/towers.js';
import { disposeTree } from './board.js';
import { padFooting, blobMesh } from './dress.js';
const FOE_BLOBS = 96, _bm = new THREE.Matrix4(), _bp = new THREE.Vector3(), _bs = new THREE.Vector3(), _bq = new THREE.Quaternion();

const towerKey = t => t.kind + (t.path || '') + (t.fork || '') + (t.level >= 6 ? 2 : t.level >= 3 ? 1 : 0);
const barGeo = new THREE.PlaneGeometry(1, 1), _q = new THREE.Quaternion();
const barBack = new THREE.MeshBasicMaterial({ color: '#1d120c', depthTest: false, transparent: true });
const barFill = new THREE.MeshBasicMaterial({ color: '#f07067', depthTest: false, transparent: true });
const FX = {
  bolt: new THREE.MeshBasicMaterial({ color: '#ffe6b0' }),
  ball: new THREE.MeshStandardMaterial({ color: '#2b2830', metalness: .6, roughness: .4 }),
  boom: new THREE.MeshBasicMaterial({ color: '#ffb35a', transparent: true, depthWrite: false }),
  frost: new THREE.MeshBasicMaterial({ color: '#b8ecff', transparent: true, depthWrite: false, side: THREE.DoubleSide }),
  flask: new THREE.MeshStandardMaterial({ color: '#7ad36a', emissive: '#1e4a10' }),
  cloud: new THREE.MeshBasicMaterial({ color: '#8fd57a', transparent: true, depthWrite: false }),
  rocket: new THREE.MeshBasicMaterial({ color: '#d9573c' }),
  trail: new THREE.MeshBasicMaterial({ color: '#e8dcc8', transparent: true, depthWrite: false }),
  mark: new THREE.MeshBasicMaterial({ color: '#2a1408', transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, fog: false }),
  fire: new THREE.MeshBasicMaterial({ color: '#ff8a2a', transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, fog: false }),
};
// which geometry and material each kind of effect uses; fading kinds get their own material per pooled mesh
const KINDS = {
  bolt: ['bolt', 'bolt', false], ball: ['ball', 'ball', false], flask: ['flask', 'flask', false],
  ring: ['ring', 'frost', true], boom: ['boom', 'boom', true], cloud: ['cloud', 'cloud', true],
  shell: ['shell', 'ball', false], mark: ['mark', 'mark', true], rocket: ['rocket', 'rocket', false], trail: ['cloud', 'trail', true],
};
const GEO = {
  bolt: new THREE.BoxGeometry(.32, .03, .03), ball: new THREE.IcosahedronGeometry(.08, 1), boom: new THREE.IcosahedronGeometry(1, 1),
  ring: new THREE.RingGeometry(.9, 1, 32).rotateX(-Math.PI / 2), flask: new THREE.IcosahedronGeometry(.07, 0), cloud: new THREE.IcosahedronGeometry(1, 1),
  shell: new THREE.IcosahedronGeometry(.19, 1), mark: new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2), // a dark spot that grows as the shell falls, like its shadow (review of 2026.11.20-15: a red ring had no explainer and cut the Mortar's ring)
  fire: new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2),
  rocket: new THREE.ConeGeometry(.06, .3, 6).rotateX(Math.PI / 2), // nose along +z, so lookAt points it where it flies
};
const _ra = new THREE.Vector3();

export class Battle {
  constructor(board, game) {
    this.board = board; this.town = board.town; this.game = game;
    this.group = new THREE.Group(); this.group.name = 'battle'; board.group.add(this.group);
    this.lanes = lanesOf(this.town);
    this.river = this.town.def.board.river ? this.town.def.board.river.path : null; // raiders cross it on bridges (its path only: the leg into the vault lifted raiders by the vault, 2026-11-22)
    const B0 = this.town.def.board;
    this.roadPts = [...B0.road, B0.vault]; // the road as points, for the steamer's stack (the lanes are path objects) // raiders stay hidden inside their lane's entrance
    this.hideS = [(B0.entrance && B0.entrance.hide) || 0, (B0.river && B0.river.entrance && B0.river.entrance.hide) || 0];
    this.pads = []; this.towers = new Map(); this.foes = new Map(); this.fx = []; this.pool = {}; this.steps = -1;
    // a soft shadow under each raider, drawn over the road (which pulls itself toward the camera too)
    this.blobs = blobMesh(FOE_BLOBS, .8); this.blobs.material.polygonOffsetFactor = -6; this.blobs.renderOrder = 1;
    this.blobs.count = 0; this.blobs.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.group.add(this.blobs);
    this.shadowMoved = false;
    // a stone pad on every spot, merged into one mesh (a tap on a pad finds its spot through the ground: board.spotAt)
    const B = this.town.def.board;
    const pads = B.spots.map(([x, z], i) => {
      const pad = !isPitSpot(B, i)
        ? part(padFooting) // cut stone blocks round a flagstone top (the look pass)
        : part(k => { // a mortar pit: a dug-out floor in a ring of sandbags
          k.cyl(0, 0, 0, .5, .03, 'stoneD', { seg: 12 });
          for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; k.ball(Math.cos(a) * .52, .07, Math.sin(a) * .52, .12, 'sand', { sy: .55, ry: -a }); }
          for (let i = 0; i < 6; i++) { const a = (i + .5) / 6 * 6.283; k.ball(Math.cos(a) * .52, .16, Math.sin(a) * .52, .11, 'sand', { sy: .5, ry: -a }); }
        });
      pad.position.set(x, 0, z); return pad;
    });
    this.group.add(mergeStatic(pads, { cast: false })); pads.forEach(disposeTree);
    this.fires = []; // pooled discs for burning ground
    this.staged = []; // bosses that reached a stage since the last frame
    this.off = [
      game.bus.on('shot', e => { if (e.town === this.town.id) this.shot(e); }),
      game.bus.on('leak', e => { if (e.town === this.town.id) this.shake = .4; }),
      // a boss reaches a stage (src/data/foes.js, stages): a puff of dust where its crew jumps off or its plates fall
      game.bus.on('stage', e => { if (e.town === this.town.id) this.staged.push(e.foe); }),
    ];
  }
  sync() {
    const seen = new Set();
    for (const t of this.town.towers) {
      seen.add(t.spot);
      const cur = this.towers.get(t.spot), key = towerKey(t);
      if (cur && cur.key === key) continue;
      if (cur) { this.group.remove(cur.obj); this.unpick(cur.obj); disposeTree(cur.obj); }
      const obj = makeTower(t.kind, t.path, t.level, t.fork), [x, z] = this.town.def.board.spots[t.spot];
      obj.position.set(x, .06, z);
      obj.traverse(o => { o.userData.spot = t.spot; if (o.isMesh) this.board.pickables.push(o); });
      if (cur) obj.userData.head.rotation.y = cur.obj.userData.head.rotation.y;
      this.group.add(obj); this.towers.set(t.spot, { obj, key, aim: cur ? cur.aim : Math.PI / 2 });
    }
    for (const [spot, cur] of this.towers) if (!seen.has(spot)) { this.group.remove(cur.obj); this.unpick(cur.obj); disposeTree(cur.obj); this.towers.delete(spot); }
  }
  unpick(obj) { const s = new Set(); obj.traverse(o => s.add(o)); this.board.pickables = this.board.pickables.filter(o => !s.has(o)); }

  shot(e) {
    if (e.kind === 'militia') { // a worker's rifle: a quick tracer from beside the road
      if (this.fx.length > 120) return;
      const u = this.foes.get(e.foe), to = u ? new THREE.Vector3(u.obj.position.x, .35, u.obj.position.z) : new THREE.Vector3(e.to[0], .35, e.to[1]);
      this.add('bolt', { from: new THREE.Vector3(e.from[0], .32, e.from[1]), to, life: .12, arc: 0, aim: true });
      return;
    }
    const tw = this.towers.get(e.spot); if (!tw) return;
    const [fx, fz] = e.from, [tx, tz] = e.to;
    tw.aim = Math.atan2(-(tz - fz), tx - fx);
    // aim at where the target is drawn (a step behind the simulation), so the shot meets it on screen
    const u = this.foes.get(e.foe), y0 = e.kind === 'still' ? .9 : e.kind === 'cannon' ? .5 : .7;
    const from = new THREE.Vector3(fx, y0, fz), to = u ? new THREE.Vector3(u.obj.position.x, .35, u.obj.position.z) : new THREE.Vector3(tx, .35, tz);
    if (this.fx.length > 120) return;
    if (e.rocket != null) { // Rocket Battery: each rocket leaves the rack on its own arc and follows its raider (it seeks)
      const muzzle = new THREE.Vector3(fx, .62 + (e.rocket >> 1) * .1, fz), r = this.add('rocket', { from: muzzle, to, life: e.flight, arc: .7 + e.rocket * .22, then: 'boom', foe: e.foe, nose: true, puff: 0 });
      r.mesh.position.copy(muzzle);
      return;
    }
    if (e.flight) { // a lobbed shell: a high arc to where it will land, and its shadow growing on the ground there
      const land = new THREE.Vector3(tx, .05, tz), muzzle = new THREE.Vector3(fx, .75, fz);
      this.add('shell', { from: muzzle, to: land, life: e.flight + .1, arc: 3.2, then: 'bigboom', splash: e.splash || 1.3 });
      const m = this.add('mark', { life: e.flight + .1, mark: e.splash || 1.3 }); m.mesh.position.set(tx, .04, tz);
      return;
    }
    if (e.kind === 'crossbow') this.add('bolt', { from, to, life: e.pierce > 1 ? .24 : .18, arc: 0, aim: true });
    else if (e.kind === 'cannon') this.add('ball', { from, to, life: .45, arc: .9, then: 'boom' });
    else if (e.kind === 'still') this.add('flask', { from, to, life: .5, arc: 1.1, then: 'cloud' });
    else if (e.kind === 'frost') { const f = this.add('ring', { life: .5, ring: e.ring ? Math.max(.6, e.ring - .3) : 2.1 }); f.mesh.position.set(fx, .12, fz); }
  }
  /* An effect from the pool, put on a list of live effects (this.fx unless given). */
  add(kind, f, list = this.fx) {
    const free = this.pool[kind] || (this.pool[kind] = []);
    let mesh = free.pop();
    if (!mesh) {
      const [g, m, own] = KINDS[kind];
      mesh = new THREE.Mesh(GEO[g], own ? FX[m].clone() : FX[m]); // a fading kind gets its own material, once
      this.group.add(mesh); this.made = (this.made || 0) + 1;
    }
    mesh.visible = true; mesh.scale.set(1, 1, 1); mesh.rotation.set(0, 0, 0);
    f.kind = kind; f.mesh = mesh; f.age = 0; list.push(f);
    return f;
  }
  release(f) { f.mesh.visible = false; this.pool[f.kind].push(f.mesh); }
  /* Build every shader a wave needs while the town loads: one of each raider, a health bar and one of each effect, then
     put them away (the effects into their pools). Without it the first raider on screen and the first shot of each kind
     each built a shader mid-wave, a frame of 150 ms on a slow phone and a raider that hopped (perf drift box,
     2026.11.26-9: the Mesa case found it). Many GPUs (and the software one tools/perf.js uses) finish a shader only the
     first time it draws, so the set is also drawn once, in front of the camera, into a tiny target nobody sees. */
  warm(renderer, scene, cam, target = null) {
    const tmp = new THREE.Group(); this.group.add(tmp);
    for (const k of Object.keys(FOES)) tmp.add(makeFoe(k));
    tmp.add(new THREE.Mesh(barGeo, barBack), new THREE.Mesh(barGeo, barFill));
    const fx = Object.keys(KINDS).map(k => this.add(k, { life: 0 }, []));
    const ahead = cam.getWorldDirection(new THREE.Vector3()).multiplyScalar(3).add(cam.position);
    tmp.position.copy(this.group.worldToLocal(ahead));
    for (const f of fx) f.mesh.position.copy(tmp.position);
    // the frame's own target when it has one (the FXAA target, which the frame then draws over), else a small one like it
    const rt = target || new THREE.WebGLRenderTarget(256, 256, { depthBuffer: true, stencilBuffer: false });
    if (!target) { rt.isXRRenderTarget = true; rt.texture.colorSpace = THREE.SRGBColorSpace; rt.texture.internalFormat = 'RGBA8'; }
    // every instanced set (tumbleweeds, birds, raider shadows) draws one copy in front of the camera too, since an empty
    // set or one whose copies are all shrunk away draws no pixels: the Mesa's first tumbleweeds cost a 130 ms frame on the
    // software GPU six seconds in, with every shader already built
    const empty = [], put = new THREE.Matrix4();
    scene.updateMatrixWorld();
    scene.traverse(o => {
      if (!o.isInstancedMesh || !o.instanceMatrix.count) return;
      const keep = { o, count: o.count, visible: o.visible, fc: o.frustumCulled, m: new THREE.Matrix4() };
      o.getMatrixAt(0, keep.m); empty.push(keep);
      o.setMatrixAt(0, put.makeTranslation(o.worldToLocal(ahead.clone()))); o.instanceMatrix.needsUpdate = true;
      o.count = Math.max(1, o.count); o.visible = true; o.frustumCulled = false;
    });
    const was = renderer.getRenderTarget();
    try { renderer.compile(scene, cam); renderer.setRenderTarget(rt); renderer.render(scene, cam); }
    catch (e) { console.warn('shader warm-up failed:', e.message); }
    renderer.setRenderTarget(was); if (!target) rt.dispose();
    for (const k of empty) { const o = k.o; o.setMatrixAt(0, k.m); o.instanceMatrix.needsUpdate = true; o.count = k.count; o.visible = k.visible; o.frustumCulled = k.fc; }
    for (const f of fx) this.release(f);
    this.group.remove(tmp);
  }

  /* alpha: how far the clock is into the next step (0-1); steps: the game's step count, to see when it moved. */
  update(dt, t, cam, alpha = 1, steps = 0) {
    const ws = this.town.waves, alive = new Set(), moved = steps !== this.steps;
    this.steps = steps;
    for (const f of ws.foes) {
      alive.add(f.id);
      let u = this.foes.get(f.id);
      if (!u) {
        const obj = makeFoe(f.kind), boss = FOES[f.kind].boss, w = boss ? 1.1 : .55;
        const back = new THREE.Mesh(barGeo, barBack), fill = new THREE.Mesh(barGeo, barFill), bar = new THREE.Group();
        back.scale.set(w + .06, .1, 1); fill.scale.set(w, .06, 1); fill.position.z = .001; bar.add(back, fill); bar.position.y = boss ? 1.25 : 1.05; bar.renderOrder = 5;
        back.renderOrder = fill.renderOrder = 5; obj.add(bar);
        if (boss) obj.scale.setScalar(1.4);
        obj.traverse(o => { if (o.isMesh) o.castShadow = false; }); // a soft shadow under it instead (foeBlobs), on every tier
        this.group.add(obj); u = { obj, bar, fill, w, boss, phase: Math.random() * 6, s0: f.s, s1: f.s }; this.foes.set(f.id, u);
      }
      if (moved) { u.s0 = u.s1; u.s1 = f.s; }
      const s = u.s0 + (u.s1 - u.s0) * alpha;
      const lane = this.lanes[f.lane || 0] || this.lanes[0], [x, z] = pointAt(lane, s), [x2, z2] = pointAt(lane, s + .3);
      // up the bridge and over (a comment here once swallowed the next two statements, so from 2026.11.19 raiders never
      // turned along the road and showed inside their entrance: review of 2026.11.20-10)
      u.obj.position.set(x, f.lane ? -.05 + Math.sin(t * 2.2 + u.phase) * .015 : this.river ? bridgeLift(polyDist(x, z, this.river).d) : 0, z);
      u.obj.rotation.y = Math.atan2(x2 - x, z2 - z); u.obj.visible = s >= this.hideS[f.lane || 0];
      // the steamer folds its stack back to pass under a bridge
      if (u.obj.userData.stack) { const want = f.lane && polyDist(x, z, this.roadPts).d < 1.3 ? -1.35 : 0, st = u.obj.userData.stack; st.rotation.x += (want - st.rotation.x) * Math.min(1, dt * 5); }
      const walk = f.frozenT > 0 ? 0 : (f.slowT > 0 ? .5 : 1), d = u.obj.userData;
      u.phase += dt * 9 * walk * speedOf(f);
      // a boss shows its stage: the crew gone from the wagon, the plates off the train, steam from the steamer's stack
      const staged = (f.stage || 0) > 0;
      if (d.crew && d.crew.visible === staged) d.crew.visible = !staged;
      if (d.plates && d.plates.visible === staged) d.plates.visible = !staged;
      if (staged && d.stack && u.obj.visible && (u.puff = (u.puff || 0) + dt) > .12 && this.fx.length < 110) {
        u.puff = 0; d.stack.getWorldPosition(_ra); _ra.y += .5 * u.obj.scale.y;
        const p = this.add('trail', { life: .9, grow: .3, op: .7 }); p.mesh.position.copy(_ra);
      }
      if (d.legs) d.legs.forEach((l, i) => { l.rotation.x = Math.sin(u.phase + i * Math.PI) * .6 * walk; });
      if (d.wheels) for (const w of d.wheels) w.children[0].rotation.z -= dt * 4 * walk;
      const r = Math.max(0, f.hp / f.max); u.fill.scale.x = u.w * r; u.fill.position.x = -u.w * (1 - r) / 2;
      u.bar.quaternion.copy(cam.quaternion).premultiply(_q.copy(u.obj.quaternion).invert());
      u.bar.visible = r < .999;
    }
    for (const id of this.staged) { // a burst of dust at the boss as its stage starts
      const u = this.foes.get(id); if (!u || this.fx.length > 110) continue;
      const p = this.add('trail', { life: .8, grow: 1.1, op: .8 }); p.mesh.position.set(u.obj.position.x, .3, u.obj.position.z);
    }
    this.staged.length = 0;
    for (const [id, u] of this.foes) if (!alive.has(id)) { this.group.remove(u.obj); disposeTree(u.obj); this.foes.delete(id); }
    // a soft round shadow under every raider in sight, in one draw call, so raiders need no sun shadow (that redrew the
    // shadow map every frame of a wave: Room on the Silver Falls script gate, 2026.11.21-4)
    let nb = 0;
    for (const u of this.foes.values()) {
      if (!u.obj.visible || nb >= FOE_BLOBS) continue;
      const w = u.boss ? 1.7 : .95;
      _bm.compose(_bp.set(u.obj.position.x, Math.max(0, u.obj.position.y) + .04, u.obj.position.z), _bq, _bs.set(w, 1, w)); this.blobs.setMatrixAt(nb++, _bm);
    }
    this.blobs.count = nb; this.blobs.visible = nb > 0; if (nb) this.blobs.instanceMatrix.needsUpdate = true;
    // towers turn toward their last target; shadowMoved: a tower head turned or a tower rose, so its shadow moved
    this.shadowMoved = false;
    for (const [spot, tw] of this.towers) {
      const up = spot === this.lift ? .14 : 0, dy = (.06 + up - tw.obj.position.y) * Math.min(1, dt * 14); tw.obj.position.y += dy;
      const h = tw.obj.userData.head; let da = tw.aim - h.rotation.y; da = Math.atan2(Math.sin(da), Math.cos(da));
      h.rotation.y += da * Math.min(1, dt * 12);
      if (Math.abs(dy) > 1e-4 || Math.abs(da) > 2e-3) this.shadowMoved = true;
      if (tw.obj.userData.float) tw.obj.userData.bar.position.y = Math.sin(t * 2 + tw.obj.position.x) * .05;
    }
    // shots and their effects; what a finished shot sets off (a blast, a cloud) joins the list after this pass,
    // since adding to the list being filtered would lose it (it would never fade or go back to the pool)
    const after = [];
    this.fx = this.fx.filter(f => {
      f.age += dt; const k = Math.min(1, f.age / f.life);
      if (f.from) {
        if (f.foe != null) { const u = this.foes.get(f.foe); if (u) f.to.set(u.obj.position.x, .35, u.obj.position.z); } // a rocket follows its raider
        f.mesh.position.lerpVectors(f.from, f.to, k); f.mesh.position.y += Math.sin(k * Math.PI) * f.arc;
        if (f.aim) f.mesh.rotation.y = Math.atan2(-(f.to.z - f.from.z), f.to.x - f.from.x);
        if (f.nose) { // point along its path, and leave a puff of smoke now and then
          const k2 = Math.min(1, k + .03); _ra.lerpVectors(f.from, f.to, k2); _ra.y += Math.sin(k2 * Math.PI) * f.arc; if (k2 > k) f.mesh.lookAt(_ra);
          if ((f.puff += dt) > .07 && this.fx.length < 110) { f.puff = 0; const p = this.add('trail', { life: .45, grow: .12, op: .55 }, after); p.mesh.position.copy(f.mesh.position); }
        }
      } else if (f.ring) { const s = .3 + k * f.ring; f.mesh.scale.set(s, 1, s); f.mesh.material.opacity = .7 * (1 - k); }
      else if (f.mark) { const s = f.mark * (.35 + k * .65); f.mesh.scale.set(s, 1, s); f.mesh.material.opacity = .12 + .38 * k; }
      else if (f.grow) { const s = f.grow * (.4 + k * .6); f.mesh.scale.set(s, f.flat ? s * .5 : s, s); f.mesh.material.opacity = f.op * (1 - k); }
      if (k < 1) return true;
      this.release(f);
      if (f.then === 'boom') this.add('boom', { life: .3, grow: .55, op: .85 }, after).mesh.position.copy(f.to);
      if (f.then === 'bigboom') this.add('boom', { life: .4, grow: (f.splash || 1.3) * .75, op: .9 }, after).mesh.position.copy(f.to);
      if (f.then === 'cloud') this.add('cloud', { life: 1.4, grow: .7, op: .45, flat: true }, after).mesh.position.copy(f.to);
      return false;
    });
    for (const f of after) { f.mesh.scale.setScalar(.01); this.fx.push(f); } // start small: they grow from the next frame
    // burning ground: one pooled disc per fire, flickering, fading as it burns out
    const fires = ws.fires || [];
    while (this.fires.length < fires.length) { const m = new THREE.Mesh(GEO.fire, FX.fire.clone()); m.renderOrder = 2; this.group.add(m); this.fires.push(m); }
    this.fires.forEach((m, i) => {
      const fi = fires[i]; m.visible = !!fi;
      if (!fi) return;
      const k = Math.max(0, Math.min(1, fi.t / FIRE.seconds)), fl = .85 + .15 * Math.sin(t * 23 + i * 1.7);
      m.position.set(fi.at[0], .03, fi.at[1]); m.scale.set(fi.r * fl, 1, fi.r * fl); m.material.opacity = .55 * k * fl;
    });
    // the vault shudders when raiders reach it
    if (this.shake > 0) { this.shake -= dt; const v = this.board.vault; v.position.x = this.town.def.board.vault[0] + Math.sin(t * 60) * .04 * this.shake; }
  }
  dispose() { for (const off of this.off) off(); disposeTree(this.group); }
}
