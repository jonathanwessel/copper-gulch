/* The Capital's city on the empire map, built in code like the towns' models: the capitol, the contract board and one
   building for each institution, each on its lot round a stone plaza (layout in src/data/capital.js, CITY). Every
   recipe draws in its own footprint (local x across, z deep, the front toward +z) at map scale. makeCity merges the
   whole city into one model (a few draw calls); makeInstitution gives one building on its own, so a new one can rise
   out of the ground before it is merged in. */
import { Kit, mergeStatic, part } from '../../render/kit.js';
import { door, windows, crate, barrel, sacks, rails, flag } from './gulch.js';
import { CITY } from '../../data/capital.js';

const HALF = Math.PI / 2;

/* The capitol: a white hall on a stone base, steps, six columns under a pediment, a drum and a copper dome, a flag. */
function capitol(k) {
  k.box(0, 0, 0, 2.3, .18, 1.4, 'stone');                                // the base
  for (let i = 0; i < 3; i++) k.box(0, i * .06, .78 - i * .06, 1.2, .06, .3, 'stoneL'); // the steps
  k.box(0, .18, -.1, 2.1, .7, .95, 'white');                             // the hall
  for (const x of [-.85, .85]) k.box(x, .18, .1, .4, .78, .7, 'cream');   // the wings stand forward a little
  for (const x of [-.95, -.75, .75, .95]) k.win(x, .48, .455, .1, .2, { frame: 'stoneD' });
  for (let i = 0; i < 6; i++) k.cyl(-.5 + i * .2, .18, .52, .045, .62, 'white', { seg: 8 }); // the columns
  k.box(0, .8, .5, 1.25, .1, .2, 'white');                                // the beam over the columns
  k.gable(0, .9, .5, 1.25, .26, .22, 'cream');
  door(k, 0, .4, { w: .2, h: .3, c: 'woodD' });
  k.cyl(0, .88, -.15, .42, .32, 'white', { seg: 14 });                    // the drum
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; k.cyl(Math.cos(a) * .43, .88, -.15 + Math.sin(a) * .43, .025, .3, 'cream', { seg: 5 }); }
  k.ball(0, 1.2, -.15, .4, 'verd', { det: 1, sy: .9 });                   // the dome
  k.cyl(0, 1.52, -.15, .06, .1, 'white', { seg: 8 });                    // the lantern on top
  k.cyl(0, 1.6, -.15, .012, .5, 'ink');                                   // the flagpole
  k.box(.13, 1.94, -.15, .24, .14, .02, 'paintR'); k.box(.07, 1.99, -.14, .1, .06, .022, 'white');
}

/* The contract board: a notice board under a little roof, with a sheet pinned up for each offer and the running
   contract's sheet in the middle with a red seal. */
function board(k, offers = 0, active = false) {
  for (const x of [-.36, .36]) k.box(x, 0, 0, .05, .56, .05, 'woodD');
  k.box(0, .2, 0, .72, .32, .04, 'wood');
  k.gable(0, .55, 0, .86, .2, .1, 'roofRD');
  const spots = [-.24, .24, 0].slice(0, Math.min(3, offers));
  for (const x of spots) k.box(x, .26, .025, .15, .2, .01, 'white', { ao: false });
  if (active) { k.box(0, .25, .03, .17, .22, .012, 'cream', { ao: false }); k.ball(0, .3, .04, .025, 'paintR'); }
}

/* An empty lot: gravel and four stakes with string. */
function lot(k, w, d) {
  k.box(0, 0, 0, w * .9, .015, d * .9, 'sand', { ao: false });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(sx * w * .42, 0, sz * d * .42, .035, .16, .035, 'woodL');
  for (const sz of [-1, 1]) k.box(0, .13, sz * d * .42, w * .84, .01, .01, 'white', { ao: false });
  for (const sx of [-1, 1]) k.box(sx * w * .42, .13, 0, .01, .01, d * .84, 'white', { ao: false });
}

const INSTITUTION = {
  /* Market Board: an open trading hall under a red roof, a chalk board of prices, crates and sacks out front. */
  market(k) {
    k.box(0, 0, 0, .86, .05, .66, 'stoneL');
    k.box(0, .05, -.27, .8, .42, .07, 'plank');
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(sx * .37, .05, sz * .27, .06, .42, .06, 'wood');
    k.gable(0, .47, 0, .96, .78, .26, 'roofR');
    k.box(0, .16, -.23, .6, .24, .02, 'black');
    for (let r = 0; r < 3; r++) for (let i = 0; i < 3; i++) k.box(-.18 + i * .18, .2 + r * .065, -.218, .12, .018, .01, i === 1 ? 'paintY' : 'white', { ao: false });
    k.box(0, .62, .33, .3, .1, .02, 'paintY');
    crate(k, .22, .2, .14, .05); crate(k, -.24, .18, .12, .05, .4); sacks(k, -.05, .22);
  },
  /* Department of Transport: a brick depot with a tall door, a clock over it, and rails out front with a little engine. */
  transport(k) {
    k.box(0, 0, -.12, .84, .5, .42, 'brick', { jit: .06 });
    k.hip(0, .5, -.12, .94, .52, .18, 'roofS');
    k.box(0, 0, .095, .3, .38, .02, 'woodD'); k.box(0, .38, .095, .34, .04, .03, 'stoneL');
    k.cyl(0, .5, .1, .065, .02, 'cream', { rx: HALF, seg: 10 }); k.box(0, .5, .115, .01, .05, .01, 'ink');
    windows(k, [-.28, .28], .22, .095, .12, .14);
    rails(k, 0, .26, .9, HALF);
    k.box(-.06, .03, .26, .16, .2, .15, 'paintR');                      // the cab
    k.log(.16, .07, .26, .3, .07, 'iron');                              // the boiler
    k.cyl(.26, .21, .26, .025, .1, 'black', { r2: .04, seg: 6 });       // the stack
    for (const x of [-.08, .08, .22]) for (const sz of [-1, 1]) k.cyl(x, .045, .26 + sz * .075, .045, .02, 'black', { rx: HALF, seg: 8 });
  },
  /* Bank: a stone hall with four columns, a pediment with a gold coin, and a gold band over the door. */
  bank(k) {
    k.box(0, 0, 0, .78, .07, .66, 'stone');
    k.box(0, .07, -.1, .7, .5, .42, 'stoneL');
    for (let i = 0; i < 4; i++) k.cyl(-.24 + i * .16, .07, .2, .035, .46, 'white', { seg: 8 });
    k.box(0, .53, .1, .74, .06, .3, 'white');
    k.gable(0, .59, .1, .74, .3, .16, 'stoneL');
    k.cyl(0, .64, .255, .055, .015, 'gold', { rx: HALF, seg: 12 });
    k.box(0, .07, .115, .16, .26, .02, 'woodD'); k.box(0, .35, .115, .3, .05, .02, 'gold');
    windows(k, [-.24, .24], .26, .115, .08, .14, { frame: 'stoneD' });
  },
  /* University: a brick hall under a green roof with a tall white clock tower at its front. */
  university(k) {
    k.box(0, 0, -.08, .74, .42, .44, 'brick', { jit: .05 });
    k.gable(0, .42, -.08, .8, .52, .18, 'roofG');
    windows(k, [-.27, -.15, .15, .27], .18, .142, .07, .12, { frame: 'white' });
    k.box(0, 0, .12, .24, 1.0, .24, 'white');
    k.box(0, 1.0, .12, .28, .05, .28, 'stoneL');
    k.cone(0, 1.05, .12, .21, .3, 'roofG', { seg: 4, ry: Math.PI / 4 });
    k.cyl(0, .76, .24, .08, .02, 'cream', { rx: HALF, seg: 12 });
    k.box(0, .78, .255, .01, .055, .01, 'ink'); k.box(.02, .76, .255, .04, .01, .01, 'ink');
    door(k, 0, .24, { w: .12, h: .24, c: 'woodD' });
    for (const x of [-.27, .27]) k.box(x, 0, .26, .14, .05, .08, 'leafD');
  },
  /* War Office: an adobe fort with battlements, a blue flag and a cannon by the gate. */
  war(k) {
    k.box(0, 0, -.05, .76, .42, .52, 'adobe', { jit: .06 });
    for (let i = 0; i < 5; i++) for (const z of [.2, -.3]) k.box(-.32 + i * .16, .42, z, .08, .08, .04, 'adobeL');
    for (let i = 0; i < 3; i++) for (const x of [-.36, .36]) k.box(x, .42, -.18 + i * .16, .04, .08, .08, 'adobeL');
    k.box(0, 0, .215, .2, .26, .02, 'woodD'); k.box(0, .26, .215, .26, .04, .03, 'wood');
    flag(k, .26, .42, -.2, 'paintB');
    k.log(-.24, .07, .36, .26, .035, 'iron', { ry: -HALF + .3 });
    for (const sx of [-1, 1]) k.cyl(-.24 + sx * .05, .02, .33, .055, .02, 'woodD', { rz: HALF, seg: 8 });
    for (let i = 0; i < 3; i++) k.ball(.16 + i * .06, .03, .36, .03, 'black');
    barrel(k, .28, .3);
  },
};

/* One recipe drawn into a group at its place on the plaza. */
function placed(spot, draw) {
  const g = part(draw, { ao: true });
  g.position.set(spot.at[0], 0, spot.at[1]); g.rotation.y = spot.ry || 0;
  return g;
}

/* One institution's building at its lot, on its own (for the rise when it is founded). */
export const makeInstitution = id => placed(CITY.lots[id], INSTITUTION[id]);

/* The whole city, merged: the plaza and its avenue, lamps and trees, the capitol, the contract board (offers on it, and
   whether a contract runs), and each lot: its institution's building once founded, else survey stakes. `skip` lists
   founded ones left out (they are rising on their own). */
export function makeCity({ founded = [], offers = 0, active = false, skip = [] } = {}) {
  const objs = [];
  objs.push(part(k => {
    k.cyl(0, 0, 0, CITY.plaza, .06, 'stoneL', { seg: 28, ao: false });
    k.cyl(0, .06, 0, CITY.plaza - .12, .012, 'stone', { seg: 28, ao: false });
    k.box(0, .07, .55, .6, .01, 1.5, 'stoneL', { ao: false });          // the walk from the gate to the steps
    for (const [x, z] of CITY.lamps) { k.cyl(x, .07, z, .025, .5, 'iron'); k.ball(x, .6, z, .05, 'glowW', { mat: 'glow' }); }
  }, { ao: false }));
  // the capitol is drawn from its base's middle; its steps reach out in front, so it moves back to sit in its footprint
  const cap = placed(CITY.capitol, capitol); cap.children.forEach(m => m.geometry.translate(0, 0, -.115)); objs.push(cap);
  objs.push(placed(CITY.board, k => board(k, offers, active)));
  for (const [id, spot] of Object.entries(CITY.lots)) {
    if (skip.includes(id)) continue;
    objs.push(founded.includes(id) ? placed(spot, INSTITUTION[id]) : placed(spot, k => lot(k, spot.w, spot.d)));
  }
  // trees round the plaza's edge, in the gaps between the lots
  for (const [x, z] of CITY.trees) {
    const t = part(k => { k.cyl(0, 0, 0, .04, .2, 'bark', { seg: 5 }); k.cone(0, .15, 0, .2, .3, 'leaf', { seg: 6 }); k.cone(0, .32, 0, .14, .24, 'leafD', { seg: 6 }); });
    t.position.set(x, .06, z); objs.push(t);
  }
  const g = mergeStatic(objs);
  objs.forEach(o => o.traverse(m => m.geometry && m.geometry.dispose()));
  return g;
}

/* The city's own state that changes its look: what makeCity needs, and a key that changes when any of it does. */
export function cityState(cap, tree) {
  const s = { founded: (tree && tree.founded) || [], offers: cap ? cap.offers.length : 0, active: !!(cap && cap.active) };
  s.key = s.founded.join() + '|' + s.offers + '|' + s.active;
  return s;
}
