/* Thunder Mesa models, built in code like the Gulch's (src/assets/models/gulch.js): each recipe draws on the 2x2 plot
   (local x and z from -0.9 to 0.9, the front toward +z) and returns its top height. Loading this file adds its recipes
   to makeBuilding. Oil and flight: timber derricks, steel tanks and pipes, tin sheds and a silver airship. */
import * as THREE from 'three';
import { part } from '../../render/kit.js';
import { addRecipes, shed, door, windows, stack, rocks, rails, cart, barrel, crate } from './gulch.js';

// a steel tank on short legs, with a ladder up its side
function tank(k, x, z, r, h, c = 'steel') {
  k.cyl(x, .06, z, r, h, c, { seg: 12, mat: 'metal' });
  k.cyl(x, .06 + h, z, r * 1.02, .04, 'iron', { seg: 12 });
  k.cyl(x, .06 + h + .04, z, r * .9, .06, c, { r2: r * .3, seg: 12, mat: 'metal' });
  k.box(x, .06, z + r + .02, .08, h, .02, 'iron');
}
// a pipe run between two points at one height
function pipe(k, x1, z1, x2, z2, y, r = .03) {
  const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz);
  k.box((x1 + x2) / 2, y, (z1 + z2) / 2, len, r * 2, r * 2, 'ironL', { ry: -Math.atan2(dz, dx), mat: 'metal' });
}
// a stack of tires lying flat
function tires(k, x, z, n) { for (let i = 0; i < n; i++) k.torus(x, .05 + i * .08, z, .1, .04, 'black', { rx: Math.PI / 2, ts: 10 }); }
// a small automobile facing +x: a box body, a cab, four wheels
function auto(k, x, z, c = 'paintB') {
  k.box(x, .07, z, .42, .1, .2, c, { mat: 'metal' });
  k.box(x - .04, .17, z, .2, .1, .18, c, { mat: 'metal' });
  k.box(x + .07, .17, z, .02, .08, .16, 'glowI');
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.cyl(x + sx * .13, .06, z + sz * .1, .06, .03, 'black', { rx: Math.PI / 2, seg: 10 });
}

const R = {
  derrick(k, add) {
    // a tall timber derrick over the well, a pump jack nodding beside it, a tank and a few barrels of crude
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(-.3 + sx * .2, 0, -.3 + sz * .2, .05, 1.6, .05, 'wood', { rx: -sz * .1, rz: sx * .1 });
    for (const y of [.4, .8, 1.2]) { const w = .44 - y * .2; k.box(-.3, y, -.3 + w / 2, w, .03, .03, 'woodD'); k.box(-.3, y, -.3 - w / 2, w, .03, .03, 'woodD'); k.box(-.3 + w / 2, y, -.3, .03, .03, w, 'woodD'); k.box(-.3 - w / 2, y, -.3, .03, .03, w, 'woodD'); }
    k.box(-.3, 1.58, -.3, .16, .08, .16, 'woodD');
    k.cyl(-.3, 0, -.3, .26, .02, 'black', { seg: 10, ao: false }); // the oil stain round the well
    k.box(.45, 0, .1, .1, .4, .1, 'iron');
    k.box(.45, .4, .1, .7, .06, .06, 'iron', { rz: .15 }); k.box(.78, .3, .1, .08, .16, .1, 'ink');
    const crank = part(k2 => { k2.cyl(0, 0, 0, .1, .03, 'iron', { rx: Math.PI / 2, seg: 10 }); k2.box(.06, -.03, .035, .1, .06, .03, 'ink'); });
    add('spin', crank, new THREE.Vector3(.18, .2, .16), 'z', 1.2);
    tank(k, .5, -.5, .22, .42, 'tinD');
    barrel(k, -.7, .55, 0, 'black'); barrel(k, -.5, .65, 0, 'black'); barrel(k, .1, .7, 0, 'woodD');
    return 1.66;
  },
  bauxitepit(k, add) {
    // a stepped pit in red bauxite, a steam shovel at its edge and a cart of red ore on rails
    for (let i = 0; i < 3; i++) k.box(-.2, -.02 + i * .08, -.35 + i * .1, 1.2 - i * .3, .08, .8 - i * .2, i % 2 ? '#b8664a' : '#9a4a32', { jit: .08 });
    rocks(k, .55, -.55, '#c4683f', 'rockR', 6, .3, 17);
    k.box(.4, 0, .25, .34, .2, .26, 'iron', { mat: 'metal' }); k.box(.4, .2, .25, .26, .18, .22, 'paintY');
    add('smoke', null, stack(k, .48, .38, .2, .22, .03));
    k.box(.15, .3, .25, .4, .04, .05, 'iron', { rz: -.6 });
    k.box(-.02, .1, .25, .12, .1, .12, 'ironL');
    rails(k, -.4, .5, .8, Math.PI / 2);
    const ct = part(k2 => cart(k2, 0, '#c4683f')); add('cart', ct, new THREE.Vector3(-.5, .02, .5));
    return .6;
  },
  rubberfarm(k, add) {
    // rows of gray-green rubber shrubs, a press shed and bales of raw rubber
    for (let row = 0; row < 3; row++) for (let i = 0; i < 4; i++) {
      const x = -.7 + i * .3, z = -.6 + row * .3;
      k.dode(x, .1, z, .11, row % 2 ? '#7a8a4a' : '#8f9a62', { sy: .8, ry: i });
    }
    shed(k, .5, .4, .7, .5, .38, 'woodL', 'tin');
    door(k, .5, .66, { w: .2, h: .3 });
    for (let i = 0; i < 3; i++) k.box(-.55 + i * .2, 0, .6, .16, .12 + (i % 2) * .04, .16, '#4a4a3a');
    crate(k, -.1, .7, .16);
    return .9;
  },
  refinery(k, add) {
    // two tall columns with rings, a squat tank, pipes between them and a flare stack burning off gas
    k.cyl(-.4, 0, -.3, .16, 1.3, 'steel', { seg: 10, mat: 'metal' });
    k.cyl(-.05, 0, -.4, .12, 1.0, 'steel', { seg: 10, mat: 'metal' });
    for (const y of [.35, .7, 1.05]) k.cyl(-.4, y, -.3, .18, .03, 'iron', { seg: 10 });
    for (const y of [.3, .65]) k.cyl(-.05, y, -.4, .14, .03, 'iron', { seg: 10 });
    tank(k, .45, .3, .3, .4, 'white');
    pipe(k, -.4, -.3, .45, -.3, .5); pipe(k, -.05, -.4, -.05, .3, .25); pipe(k, -.05, .3, .45, .3, .25);
    k.cyl(.6, 0, -.55, .04, 1.1, 'iron', { seg: 6 });
    const hot = part(k2 => k2.cone(0, 0, 0, .06, .16, 'glowO', { mat: 'fire', seg: 6 })); add('hot', hot, new THREE.Vector3(.6, 1.1, -.55));
    add('smoke', null, new THREE.Vector3(-.4, 1.32, -.3));
    barrel(k, -.65, .5, 0, 'black'); barrel(k, -.45, .6, 0, 'paintY');
    return 1.35;
  },
  aluminumworks(k, add) {
    // a silver-roofed pot room fed by a power pole with thick cables (aluminum is made with electricity), a ladle
    // pouring white-hot metal into molds, and tall stacks of shining ingots (clarity fix 8p: it read as a shed)
    k.box(-.15, 0, -.35, 1.3, .48, .7, 'tinD', { jit: .04 });
    k.gable(-.15, .48, -.35, 1.36, .76, .2, 'white', { mat: 'metal' });
    windows(k, [-.6, -.15, .3], .2, .01, .16, .14, { c: 'glowO' });
    for (const x of [-.55, -.15, .25]) add('smoke', null, stack(k, x, .6, -.45, .3, .04, 'ironL'));
    // the power pole: a tall post, a crossarm with three white insulators and cables sagging to the roof
    k.box(.72, 0, -.55, .07, 1.25, .07, 'woodD');
    k.box(.72, 1.15, -.55, .07, .05, .5, 'woodD');
    for (const dz of [-.2, 0, .2]) { k.cyl(.72, 1.2, -.55 + dz, .03, .07, 'white', { seg: 6 }); k.box(.6, 1.0, -.55 + dz, .3, .02, .02, 'black', { rz: .55 }); }
    // the ladle on its frame, tipped toward a row of molds glowing with poured metal
    k.box(.35, 0, .3, .04, .45, .04, 'iron'); k.box(.75, 0, .3, .04, .45, .04, 'iron'); k.box(.55, .45, .3, .46, .04, .04, 'iron');
    k.cyl(.55, .24, .3, .13, .16, 'iron', { r2: .09, seg: 10, rz: .5 });
    const hot = part(k2 => { k2.cyl(0, 0, 0, .1, .02, 'glowO', { mat: 'fire', seg: 10 }); for (let i = 0; i < 3; i++) k2.box(-.25 - i * .17, -.2, .22, .12, .03, .08, 'glowO', { mat: 'fire' }); });
    add('hot', hot, new THREE.Vector3(.6, .36, .3));
    for (let i = 0; i < 3; i++) k.box(.3 - i * .17, 0, .52, .14, .12, .1, 'iron');
    // ingots stacked crosswise, bright and tall enough to read from the map
    for (const [x, z] of [[-.6, .35], [-.25, .55]]) for (let row = 0; row < 5; row++) for (let i = 0; i < 2; i++) {
      const across = row % 2 === 1;
      k.box(x + (across ? 0 : (i - .5) * .12), row * .055, z + (across ? (i - .5) * .12 : 0), across ? .26 : .1, .055, across ? .1 : .26, '#f4f7fa');
    }
    return 1.25;
  },
  tireworks(k, add) {
    // a brick shed with a tall stack, a mold that turns a tire, and piles of black tires out front
    k.box(-.15, 0, -.3, 1.1, .55, .7, 'brick', { jit: .06 });
    k.gable(-.15, .55, -.3, 1.16, .76, .26, 'roofS');
    windows(k, [-.45, -.15, .15], .24, .06, .16, .16);
    add('smoke', null, stack(k, .55, 0, -.5, 1.0, .07, 'brickD'));
    const mold = part(k2 => { k2.torus(0, 0, 0, .14, .05, 'black', { ts: 12 }); k2.cyl(0, 0, 0, .09, .04, 'steel', { rx: Math.PI / 2, seg: 10 }); });
    add('spin', mold, new THREE.Vector3(.5, .3, .3), 'z', 2);
    k.box(.5, 0, .3, .12, .16, .1, 'iron');
    tires(k, -.55, .5, 4); tires(k, -.25, .6, 3); tires(k, .05, .55, 2);
    return 1.0;
  },
  motorworks(k, add) {
    // a brick factory with a sawtooth roof and a big brass gear over its door, and out front a red motor on a test
    // stand: its cylinders in a row on top, a big flywheel turning and a belt to the wall (clarity fix 8p: it read as
    // a small shed with a box beside it)
    k.box(0, 0, -.35, 1.5, .55, .7, 'brickD', { jit: .06 });
    for (let i = 0; i < 3; i++) { k.gable(-.5 + i * .5, .55, -.35, .5, .74, .24, i % 2 ? 'tinD' : 'tin', { ry: Math.PI / 2 }); k.box(-.5 + i * .5 - .2, .6, -.35, .02, .14, .7, 'glowW'); }
    windows(k, [-.55, -.25, .25, .55], .22, .01, .14, .14, { c: 'glowW' });
    k.box(-.02, 0, .01, .3, .36, .02, 'iron');
    // the gear: a brass ring with ten teeth on the front wall, over the door
    const gear = part(k2 => { k2.cyl(0, 0, 0, .14, .04, 'paintY', { rx: Math.PI / 2, seg: 12, mat: 'metal' }); k2.cyl(0, 0, .01, .05, .05, 'iron', { rx: Math.PI / 2, seg: 8 }); for (let i = 0; i < 10; i++) { const t = i / 10 * Math.PI * 2; k2.box(Math.cos(t) * .16, Math.sin(t) * .16 - .025, 0, .05, .05, .04, 'paintY', { rz: t, mat: 'metal' }); } });
    add('spin', gear, new THREE.Vector3(-.02, .46, .04), 'z', .6);
    // the test stand: a timber bed, the motor block, four cylinder heads, an exhaust pipe and the flywheel
    k.box(.3, 0, .48, .62, .14, .34, 'woodD');
    k.box(.3, .14, .48, .46, .22, .26, 'paintR', { mat: 'metal' });
    for (let i = 0; i < 4; i++) k.box(.14 + i * .11, .36, .48, .08, .08, .2, 'steel', { mat: 'metal' });
    k.box(.3, .44, .4, .46, .03, .03, 'ironL');
    add('smoke', null, stack(k, .58, .3, .6, .3, .03));
    const fly = part(k2 => { k2.cyl(0, -.025, 0, .2, .05, 'iron', { rx: Math.PI / 2, seg: 14 }); for (const r of [0, Math.PI / 2]) k2.box(0, 0, -.03, .34, .03, .02, 'steel', { rz: r }); });
    add('spin', fly, new THREE.Vector3(-.02, .3, .48), 'z', 6);
    k.box(-.04, .3, .2, .03, .03, .5, 'black', { rx: .25 });
    crate(k, -.6, .45, .2); crate(k, -.62, .7, .16); barrel(k, -.35, .7, 0, 'paintY');
    return 1.0;
  },
  autoplant(k, add) {
    // a long white assembly hall with a stepped front, a sign, and a new automobile rolling out on the front lot
    k.box(-.1, 0, -.3, 1.6, .62, .8, 'white', { jit: .04 });
    k.box(-.1, .62, -.3, 1.66, .06, .86, 'stoneD');
    k.box(-.1, .68, .08, .8, .16, .06, 'white');
    k.box(-.1, .72, .12, .6, .08, .02, 'paintB');
    windows(k, [-.7, -.4, .2, .5], .25, .11, .16, .2);
    k.box(-.1, 0, .11, .34, .34, .03, 'iron');
    k.box(-.1, 0, .35, 1.6, .01, .5, '#7d7266', { ao: false });
    const car = part(k2 => auto(k2, 0, 0, 'paintB'));
    add('cart', car, new THREE.Vector3(.35, .01, .45));
    auto(k, -.55, .52, 'paintR');
    add('smoke', null, stack(k, .62, .68, -.55, .4, .05));
    return 1.1;
  },
  airshipworks(k, add) {
    // a tall round-roofed hangar and a silver airship moored nose first to a mast beside it, its propeller turning
    k.box(-.4, 0, -.25, .9, .5, 1.1, 'tin');
    k.cyl(-.4, .5, -.8, .45, 1.1, 'tinD', { rx: Math.PI / 2, seg: 12 }); // lying along z, from the back to the front wall
    k.box(-.4, 0, .31, .6, .6, .02, 'black');
    k.cyl(.72, 0, -.1, .035, 1.15, 'iron', { seg: 6 });
    k.cyl(.72, 1.15, -.1, .07, .05, 'ironL', { seg: 8 });
    k.ball(.42, 1.12, -.1, .3, '#c9ced6', { det: 1, sy: .5, sz: .5, mat: 'metal' });
    k.box(.42, .92, -.1, .22, .07, .1, 'woodD');
    for (const sy of [-1, 1]) k.box(.16, 1.12 + sy * .09, -.1, .1, .02, .14, 'paintR');
    k.box(.16, 1.03, -.1, .1, .18, .02, 'paintR');
    const prop = part(k2 => { k2.box(0, -.09, 0, .02, .18, .03, 'woodD'); });
    add('spin', prop, new THREE.Vector3(.1, 1.12, -.1), 'x', 8);
    crate(k, .2, .75, .18); barrel(k, .45, .8);
    return 1.4;
  },
  // --- Tar Seep, the fourth outpost (M6b part 3) ---
  oilwell(k, add) {
    // a pool of black crude seeping up through the sand, a small pump jack nodding over a well head beside it, a short
    // timber tripod over the old hole, and barrels of crude waiting to go
    k.cyl(-.25, 0, -.2, .55, .02, 'black', { seg: 12, sx: 1.2, ao: false });
    k.cyl(-.5, .01, .15, .24, .02, '#3a2c1e', { seg: 10, ao: false });
    k.box(.35, 0, -.25, .5, .08, .26, 'stoneD');
    for (const sz of [-1, 1]) k.box(.35, .08, -.25 + sz * .09, .06, .42, .04, 'iron', { rx: sz * -.12 });
    k.box(.35, .48, -.25, .78, .07, .07, 'iron', { rz: .12, mat: 'metal' });
    k.box(-.05, .38, -.25, .1, .22, .09, 'ink', { rz: .12 }); // the horse head over the well
    k.cyl(-.05, 0, -.25, .05, .3, 'ironL', { seg: 6 });
    const crank = part(k2 => { k2.cyl(0, 0, 0, .12, .04, 'iron', { rx: Math.PI / 2, seg: 10 }); k2.box(.07, -.04, .03, .12, .08, .04, 'ink'); });
    add('spin', crank, new THREE.Vector3(.62, .2, -.12), 'z', 1.1);
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; k.box(-.3 + Math.cos(a) * .18, 0, -.25 + Math.sin(a) * .18, .05, .9, .05, 'wood', { rx: Math.sin(a) * .2, rz: -Math.cos(a) * .2 }); }
    k.box(-.3, .86, -.25, .14, .06, .14, 'woodD');
    barrel(k, .55, .45, 0, 'black'); barrel(k, .35, .6, 0, 'black'); barrel(k, .7, .62, 0, 'woodD');
    crate(k, -.6, .6, .18);
    return .95;
  },
  rubbergrove(k, add) {
    // a few rubber trees with tapping cups on their trunks, and sheets of raw rubber hung to dry on a rack
    for (const [x, z, h] of [[-.6, -.55, .7], [-.1, -.6, .8], [.45, -.5, .65], [-.45, .0, .75], [.15, -.05, .7]]) {
      k.cyl(x, 0, z, .05, h, 'bark', { r2: .04, seg: 6 });
      k.dode(x, h - .05, z, .24, 'leafD', { sy: .8, ry: x * 5 });
      k.dode(x + .1, h + .08, z - .05, .16, 'leaf', { sy: .8, ry: z * 5 });
      k.cyl(x, .22, z + .06, .035, .06, 'white', { seg: 6 });
    }
    for (const sx of [-1, 1]) k.box(.35 + sx * .3, 0, .55, .04, .4, .04, 'woodD');
    k.box(.35, .38, .55, .66, .03, .03, 'woodD');
    for (let i = 0; i < 3; i++) k.box(.15 + i * .2, .14, .55, .14, .24, .01, '#d9cf9a', { ao: false });
    for (let i = 0; i < 3; i++) k.box(-.55 + i * .17, 0, .6, .14, .1 + (i % 2) * .04, .14, '#4a4a3a');
    return .9;
  },
};

addRecipes(R);
export const MESA_BUILDINGS = Object.keys(R);
