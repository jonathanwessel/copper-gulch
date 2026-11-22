/* Call to arms on the board (src/core/arms.js): while a town's workers fight, two of them stand at each built
   building's post by the road, rifles toward it. One instanced mesh for all of them, made once; nothing is made or
   thrown away while it runs. They rise out of the ground when called and sink back when the call is over. Never in
   board.pickables, so a tap goes through them. Shown on every graphics tier (it is part of the fight, not scenery).
   Their shots are drawn by src/render/battle.js (a 'shot' of kind 'militia'). */
import * as THREE from 'three';
import { Kit, MAT } from './kit.js';
import { armsPosts, lanesOf } from '../core/defense.js';
import { pointAt } from '../core/path.js';

const PER = 2, MAX = 32, SIZE = 1.15;
// a worker with a rifle: dark trousers, a red bandana over a work shirt, a hat, the rifle held across toward +z
function figure() {
  const k = new Kit({ aoH: .45 });
  k.box(-.035, 0, 0, .05, .14, .06, '#4a3c34'); k.box(.035, 0, 0, .05, .14, .06, '#4a3c34');
  k.box(-.035, -.005, .005, .055, .03, .075, 'black'); k.box(.035, -.005, .005, .055, .03, .075, 'black');
  k.box(0, .14, 0, .13, .13, .08, '#5b7fa8');
  k.box(0, .24, .02, .1, .03, .08, '#c9433a');
  k.box(-.08, .16, .03, .03, .04, .1, '#5b7fa8'); k.box(.08, .16, .03, .03, .04, .1, '#5b7fa8');
  k.box(0, .27, 0, .08, .08, .08, 'skin');
  k.cyl(0, .34, 0, .085, .015, 'bark', { seg: 8, ao: false }); k.cyl(0, .35, 0, .045, .045, 'bark', { seg: 8, ao: false });
  k.box(.02, .17, .1, .025, .025, .26, 'woodD', { ao: false }); k.box(.02, .175, .2, .012, .012, .12, 'black', { ao: false });
  return k.build({ cast: false }).children[0].geometry;
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();

export class Militia {
  /* board: the Board (its town and def); height(x, z): the ground there. */
  constructor(board, height) {
    this.board = board; this.height = height; this.k = 0;
    this.mesh = new THREE.InstancedMesh(figure(), MAT.solid, MAX);
    this.mesh.name = 'militia'; this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false; this.mesh.castShadow = false; this.mesh.receiveShadow = false;
    this.mesh.count = 0; this.mesh.visible = false;
    this.group = new THREE.Group(); this.group.add(this.mesh);
    // where each pair stands and which way it faces (the road), worked out once
    const town = board.town, road = town.def.board.road ? lanesOf(town)[0] : null;
    this.spots = road ? armsPosts(town).map(p => {
      const r = pointAt(road, p.s), dx = r[0] - p.at[0], dz = r[1] - p.at[1], yaw = Math.atan2(dx, dz), sx = Math.cos(yaw) * .17, sz = -Math.sin(yaw) * .17;
      return { id: p.id, yaw, at: [-1, 1].map(side => [p.at[0] + sx * side, p.at[1] + sz * side]) };
    }) : [];
  }
  /* Count of workers out now (for the smoke test). */
  get out() { return this.mesh.visible ? this.mesh.count : 0; }
  update(dt, t) {
    const town = this.board.town, on = !!(town.arms && town.arms.t > 0);
    this.k += ((on ? 1 : 0) - this.k) * Math.min(1, dt * 6);
    if (!on && this.k < .02) { if (this.mesh.visible) { this.mesh.visible = false; this.mesh.count = 0; } return; }
    let n = 0;
    for (const sp of this.spots) {
      if (!(town.level(sp.id) > 0)) continue;
      for (let i = 0; i < PER && n < MAX; i++) {
        const [x, z] = sp.at[i], bob = Math.abs(Math.sin(t * 7 + x * 3 + i)) * .02;
        _p.set(x, Math.max(0, this.height(x, z)) - (1 - this.k) * .45 + bob, z);
        _q.setFromEuler(_e.set(0, sp.yaw + (i ? .25 : -.25), 0));
        _m.compose(_p, _q, _s.setScalar(SIZE * Math.max(.01, this.k)));
        this.mesh.setMatrixAt(n++, _m);
      }
    }
    this.mesh.count = n; this.mesh.visible = n > 0; if (n) this.mesh.instanceMatrix.needsUpdate = true;
  }
  dispose() { this.mesh.geometry.dispose(); }
}
