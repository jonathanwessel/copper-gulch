/* The empire map's land in 3D (PLAN.md M5b, the empire map; GDD.md, Empire map), drawn from src/render/empire-plan.js:
   varied mesas, the land that fits each town (pines, hoodoos, rock ridges, dunes, scrub, green banks), the river and the
   falls east of Silver Falls, Dry Creek's dry creek bed, each town's own entrance at map scale, surveyors' camps on land
   not open yet, roads and rails between towns, trains, and the drifting cloud shadows every map material shares.
   Everything static is merged into a few meshes. */
import * as THREE from 'three';
import { Kit, MAT, mergeStatic, rng } from './kit.js';
import { roadRibbon, riverRibbon, disposeTree } from './board.js';
import { PROPS } from '../assets/models/gulch.js';
import { TOWNS } from '../data/towns/index.js';
import { SQUASH, ENT_BOX } from './empire-plan.js';
import { waterCut, crossings, bridgePlan } from './bridge-plan.js';

/* --- cloud shadows --------------------------------------------------------------------------------------------------
   Soft shade that drifts across the whole map, worked out per vertex (cheap on every tier): every map material
   (the ground, roads, rails, the river, the dioramas, the scenery, the wagons) darkens under it the same way.
   CLOUD.t is the time, CLOUD.k how dark a cloud's middle is (0 turns them off). */
export const CLOUD = { t: { value: 0 }, k: { value: .2 } };
export function cloudy(mat) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.cgT = CLOUD.t; sh.uniforms.cgK = CLOUD.k;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float cgT;\nuniform float cgK;\nvarying float vCloud;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          vec4 cgW = vec4(transformed, 1.);
          #ifdef USE_INSTANCING
          cgW = instanceMatrix * cgW;
          #endif
          cgW = modelMatrix * cgW;
          vec2 cp = cgW.xz * .075 + vec2(cgT * .028, cgT * .011);
          float cn = sin(cp.x * 1.7 + sin(cp.y * 1.3) * 1.6) * sin(cp.y * 1.9 - cp.x * .6 + 1.3) + .4 * sin(cp.x * 3.1 + cp.y * 2.3 + 2.);
          vCloud = 1. - cgK * smoothstep(.2, .8, cn);
        }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vCloud;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= vCloud;');
  };
  mat.customProgramCacheKey = () => 'cg-cloudy-' + mat.type;
  return mat;
}
/* Map copies of the shared materials, so the clouds reach the merged models without touching the towns' materials. */
export function mapMaterials() {
  const M = new Map([[MAT.solid, cloudy(MAT.solid.clone())], [MAT.metal, cloudy(MAT.metal.clone())]]);
  return {
    /* Swap every shared material under obj for its map copy; a mesh's own material gets the clouds itself. */
    apply(obj) {
      obj.traverse(o => {
        if (!o.isMesh) return;
        if (M.has(o.material)) o.material = M.get(o.material);
        else if (o.material.userData.own && !o.material.userData.cloudy && o.material.isMeshLambertMaterial) { cloudy(o.material); o.material.userData.cloudy = true; o.material.needsUpdate = true; }
      });
      return obj;
    },
    get solid() { return M.get(MAT.solid); },
    dispose() { for (const m of M.values()) m.dispose(); },
  };
}

/* --- mesas ----------------------------------------------------------------------------------------------------------- */
function mesaModel(m, seed) {
  const k = new Kit({ ao: false }), R = rng(seed), [base, ledge, cap, top] = m.colors, s = m.s, h = m.h;
  if (m.kind === 'mesa') {
    k.cyl(0, -.5, 0, s, h * .62 + .5, base, { r2: s * .88, seg: 9, jit: .1 });
    k.cyl(0, h * .62, 0, s * .88, h * .12, ledge, { r2: s * .84, seg: 9 });
    k.cyl(s * .06, h * .74, 0, s * .8, h * .22, cap, { r2: s * .72, seg: 9, jit: .1 });
    k.cyl(s * .06, h * .96, 0, s * .72, h * .04, top, { r2: s * .7, seg: 9 });
  } else if (m.kind === 'butte') {
    k.cyl(0, -.5, 0, s * 1.25, h * .3 + .5, base, { r2: s, seg: 8, jit: .12 }); // a talus apron
    k.cyl(0, h * .3, 0, s * .78, h * .55, cap, { r2: s * .7, seg: 8, jit: .1 });
    k.cyl(0, h * .85, 0, s * .7, h * .1, ledge, { r2: s * .66, seg: 8 });
    k.cyl(0, h * .95, 0, s * .66, h * .05, top, { r2: s * .62, seg: 8 });
  } else if (m.kind === 'spire') {
    k.cyl(0, -.5, 0, s * 1.3, h * .2 + .5, base, { r2: s * .9, seg: 7, jit: .15 });
    let y = h * .2, r = s * .62;
    for (let i = 0; i < 4; i++) { const hh = h * (.22 - i * .02); k.cyl((R() - .5) * .15 * s, y, (R() - .5) * .15 * s, r, hh, i % 2 ? ledge : cap, { r2: r * .86, seg: 7, jit: .12 }); y += hh; r *= .82; }
    k.dode(0, y + r * .3, 0, r * 1.1, top, { sy: .6 });
  } else if (m.kind === 'step') {
    let y = -.5, r = s;
    for (let i = 0; i < 3; i++) { const hh = (i ? h * .3 : h * .32 + .5); k.cyl(i * s * .12, y, -i * s * .08, r, hh, [base, cap, ledge][i], { r2: r * .9, seg: 8, jit: .1 }); y += hh; r *= .68; }
    k.cyl(s * .24, y, -s * .16, r * 1.4, h * .04, top, { r2: r * 1.35, seg: 8 });
  } else { // a long ridge: a row of rounded rock shoulders
    const n = 5;
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1) - .5) * s * 1.6, hh = h * (.55 + .45 * Math.sin(i / (n - 1) * Math.PI)) * (.85 + R() * .3);
      k.cyl(x, -.5, (R() - .5) * .3, s * .42, hh + .5, i % 2 ? base : cap, { r2: s * .3, seg: 7, jit: .14 });
      k.cyl(x, hh, 0, s * .3, hh * .08, top, { r2: s * .26, seg: 7 });
    }
  }
  const g = k.build({ cast: false });
  g.position.set(m.x, 0, m.z); g.rotation.y = m.ry; g.scale.set(m.sx, 1, m.sz);
  return g;
}
export const mesas = plan => plan.map((m, i) => mesaModel(m, 100 + i));

/* --- the land that fits each town ------------------------------------------------------------------------------------ */
const FLAVOR_MODEL = {
  pine: (s, seed) => PROPS.tree(s, seed),
  sage: (s, seed) => PROPS.shrub(s, seed),
  hoodoo: (s, seed) => { // a red rock pillar with a harder cap
    const k = new Kit({ ao: false }), R = rng(seed), H = .7 + R() * .6;
    k.cyl(0, 0, 0, .28, H * .45, '#b35a3a', { r2: .2, seg: 7, jit: .12 });
    k.cyl(0, H * .45, 0, .2, H * .4, '#d98a55', { r2: .15, seg: 7, jit: .12 });
    k.cyl(0, H * .85, 0, .24, .1, '#8f4a33', { r2: .26, seg: 7 });
    if (R() < .6) k.cyl(.35, 0, .1, .16, H * .5, '#a94f33', { r2: .1, seg: 6, jit: .12 });
    return k.build({ cast: true });
  },
  crag: (s, seed) => { // a jagged run of gray rock
    const k = new Kit({ ao: false }), R = rng(seed);
    for (let i = 0; i < 4; i++) k.dode((i - 1.5) * .32, .1 + R() * .15, (R() - .5) * .2, .28 + R() * .18, i % 2 ? '#6f6a62' : '#8a8478', { sy: 1.3 + R() * .6, ry: R() * 3 });
    k.dode(0, .5, 0, .2, '#9b9488', { sy: 1.4 });
    return k.build({ cast: true });
  },
  dune: (s, seed) => { // a low wind-swept mound of pale sand, with a grass tuft
    const k = new Kit({ ao: false }), R = rng(seed);
    // a crescent: a long gentle back and a steeper, shaded lee side
    k.ball(0, 0, 0, .7, '#d9bc88', { det: 1, sy: .3, sx: 1.6 });
    k.ball(.15, .02, .28, .5, '#caa978', { det: 1, sy: .24, sx: 1.3 });
    if (R() < .7) for (let i = 0; i < 3; i++) k.cone(-.4 + i * .08, .1, -.2, .03, .22, '#8f9a42', { seg: 4, rz: (i - 1) * .3 });
    return k.build({ cast: false });
  },
  reed: (s, seed) => { // green grass and reeds on the river's banks
    const k = new Kit({ ao: false }), R = rng(seed);
    for (let i = 0; i < 5; i++) k.cone((R() - .5) * .4, 0, (R() - .5) * .4, .05, .2 + R() * .2, R() < .5 ? '#6f9a4a' : '#557f3c', { seg: 4, rz: (R() - .5) * .4 });
    return k.build({ cast: false });
  },
};
export function flavorModels(list) {
  return list.map((p, i) => { const o = FLAVOR_MODEL[p.kind](1, 300 + i); o.position.set(p.x, p.y || 0, p.z); o.rotation.y = p.ry; o.scale.setScalar(p.s); return o; });
}

/* --- water and the dry creek ------------------------------------------------------------------------------------------ */
/* The river from the falls to the town, and the falls: a rock cliff across the river's head, water pouring over a notch
   in it into a foaming pool. */
export function fallsModels(river) {
  const look = TOWNS.falls.board.look, out = [];
  const w = riverRibbon(river.pts, look, river.width); w.position.y = .005; out.push(w);
  const k = new Kit({ ao: false }), R = rng(5), [cx, cz] = river.cliff, m = look.mesa;
  // the cliff runs across the river (north to south), a little taller where it meets the falls
  // (rounded, uneven shoulders of layered rock, so it reads as a cliff and never as a wall with battlements)
  for (let i = -6; i <= 6; i++) {
    if (Math.abs(i) < 1) continue;
    const z = cz + i * .5 + (R() - .5) * .15, e = Math.abs(i) / 6, H = 1.55 - e * e * .9 + R() * .25, x = cx + .4 + e * e * .5 + (R() - .5) * .25, r = .42 + R() * .14;
    k.cyl(x, -.3, z, r * 1.15, H * .55 + .3, m[0], { r2: r, seg: 7, jit: .12 });
    k.cyl(x + .05, H * .55, z, r * .95, H * .4, m[2], { r2: r * .8, seg: 7, jit: .12 });
    k.dode(x + .05, H * .95, z, r * .72, m[3], { sy: .45 });
  }
  // behind the notch: the river's upper reach on top of the cliff
  k.box(cx + .5, 1.2, cz, 1.2, .25, .6, m[1]);
  k.box(cx + .55, 1.45, cz, 1.2, .03, .46, look.water);
  // the falls: sheets of water stepping down the face, white where they break
  for (let i = 0; i < 6; i++) { const y = 1.45 - (i + 1) * .24; k.box(cx - .02 - i * .015, y, cz, .06, .26, .48 - i * .01, i % 2 ? look.foam : '#d6ecf2'); }
  // the foaming pool at its foot, with mist
  for (let i = 0; i < 7; i++) k.ball(cx - .3 - R() * .5, .05, cz + (R() - .5) * .7, .12 + R() * .1, R() < .5 ? '#eef6f8' : look.foam, { sy: .5 });
  k.ball(cx - .3, .35, cz, .35, '#eef6f8', { sy: .5, det: 0 });
  // a few rocks in the water below
  for (let i = 0; i < 4; i++) k.dode(cx - 1 - R() * 1.5, -.02, cz + (R() - .5) * .6, .08 + R() * .06, 'rockD');
  out.push(k.build({ cast: true }));
  return out;
}
/* The dry creek: a pale bed of sand and pebbles, darker at its banks. */
export function creekModels(creek) {
  const bed = roadRibbon(creek.pts, [new THREE.Color('#e2c99a'), new THREE.Color('#cdb284'), new THREE.Color('#a9875f')], creek.width, .004,
    [[-.66, new THREE.Color('#a9875f')], [-.45, new THREE.Color('#d6bb8c')], [-.2, new THREE.Color('#e8d3a8')], [.2, new THREE.Color('#e2c99a')], [.45, new THREE.Color('#d6bb8c')], [.66, new THREE.Color('#a9875f')]]);
  bed.material.userData.own = true; bed.name = 'creek';
  const k = new Kit({ ao: false }), R = rng(23);
  for (let i = 1; i < creek.pts.length; i++) {
    const [ax, az] = creek.pts[i - 1], [bx, bz] = creek.pts[i];
    for (let j = 0; j < 5; j++) { const t = R(); k.dode(ax + (bx - ax) * t + (R() - .5) * .5, -.02, az + (bz - az) * t + (R() - .5) * .5, .04 + R() * .05, R() < .5 ? 'stoneL' : 'stone'); }
  }
  return [bed, k.build({ cast: false })];
}

/* --- entrances ------------------------------------------------------------------------------------------------------- */
/* A town's entrances at map scale, in board units (the diorama scales them). The board's own entrance models are built
   of blocks for the close view, and from the map's height they read as crates and walls (review of 2026.11.21-5), so
   the map draws each one in the mesas' rounded rock instead: shoulders of rock rising on both sides of the road as it
   runs back from the mouth, and where the board's entrance closes (the canyon's mine, the Ridge's tunnel, the chute) a
   rock hill across the way with a dark portal in a timber or stone frame. A wash or a riverbed stays open, running off
   into the land. Each runs SQUASH of its board length (ENT_BOX), toward -z from its mouth. */
const CLOSED = { canyon: 'woodD', tunnel: 'stoneL', chute: 'woodD' };
export function entranceModels(B) {
  const out = [], m = (B.look && B.look.mesa) || ['#b35a3a', '#d98a55', '#a94f33', '#e0a46c'];
  for (const e of [B.entrance, B.river && B.river.entrance].filter(Boolean)) {
    const k = new Kit({ ao: false }), R = rng(e.mouth[0] * 31 + 7), [mx, mz] = e.mouth, half = e.width / 2, back = ((ENT_BOX[e.kind] || {}).back || 7) * SQUASH, end = mz - back;
    for (const side of [-1, 1]) {
      for (let z = mz + .2, i = 0; z > end - .4; i++) {
        const rise = Math.min(1, (mz + .2 - z) / (back * .7)), r = .55 + R() * .6, H = (.7 + rise * 1.7) * (.7 + R() * .6);
        const x = mx + side * (half + r * .75 + R() * .35), o = { seg: 5 + Math.floor(R() * 4), jit: .16, ry: R() * 6, sx: .8 + R() * .5, sz: .8 + R() * .5 };
        if (R() < .3) { k.dode(x, r * .3, z, r * .9, m[i % 3], { sy: .6 + R() * .5, ry: o.ry }); k.dode(x + side * r * .5, r * .2, z - r * .6, r * .55, m[(i + 1) % 3], { sy: .7, ry: R() * 6 }); z -= r * 1.3 + R() * .3; continue; }
        k.cyl(x, -.3, z, r * 1.15, H * .6 + .3, m[0], { ...o, r2: r });
        k.cyl(x + side * .05, H * .6, z, r * (.75 + R() * .2), H * .4, m[(i % 2) ? 2 : 1], { ...o, r2: r * (.5 + R() * .3) });
        if (R() < .6) k.dode(x + side * .05, H * .96, z, r * (.4 + R() * .3), m[3], { sy: .4 + R() * .3, ry: R() * 6 });
        if (R() < .35) k.dode(x - side * r * .7, 0, z + (R() - .5) * .4, .2 + R() * .2, m[1], { ry: R() * 6 });
        z -= r * 1.2 + R() * .45;
      }
    }
    const frame = CLOSED[e.kind];
    if (frame) {
      const zb = end - 1.1, w = half + 1.5;
      k.cyl(mx, -.3, zb, w, 2.3, m[0], { r2: w * .82, seg: 8, jit: .1 });
      k.cyl(mx, 2, zb, w * .8, .7, m[2], { r2: w * .55, seg: 8, jit: .1 });
      k.dode(mx, 2.6, zb, w * .5, m[3], { sy: .4 });
      const fz = zb + w * .86, pw = Math.min(1.5, e.width * .62);
      k.box(mx, 0, fz, pw, 1.05, .12, 'ink', { ao: false });
      for (const s2 of [-1, 1]) k.box(mx + s2 * (pw / 2 + .06), 0, fz + .04, .14, 1.15, .16, frame);
      k.box(mx, 1.12, fz + .04, pw + .32, .14, .18, frame);
    }
    out.push(k.build({ cast: true }));
  }
  return out;
}

/* --- surveyed land -------------------------------------------------------------------------------------------------- */
/* Stakes and string round the plot, a sign, and the surveyors' camp: a canvas tent, a ring of stones round a fire, and
   a tripod with its level. Local to the site's middle. */
export function surveyed(capital, c) {
  const k = new Kit({ ao: false }), R = rng(capital ? 3 : 9), n = capital ? 10 : 8, r = capital ? 2.1 : 1.8;
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r * .8;
    k.box(x, 0, z, .07, .3, .07, 'woodL'); k.box(x, .26, z, .08, .05, .08, 'paintR', { ao: false });
    const b = (i + 1) / n * Math.PI * 2, x2 = Math.cos(b) * r, z2 = Math.sin(b) * r * .8, L = Math.hypot(x2 - x, z2 - z);
    k.box((x + x2) / 2, .24, (z + z2) / 2, .015, .015, L, 'white', { ry: Math.atan2(x2 - x, z2 - z), ao: false });
  }
  k.box(.3, 0, .2, .06, .6, .06, 'woodD'); k.box(.3, .42, .23, .46, .24, .03, 'cream');
  if (capital) { k.box(-.2, 0, -.3, .05, 1.2, .05, 'woodD'); k.box(.05, .92, -.3, .46, .26, .02, 'gold'); }
  const [tx, tz] = [c.tent[0], c.tent[1]], [fx, fz] = [c.fire[0], c.fire[1]], [px, pz] = [c.tripod[0], c.tripod[1]];
  // the tent: a canvas ridge tent with a dark open door toward the fire, and its pole
  k.gable(tx, 0, tz, .62, .55, .42, 'cream', { ry: .5 });
  k.box(tx + Math.sin(.5) * .02 + .26, 0, tz - .14, .02, .3, .16, 'ink', { ry: .5 + Math.PI / 2, ao: false });
  k.box(tx, 0, tz, .03, .5, .03, 'woodD');
  // the fire: a ring of stones, logs, a small flame
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; k.dode(fx + Math.cos(a) * .16, .02, fz + Math.sin(a) * .16, .05, 'stone'); }
  k.log(fx - .08, 0, fz, .2, .03, 'bark', { ry: .6 }); k.log(fx - .08, 0, fz, .2, .03, 'bark', { ry: -.6 });
  k.cone(fx, .03, fz, .06, .14, 'glowO', { mat: 'fire', seg: 5 });
  // the surveyor's tripod and level
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; k.box(px + Math.cos(a) * .07, 0, pz + Math.sin(a) * .07, .025, .4, .025, 'woodL', { rx: Math.sin(a) * .2, rz: -Math.cos(a) * .2 }); }
  k.box(px, .38, pz, .14, .06, .06, 'goldD');
  for (let i = 0; i < 5; i++) k.dode(-1 + R() * 2, .05, -.8 + R() * 1.6, .08 + R() * .07, R() < .5 ? 'rock' : 'rockD');
  return k.build();
}

/* --- roads and rails ------------------------------------------------------------------------------------------------- */
const DIRT = [new THREE.Color('#9a7550'), new THREE.Color('#7a5a3c'), new THREE.Color('#b38c62')];
/* A dirt road: the ribbon with its ruts, and small stones along both edges. */
export function roadModel(pts, wet = null) {
  const road = roadRibbon(pts, DIRT, .7, .015, null, wet); road.position.y = .01; road.material.userData.own = true;
  const k = new Kit({ ao: false }), R = rng(pts.length);
  for (let i = 1; i < pts.length - 1; i += 2) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az) || 1, nx = -(bz - az) / L, nz = (bx - ax) / L;
    for (const s of [-1, 1]) if (R() < .55 && !(wet && wet(pts[i][0], pts[i][1]))) k.dode(pts[i][0] + nx * s * (.5 + R() * .06), -.01, pts[i][1] + nz * s * (.5 + R() * .06), .035 + R() * .03, R() < .5 ? 'stone' : 'stoneD');
  }
  return [road, k.build({ cast: false })];
}
/* Rails: a bed of gray ballast, wooden ties and two steel rails, with a telegraph pole now and then. */
export function railModel(pts, wet = null) {
  const bed = roadRibbon(pts, [new THREE.Color('#8f877c'), new THREE.Color('#6e675e'), new THREE.Color('#a59c8e')], .62, .012,
    [[-.66, new THREE.Color('#a59c8e')], [-.5, new THREE.Color('#8f877c')], [.5, new THREE.Color('#878075')], [.66, new THREE.Color('#a59c8e')]], wet);
  bed.material.userData.own = true; bed.name = 'rails';
  const k = new Kit({ ao: false });
  let run = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i], L = Math.hypot(bx - ax, bz - az);
    if (L < 1e-4) continue;
    const ry = Math.atan2(bx - ax, bz - az), nx = -(bz - az) / L, nz = (bx - ax) / L, mx = (ax + bx) / 2, mz = (az + bz) / 2;
    for (let t = 0; t < L; t += .17) { const x = ax + (bx - ax) * t / L, z = az + (bz - az) * t / L; if (!(wet && wet(x, z))) k.box(x, .01, z, .4, .035, .08, '#3e2a1c', { ry }); } // no ties on the water
    for (const s of [-1, 1]) k.box(mx + nx * s * .1, .03, mz + nz * s * .1, .03, .03, L + .01, '#c9d2dc', { ry });
    run += L;
    if (run > 2.4 && !(wet && wet(ax + nx * .42, az + nz * .42))) { run = 0; k.box(ax + nx * .42, 0, az + nz * .42, .035, .55, .035, 'woodD'); k.box(ax + nx * .42, .5, az + nz * .42, .16, .025, .025, 'woodD', { ry }); }
  }
  return [bed, k.build({ cast: false })];
}
/* A plank bridge wherever a route crosses the river: the route stops at the water's edge (waterCut), the deck spans the
   water and a short bit of each bank, and its posts stand in the water, each with a pale ring (owner, 2026-11-22). */
export const DECK_Y = .22; // the top of a route bridge's deck
export function routeBridges(pts, river, rail = false) {
  const k = new Kit({ ao: false }), wet = waterCut(river.pts, river.width, 0), half = .4;
  // the deck stands DECK_Y over the water, so water shows under it from a low view (review of 2026.11.22-7: a deck
  // laid nearly on the water hid the narrow map river); it reaches only a little past each bank
  for (const run of crossings(pts, river.pts, river.width / 2 + .18, .05)) {
    const P = bridgePlan(run, wet, { deckHalf: half, gap: .35 }), { a: [ax, az], len, ry, ux, uz } = P, L = len + .06, mx = ax + ux * len / 2, mz = az + uz * len / 2, y = DECK_Y;
    k.box(mx, y - .05, mz, half * 2, .05, L, 'woodL', { ry }); k.box(mx, y - .065, mz, half * 2 - .1, .02, L, 'woodD', { ry });
    for (let t = .05; t < L; t += .14) k.box(ax + ux * (t - .03), y, az + uz * (t - .03), half * 2 + .02, .008, .035, 'woodD', { ry }); // planks
    for (const q of [-1, 1]) {
      k.box(mx + P.sx * q * (half - .02), y + .08, mz + P.sz * q * (half - .02), .03, .03, L, 'wood', { ry }); // a rail each side
      for (let t = 0; t <= L; t += L / 4) k.box(ax + ux * (t - .03) + P.sx * q * (half - .02), y, az + uz * (t - .03) + P.sz * q * (half - .02), .03, .09, .03, 'woodD');
    }
    if (rail) for (const q of [-1, 1]) k.box(mx + P.sx * q * .1, y, mz + P.sz * q * .1, .03, .03, L, '#c9d2dc', { ry });
    for (const [px, pz] of P.posts) { k.box(px, -.06, pz, .06, y - .05 + .06, .06, 'woodD'); k.torus(px, .012, pz, .07, .012, '#cfe6ee', { rx: Math.PI / 2, ts: 12 }); }
  }
  return k.parts.solid.length ? [k.build({ cast: true })] : [];
}

/* A train's engine and a freight car: one geometry each, so every train on the map is two instanced draws. Both face +z. */
function geometryOf(k) { const g = k.build({ cast: true }), m = g.children[0], geo = m.geometry; g.remove(m); return geo; }
export function engineGeometry() {
  const k = new Kit({ ao: false });
  k.box(0, .04, 0, .26, .05, .62, 'iron');
  k.cyl(0, .09, .06, .1, .4, 'black', { rx: Math.PI / 2, seg: 8 });
  k.box(0, .09, -.2, .24, .22, .18, 'roofRD'); k.box(0, .31, -.2, .28, .03, .22, 'black');
  k.cyl(0, .19, .2, .04, .12, 'black', { r2: .06, seg: 6 }); k.box(0, .12, .3, .2, .03, .02, 'paintR');
  k.cone(0, .03, .33, .1, .08, 'paintR', { rx: Math.PI / 2, seg: 4 });
  for (const sx of [-1, 1]) for (const sz of [-.18, .02, .2]) k.cyl(sx * .13, .02, sz, .055, .03, 'black', { rz: Math.PI / 2, seg: 8 });
  k.ball(0, .2, .3, .03, 'glowW', { mat: 'solid' });
  return geometryOf(k);
}
export function carGeometry() {
  const k = new Kit({ ao: false });
  k.box(0, .04, 0, .24, .04, .46, 'iron');
  k.box(0, .08, 0, .24, .18, .44, 'brick'); k.box(0, .26, 0, .26, .025, .46, 'roofRD');
  k.box(.122, .1, 0, .005, .12, .14, 'woodD', { ao: false }); k.box(-.122, .1, 0, .005, .12, .14, 'woodD', { ao: false });
  for (const sx of [-1, 1]) for (const sz of [-.15, .15]) k.cyl(sx * .12, .02, sz, .045, .03, 'black', { rz: Math.PI / 2, seg: 8 });
  return geometryOf(k);
}

/* Merge a list of placed objects into a few meshes and drop the originals. */
export function merged(objs, opt) { const g = mergeStatic(objs, opt); objs.forEach(disposeTree); return g; }
