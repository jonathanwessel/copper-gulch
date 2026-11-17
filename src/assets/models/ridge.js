/* Iron Ridge and Pine Hollow models, built in code like the Gulch's (src/assets/models/gulch.js): each recipe draws
   on the 2x2 plot (local x and z from -0.9 to 0.9, the front toward +z) and returns its top height. Loading this file
   adds its recipes to makeBuilding. Parts use the plain material (not metal), so each building draws in fewer calls.  */
import * as THREE from 'three';
import { part } from '../../render/kit.js';
import { addRecipes, shed, door, windows, chimney, stack, logpile, ingots, rocks, rails, cart, barrel, crate, planks } from './gulch.js';

const R = {
  // --- Iron Ridge ---
  rquarry(k, add) {
    // a gray granite face cut in steps, a steam derrick with a turning drum, and blocks stacked for the line
    for (let i = 0; i < 3; i++) k.box(-.2, i * .3, -.5 + i * .03, 1.35 - i * .32, .32, .55 - i * .12, i % 2 ? 'stoneL' : 'stoneD', { jit: .08 });
    rocks(k, -.2, -.3, 'stone', 'stoneD', 7, .6, 31);
    k.box(.45, 0, -.1, .08, 1.2, .08, 'iron'); k.box(.45, 1.05, .1, .06, .06, .75, 'ironL', { rx: .5 });
    k.box(.62, 0, -.05, .26, .22, .22, 'iron');
    const drum = part(k2 => { k2.cyl(0, -.08, 0, .08, .16, 'steel', { rz: Math.PI / 2, seg: 8 }); k2.box(0, -.01, 0, .18, .02, .02, 'ink'); });
    add('spin', drum, new THREE.Vector3(.62, .3, -.05), 'x', 4);
    add('smoke', null, stack(k, .7, .22, -.12, .3, .04));
    for (let r = 0; r < 2; r++) for (let i = 0; i < 3 - r; i++) k.box(-.55 + (i - (2 - r) / 2) * .2, r * .14, .55, .18, .13, .22, r % 2 ? 'stoneL' : 'stone');
    return 1.25;
  },
  ironmine(k, add) {
    // a timbered adit in rust-red rock with a steel headframe, ore carts on rails and a heap of red ore
    rocks(k, 0, -.45, 'rockR', 'rockD', 9, .65, 37); k.dode(0, .32, -.5, .5, 'rockR', { sy: .8, ry: .2 });
    k.box(0, 0, -.06, .42, .42, .2, 'black'); for (const sx of [-1, 1]) k.box(sx * .22, 0, .05, .07, .48, .07, 'woodD'); k.box(0, .46, .05, .56, .08, .09, 'woodD');
    for (const sx of [-1, 1]) k.box(.55 + sx * .14, 0, -.35, .05, 1.0, .05, 'iron', { rz: sx * .12 });
    const wh = part(k2 => { k2.torus(0, 0, 0, .14, .02, 'steel', { ts: 12 }); k2.box(0, -.14, 0, .02, .28, .02, 'steel'); });
    add('spin', wh, new THREE.Vector3(.55, .98, -.35), 'z', 3);
    rails(k, 0, .45, .8);
    const ct = part(k2 => cart(k2, 0, 'rockR')); add('cart', ct, new THREE.Vector3(0, .02, .45));
    k.cone(-.55, 0, .45, .24, .22, 'rockR', { seg: 6 }); k.cone(-.7, 0, .7, .13, .12, 'rockD', { seg: 5 });
    return 1.1;
  },
  colliery(k, add) {
    // a coal pit: a tall timber tipple over a black heap, a chute, and a cart of coal
    k.cyl(-.2, 0, -.2, .55, .05, 'coal', { seg: 10, jit: .08 });
    k.cone(-.2, 0, -.2, .45, .35, 'coal', { seg: 8, jit: .1 }); k.cone(.25, 0, -.45, .25, .2, 'coal', { seg: 6 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(.35 + sx * .22, 0, .1 + sz * .2, .06, .95, .06, 'woodD');
    k.box(.35, .95, .1, .56, .35, .5, 'wood', { jit: .06 }); k.gable(.35, 1.3, .1, .62, .56, .2, 'tinD');
    k.box(.05, .7, .15, .5, .05, .16, 'iron', { rz: .5 });
    const wh = part(k2 => k2.gear(0, 0, 0, .12, .02, 'iron', { teeth: 10 })); add('spin', wh, new THREE.Vector3(.35, 1.15, .36), 'z', 2.5);
    rails(k, .35, .55, .7, Math.PI / 2); cart(k, 0, 'coal', .55, .55);
    return 1.5;
  },
  furnace(k, add) {
    // a blast furnace: a stone stack wider at the waist, a glowing tap hole, a charging ramp and pig iron in the sand
    k.cyl(-.15, 0, -.15, .42, .5, 'stoneD', { r2: .5, seg: 10, jit: .06 }); k.cyl(-.15, .5, -.15, .5, .6, 'stone', { r2: .34, seg: 10, jit: .06 });
    k.cyl(-.15, 1.1, -.15, .34, .12, 'iron', { seg: 10 });
    add('smoke', null, new THREE.Vector3(-.15, 1.26, -.15));
    k.box(-.15, 0, .3, .26, .22, .1, 'brickD'); k.box(-.15, .02, .35, .16, .14, .04, 'black');
    const hot = part(k2 => k2.box(0, 0, 0, .14, .12, .03, 'glowO', { mat: 'fire' })); add('hot', hot, new THREE.Vector3(-.15, .03, .37));
    k.box(-.15, 0, .55, .14, .02, .4, 'glowO', { mat: 'fire' });                       // the molten run to the molds
    k.box(.5, 0, -.1, .14, 1.0, .5, 'wood', { rx: -.5 });                                // the charging ramp
    add('smoke', null, stack(k, .6, 0, -.6, 1.2, .08, 'iron'));
    ingots(k, .45, .55, 'iron'); cart(k, 0, 'rockR', -.65, .6);
    return 1.3;
  },
  steelmill(k, add) {
    // a long tin-roofed mill with two stacks and a converter pot that tips and glows
    const top = shed(k, -.15, -.25, 1.3, .75, .7, 'tinD', 'roofS', { trim: 'iron' });
    windows(k, [-.55, -.2, .15], .35, .13, .16, .16, { c: 'glowO' });
    add('smoke', null, stack(k, -.55, .7, -.45, .7, .07, 'iron')); add('smoke', null, stack(k, -.25, .7, -.45, .6, .07, 'iron'));
    const pot = part(k2 => { k2.cyl(0, -.15, 0, .16, .3, 'iron', { r2: .1, seg: 10 }); k2.cyl(0, .14, 0, .1, .03, 'glowO', { seg: 10, mat: 'fire' }); });
    add('hammer', pot, new THREE.Vector3(.55, .3, .4));
    for (const sx of [-1, 1]) k.box(.55 + sx * .22, 0, .4, .05, .38, .05, 'iron');
    ingots(k, -.45, .6, 'steel');
    return top;
  },
  rolling(k, add) {
    // a rolling mill: a low brick hall, a big flywheel that turns, and rails stacked in the yard
    const top = shed(k, -.1, -.3, 1.3, .7, .55, 'brick', 'roofS', { trim: 'brickD' });
    windows(k, [-.45, -.1, .25], .25, .06, .16, .16);
    const fw = part(k2 => { k2.torus(0, 0, 0, .26, .04, 'iron', { ts: 14 }); for (let i = 0; i < 3; i++) k2.box(0, -.26, 0, .03, .52, .03, 'iron', { rz: i * 1.05 }); });
    add('spin', fw, new THREE.Vector3(.68, .3, -.2), 'x', 2.5);
    add('smoke', null, chimney(k, -.6, .55, -.5, .55, 'brickD', .08));
    for (let r = 0; r < 4; r++) k.box(-.1, r * .04, .45 + (r % 2) * .03, 1.1, .035, .05, 'steel');
    for (let r = 0; r < 3; r++) k.box(-.1, r * .04, .65, 1.1, .035, .05, 'steel');
    return top;
  },
  boilershop(k, add) {
    // a boiler shop: a brick shed with a big door, a riveted boiler on cradles, bricks stacked, a crane
    const top = shed(k, -.2, -.3, 1.2, .7, .65, 'brick', 'tinD', { trim: 'brickD' });
    k.box(-.2, 0, .06, .5, .5, .03, 'black');
    k.cyl(.25, .32, .5, .22, .9, 'iron', { rz: Math.PI / 2, seg: 12 });
    for (const x of [-.12, .62]) k.box(x, 0, .5, .1, .14, .36, 'woodD');
    for (let i = 0; i < 4; i++) k.torus(-.1 + i * .23, .32, .5, .225, .012, 'ironL', { ry: Math.PI / 2, ts: 12 });
    for (let r = 0; r < 2; r++) for (let i = 0; i < 2; i++) k.box(-.7 + i * .14, r * .07, .65, .12, .065, .2, 'brick');
    const hot = part(k2 => k2.box(0, 0, 0, .1, .1, .02, 'glowO', { mat: 'fire' })); add('hot', hot, new THREE.Vector3(-.2, .1, .08));
    add('smoke', null, stack(k, .45, .65, -.5, .45, .06));
    return top;
  },
  loco(k, add) {
    // the locomotive works: a tall engine house with a round-top door, and a new engine on a stub of track
    k.box(0, 0, -.35, 1.5, .9, .8, 'brickD', { jit: .06 }); k.gable(0, .9, -.35, 1.6, .94, .4, 'roofS');
    k.box(0, 0, .06, .5, .62, .03, 'black'); k.cyl(0, .62, .06, .25, .03, 'black', { rx: Math.PI / 2, seg: 10 });
    windows(k, [-.55, .55], .45, .06, .18, .2);
    add('smoke', null, chimney(k, .55, .9, -.55, .4, 'brick', .08));
    rails(k, 0, .55, 1.6, Math.PI / 2);
    // the engine: boiler, cab, stack and wheels, facing east
    k.cyl(-.05, .16, .55, .13, .55, 'ink', { rz: Math.PI / 2, seg: 10 }); k.box(-.45, .1, .55, .26, .36, .3, 'paintR'); k.box(-.45, .46, .55, .32, .04, .34, 'ink');
    k.cyl(.12, .28, .55, .045, .18, 'ink', { r2: .07, seg: 8 }); k.cone(.3, .03, .55, .1, .14, 'iron', { rz: -Math.PI / 2, seg: 4 });
    for (const x of [-.4, -.15, .1]) for (const sz of [-1, 1]) k.cyl(x, .08, .55 + sz * .15, .08, .03, 'paintR', { rx: Math.PI / 2, seg: 10 });
    k.box(0, .06, .55, .1, .02, .34, 'gold');
    return 1.4;
  },
  // --- Pine Hollow ---
  logcamp(k, add) {
    // a logging camp in the pines: a bunkhouse, a log deck, a two-man saw on a trestle and two tall pines
    for (let i = 0; i < 5; i++) k.log(-.25, i * .085, -.2, .9, .045, i % 2 ? 'log' : 'bark');
    k.box(-.25, 0, -.42, .86, .42, .4, 'wood'); k.gable(-.25, .42, -.42, 1.04, .7, .3, 'roofG', { jit: .06 });
    door(k, -.25, -.02, { h: .36 });
    add('smoke', null, chimney(k, .1, 0, -.6, .9, 'stone', .07));
    logpile(k, .5, .4, 3, .6); logpile(k, -.45, .55, 2, .5);
    for (const [x, z, h] of [[.65, -.45, 1.3], [.8, .0, 1.0]]) { k.cyl(x, 0, z, .05, .3, 'bark', { seg: 6 }); for (let i = 0; i < 3; i++) k.cone(x, .2 + i * .25, z, .3 - i * .07, .4 * h, i % 2 ? 'leaf' : 'leafD', { seg: 7 }); }
    k.box(.05, 0, .3, .05, .22, .3, 'woodD'); k.log(.05, .2, .3, .5, .06, 'log');
    return 1.1;
  },
  claybank(k, add) {
    // a clay bank: a cut red bank by a creek, a sluice, a barrow on a plank, and drying blocks
    for (let i = 0; i < 3; i++) k.box(-.15, i * .18, -.45 + i * .06, 1.3 - i * .25, .2, .45 - i * .1, i % 2 ? '#a8603e' : '#bf6d45', { jit: .08 });
    k.box(-.15, .01, .1, 1.4, .02, .22, 'water');
    k.box(.45, .05, .1, .55, .08, .14, 'woodL', { rz: -.1 });
    const bar = part(k2 => { k2.box(0, .08, 0, .2, .1, .14, 'iron'); k2.cyl(.12, .04, 0, .04, .02, 'black', { rx: Math.PI / 2, seg: 8 }); k2.box(-.18, .12, 0, .2, .02, .1, 'woodD'); k2.dode(0, .17, 0, .06, '#bf6d45', { sy: .6 }); });
    add('cart', bar, new THREE.Vector3(-.35, .03, .55));
    for (let r = 0; r < 2; r++) for (let i = 0; i < 3; i++) k.box(.3 + i * .15, r * .07, .55, .12, .06, .18, '#bf6d45', { jit: .1 });
    barrel(k, .78, -.2); crate(k, -.75, .2, .18); planks(k, .5, .78, 2);
    return .8;
  },
};

addRecipes(R);
export const RIDGE_BUILDINGS = Object.keys(R);
