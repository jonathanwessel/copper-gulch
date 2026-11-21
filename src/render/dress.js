/* The look pass for a town's board (PLAN.md M5b): fine detail on the ground (sand ripples and grains, drawn in the
   ground's own shader, so no textures and no extra draw calls), grass tufts, stones along the road's edges, a ring of
   rock round the board so the town sits in a valley, stone footings for the tower pads, and soft contact shadows.
   Everything static is merged; the rim is four meshes (one a side) that sink, like an entrance, on the side the camera
   looks from, so they never hide the road or a pad. Reads the board's data; never changes the town. */
import * as THREE from 'three';
import { Kit, rng, part } from './kit.js';
import { polyDist, sstep } from './terrain.js';

/* Sand ripples and grains on a ground material. The mesh needs a `rip` attribute (0 to 1 per vertex): how much of
   the ripples show there (open sand 1, yards and roads 0). Grains show everywhere. */
export function groundDetail(mat) {
  mat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float rip;\nvarying vec3 vGW;\nvarying float vRip;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGW = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvRip = rip;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGW;\nvarying float vRip;\nfloat cgHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }')
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec2 gp = vGW.xz;
          float warp = sin(gp.x * .41 + sin(gp.y * .27) * 2.1) * 1.4 + sin(gp.y * .19 - gp.x * .13) * 1.1;
          float s = sin((gp.x * .52 + gp.y * .85) * 7.2 + warp * 2.2);
          float crest = smoothstep(.55, 1., s) * .075 - smoothstep(.35, 1., -s) * .045; // a lit crest, a shaded trough
          float grain = cgHash(floor(gp * 12.)) - .5;
          diffuseColor.rgb *= 1. + vRip * crest + grain * .045;
        }`);
  };
  mat.customProgramCacheKey = () => 'cg-ground-detail';
  return mat;
}

/* Where scenery may not go: the road, the river, the plots, the pads, the vault and the entrances. */
export function keepOut(B) {
  const RIV = B.river ? B.river.path.concat([B.vault]) : null, gates = [B.entrance, B.river && B.river.entrance].filter(Boolean);
  const plots = Object.values(B.plots), spots = B.spots || [];
  return {
    road: (x, z) => polyDist(x, z, B.road).d,
    river: (x, z) => RIV ? polyDist(x, z, RIV).d : Infinity,
    plot: (x, z, m = 1.05) => plots.some(([px, pz]) => Math.abs(x - px) < m && Math.abs(z - pz) < m),
    pad: (x, z, m = .75) => spots.some(([sx, sz]) => Math.hypot(x - sx, z - sz) < m),
    gate: (x, z, m = 3.2) => gates.some(e => Math.abs(x - e.mouth[0]) < e.width / 2 + m && z < e.mouth[1] + 1.4),
    vault: (x, z, m = 1.4) => Math.hypot(x - B.vault[0], z - B.vault[1]) < m,
  };
}

/* The box round everything the player uses: pads, plots, the road and the vault. */
export function boardBounds(B) {
  const pts = [...(B.spots || []), ...Object.values(B.plots), ...B.road, B.vault];
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const [x, z] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  return { x0, x1, z0, z1 };
}

/* Grass tufts: a few thin blades, dry or green by the town's ground. Returns placed objects (merged by the caller). */
export function tufts(B, height, seed, n) {
  const K = keepOut(B), R = rng(seed), out = [], look = B.look || {};
  const dry = look.tuft || '#a8a05a', green = look.tuftG || '#7f9150';
  const { x0, x1, z0, z1 } = boardBounds(B);
  for (let i = 0, placed = 0; i < n * 6 && placed < n; i++) {
    const x = x0 - 3 + R() * (x1 - x0 + 6), z = z0 - 2 + R() * (z1 - z0 + 5), rd = K.road(x, z), vd = K.river(x, z);
    // most grow where something holds the water: the road's verges, the riverbanks, the yards' edges
    const near = (rd > .85 && rd < 1.6) || (vd > .75 && vd < 1.7) || (K.plot(x, z, 1.5) && !K.plot(x, z, 1.1));
    if (!near && R() < .82) continue; // few in the open, so they gather where water would
    if (rd < .85 || vd < .75 || K.plot(x, z, 1.1) || K.pad(x, z, .7) || K.gate(x, z, 2.4) || K.vault(x, z)) continue;
    const c = vd < 2 || R() < .3 ? green : dry, R2 = rng(i * 7 + seed);
    const o = part(k => {
      const blades = 4 + Math.floor(R2() * 3);
      for (let b = 0; b < blades; b++) {
        const a = b / blades * 6.28 + R2(), r = .035 + R2() * .03;
        k.cone(Math.cos(a) * r, 0, Math.sin(a) * r, .022, .13 + R2() * .11, b % 2 ? c : '#8a8448', { seg: 3, rx: Math.sin(a) * .35, rz: -Math.cos(a) * .35, jit: .15, ao: false });
      }
    }, { cast: false });
    o.position.set(x, Math.max(0, height(x, z)), z); o.scale.setScalar(.6 + R() * .5);
    out.push(o); placed++;
  }
  return out;
}

/* Edge stones: small flat stones along both sides of the road, here and there. */
export function edgeStones(B, height, seed) {
  const K = keepOut(B), R = rng(seed), k = new Kit({ ao: false }), pts = B.road, look = B.look || {};
  const cols = look.edge || ['stone', 'stoneL', 'rockD'];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / L, nz = (bx - ax) / L;
    for (let t = .3; t < L - .3; t += .32 + R() * .3) {
      if (R() < .35) continue;
      const s = R() < .5 ? 1 : -1, off = .74 + R() * .1, x = ax + (bx - ax) * t / L + nx * off * s, z = az + (bz - az) * t / L + nz * off * s;
      if (K.road(x, z) < .7 || K.river(x, z) < 1.3 || K.pad(x, z, .62) || K.plot(x, z, 1.08) || K.gate(x, z, .4) || K.vault(x, z, 1)) continue;
      k.dode(x, Math.max(0, height(x, z)) + .015, z, .045 + R() * .045, cols[Math.floor(R() * cols.length)], { sy: .45, ry: R() * 3, jit: .1 });
    }
  }
  return k.build({ cast: false });
}

/* The rim: rough rock ledges round the board, tall behind it (where the entrances are) and lower at the sides and
   front, in the town's mesa colors. Returns { obj, update(yaw) }: four meshes, one a side, each sinking to a third of
   its height when the camera looks across it, so it never stands between the camera and the town. */
const SIDES = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] };
export function rim(B, height, seed, lod = 'full') {
  const K = keepOut(B), R = rng(seed), { x0, x1, z0, z1 } = boardBounds(B), mesa = (B.look && B.look.mesa) || ['#b35a3a', '#d98a55', '#a94f33', '#e0a46c'];
  const m = { n: 4.2, s: 5.2, w: 4, e: 4 }, tall = { n: [1.6, 4.4], s: [.5, 1.3], w: [1, 2.8], e: [1, 2.8] };
  const group = new THREE.Group(); group.name = 'rim';
  const sides = {};
  for (const [side, [dx, dz]] of Object.entries(SIDES)) {
    const k = new Kit({ aoH: 2.5 }), along = dx === 0, a0 = along ? x0 - m.w : z0 - m.n, a1 = along ? x1 + m.e : z1 + m.s;
    const step = lod === 'low' ? 2.4 : 1.5;
    for (let a = a0; a <= a1 + .01; a += step * (.8 + R() * .4)) {
      const x = along ? a : (dx < 0 ? x0 - m.w : x1 + m.e) + (R() - .5) * 1.4;
      const z = along ? (dz < 0 ? z0 - m.n : z1 + m.s) + (R() - .5) * 1.4 : a;
      if (K.gate(x, z, 2.2) || K.road(x, z) < 2.6 || K.river(x, z) < 2.6) continue;
      // sizes vary a lot, so the ring reads as rock, not a row of tiles; each stands on the ground there (on a hill too,
      // or only its tip showed, like a shard: review of 2026.11.21-2)
      const [h0, h1] = tall[side], h = h0 + R() * (h1 - h0), r = .8 + R() * 1.6, y = height(x, z) - .35;
      // a corner stands as tall as its taller side, so the ring has no gap there
      k.cyl(x, y, z, r, h * .55 + .4, mesa[0], { r2: r * .88, seg: 7, jit: .1, ry: R() * 3 });
      k.cyl(x + (R() - .5) * .3, y + h * .55 + .4, z + (R() - .5) * .3, r * .86, h * .08, mesa[1], { r2: r * .8, seg: 7, ry: R() * 3 });
      k.cyl(x + (R() - .5) * .4, y + h * .63 + .4, z + (R() - .5) * .4, r * .72, h * .37, mesa[2], { r2: r * .58, seg: 6, jit: .12, ry: R() * 3 });
      if (h > 1.5) k.cyl(x + (R() - .5) * .3, y + h + .4, z, r * .55, .08, mesa[3], { r2: r * .5, seg: 6 });
    }
    const obj = k.build({ cast: false });
    sides[side] = { obj, dir: [dx, dz], cut: 1 };
    group.add(obj);
  }
  return {
    obj: group,
    /* yaw: the camera's; dt: seconds since the last call (the walls ease up and down). */
    update(yaw, dt = 1) {
      const cx = Math.sin(yaw), cz = Math.cos(yaw); // which way the camera sits from what it looks at
      for (const s of Object.values(sides)) {
        const k = s.dir[0] * cx + s.dir[1] * cz, want = k > .25 ? .3 : 1;
        s.cut += (want - s.cut) * (1 - Math.pow(.02, dt));
        const y = Math.round(s.cut * 200) / 200;
        if (s.obj.scale.y !== y) s.obj.scale.y = y;
      }
    },
  };
}

/* A tower pad: a footing of cut stone blocks round a flagstone top, so it reads as built, not as a gray octagon.
   Radius 0.5, like before (src/render/camera.js PAD_R). */
export function padFooting(k) {
  const n = 8;
  k.cyl(0, 0, 0, .44, .09, 'stoneD', { seg: 8 }); // the bed the stones sit in, seen in the seams
  for (let i = 0; i < n; i++) {
    const a = (i + .5) / n * Math.PI * 2;
    k.box(Math.cos(a) * .4, 0, Math.sin(a) * .4, .29, .085, .17, i % 2 ? 'stone' : '#b3a898', { ry: -a + Math.PI / 2, jit: .06 });
  }
  // the top: four flagstones a little higher than the ring, with dark seams between them
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box(sx * .135, .085, sz * .135, .25, .025, .25, sx * sz > 0 ? 'stoneL' : '#bcb1a0', { jit: .05, ao: false });
}

/* Soft contact shadows: one dark radial blob under each pad and the vault (static), and one under each plot that
   has a building (shown by scale). A single instanced mesh, so one draw call for all of them. */
let BLOB = null;
function blobTexture() {
  if (BLOB) return BLOB;
  const N = 64, data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const d = Math.hypot(x - N / 2 + .5, y - N / 2 + .5) / (N / 2), a = Math.max(0, 1 - d), i = (y * N + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = 0; data[i + 3] = Math.round(255 * Math.min(1, a * 1.6));
  }
  BLOB = new THREE.DataTexture(data, N, N); BLOB.needsUpdate = true; BLOB.magFilter = THREE.LinearFilter; BLOB.minFilter = THREE.LinearFilter;
  return BLOB;
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
export class Blobs {
  constructor(B) {
    this.B = B; this.ids = Object.keys(B.plots);
    const n = (B.spots || []).length + 1 + this.ids.length;
    const mat = new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, opacity: .5, color: '#000', polygonOffset: true, polygonOffsetFactor: -1, fog: false });
    mat.userData.own = true;
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mat, n);
    this.mesh.name = 'blobs'; this.mesh.castShadow = false; this.mesh.receiveShadow = false; this.mesh.frustumCulled = false; this.mesh.renderOrder = 0;
    let i = 0;
    const put = (x, z, w, d = w) => { _m.compose(_p.set(x, .02, z), _q.identity(), _s.set(w, 1, d)); this.mesh.setMatrixAt(i++, _m); };
    for (const [x, z] of B.spots || []) put(x, z, 1.75);
    put(B.vault[0], B.vault[1], 2);
    this.first = i;
    for (const id of this.ids) { const [x, z] = B.plots[id]; put(x, z, 0); }
  }
  /* built(id): whether a plot has a building now. */
  sync(built) {
    this.ids.forEach((id, j) => { const [x, z] = this.B.plots[id], w = built(id) ? 2.8 : 0; _m.compose(_p.set(x, .02, z), _q.identity(), _s.set(w || 1e-4, 1, w || 1e-4)); this.mesh.setMatrixAt(this.first + j, _m); });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
