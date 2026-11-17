/* A lane's entrance on a board: the model (src/assets/models/entrances.js), a shade over the road inside it, and the
   dust plume that rises behind it a few seconds before each wave (bigger and darker for a boss). Cheap: the model is
   merged by material, the shade is one quad, and the plume is one instanced mesh. Reads the town; never changes it. */
import * as THREE from 'three';
import { ENTRANCES } from '../assets/models/entrances.js';
import { bossWave } from '../core/defense.js';

const CUT = .3; // how tall an entrance's walls stand (of full height) when they would hide the board
const MAX = 40, WARN = 6, AFTER = 3; // puffs in the plume; seconds before a wave it starts, and after it stops
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();

export class Entrance {
  constructor(board) {
    const e = board.def.entrance, make = ENTRANCES[e.kind];
    this.town = board.town; this.group = new THREE.Group(); this.group.name = 'entrance';
    const built = make({ ...e, mesa: board.def.look && board.def.look.mesa });
    built.obj.traverse(o => { o.renderOrder = -1; }); // drawn before the ground, so the ground under it is skipped
    this.group.add(built.obj); this.obj = built.obj; this.cut = 1;
    // the way the entrance runs, out from the board (mouth toward portal): seen from that side or across, its walls
    // would hide the road and the pads beside it, so they sink (cutaway) until the camera looks in from the board
    const [mx, mz] = e.mouth, [px, pz] = e.portal || [mx, mz - 1], L = Math.hypot(px - mx, pz - mz) || 1;
    this.dir = [(px - mx) / L, (pz - mz) / L];
    if (built.shade) { // darker toward the inside, so raiders ride out of shadow
      const { x, z0, z1, w } = built.shade;
      const g = new THREE.PlaneGeometry(w, Math.abs(z1 - z0)).rotateX(-Math.PI / 2).translate(x, .03, (z0 + z1) / 2);
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, fog: false, uniforms: { z0: { value: z0 }, z1: { value: z1 } },
        vertexShader: 'varying float vZ; void main(){ vZ = (modelMatrix * vec4(position, 1.)).z; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
        fragmentShader: 'uniform float z0, z1; varying float vZ; void main(){ float k = clamp((vZ - z0) / (z1 - z0), 0., 1.); gl_FragColor = vec4(.08, .05, .04, .7 * k * k); }',
      });
      mat.userData.own = true; this.shade = new THREE.Mesh(g, mat); this.shade.renderOrder = 1; this.group.add(this.shade);
    }
    this.at = new THREE.Vector3(...built.plume);
    this.puffs = []; this.emit = 0;
    this.plume = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ color: '#c99a68', emissive: '#4a3220', flatShading: true, transparent: true, opacity: .82, depthWrite: false }), MAX);
    this.plume.material.userData.own = true;
    this.plume.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.plume.count = 0; this.plume.frustumCulled = false; this.plume.castShadow = false;
    this.plume.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
    this.group.add(this.plume);
    board.group.add(this.group);
  }
  /* Is a wave about to come (or coming out now)? 0 for no, 1 for a wave, 2 for a boss. */
  cue() {
    const t = this.town, ws = t.waves;
    if (!ws) return 0;
    const boss = bossWave(t, t.wave) ? 2 : 1;
    if (ws.phase === 'break') return ws.timer < WARN && !ws.hold ? boss : 0; // held waves do not come
    return this.since < AFTER ? boss : 0; // the first seconds of the wave
  }
  /* How tall the walls stand for a camera looking from yaw: 1 seen from the board side, CUT seen across or from behind. */
  height(yaw) {
    const k = -(Math.sin(yaw) * this.dir[0] + Math.cos(yaw) * this.dir[1]); // 1 when the camera is on the board side
    return CUT + (1 - CUT) * Math.min(1, Math.max(0, (k - .45) / .4));
  }
  update(dt, view = null) {
    if (view) {
      const h = this.height(view.yaw);
      this.cut += (h - this.cut) * (1 - Math.pow(.02, dt));
      const y = Math.round(this.cut * 200) / 200;
      if (this.obj.scale.y !== y) this.obj.scale.y = y;
    }
    const ph = this.town.waves && this.town.waves.phase;
    if (ph !== this.phase) { this.phase = ph; this.since = 0; } else this.since = (this.since || 0) + dt;
    const c = this.cue();
    if (c) {
      this.emit -= dt;
      while (this.emit <= 0 && this.puffs.length < MAX) {
        this.emit += c === 2 ? .07 : .14;
        const big = c === 2 ? 1.7 : 1;
        this.puffs.push({ x: this.at.x + (Math.random() - .5) * 1.6, y: this.at.y + Math.random() * .4, z: this.at.z + (Math.random() - .5) * 2.4,
          vx: (Math.random() - .5) * .25, vy: .8 + Math.random() * .7, r: (.6 + Math.random() * .45) * big, age: 0, life: 3.2 + Math.random() * 1.6, dark: c === 2 ? .72 : .95 });
      }
    } else this.emit = 0;
    this.puffs = this.puffs.filter(p => (p.age += dt) < p.life);
    const col = this.plume.instanceColor;
    this.puffs.forEach((p, i) => {
      const k = p.age / p.life;
      p.x += p.vx * dt; p.y += p.vy * dt * (1 - k * .6);
      const s = p.r * (.5 + k * 1.6) * (k > .8 ? (1 - k) / .2 : 1);
      _m.compose(_p.set(p.x, p.y, p.z), _q.identity(), _s.set(s, s * .8, s));
      this.plume.setMatrixAt(i, _m);
      col.setXYZ(i, p.dark, p.dark * .93, p.dark * .85);
    });
    this.plume.count = this.puffs.length;
    this.plume.instanceMatrix.needsUpdate = true; col.needsUpdate = true;
  }
}
