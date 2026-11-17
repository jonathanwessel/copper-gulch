/* The title backdrop: Copper Gulch at golden hour, seen from a slowly circling camera. A ring of desert with a dirt
   road, red mesas behind, and the town's first buildings with their wheels turning and lamps lit. */
import * as THREE from 'three';
import { createScene } from './scene.js';
import { startQuality, autoStep } from './autoquality.js';
import { Kit, rng } from './kit.js';
import { makeBuilding, makeVault, PROPS } from '../assets/models/gulch.js';

const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function hash(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function noise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  return lerp(lerp(hash(ix, iz), hash(ix + 1, iz), u), lerp(hash(ix, iz + 1), hash(ix + 1, iz + 1), u), v);
}
const fbm = (x, z) => noise(x, z) * .6 + noise(x * 2.1 + 5, z * 2.1) * .3 + noise(x * 4.3, z * 4.3 + 9) * .1;
// the road: a gentle curve across the front of town
const roadZ = x => 3.1 + Math.sin(x * .32) * .7;

function ground() {
  const g = new THREE.PlaneGeometry(64, 64, 96, 96); g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position, cols = new Float32Array(pos.count * 3), c = new THREE.Color();
  const sand = new THREE.Color('#d8b382'), sandD = new THREE.Color('#bf9465'), dirt = new THREE.Color('#8c6242'), rut = new THREE.Color('#6a4630');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), d = Math.hypot(x, z * 1.1);
    const road = Math.abs(z - roadZ(x));
    let h = sstep(7, 16, d) * fbm(x * .2, z * .2) * 2.4 + (fbm(x * .9, z * .9) - .5) * .12;
    if (road < .9) h = lerp(-.05, h, sstep(.55, .9, road));
    pos.setY(i, h);
    c.copy(sand).lerp(sandD, fbm(x * .5 + 3, z * .5));
    if (road < .9) c.copy(c.lerp(dirt, 1 - sstep(.45, .9, road))).lerp(rut, Math.abs(Math.abs(z - roadZ(x)) - .22) < .06 ? .8 : 0);
    cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .95 }));
  m.receiveShadow = true;
  return m;
}

function mesas() {
  const k = new Kit({ ao: false }), R = rng(7);
  const spots = [[-14, -16, 4.5], [-5, -20, 6], [7, -18, 5], [17, -13, 4], [-20, -6, 3.5], [21, 0, 3]];
  for (const [x, z, s] of spots) {
    const h = s * (.7 + R() * .4);
    k.cyl(x, 0, z, s, h * .62, '#b35a3a', { r2: s * .86, seg: 9, jit: .08 });
    k.cyl(x, h * .62, z, s * .86, h * .1, '#d98a55', { r2: s * .8, seg: 9 });
    k.cyl(x + s * .1, h * .72, z, s * .7, h * .28, '#a94f33', { r2: s * .58, seg: 8, jit: .1 });
    k.cyl(x + s * .1, h, z, s * .58, h * .05, '#e0a46c', { r2: s * .55, seg: 8 });
  }
  const o = k.build({ cast: false }); return o;
}

const LAYOUT = [ // [id, x, z, rotation]
  ['hall', 0, -.9, 0], ['market', -2.15, -.6, .12], ['camp', 2.25, -1.1, -.15], ['cumine', -4.3, -2.3, .4],
  ['saw', 4.2, .4, -.35], ['smelt', -2.6, 1.5, .25], ['pit', 4.6, -2.8, -.5],
];

export function startTitleScene(canvas) {
  const q = startQuality(), v = createScene(canvas, { tier: q.tier, lamps: true });
  if (!v) return null;
  const step = autoStep(v, q);
  const { scene, cam } = v;
  scene.add(ground(), mesas());
  const movers = [], lamps = [];
  for (const [id, x, z, ry] of LAYOUT) {
    const b = makeBuilding(id, id === 'hall' ? 2 : 1);
    b.obj.position.set(x, 0, z); b.obj.rotation.y = ry; scene.add(b.obj); b.obj.updateMatrixWorld(true);
    movers.push(...b.movers);
    for (const p of b.lights) lamps.push(b.obj.localToWorld(p.clone()));
  }
  const vault = makeVault(2); vault.position.set(1.3, 0, 1.4); vault.rotation.y = -Math.PI / 2 + .3; scene.add(vault);
  const R = rng(11);
  for (let i = 0; i < 26; i++) {
    const a = R() * Math.PI * 2, d = 5.5 + R() * 6, x = Math.cos(a) * d, z = Math.sin(a) * d * .8;
    if (Math.abs(z - roadZ(x)) < 1) continue;
    const kind = R() < .45 ? 'cactus' : R() < .6 ? 'rock' : 'shrub', o = PROPS[kind](1, i * 13);
    o.position.set(x, 0, z); o.rotation.y = R() * 6; o.scale.setScalar(.8 + R() * .6); scene.add(o);
  }
  v.setLamps(lamps, .25);
  scene.traverse(o => { if (o.isMesh && o.material.type === 'MeshStandardMaterial') o.receiveShadow = true; });

  v.sun.position.set(-9, 7, 6); v.sun.target.position.set(0, 0, 0);
  let t0 = performance.now(), raf = 0, frames = 0;
  const size = () => {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    v.resize(w, h);
    return w / h;
  };
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (document.hidden || v.lost) return;
    const dt = Math.min(.1, (now - (frame.last || now)) / 1000); frame.last = now; step(dt);
    const aspect = size(), t = (now - t0) / 1000;
    // a slow circle; narrow (portrait) screens step back so the town fits the width
    const p = api.pose || { yaw: -.35 + Math.sin(t * .05) * .5, dist: 12.5 / Math.min(1, Math.max(.6, aspect * 1.15)), pitch: .42, look: [0, .9, .4] };
    cam.position.set(p.look[0] + Math.sin(p.yaw) * Math.cos(p.pitch) * p.dist, p.look[1] + Math.sin(p.pitch) * p.dist + .6, p.look[2] + Math.cos(p.yaw) * Math.cos(p.pitch) * p.dist);
    cam.lookAt(...p.look);
    for (const m of movers) {
      if (m.kind === 'spin') m.node.rotation[m.axis] += m.speed * dt * .5;
      if (m.kind === 'flag') m.node.rotation.y = Math.sin(t * 3) * .3;
    }
    v.render(); frames++;
  }
  // pose: set { yaw, pitch, dist, look } to hold the camera still (the icon maker uses it)
  const api = { view: v, pose: null, get frames() { return frames; }, stop() { cancelAnimationFrame(raf); v.dispose(); } };
  raf = requestAnimationFrame(frame);
  return api;
}
