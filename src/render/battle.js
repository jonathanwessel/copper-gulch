/* The battle on a board: stone pads on the empty tower spots, the towers (their heads turn to their target), the
   raiders walking the road with health bars, and the shots, blasts, frost rings and poison clouds, drawn from the
   defense events. Reads the town; never changes it. */
import * as THREE from 'three';
import { makeFoe, makeTower } from '../assets/models/units.js';
import { part, mergeStatic } from './kit.js';
import { roadOf } from '../core/defense.js';
import { pointAt } from '../core/path.js';
import { FOES } from '../data/foes.js';
import { disposeTree } from './board.js';

const towerKey = t => t.kind + (t.path || '') + (t.level >= 6 ? 2 : t.level >= 3 ? 1 : 0);
const barGeo = new THREE.PlaneGeometry(1, 1);
const barBack = new THREE.MeshBasicMaterial({ color: '#1d120c', depthTest: false, transparent: true });
const barFill = new THREE.MeshBasicMaterial({ color: '#f07067', depthTest: false, transparent: true });
const FX = {
  bolt: new THREE.MeshBasicMaterial({ color: '#ffe6b0' }),
  ball: new THREE.MeshStandardMaterial({ color: '#2b2830', metalness: .6, roughness: .4 }),
  boom: new THREE.MeshBasicMaterial({ color: '#ffb35a', transparent: true, depthWrite: false }),
  frost: new THREE.MeshBasicMaterial({ color: '#b8ecff', transparent: true, depthWrite: false, side: THREE.DoubleSide }),
  flask: new THREE.MeshStandardMaterial({ color: '#7ad36a', emissive: '#1e4a10' }),
  cloud: new THREE.MeshBasicMaterial({ color: '#8fd57a', transparent: true, depthWrite: false }),
};
const GEO = {
  bolt: new THREE.BoxGeometry(.32, .03, .03), ball: new THREE.IcosahedronGeometry(.08, 1), boom: new THREE.IcosahedronGeometry(1, 1),
  ring: new THREE.RingGeometry(.9, 1, 32).rotateX(-Math.PI / 2), flask: new THREE.IcosahedronGeometry(.07, 0), cloud: new THREE.IcosahedronGeometry(1, 1),
};

export class Battle {
  constructor(board, game) {
    this.board = board; this.town = board.town; this.game = game;
    this.group = new THREE.Group(); this.group.name = 'battle'; board.group.add(this.group);
    this.road = roadOf(this.town);
    this.pads = []; this.towers = new Map(); this.foes = new Map(); this.fx = [];
    // a stone pad on every spot, merged into one mesh (a tap on a pad finds its spot through the ground: board.spotAt)
    const pads = this.town.def.board.spots.map(([x, z]) => {
      const pad = part(k => { k.cyl(0, 0, 0, .42, .06, 'stoneL', { seg: 8, jit: .08 }); k.cyl(0, .06, 0, .34, .015, 'stone', { seg: 8 }); });
      pad.position.set(x, 0, z); return pad;
    });
    this.group.add(mergeStatic(pads, { cast: false })); pads.forEach(disposeTree);
    this.off = [
      game.bus.on('shot', e => { if (e.town === this.town.id) this.shot(e); }),
      game.bus.on('leak', e => { if (e.town === this.town.id) this.shake = .4; }),
    ];
  }
  sync() {
    const seen = new Set();
    for (const t of this.town.towers) {
      seen.add(t.spot);
      const cur = this.towers.get(t.spot), key = towerKey(t);
      if (cur && cur.key === key) continue;
      if (cur) { this.group.remove(cur.obj); this.unpick(cur.obj); disposeTree(cur.obj); }
      const obj = makeTower(t.kind, t.path, t.level), [x, z] = this.town.def.board.spots[t.spot];
      obj.position.set(x, .06, z);
      obj.traverse(o => { o.userData.spot = t.spot; if (o.isMesh) this.board.pickables.push(o); });
      if (cur) obj.userData.head.rotation.y = cur.obj.userData.head.rotation.y;
      this.group.add(obj); this.towers.set(t.spot, { obj, key, aim: cur ? cur.aim : Math.PI / 2 });
    }
    for (const [spot, cur] of this.towers) if (!seen.has(spot)) { this.group.remove(cur.obj); this.unpick(cur.obj); disposeTree(cur.obj); this.towers.delete(spot); }
  }
  unpick(obj) { const s = new Set(); obj.traverse(o => s.add(o)); this.board.pickables = this.board.pickables.filter(o => !s.has(o)); }

  shot(e) {
    const tw = this.towers.get(e.spot); if (!tw) return;
    const [fx, fz] = e.from, [tx, tz] = e.to;
    tw.aim = Math.atan2(-(tz - fz), tx - fx);
    const y0 = e.kind === 'still' ? .9 : e.kind === 'cannon' ? .5 : .7, from = new THREE.Vector3(fx, y0, fz), to = new THREE.Vector3(tx, .35, tz);
    if (this.fx.length > 120) return;
    if (e.kind === 'crossbow') this.add({ mesh: new THREE.Mesh(GEO.bolt, FX.bolt), from, to, life: .18, arc: 0, aim: true });
    else if (e.kind === 'cannon') this.add({ mesh: new THREE.Mesh(GEO.ball, FX.ball), from, to, life: .45, arc: .9, then: 'boom' });
    else if (e.kind === 'still') this.add({ mesh: new THREE.Mesh(GEO.flask, FX.flask), from, to, life: .5, arc: 1.1, then: 'cloud' });
    else if (e.kind === 'frost') { const m = new THREE.Mesh(GEO.ring, FX.frost.clone()); m.position.set(fx, .12, fz); this.add({ mesh: m, life: .5, ring: 2.1 }); }
  }
  add(f) { f.age = 0; this.group.add(f.mesh); this.fx.push(f); }

  update(dt, t, cam) {
    const ws = this.town.waves, alive = new Set();
    for (const f of ws.foes) {
      alive.add(f.id);
      let u = this.foes.get(f.id);
      if (!u) {
        const obj = makeFoe(f.kind), boss = FOES[f.kind].boss, w = boss ? 1.1 : .55;
        const back = new THREE.Mesh(barGeo, barBack), fill = new THREE.Mesh(barGeo, barFill), bar = new THREE.Group();
        back.scale.set(w + .06, .1, 1); fill.scale.set(w, .06, 1); fill.position.z = .001; bar.add(back, fill); bar.position.y = boss ? 1.25 : 1.05; bar.renderOrder = 5;
        back.renderOrder = fill.renderOrder = 5; obj.add(bar);
        if (boss) obj.scale.setScalar(1.4);
        this.group.add(obj); u = { obj, bar, fill, w, phase: Math.random() * 6 }; this.foes.set(f.id, u);
      }
      const [x, z] = pointAt(this.road, f.s), [x2, z2] = pointAt(this.road, f.s + .3);
      u.obj.position.set(x, 0, z); u.obj.rotation.y = Math.atan2(x2 - x, z2 - z);
      const walk = f.frozenT > 0 ? 0 : (f.slowT > 0 ? .5 : 1), d = u.obj.userData;
      u.phase += dt * 9 * walk * FOES[f.kind].speed;
      if (d.legs) d.legs.forEach((l, i) => { l.rotation.x = Math.sin(u.phase + i * Math.PI) * .6 * walk; });
      if (d.wheels) for (const w of d.wheels) w.children[0].rotation.z -= dt * 4 * walk;
      const r = Math.max(0, f.hp / f.max); u.fill.scale.x = u.w * r; u.fill.position.x = -u.w * (1 - r) / 2;
      u.bar.quaternion.copy(cam.quaternion).premultiply(u.obj.quaternion.clone().invert());
      u.bar.visible = r < .999;
    }
    for (const [id, u] of this.foes) if (!alive.has(id)) { this.group.remove(u.obj); disposeTree(u.obj); this.foes.delete(id); }
    // towers turn toward their last target
    for (const tw of this.towers.values()) {
      const h = tw.obj.userData.head; let da = tw.aim - h.rotation.y; da = Math.atan2(Math.sin(da), Math.cos(da));
      h.rotation.y += da * Math.min(1, dt * 12);
      if (tw.obj.userData.float) tw.obj.userData.bar.position.y = Math.sin(t * 2 + tw.obj.position.x) * .05;
    }
    // shots and their effects
    this.fx = this.fx.filter(f => {
      f.age += dt; const k = Math.min(1, f.age / f.life);
      if (f.from) {
        f.mesh.position.lerpVectors(f.from, f.to, k); f.mesh.position.y += Math.sin(k * Math.PI) * f.arc;
        if (f.aim) f.mesh.rotation.y = Math.atan2(-(f.to.z - f.from.z), f.to.x - f.from.x);
      } else if (f.ring) { const s = .3 + k * f.ring; f.mesh.scale.set(s, 1, s); f.mesh.material.opacity = .7 * (1 - k); }
      else if (f.grow) { const s = f.grow * (.4 + k * .6); f.mesh.scale.setScalar(s); f.mesh.material.opacity = f.op * (1 - k); }
      if (k < 1) return true;
      this.group.remove(f.mesh);
      if (f.then === 'boom') { const m = new THREE.Mesh(GEO.boom, FX.boom.clone()); m.position.copy(f.to); this.add({ mesh: m, life: .3, grow: .55, op: .85 }); }
      if (f.then === 'cloud') { const m = new THREE.Mesh(GEO.cloud, FX.cloud.clone()); m.position.copy(f.to); m.scale.y = .5; this.add({ mesh: m, life: 1.4, grow: .7, op: .45 }); }
      if (f.mesh.material !== FX.bolt && f.mesh.material !== FX.ball && f.mesh.material !== FX.flask) f.mesh.material.dispose();
      return false;
    });
    // the vault shudders when raiders reach it
    if (this.shake > 0) { this.shake -= dt; const v = this.board.vault; v.position.x = this.town.def.board.vault[0] + Math.sin(t * 60) * .04 * this.shake; }
  }
  dispose() { for (const off of this.off) off(); disposeTree(this.group); }
}
