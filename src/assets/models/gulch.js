/* Copper Gulch models, built in code. Each building sits on its 2x2 yard plot (local x and z from -0.9 to 0.9; the
   front faces +z, toward the camera). makeBuilding(id, tier) returns { obj, movers, smoke, lights, top }:
   - obj: one group whose static parts are merged by material;
   - movers: named moving parts (spin turns while the building works, hot glows, flag waves);
   - smoke: chimney sockets; lights: lamp positions for night lighting.
   Adapted from the old game's buildings and units. */
import * as THREE from 'three';
import { Kit, part, rng } from '../../render/kit.js';

// --- shared pieces ---------------------------------------------------------------------------------------------------
function shed(k, x, z, w, d, h, wall, roof, o = {}) {
  const y = o.y || 0;
  k.box(x, y, z, w, h, d, wall, { jit: .08 });
  // corner posts and a sill: the trims that make a box read as a building
  const tc = o.trim || 'woodD';
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(x + sx * (w / 2 - .02), y, z + sz * (d / 2 - .02), .07, h, .07, tc);
  k.box(x, y + h - .04, z + d / 2, w + .04, .06, .04, tc);
  const rh = o.rh === undefined ? .34 : o.rh;
  if (o.flat) { k.box(x, y + h, z, w + .08, .06, d + .08, roof); }
  else if (o.hip) k.hip(x, y + h, z, w + .14, d + .14, rh, roof);
  else k.gable(x, y + h, z, w + .14, d + .16, rh, roof, { jit: .05 });
  return y + h + (o.flat ? .06 : rh);
}
// a Western false front: a tall flat board facing +z, with a stepped top and a sign board
function falseFront(k, x, z, w, h, c, sign) {
  k.box(x, 0, z, w, h, .07, c, { jit: .06 });
  k.box(x, h, z, w * .55, .14, .07, c);
  k.box(x, h - .04, z + .02, w + .06, .05, .09, 'woodD');
  k.box(x, h * .62, z + .045, w * .78, h * .2, .03, sign || 'cream');
  return h + .14;
}
function door(k, x, z, o = {}) { const w = o.w || .26, h = o.h || .42; k.box(x, 0, z, w + .06, h + .04, .03, 'woodD'); k.box(x, 0, z + .012, w, h, .03, o.c || 'bark'); k.box(x - w * .3, 0, z + .035, .12, .05, .14, 'stoneD'); }
function windows(k, xs, y, z, w = .16, h = .18, o) { for (const x of xs) k.win(x, y, z, w, h, o); }
function chimney(k, x, y, z, h, c = 'brick', r = .09) { k.box(x, y, z, r * 2, h, r * 2, c, { jit: .1 }); k.box(x, y + h - .05, z, r * 2 + .05, .07, r * 2 + .05, 'stoneD'); return new THREE.Vector3(x, y + h + .04, z); }
function stack(k, x, y, z, h, r = .07, c = 'iron') { k.cyl(x, y, z, r, h, c, { r2: r * .85, seg: 8 }); k.cyl(x, y + h - .06, z, r * 1.25, .06, 'black', { seg: 8 }); return new THREE.Vector3(x, y + h + .04, z); }
export function barrel(k, x, z, y = 0, c = 'wood') { k.cyl(x, y, z, .085, .22, c, { r2: .075, seg: 8 }); k.cyl(x, y + .045, z, .089, .022, 'iron', { seg: 8, ao: false }); k.cyl(x, y + .155, z, .087, .022, 'iron', { seg: 8, ao: false }); }
export function crate(k, x, z, s = .2, y = 0, ry = 0) { k.box(x, y, z, s, s, s, 'woodL', { ry }); k.box(x, y + s * .45, z, s + .012, s * .12, s + .012, 'woodD', { ry, ao: false }); }
function sacks(k, x, z) { for (const [dx, dz, y] of [[0, 0, 0], [.13, .02, 0], [.065, .01, .1]]) k.ball(x + dx, y + .06, z + dz, .075, 'cream', { sy: .75 }); }
function logpile(k, x, z, n = 3, len = .6, ry = 0) { const c = Math.cos(ry), s = Math.sin(ry); for (let row = 0; row < n; row++) for (let i = 0; i < n - row; i++) { const off = (i - (n - row - 1) / 2) * .13; k.log(x - s * off, row * .11, z + c * off, len, .065, i % 2 ? 'log' : 'woodL', { ry: ry + Math.PI / 2 * 0, seg: 6 }); } }
function planks(k, x, z, n = 4) { for (let i = 0; i < n; i++) k.box(x, i * .045, z, .5, .04, .2, i % 2 ? 'plank' : 'woodL'); }
function ingots(k, x, z, c = 'steel') { for (let row = 0; row < 3; row++) for (let i = 0; i < 3 - row; i++) k.box(x + (i - (2 - row) / 2) * .1, row * .05, z, .08, .05, .16, c, { mat: 'metal' }); }
function rocks(k, x, z, c1, c2, n, r, seed) { const R = rng(seed); for (let i = 0; i < n; i++) { const a = R() * 6.28, d = R() * r; k.dode(x + Math.cos(a) * d, .05 + R() * .1, z + Math.sin(a) * d * .7, .14 + R() * .18, R() < .5 ? c1 : c2, { ry: R() * 3, sy: .7 + R() * .4 }); } }
let LAMPS = null; // filled while a building is made, so it knows where its lamps are
function lantern(k, x, z, h = .62) { if (LAMPS) LAMPS.push(new THREE.Vector3(x + .12, h - .11, z)); k.box(x, 0, z, .04, h, .04, 'woodD'); k.box(x + .06, h - .02, z, .14, .03, .03, 'woodD'); k.box(x + .12, h - .16, z, .07, .1, .07, 'glowW', { mat: 'glow' }); k.box(x + .12, h - .07, z, .09, .03, .09, 'iron'); }
function flag(k, x, y, z, c = 'paintR') { k.box(x, y, z, .025, .5, .025, 'woodD'); k.box(x + .13, y + .34, z, .24, .14, .015, c); }
function rails(k, x, z, len, ry = 0) { const c = Math.cos(ry), s = Math.sin(ry); for (const o of [-.07, .07]) k.box(x + c * o, 0, z - s * o, .025, .025, len, 'steel', { ry, mat: 'metal' }); for (let i = -len / 2 + .05; i < len / 2; i += .12) k.box(x + s * i, 0, z + c * i, .22, .015, .04, 'woodD', { ry }); }
function cart(k, y = 0, load = 'rock', x = 0, z = 0) { k.box(x, y + .05, z, .2, .12, .26, 'iron', { mat: 'metal' }); for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.cyl(x + sx * .1, y + .04, z + sz * .08, .04, .02, 'black', { rz: Math.PI / 2, seg: 8 }); k.dode(x, y + .17, z, .09, load, { sy: .6 }); }
const lampRow = (k, xs, z) => { for (const x of xs) lantern(k, x, z); };

// --- the recipes: (kit, add) => top height. add(name, group, pos, axis, speed) registers a moving part ----------
const R = {
  camp(k, add) {
    // a log cabin with a stone chimney, a log pile and a chopping block
    for (let i = 0; i < 6; i++) { k.log(-.15, i * .085, .26, 1.08, .045, i % 2 ? 'log' : 'woodL'); k.log(-.15, i * .085, -.36, 1.08, .045, i % 2 ? 'woodL' : 'log'); }
    k.box(-.15, 0, -.05, 1.02, .5, .6, 'wood');
    k.gable(-.15, .5, -.05, 1.28, .92, .36, 'woodD', { jit: .08 });
    door(k, -.15, .3, { h: .38 }); windows(k, [-.46, .17], .2, .3, .14, .14);
    const sm = chimney(k, .3, 0, -.25, 1.02, 'stone', .09);
    logpile(k, .58, .45, 3, .55);
    k.cyl(-.62, 0, .55, .1, .14, 'woodL', { seg: 8 }); k.box(-.62, .14, .55, .03, .2, .03, 'woodD', { rz: .4 }); k.box(-.57, .3, .55, .1, .06, .02, 'steel', { mat: 'metal' });
    add('smoke', null, sm);
    return .86;
  },
  mine(k, add, c = { r1: 'rock', r2: 'rockD', ore: 'stoneD' }) {
    rocks(k, 0, -.38, c.r1, c.r2, 9, .65, 3); k.dode(0, .3, -.45, .5, c.r1, { sy: .8, ry: .4 }); k.dode(-.45, .15, -.3, .34, c.r2, { ry: 1 });
    // timbered tunnel mouth
    k.box(0, 0, -.02, .42, .42, .2, 'black'); for (const sx of [-1, 1]) k.box(sx * .22, 0, .08, .07, .48, .07, 'wood'); k.box(0, .46, .08, .55, .08, .09, 'wood');
    rails(k, 0, .45, .8);
    const ct = part(k2 => cart(k2, 0, c.ore)); add('cart', ct, new THREE.Vector3(0, .02, .45));
    k.cone(.55, 0, .45, .2, .2, c.ore, { seg: 6 }); k.box(-.55, 0, .45, .04, .5, .04, 'woodD'); k.box(-.55, .42, .45, .2, .14, .03, 'cream');
    return .85;
  },
  cumine(k, add) { return R.mine(k, add, { r1: 'verd', r2: 'rock', ore: 'copper' }); },
  pit(k, add) {
    k.cyl(-.15, 0, -.1, .52, .05, 'stoneD', { seg: 10 }); k.cyl(-.15, 0, -.1, .42, .055, 'black', { seg: 10 });
    // the headframe: two A-legs and the winding wheel on top
    for (const sx of [-1, 1]) { k.box(-.15 + sx * .3, 0, -.1, .07, 1.25, .07, 'wood', { rz: sx * .22 }); k.box(-.15 + sx * .24, 0, .18, .05, 1.1, .05, 'woodD', { rx: -.35, rz: sx * .2 }); }
    k.box(-.15, 1.12, -.1, .4, .06, .1, 'woodD');
    const wh = part(k2 => { k2.torus(0, 0, 0, .2, .025, 'iron', { mat: 'metal', ts: 12 }); for (let i = 0; i < 4; i++) k2.box(0, -.2, 0, .03, .4, .02, 'iron', { rz: i * .785, mat: 'metal' }); });
    add('spin', wh, new THREE.Vector3(-.15, 1.22, -.03), 'z', 3);
    k.cone(.55, 0, .42, .28, .3, 'coal', { seg: 7 }); k.cone(.38, 0, .62, .16, .17, 'coal', { seg: 6 }); k.box(.6, 0, -.45, .32, .34, .32, 'tinD'); k.gable(.6, .34, -.45, .38, .38, .12, 'roofS');
    return 1.4;
  },
  saw(k, add) {
    // an open sawmill shed with a spinning circular saw over the log carriage
    k.box(0, 0, 0, 1.6, .06, 1.1, 'woodD');
    for (const sx of [-.72, 0, .72]) for (const sz of [-.45, .45]) k.box(sx, .06, sz, .07, .62, .07, 'wood');
    k.gable(0, .68, 0, 1.7, 1.24, .32, 'roofR', { jit: .06 }); k.box(-.3, .06, -.45, 1, .5, .05, 'woodL');
    k.box(0, .06, .05, 1.2, .22, .2, 'woodD'); k.log(-.2, .28, .05, .7, .07, 'log');
    const bl = part(k2 => k2.gear(0, 0, 0, .19, .02, 'steel', { teeth: 14, mat: 'metal' }));
    add('spin', bl, new THREE.Vector3(.25, .4, .05), 'z', -14);
    planks(k, .45, .62, 4); logpile(k, -.55, .66, 2, .5); barrel(k, .76, -.3);
    return 1;
  },
  smelt(k, add) {
    const top = shed(k, -.1, -.1, 1.1, .8, .62, 'stone', 'roofS', { trim: 'stoneD' });
    // an arched furnace mouth that glows while it works
    k.box(-.3, 0, .3, .36, .34, .05, 'brickD'); k.box(-.3, .02, .31, .26, .24, .05, 'black');
    const hot = part(k2 => k2.box(0, 0, 0, .24, .22, .03, 'glowO', { mat: 'fire' })); add('hot', hot, new THREE.Vector3(-.3, .03, .335));
    windows(k, [.2], .3, .31, .18, .16, { c: 'glowO' });
    const sm = chimney(k, .4, 0, -.35, 1.42, 'brick', .12);
    ingots(k, .55, .55); cart(k, 0, 'rockR', -.62, .62);
    add('smoke', null, sm);
    return top;
  },
  market(k) {
    // a general store: false front, striped awning, crates and barrels of goods
    k.box(0, 0, -.2, 1.3, .62, .8, 'wood', { jit: .08 }); k.gable(0, .62, -.2, 1.4, .92, .28, 'roofRD');
    const top = falseFront(k, 0, .22, 1.34, .92, 'paintB', 'cream');
    k.cyl(0, .66, .27, .1, .02, 'gold', { rx: Math.PI / 2, seg: 10, mat: 'metal' });
    for (let i = 0; i < 7; i++) k.box(-.54 + i * .18, .42, .38, .18, .03, .34, i % 2 ? 'white' : 'paintR', { rx: .32 });
    for (const sx of [-.6, .6]) k.box(sx, 0, .53, .04, .48, .04, 'woodD');
    door(k, 0, .26, { w: .28 }); windows(k, [-.4, .4], .16, .26, .22, .2);
    crate(k, -.5, .72); crate(k, -.32, .78, .15); barrel(k, .5, .74); barrel(k, .66, .66); sacks(k, .28, .8);
    return top;
  },
  hall(k, add) {
    // the foremen's hall: a two-story saloon with a balcony and a flag
    k.box(0, 0, -.12, 1.3, 1.1, .85, 'paintG', { jit: .07 }); k.box(0, 1.1, -.12, 1.36, .06, .9, 'woodD');
    falseFront(k, 0, .3, 1.32, 1.28, 'paintG', 'cream');
    k.box(0, .52, .45, 1.34, .05, .32, 'woodL'); for (let i = 0; i < 9; i++) k.box(-.62 + i * .155, .57, .6, .025, .16, .025, 'woodD'); k.box(0, .71, .6, 1.3, .03, .03, 'woodD');
    for (const sx of [-.62, .62]) k.box(sx, 0, .6, .05, .52, .05, 'woodD');
    door(k, 0, .34, { w: .3, h: .4, c: 'woodL' }); windows(k, [-.42, .42], .16, .34, .2, .2); windows(k, [-.4, 0, .4], .66, .34, .16, .22);
    const fl = part(k2 => k2.box(.13, 0, 0, .26, .15, .015, 'paintR')); k.box(.55, 1.42, .3, .025, .55, .025, 'woodD'); add('flag', fl, new THREE.Vector3(.56, 1.78, .3));
    return 1.6;
  },
};


/* Milestones show on every building: crates at level 10, lanterns at 25, a flag at 50, gold trim at 100+. */
function milestones(k, tier, top, id) {
  if (tier >= 1) { crate(k, .78, .78, .16); barrel(k, -.8, .8); }
  if (tier >= 2) lampRow(k, [-.88, .7], .88);
  if (tier >= 3 && !['hall'].includes(id)) flag(k, -.7, top - .25, -.6, tier >= 4 ? 'gold' : 'paintR');
  if (tier >= 4) { k.box(0, 0, .92, 1.7, .05, .05, 'goldD'); for (let i = 0; i < 6; i++) k.box(-.75 + i * .3, .05, .92, .06, .08, .06, 'gold', { mat: 'metal' }); }
}
/* A plot not built yet: survey stakes and a little sign. */
function emptyLot(k) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(sx * .72, 0, sz * .72, .05, .18, .05, 'woodL');
  for (const [x, z, w, d] of [[0, .72, 1.44, .012], [0, -.72, 1.44, .012], [.72, 0, .012, 1.44], [-.72, 0, .012, 1.44]]) k.box(x, .14, z, w, .012, d, 'white', { ao: false });
  k.box(.45, 0, .55, .04, .34, .04, 'woodD'); k.box(.45, .26, .57, .26, .14, .02, 'cream');
  rocks(k, -.3, -.2, 'rock', 'rockD', 3, .3, 17);
}

/* The vault: a riveted safe on a stone plinth, with more steel bands as it is reinforced. */
export function makeVault(bands = 1) {
  return part(k => {
    k.box(0, 0, 0, .9, .14, .9, 'stoneL', { jit: .1 }); k.box(0, .14, 0, .74, .62, .7, 'iron', { mat: 'metal' }); k.box(0, .76, 0, .8, .06, .76, 'ironL', { mat: 'metal' });
    // the round door faces the road coming in (-x)
    k.cyl(-.37, .45, 0, .24, .04, 'steel', { rz: Math.PI / 2, seg: 12, mat: 'metal' }); k.torus(-.39, .45, 0, .24, .025, 'gold', { ry: Math.PI / 2, ts: 14, mat: 'metal' });
    k.torus(-.41, .45, 0, .08, .015, 'gold', { ry: Math.PI / 2, ts: 10, mat: 'metal' }); for (let i = 0; i < 3; i++) k.box(-.41, .45 - .1, 0, .015, .2, .015, 'gold', { rx: i * 1.05, mat: 'metal' });
    for (let i = 0; i < Math.min(5, bands); i++) k.box(0, .22 + i * .11, 0, .76, .025, .72, 'goldD', { mat: 'metal' });
    for (const sy of [.2, .7]) for (const sz of [-.3, .3]) k.ball(-.372, sy, sz, .02, 'steel');
    k.box(0, .82, 0, .3, .05, .3, 'gold', { mat: 'metal' });
  });
}

/* --- scenery -------------------------------------------------------------------------------------------------- */
export const PROPS = {
  tree: (s, seed) => part(k => { const R2 = rng(seed); k.cyl(0, 0, 0, .07, .35, 'bark', { r2: .05, seg: 6 }); for (let i = 0; i < 3; i++) k.cone(0, .25 + i * .22, 0, .42 - i * .1, .42, i % 2 ? 'leaf' : 'leafD', { seg: 7, ry: R2() * 3, jit: .12 }); }),
  boulder: (s, seed) => part(k => { const R2 = rng(seed); k.dode(0, .25, 0, .32, 'stone', { ry: R2() * 3, sy: .8 }); k.dode(.25, .12, .1, .2, 'stoneD', { ry: R2() * 3 }); k.dode(-.2, .1, .15, .16, 'stoneL'); }),
  rock: (s, seed) => part(k => { const R2 = rng(seed); k.dode(0, .18, 0, .26, 'rock', { ry: R2() * 3, sy: .75 }); k.dode(.2, .1, .12, .14, 'rockD', { ry: R2() * 3 }); }),
  shrub: (s, seed) => part(k => { const R2 = rng(seed); k.cyl(0, 0, 0, .03, .12, 'bark', { seg: 5 }); for (let i = 0; i < 4; i++) { const a = R2() * 6.28, d = R2() * .14; k.ball(Math.cos(a) * d, .16 + R2() * .08, Math.sin(a) * d, .15 + R2() * .05, i % 2 ? '#8fa36a' : '#6f8452', { jit: .1, sy: .8 }); } for (let i = 0; i < 3; i++) k.ball((R2() - .5) * .3, .32, (R2() - .5) * .3, .025, 'paintY'); }),
  rockV: (s, seed) => part(k => { const R2 = rng(seed); k.dode(0, .18, 0, .26, 'verd', { ry: R2() * 3, sy: .75 }); k.dode(.2, .1, .12, .14, 'rock', { ry: R2() * 3 }); }),
  cactus: (s, seed) => part(k => { const R2 = rng(seed); k.cyl(0, 0, 0, .07, .5, 'cactus', { seg: 7, r2: .06 }); k.ball(0, .5, 0, .06, 'cactus', { sy: .7 }); for (const sx of [-1, 1]) { const y = .16 + R2() * .14; k.box(sx * .1, y, 0, .12, .05, .05, 'cactusD'); k.cyl(sx * .15, y, 0, .04, .16 + R2() * .08, 'cactus', { seg: 6 }); } k.ball(0, .56, 0, .025, 'paintR'); }),
  barrel: () => part(k => barrel(k, 0, 0)),
  crate: () => part(k => crate(k, 0, 0, .22, 0, .3)),
  skull: () => part(k => { k.ball(0, .06, 0, .07, 'white', { sy: .85 }); k.box(.03, .04, .06, .02, .02, .01, 'ink'); k.box(-.03, .04, .06, .02, .02, .01, 'ink'); for (const s of [-1, 1]) k.cone(s * .12, .02, -.05, .02, .14, 'white', { rz: s * 1.3, seg: 4 }); }),
  weed: () => part(k => { k.ball(0, .12, 0, .12, 'woodL', { det: 0 }); k.ball(0, .12, 0, .1, 'bark', { det: 0, ry: .7 }); }, { cast: true }),
};

export const BUILDING_IDS = Object.keys(R);
/* Build a building: { obj, movers, smoke, lights, top } (see the top of this file). */
export function makeBuilding(id, tier = 0) {
  const k = new Kit({ aoH: .8 }), movers = [], smoke = [], obj = new THREE.Group(), lights = LAMPS = [];
  const add = (kind, node, pos, axis, speed) => {
    if (kind === 'smoke') { smoke.push(pos.clone()); return; }
    node.position.copy(pos); obj.add(node); movers.push({ kind, node, axis, speed, base: node.rotation.clone(), y0: pos.y });
  };
  let top = 1;
  if (id === '_lot') emptyLot(k); else if (R[id]) { top = R[id](k, add); milestones(k, tier, top, id); } else { shed(k, 0, 0, 1.2, .9, .6, 'wood', 'roofR'); }
  obj.add(k.build());
  obj.traverse(o => { if (o.isMesh) { o.castShadow = o.castShadow !== false && o.material.type !== 'MeshBasicMaterial'; o.receiveShadow = true; } });
  LAMPS = null;
  return { obj, movers, smoke, lights, top };
}
