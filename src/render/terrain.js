/* Terrain helpers shared by the title and the boards: value noise, distance to a road polyline, a vertex-colored
   ground mesh from height and color functions, and a ring of desert mesas. */
import * as THREE from 'three';
import { Kit, rng } from './kit.js';

export const lerp = (a, b, t) => a + (b - a) * t;
export const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function hash(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
export function noise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  return lerp(lerp(hash(ix, iz), hash(ix + 1, iz), u), lerp(hash(ix, iz + 1), hash(ix + 1, iz + 1), u), v);
}
export const fbm = (x, z) => noise(x, z) * .6 + noise(x * 2.1 + 5, z * 2.1) * .3 + noise(x * 4.3, z * 4.3 + 9) * .1;

/* Distance from (px, pz) to a polyline, how far along it, and which side. */
export function polyDist(px, pz, pts) {
  let best = 1e9, along = 0, run = 0, side = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, z1] = pts[i], [x2, z2] = pts[i + 1], dx = x2 - x1, dz = z2 - z1, L = Math.hypot(dx, dz) || 1;
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (pz - z1) * dz) / (L * L))), qx = x1 + dx * t, qz = z1 + dz * t, d = Math.hypot(px - qx, pz - qz);
    if (d < best) { best = d; along = run + t * L; side = ((px - x1) * dz - (pz - z1) * dx) / L; }
    run += L;
  }
  return { d: best, along, side };
}

/* A ground mesh: w x d units centered on (cx, cz), seg segments a side; height(x, z) and color(x, z, out Color).
   rip(x, z), if given, is how much sand ripple shows there (0 to 1), drawn by the ground's shader (src/render/dress.js). */
export function makeGround({ cx = 0, cz = 0, w = 64, d = 64, seg = 96, height, color, rip = null, detail = null }) {
  const g = new THREE.PlaneGeometry(w, d, seg, Math.round(seg * d / w)); g.rotateX(-Math.PI / 2); g.translate(cx, 0, cz);
  const pos = g.attributes.position, cols = new Float32Array(pos.count * 3), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, height(x, z)); color(x, z, c);
    cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); g.computeVertexNormals();
  if (rip) { const r = new Float32Array(pos.count); for (let i = 0; i < pos.count; i++) r[i] = rip(pos.getX(i), pos.getZ(i)); g.setAttribute('rip', new THREE.BufferAttribute(r, 1)); }
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  if (rip && detail) detail(mat);
  mat.userData.own = true;
  const m = new THREE.Mesh(g, mat);
  m.receiveShadow = true; m.name = 'ground';
  return m;
}

/* Stepped desert mesas at [x, z, size] spots, in four colors: base, ledge, cap, top. */
export function makeMesas(spots, colors = ['#b35a3a', '#d98a55', '#a94f33', '#e0a46c'], seed = 7) {
  const k = new Kit({ ao: false }), R = rng(seed);
  for (const [x, z, s] of spots) {
    const h = s * (.7 + R() * .4);
    k.cyl(x, -.5, z, s, h * .62 + .5, colors[0], { r2: s * .86, seg: 9, jit: .08 });
    k.cyl(x, h * .62, z, s * .86, h * .1, colors[1], { r2: s * .8, seg: 9 });
    k.cyl(x + s * .1, h * .72, z, s * .7, h * .28, colors[2], { r2: s * .58, seg: 8, jit: .1 });
    k.cyl(x + s * .1, h, z, s * .58, h * .05, colors[3], { r2: s * .55, seg: 8 });
  }
  return k.build({ cast: false });
}
