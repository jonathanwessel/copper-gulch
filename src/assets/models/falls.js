/* Silver Falls and Sandy Bend models, built in code like the Gulch's (src/assets/models/gulch.js): each recipe draws
   on the 2x2 plot (local x and z from -0.9 to 0.9, the front toward +z) and returns its top height. Loading this file
   adds its recipes to makeBuilding. Electric-era brick and timber, copper wire, glass that catches the light. */
import * as THREE from 'three';
import { part } from '../../render/kit.js';
import { addRecipes, shed, door, windows, chimney, stack, rocks, rails, cart, barrel, crate, planks } from './gulch.js';

// a telegraph pole with two crossarms and glass insulators
function pole(k, x, z, h = 1.1) {
  k.cyl(x, 0, z, .025, h, 'woodD', { seg: 5 });
  for (const y of [h - .08, h - .2]) { k.box(x, y, z, .3, .03, .03, 'wood'); for (const sx of [-1, 1]) k.cyl(x + sx * .12, y + .03, z, .018, .04, 'glowI', { seg: 5 }); }
}
// a spool of copper wire on its side
function spool(k, x, y, z, r = .12, w = .14) {
  for (const sx of [-1, 1]) k.cyl(x + sx * w / 2, y, z, r, .025, 'woodD', { rz: Math.PI / 2, seg: 10 });
  k.cyl(x, y, z, r * .75, w, 'copper', { rz: Math.PI / 2, seg: 10 });
}
// a heap of crystals
function crystals(k, x, z, n, seed, c = '#d9c8f0') {
  for (let i = 0; i < n; i++) {
    const a = (i * 2.39 + seed) % 6.28, d = .04 + (i % 3) * .06;
    k.cone(x + Math.cos(a) * d, 0, z + Math.sin(a) * d, .04 + (i % 2) * .02, .16 + (i % 4) * .05, i % 3 ? c : 'glowT', { seg: 4, rx: Math.sin(a) * .35, rz: Math.cos(a) * .35, mat: i % 3 ? 'solid' : 'glow' });
  }
}

const R = {
  // --- Silver Falls ---
  sandpit(k, add) {
    // a pit dug in steps into pale sand, a screen on legs that sifts it, a heap of clean sand and a barrow
    for (let i = 0; i < 3; i++) k.box(-.25, -.02 + i * .08, -.35 + i * .1, 1.2 - i * .3, .08, .8 - i * .2, i % 2 ? '#d8bf82' : 'sand', { jit: .08 });
    k.cone(.5, 0, -.35, .32, .34, 'sand', { seg: 8, jit: .08 }); k.cone(.62, 0, .05, .2, .2, '#d8bf82', { seg: 7 });
    for (const sx of [-1, 1]) k.box(.05 + sx * .22, 0, .4, .04, .42, .04, 'woodD');
    k.box(.05, .34, .42, .56, .03, .34, 'iron', { rx: -.35 });
    k.cone(.05, 0, .62, .16, .12, 'sand', { seg: 7 });
    const bar = part(k2 => { k2.box(0, .08, 0, .2, .1, .14, 'iron'); k2.cyl(.12, .04, 0, .04, .02, 'black', { rx: Math.PI / 2, seg: 8 }); k2.box(-.18, .12, 0, .2, .02, .1, 'woodD'); k2.dode(0, .17, 0, .06, 'sand', { sy: .6 }); });
    add('cart', bar, new THREE.Vector3(-.55, .03, .55));
    planks(k, -.6, .2, 2);
    return .7;
  },
  quartzmine(k, add) {
    // a pale rock outcrop seamed with quartz, a small timber headframe with a turning wheel, a cart of crystals
    rocks(k, -.15, -.4, 'stoneL', 'stone', 9, .6, 41); k.dode(-.15, .3, -.5, .5, 'stoneL', { sy: .8, ry: .4 });
    crystals(k, -.45, -.2, 7, 1); crystals(k, .1, -.35, 6, 3); crystals(k, -.6, .35, 5, 5);
    k.box(-.15, 0, -.08, .38, .38, .2, 'black'); for (const sx of [-1, 1]) k.box(-.15 + sx * .2, 0, .03, .07, .44, .07, 'woodD'); k.box(-.15, .42, .03, .5, .08, .09, 'woodD');
    for (const sx of [-1, 1]) k.box(.55 + sx * .14, 0, -.25, .05, .95, .05, 'wood', { rz: sx * .12 });
    const wh = part(k2 => { k2.torus(0, 0, 0, .13, .02, 'iron', { ts: 12 }); k2.box(0, -.13, 0, .02, .26, .02, 'iron'); });
    add('spin', wh, new THREE.Vector3(.55, .92, -.25), 'z', 2.5);
    rails(k, .1, .5, .8);
    const ct = part(k2 => cart(k2, 0, '#d9c8f0')); add('cart', ct, new THREE.Vector3(.1, .02, .5));
    return 1.05;
  },
  waterwheel(k, add) {
    // a mill house beside a flume of water, a big wheel turning on its west wall, and power lines leaving on poles
    shed(k, .2, -.1, .9, .8, .5, 'woodL', 'roofS');
    door(k, .2, .31); windows(k, [-.05, .45], .25, .31, .14, .14);
    k.box(-.62, 0, -.1, .28, .14, 1.6, 'woodD'); k.box(-.62, .14, -.1, .2, .02, 1.6, 'water', { ao: false }); // the flume
    const wheel = part(k2 => {
      k2.torus(0, 0, 0, .5, .035, 'wood', { ts: 16, ry: Math.PI / 2 }); k2.torus(0, 0, 0, .32, .025, 'woodD', { ts: 14, ry: Math.PI / 2 });
      for (let i = 0; i < 4; i++) k2.box(0, -.48, 0, .04, .96, .04, 'woodD', { rx: i / 4 * Math.PI });
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; k2.box(0, Math.sin(a) * .5 - .04, Math.cos(a) * .5, .14, .08, .03, 'wood', { rx: -a }); }
      k2.cyl(-.1, 0, 0, .06, .2, 'iron', { rz: Math.PI / 2, seg: 8 });
    });
    add('spin', wheel, new THREE.Vector3(-.4, .55, -.1), 'x', 1.2);
    pole(k, .7, .65); pole(k, .7, -.75, 1.2);
    k.box(.7, 1.1, -.05, .01, .01, 1.4, 'ink', { ao: false });
    return 1.1;
  },
  glassworks(k, add) {
    // a brick glass cone with a glowing furnace mouth, a shed, and stacked panes catching the light
    k.cyl(-.25, 0, -.2, .55, .3, 'brick', { r2: .5, seg: 10, jit: .06 });
    k.cyl(-.25, .3, -.2, .5, .8, 'brick', { r2: .16, seg: 10, jit: .06 });
    k.cyl(-.25, 1.1, -.2, .17, .08, 'brickD', { seg: 10 });
    k.box(-.25, 0, .33, .22, .22, .03, 'glowO', { mat: 'glow' });
    add('smoke', null, new THREE.Vector3(-.25, 1.22, -.2));
    shed(k, .55, .15, .55, .65, .4, 'woodL', 'roofR');
    for (let i = 0; i < 5; i++) k.box(.5 + (i % 2) * .05, 0, .72 - i * .02, .34, .3, .02, i % 2 ? 'glowI' : '#8fd3e0', { rx: -.15, mat: i % 2 ? 'glow' : 'solid' });
    crate(k, .82, -.6, .2); barrel(k, -.75, .55);
    return 1.2;
  },
  wiremill(k, add) {
    // a long brick shed with a sawtooth roof, copper wire running off a turning drum onto spools out front
    k.box(0, 0, -.25, 1.5, .48, .8, 'brick', { jit: .06 });
    for (let i = 0; i < 3; i++) k.gable(-.5 + i * .5, .48, -.25, .5, .8, .22, i % 2 ? 'tinD' : 'tin', { ry: Math.PI / 2 });
    windows(k, [-.5, 0, .5], .2, .16, .16, .14);
    const drum = part(k2 => { k2.cyl(0, -.12, 0, .16, .24, 'copper', { rz: Math.PI / 2, seg: 12 }); k2.box(0, -.01, 0, .26, .02, .02, 'ink'); });
    add('spin', drum, new THREE.Vector3(-.35, .3, .4), 'x', 3);
    k.box(-.35, 0, .4, .3, .14, .2, 'iron');
    for (let i = 0; i < 3; i++) spool(k, .15 + i * .26, .12, .45 + (i % 2) * .15);
    spool(k, .4, .34, .5);
    add('smoke', null, stack(k, .6, .48, -.5, .4, .05));
    return 1.0;
  },
  bulbworks(k, add) {
    // a two-story brick works with tall glowing windows and a giant light bulb on the roof
    k.box(0, 0, -.15, 1.3, .9, .9, 'brickD', { jit: .05 });
    k.box(0, .9, -.15, 1.36, .06, .96, 'stoneD');
    windows(k, [-.4, 0, .4], .2, .31, .2, .26, { c: 'glowW' }); windows(k, [-.4, 0, .4], .58, .31, .2, .22, { c: 'glowW' });
    door(k, .6, .31, { w: .2, h: .3 });
    k.cyl(0, .96, -.15, .06, .14, 'steel', { seg: 8 });
    k.ball(0, 1.24, -.15, .17, 'glowW', { mat: 'glow', det: 1 });
    k.box(0, 1.08, -.15, .02, .1, .02, 'ink');
    for (let i = 0; i < 3; i++) crate(k, -.6 + i * .25, .65, .16);
    return 1.45;
  },
  dynamo(k, add) {
    // a power house: a big dynamo in a brick hall, its copper windings turning, a tall stack and wires on insulators
    k.box(-.15, 0, -.25, 1.2, .62, .8, 'brick', { jit: .06 });
    k.gable(-.15, .62, -.25, 1.2, .8, .3, 'roofB');
    windows(k, [-.5, -.15, .2], .25, .16, .16, .2);
    k.box(.45, 0, .45, .5, .2, .4, 'iron', { mat: 'metal' });
    const arm = part(k2 => { k2.cyl(0, -.16, 0, .16, .32, 'copper', { rz: Math.PI / 2, seg: 12 }); for (let i = 0; i < 6; i++) k2.box(0, -.01, 0, .34, .03, .03, 'ink', { rx: i / 6 * Math.PI }); });
    add('spin', arm, new THREE.Vector3(.45, .38, .45), 'x', 5);
    add('smoke', null, stack(k, -.65, .62, -.55, .7, .07, 'brickD'));
    pole(k, .8, -.5, 1.15); pole(k, -.8, .55, 1.0);
    return 1.4;
  },
  telegraph(k, add) {
    // the telegraph office: a white two-story building with a clock, a tall mast with crossarms and wires going out
    k.box(-.2, 0, -.15, 1.0, .85, .75, 'white', { jit: .04 });
    k.hip(-.2, .85, -.15, 1.1, .85, .3, 'roofG');
    windows(k, [-.5, -.2, .1], .2, .23, .16, .22); windows(k, [-.5, -.2, .1], .55, .23, .16, .18);
    door(k, -.2, .23, { w: .22, h: .34 });
    k.cyl(-.2, .95, .24, .1, .03, 'cream', { rx: Math.PI / 2, seg: 12 }); k.box(-.2, .95, .26, .015, .08, .01, 'ink');
    k.cyl(.62, 0, .1, .04, 1.7, 'woodD', { seg: 6 });
    for (const y of [1.6, 1.45, 1.3]) { k.box(.62, y, .1, .5, .03, .03, 'wood'); for (const sx of [-1, 0, 1]) k.cyl(.62 + sx * .2, y + .03, .1, .02, .04, 'glowI', { seg: 5 }); }
    for (const y of [1.6, 1.45]) k.box(.62, y + .05, .55, .01, .01, .9, 'ink', { ao: false });
    barrel(k, .6, .7); crate(k, .82, .6, .16);
    return 1.75;
  },
  // --- Sandy Bend ---
  sandwash(k, add) {
    // a rocker box on a sand bar: a sluice tilted over a puddle, a hand pump, and heaps of washed sand
    k.box(-.1, .01, -.2, 1.4, .02, .5, 'water', { ao: false });
    k.box(-.1, .1, .15, .9, .12, .22, 'wood', { rz: -.12 }); for (const sx of [-1, 1]) k.box(-.1 + sx * .4, 0, .15, .05, .18 + sx * -.05, .05, 'woodD');
    k.cone(.55, 0, .5, .3, .3, 'sand', { seg: 8, jit: .08 }); k.cone(-.6, 0, .55, .22, .22, '#d8bf82', { seg: 7 });
    const pump = part(k2 => { k2.box(0, 0, 0, .3, .03, .03, 'iron'); k2.box(.15, 0, 0, .03, .14, .03, 'iron'); });
    add('spin', pump, new THREE.Vector3(.65, .45, -.2), 'z', 1.5);
    k.cyl(.65, 0, -.2, .05, .45, 'iron', { seg: 6 });
    barrel(k, -.7, -.55); planks(k, .1, .72, 2);
    return .6;
  },
  quartzdig(k, add) {
    // a shallow dig in pale rock, a canvas tent, crystals heaped by a sieve, and a pick in the ground
    rocks(k, -.3, -.45, 'stoneL', 'rock', 7, .5, 61);
    crystals(k, -.4, -.1, 7, 2); crystals(k, .1, .45, 6, 4);
    k.gable(.45, 0, -.35, .6, .6, .5, 'cream', { ry: Math.PI / 2 }); k.box(.45, 0, -.06, .14, .3, .02, 'black');
    k.box(-.3, 0, .5, .05, .3, .05, 'woodD', { rz: .3 }); k.box(-.24, .3, .5, .2, .04, .04, 'iron', { rz: .3 });
    crate(k, .75, .55, .18); barrel(k, -.75, .2);
    return .55;
  },
};

addRecipes(R);
export const FALLS_BUILDINGS = Object.keys(R);
