/* Raiders drawn in batches: every raider of a kind looks the same, so each kind's model is built once, and each of its
   meshes (a body, a leg, a wheel) becomes one instanced mesh that draws that part for every raider of the kind in one
   draw call. Each raider keeps its own node tree, a copy of the model's groups with an empty node where each mesh was,
   so the battle moves, turns and animates it as before (legs, wheels, a boss's crew and stack), and its userData points
   at its own nodes. Each frame draw() puts every visible part of every visible raider into its batch.
   Perf headroom box (2026.11.27-5): a raider was three to five draw calls, about 90 of the Mesa's 200 in a busy wave,
   and the frame's script part rose and fell with them (8.4 ms at 144 calls, 10.1 ms at 165). */
import * as THREE from 'three';
import { makeFoe } from '../assets/models/units.js';

const _inv = new THREE.Matrix4(), _m = new THREE.Matrix4();

export class FoeBatches {
  /* group: the group the batches and the raiders' trees live in; cap: the most raiders of one kind drawn at once. */
  constructor(group, kinds, cap) {
    this.group = group; this.cap = cap; this.kinds = new Map();
    for (const k of kinds) this.kind(k);
  }
  /* The batches of one kind, built the first time it is asked for. */
  kind(k) {
    let e = this.kinds.get(k);
    if (e) return e;
    const tpl = makeFoe(k), parts = [];
    tpl.traverse(o => {
      if (!o.isMesh) return;
      const m = new THREE.InstancedMesh(o.geometry, o.material, this.cap);
      m.name = 'foe:' + k; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.count = 0; m.visible = false;
      m.frustumCulled = false; m.castShadow = false; m.receiveShadow = false; // a soft shadow under each raider instead (battle.js)
      this.group.add(m); parts.push(m);
    });
    e = { tpl, parts }; this.kinds.set(k, e);
    return e;
  }
  /* A raider's own tree: the model's places and turns, an empty node for each mesh (userData.part is its batch). */
  make(k) {
    const e = this.kind(k), map = new Map(); let i = 0;
    const copy = o => {
      const c = new THREE.Object3D();
      c.name = o.name; c.position.copy(o.position); c.quaternion.copy(o.quaternion); c.scale.copy(o.scale); c.visible = o.visible;
      map.set(o, c);
      if (o.isMesh) c.userData.part = i++; // the same order as kind()'s traverse: the node first, then its children
      for (const ch of o.children) c.add(copy(ch));
      return c;
    };
    const root = copy(e.tpl);
    // the model's userData names its moving parts (legs, wheels, crew, stack): point each at this raider's own node
    const own = v => (v instanceof THREE.Object3D ? map.get(v) || v : v);
    for (const [o, c] of map) for (const [key, v] of Object.entries(o.userData)) if (key !== 'part') c.userData[key] = Array.isArray(v) ? v.map(own) : own(v);
    root.userData.kind = k;
    return root;
  }
  /* Draw every visible raider: foes is a list of raider trees made by make(). */
  draw(foes) {
    for (const e of this.kinds.values()) for (const m of e.parts) m.count = 0;
    this.group.updateWorldMatrix(true, false); _inv.copy(this.group.matrixWorld).invert();
    for (const obj of foes) {
      if (!obj.visible) continue;
      const e = this.kinds.get(obj.userData.kind);
      if (!e) continue;
      obj.updateMatrixWorld(true);
      const put = o => {
        if (!o.visible) return;
        const p = o.userData.part;
        if (p !== undefined) { const m = e.parts[p]; if (m.count < this.cap) m.setMatrixAt(m.count++, _m.multiplyMatrices(_inv, o.matrixWorld)); }
        for (const c of o.children) put(c);
      };
      put(obj);
    }
    for (const e of this.kinds.values()) for (const m of e.parts) { m.visible = m.count > 0; if (m.count) m.instanceMatrix.needsUpdate = true; }
  }
  /* How many parts are drawn this frame, and the draw calls they take (smoke checks both). */
  stats() {
    let parts = 0, calls = 0;
    for (const e of this.kinds.values()) for (const m of e.parts) { parts += m.count; if (m.count) calls++; }
    return { parts, calls };
  }
  dispose() { for (const e of this.kinds.values()) e.tpl.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
}
