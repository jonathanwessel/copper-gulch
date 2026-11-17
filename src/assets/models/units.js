/* Raiders and towers, modeled in code (adapted from the old game). People are three moving parts (body, left leg,
   right leg) so a walking crowd stays cheap to draw. makeFoe(kind) faces +z; makeTower(kind, path, level) has a
   head that turns to aim (barrel along +x). */
import * as THREE from 'three';
import { part, rng } from '../../render/kit.js';

const G = () => new THREE.Group();
function legs(k, pants, boot, w = .075, h = .3) { k.box(0, -h, 0, w, h, w * 1.1, pants, { ao: false }); k.box(0, -h, .015, w + .01, .07, w * 1.4, boot, { ao: false }); }
/* A person facing +z, feet at y = 0, about .8 tall. o: shirt, pants, hat ('cowboy'|'bowler'|'cap'|'bandana'|'none'), extra(k). */
export function person(o) {
  const root = G(), body = part(k => {
    const s = o.wide || 1, skin = o.skin || 'skin';
    k.box(0, .3, 0, .22 * s, .26, .14, o.shirt, { ao: false });
    if (o.vest) k.box(0, .32, .002, .225 * s, .22, .145, o.vest, { ao: false });
    k.box(0, .3, 0, .23 * s, .04, .15, o.belt || 'bark', { ao: false });
    for (const sx of [-1, 1]) { k.box(sx * (.14 * s), .32, 0, .065, .22, .08, o.shirt, { ao: false, rz: sx * .12 }); k.box(sx * (.15 * s), .29, 0, .06, .05, .06, skin, { ao: false }); }
    k.box(0, .56, 0, .14, .14, .13, skin, { ao: false });
    if (o.mask) k.box(0, .57, .055, .145, .05, .03, o.mask, { ao: false });
    k.box(0, .6, .067, .1, .02, .01, 'ink', { ao: false });
    const hc = o.hatC || 'bark';
    if (o.hat === 'cowboy') { k.cyl(0, .68, 0, .16, .02, hc, { seg: 10, ao: false }); k.cyl(0, .69, 0, .07, .09, hc, { r2: .065, seg: 8, ao: false }); }
    else if (o.hat === 'bowler') { k.cyl(0, .68, 0, .11, .02, hc, { seg: 10, ao: false }); k.ball(0, .72, 0, .075, hc, { det: 1, sy: .8, ao: false }); }
    else if (o.hat === 'cap') { k.box(0, .67, 0, .15, .05, .14, hc, { ao: false }); k.box(0, .67, .08, .12, .02, .08, hc, { ao: false }); }
    else if (o.hat === 'bandana') k.box(0, .64, 0, .15, .05, .14, hc, { ao: false });
    if (o.extra) o.extra(k);
  }, { ao: false });
  const L = part(k => legs(k, o.pants || 'denim', 'bark'), { ao: false }), Rl = part(k => legs(k, o.pants || 'denim', 'bark'), { ao: false });
  L.position.set(-.06 * (o.wide || 1), .3, 0); Rl.position.set(.06 * (o.wide || 1), .3, 0);
  root.add(body, L, Rl); root.userData = { body, legs: [L, Rl] };
  return root;
}
const gun = k => { k.box(.17, .2, .09, .03, .05, .14, 'iron', { ao: false }); };
const FOE = {
  raider: () => person({ shirt: 'paintR', pants: 'cloth', hat: 'cowboy', hatC: 'bark', mask: 'paintR', extra: gun }),
  brute: () => person({ shirt: 'paintP', pants: 'black', hat: 'bandana', hatC: 'ink', wide: 1.35, skin: 'skinD', extra: k => { k.cyl(.22, .1, .1, .04, .4, 'woodD', { r2: .07, rx: .5, seg: 6, ao: false }); } }),
};
function horse(k, c = 'woodD') {
  k.box(0, .3, 0, .18, .18, .48, c, { ao: false }); k.box(0, .4, .26, .1, .2, .12, c, { rx: -.5, ao: false }); k.box(0, .52, .36, .09, .08, .18, c, { ao: false });
  k.box(0, .44, .2, .03, .16, .14, 'ink', { rx: -.5, ao: false }); k.box(0, .38, -.26, .04, .2, .04, 'ink', { rx: .5, ao: false });
}
FOE.runner = () => {
  const root = G(), body = part(k => {
    horse(k, 'woodD'); k.box(0, .47, -.02, .2, .05, .18, 'paintR', { ao: false });
    k.box(0, .5, -.04, .2, .24, .13, 'paintY'); k.box(0, .76, -.04, .13, .13, .12, 'skin'); k.cyl(0, .87, -.04, .15, .02, 'bark', { seg: 10 }); k.cyl(0, .88, -.04, .065, .08, 'bark', { seg: 8 });
    for (const sx of [-1, 1]) k.box(sx * .12, .42, 0, .06, .16, .14, 'denim', { ao: false });
  }, { ao: false });
  const legsA = [[-.06, .17], [.06, .17], [-.06, -.17], [.06, -.17]].map(([x, z]) => { const l = part(k => k.box(0, -.3, 0, .05, .3, .05, 'woodD', { ao: false }), { ao: false }); l.position.set(x, .32, z); return l; });
  root.add(body, ...legsA); root.userData = { body, legs: legsA, gallop: 1 }; return root;
};
function wheel(r, c = 'woodD', hub = 'iron') { return part(k => { k.torus(0, 0, 0, r, r * .16, c, { ts: 10 }); for (let i = 0; i < 3; i++) k.box(0, -r, 0, r * .14, r * 2, r * .14, c, { rz: i * 1.05 }); k.cyl(0, 0, -.03, r * .25, .06, hub, { rx: Math.PI / 2, seg: 8 }); }); }
function wheels(root, list, r, c) { const ws = list.map(([x, y, z, ry]) => { const w = wheel(r, c); const h = G(); h.add(w); w.rotation.y = ry || Math.PI / 2; h.position.set(x, y, z); root.add(h); return h; }); root.userData.wheels = ws; }
FOE.wagon = () => {
  // the war wagon: an iron-plated wagon with spikes and a cannon, drawn by two armored horses
  const root = G(); root.userData = {};
  root.add(part(k => {
    k.box(0, .2, -.15, .5, .08, .8, 'woodD'); k.box(0, .28, -.15, .46, .3, .72, 'iron', { mat: 'metal' }); k.box(0, .58, -.15, .5, .05, .76, 'ironL', { mat: 'metal' });
    for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) k.cone(sx * .25, .38, -.45 + i * .2, .03, .1, 'steel', { rz: -sx * Math.PI / 2, mat: 'metal', seg: 5 });
    k.cyl(0, .63, -.2, .09, .1, 'iron'); k.cyl(0, .7, -.05, .05, .4, 'black', { rx: Math.PI / 2 - .2, seg: 8 });
    k.box(0, .6, -.5, .06, .3, .02, 'woodD'); k.box(.08, .78, -.5, .16, .12, .01, 'paintR');
    for (const sx of [-1, 1]) { const off = sx * .12; k.box(off, .3, .5, .14, .16, .36, 'black', { ao: false }); k.box(off, .4, .7, .08, .16, .1, 'black', { rx: -.5, ao: false }); k.box(off, .31, .5, .15, .1, .3, 'steel', { mat: 'metal', ao: false }); }
  }));
  wheels(root, [[-.27, .16, -.4], [.27, .16, -.4], [-.27, .16, .1], [.27, .16, .1]], .16);
  const hl = [[-.12, .36], [.12, .36], [-.12, .64], [.12, .64]].map(([x, z]) => { const l = part(k => k.box(0, -.3, 0, .045, .3, .045, 'black', { ao: false }), { ao: false }); l.position.set(x, .32, z); root.add(l); return l; });
  root.userData.legs = hl; root.userData.gallop = 1; return root;
};
FOE.bandits = () => {
  // the bandit wagon (Dry Creek's boss): a patched canvas wagon with a driver in a red bandana, drawn by one horse
  const root = G(); root.userData = {};
  root.add(part(k => {
    k.box(0, .2, -.12, .4, .07, .62, 'woodD'); for (const sx of [-1, 1]) k.box(sx * .19, .27, -.12, .03, .12, .62, 'wood');
    k.cyl(0, .38, -.42, .19, .5, 'sand', { rx: Math.PI / 2, seg: 10 }); // the canvas cover, lying along the wagon
    for (const z of [-.4, -.17, .06]) k.torus(0, .38, z, .2, .012, 'woodD', { ts: 10 });
    k.box(.19, .4, -.25, .01, .09, .1, 'paintR'); k.box(-.19, .44, -.05, .01, .08, .09, 'cloth'); // patches
    barrelBits(k);
    k.box(0, .3, .2, .3, .05, .12, 'wood'); // the driver's bench
    k.box(0, .42, .2, .14, .2, .1, 'cloth'); k.box(0, .58, .2, .1, .1, .1, 'skin'); k.box(0, .56, .26, .11, .05, .02, 'paintR');
    k.cyl(0, .64, .2, .12, .02, 'bark', { seg: 8 }); k.cyl(0, .66, .2, .055, .06, 'bark', { seg: 8 });
    k.box(0, .3, .58, .14, .15, .32, 'woodD', { ao: false }); k.box(0, .4, .76, .08, .16, .1, 'woodD', { rx: -.5, ao: false }); k.box(0, .49, .84, .07, .07, .14, 'woodD', { ao: false });
    for (const sx of [-1, 1]) k.box(sx * .05, .3, .32, .02, .02, .3, 'woodL', { ao: false }); // the shafts
  }));
  wheels(root, [[-.23, .13, -.35], [.23, .13, -.35], [-.23, .13, .08], [.23, .13, .08]], .13, 'wood');
  const hl = [[-.05, .47], [.05, .47], [-.05, .69], [.05, .69]].map(([x, z]) => { const l = part(k => k.box(0, -.3, 0, .04, .3, .04, 'woodD', { ao: false }), { ao: false }); l.position.set(x, .32, z); root.add(l); return l; });
  root.userData.legs = hl; root.userData.gallop = 1; return root;
};
FOE.train = () => {
  // the armored train (Iron Ridge's boss): a riveted, plated engine with a cowcatcher and a gun turret on its tender
  const root = G(); root.userData = {};
  root.add(part(k => {
    k.box(0, .12, -.1, .42, .06, 1.1, 'ink');                                                          // the frame
    k.box(0, .18, .12, .36, .3, .6, 'iron', { mat: 'metal' });                                         // the plated boiler
    for (const z of [-.12, .12, .36]) k.box(0, .18, z, .38, .3, .025, 'ironL', { mat: 'metal' });      // armor bands
    k.cyl(0, .48, .32, .06, .2, 'black', { r2: .09, seg: 8 });                                         // the stack
    k.box(0, .18, -.3, .4, .42, .3, 'iron', { mat: 'metal' }); k.box(0, .52, -.3, .42, .05, .33, 'ironL', { mat: 'metal' }); // the cab
    k.box(0, .38, -.15, .3, .06, .02, 'black'); k.box(.15, .3, -.3, .01, .06, .18, 'black');          // slits
    k.box(0, .18, -.56, .4, .26, .26, 'iron', { mat: 'metal' }); k.cyl(0, .44, -.56, .1, .08, 'ink', { seg: 8 });
    k.cyl(0, .5, -.48, .035, .26, 'black', { rx: Math.PI / 2, seg: 6 });                               // the turret gun
    for (const sx of [-1, 1]) k.box(sx * .1, .06, .5, .14, .12, .12, 'steel', { ry: -sx * .5, mat: 'metal' }); // the cowcatcher
    k.box(0, .28, .44, .08, .08, .03, 'glowW', { mat: 'glow' });                                       // the headlamp
    k.box(.21, .26, -.05, .01, .1, .2, 'paintR');
  }));
  wheels(root, [[-.21, .1, .3], [.21, .1, .3], [-.21, .1, .05], [.21, .1, .05], [-.21, .1, -.3], [.21, .1, -.3], [-.21, .1, -.56], [.21, .1, -.56]], .1, 'iron');
  return root;
};
function barrelBits(k) { k.cyl(-.1, .24, -.42, .06, .12, 'wood', { seg: 8 }); k.box(.1, .24, -.42, .1, .08, .08, 'woodL'); }

export function makeFoe(kind) {
  const f = (FOE[kind] || FOE.raider)();
  f.traverse(o => { if (o.isMesh) { o.castShadow = o.material.type !== 'MeshBasicMaterial'; o.receiveShadow = false; } });
  // legs and wheels are small moving parts: only the body casts a shadow, which saves a shadow draw call per part
  // (12 raiders on the road cost about 2 ms on a phone with every part casting)
  for (const p of [...(f.userData.legs || []), ...(f.userData.wheels || [])]) p.traverse(o => { if (o.isMesh) o.castShadow = false; });
  return f;
}

/* --- towers: a base, and a head that turns to aim (barrel along +x) --------------------------------------------- */
export function makeTower(type, br, lvl) {
  const root = G(), head = G(), bar = G(); root.add(head); head.add(bar); root.userData = { head, bar };
  const gold = lvl >= 3, R2 = rng(type.length * 7 + (br || '').length);
  const base = part(k => {
    if (type === 'crossbow') { for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(sx * .26, 0, sz * .26, .07, .5, .07, 'wood', { rz: -sx * .06, rx: sz * .06 }); k.box(0, .2, 0, .58, .04, .04, 'woodD', { rz: .4 }); k.box(0, .5, 0, .66, .07, .66, 'woodL'); for (let i = 0; i < 6; i++) k.box(-.28 + i * .112, .57, .3, .05, .12, .05, 'woodD'); }
    else if (type === 'mortar') { k.cyl(0, 0, 0, .36, .08, 'woodD', { seg: 10 }); for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283; k.ball(Math.cos(a) * .36, .1, Math.sin(a) * .36, .1, 'sand', { sy: .55, ry: -a }); }
      k.box(-.06, .08, 0, .22, .12, .3, 'woodD'); if (br === 'b') k.box(.18, .08, .18, .1, .1, .1, 'paintR'); }
    else if (type === 'cannon') { k.cyl(0, 0, 0, .36, .3, 'stone', { r2: .32, seg: 10, jit: .1 }); for (let i = 0; i < 8; i++) k.box(Math.cos(i * .785) * .3, .3, Math.sin(i * .785) * .3, .12, .1, .12, 'stoneL', { ry: -i * .785 }); }
    else if (type === 'frost') { k.cyl(0, 0, 0, .3, .12, 'stoneL', { seg: 6 }); k.cyl(0, .12, 0, .14, .42, 'stone', { r2: .1, seg: 6 }); k.cyl(0, .54, 0, .2, .05, 'glowI', { seg: 6, mat: 'glow' }); }
    else if (type === 'still') { k.cyl(0, 0, 0, .32, .1, 'stoneD', { seg: 8 }); for (let i = 0; i < 5; i++) k.log(Math.cos(i * 1.26) * .12, .1, Math.sin(i * 1.26) * .12, .22, .03, 'log', { ry: i * 1.26 }); k.ball(0, .14, 0, .07, 'glowO', { mat: 'fire' });
      k.ball(0, .36, 0, .24, 'copper', { det: 1, sy: .9, mat: 'metal' }); k.cyl(0, .55, 0, .06, .22, 'copper', { r2: .03, mat: 'metal' }); k.cyl(.12, .75, 0, .025, .3, 'copper', { rz: -1.2, mat: 'metal' });
      for (let i = 0; i < 4; i++) k.torus(.32, .3 + i * .07, 0, .07, .015, 'copper', { rx: Math.PI / 2, mat: 'metal', ts: 8 }); k.cyl(.32, 0, .18, .09, .26, 'glowT', { seg: 8, mat: 'glow' }); k.cyl(.32, .26, .18, .05, .05, 'woodD', { seg: 6 });
      if (br === 'a') for (let i = 0; i < 3; i++) k.ball(-.2 + i * .12, .75 + i * .05, -.1, .06 + i * .02, 'verd', { mat: 'glow' });
      if (br === 'b') { k.cyl(-.3, 0, .2, .08, .2, 'paintR', { seg: 8 }); k.box(-.3, .2, .2, .06, .06, .06, 'white'); } }
    else { for (let i = 0; i < 10; i++) { const a = i / 10 * 6.28; k.ball(Math.cos(a) * .3, .07 + (i % 2) * .02, Math.sin(a) * .3, .1, 'sand', { sy: .6, ry: a }); } k.cyl(0, 0, 0, .06, .4, 'iron', { seg: 6 }); for (const a of [0, 2.1, 4.2]) k.box(Math.cos(a) * .12, 0, Math.sin(a) * .12, .03, .3, .03, 'iron', { rz: Math.cos(a) * .4, rx: -Math.sin(a) * .4 }); }
    if (gold) k.cyl(0, .02, 0, type === 'crossbow' ? .4 : .38, .04, 'gold', { seg: 10, mat: 'metal' });
    if (lvl >= 6) for (let i = 0; i < 3; i++) k.box(-.2 + i * .2, 0, .42, .06, .06, .06, 'gold', { mat: 'metal' });
  });
  root.add(base);
  const hy = type === 'mortar' ? .26 : type === 'still' ? .9 : type === 'crossbow' ? .62 : type === 'cannon' ? .4 : type === 'frost' ? .85 : type === 'tesla' ? .95 : .42;
  head.position.y = hy;
  if (type === 'crossbow') bar.add(part(k => {
    k.box(.05, 0, 0, .5, .06, .07, 'woodL'); k.box(.27, -.02, 0, .04, .05, .52, 'woodD', { ry: 0 });
    for (const sz of [-1, 1]) k.box(.24, -.01, sz * .27, .05, .04, .05, 'woodD');
    k.box(.08, .03, 0, .44, .015, .015, 'ink');
    if (br === 'a') k.box(.02, .06, 0, .16, .12, .1, 'iron'); if (br === 'b') { k.box(-.12, 0, 0, .3, .05, .06, 'woodD'); k.cyl(.05, .07, 0, .025, .22, 'black', { rz: Math.PI / 2, seg: 6 }); }
  }));
  else if (type === 'cannon') bar.add(part(k => {
    k.box(0, -.12, 0, .3, .1, .26, 'woodD'); for (const sz of [-1, 1]) k.cyl(-.05, -.12, sz * .14, .08, .03, 'woodD', { rx: Math.PI / 2, seg: 8 });
    if (br === 'a') { k.cyl(0, -.04, 0, .14, .3, 'black', { rz: -.6, seg: 10, mat: 'metal' }); }
    else { k.cyl(-.08, 0, 0, .1, .5, 'black', { rz: -Math.PI / 2, r2: br === 'b' ? .13 : .07, seg: 10, mat: 'metal' }); k.ball(-.12, 0, 0, .1, 'black', { mat: 'metal' }); }
    if (gold) k.cyl(.2, 0, 0, .085, .03, 'gold', { rz: -Math.PI / 2, seg: 10, mat: 'metal' });
  }));
  else if (type === 'mortar') bar.add(part(k => { // a short, wide barrel tipped steeply up
    const r = br === 'a' ? .17 : .14; k.cyl(0, 0, 0, r, .42, 'black', { r2: r * 1.1, rz: -.5, seg: 12, mat: 'metal' }); k.cyl(0, 0, 0, r * 1.25, .06, 'iron', { rz: -.5, seg: 12, mat: 'metal' });
    for (const sz of [-1, 1]) k.cyl(-.04, -.02, sz * .15, .05, .03, 'iron', { rx: Math.PI / 2, seg: 8 });
    if (gold) k.cyl(.17, .3, 0, r * 1.18, .04, 'gold', { rz: -.5, seg: 12, mat: 'metal' });
  }));
  else if (type === 'frost') {
    const cr = part(k => { k.cone(0, 0, 0, .14, .28, br === 'b' ? 'paintP' : 'glowI', { seg: 5, mat: 'glow' }); k.cone(0, 0, 0, .14, .16, br === 'b' ? 'paintP' : 'glowI', { seg: 5, mat: 'glow', rx: Math.PI }); if (br === 'a') for (let i = 0; i < 3; i++) k.cone(Math.cos(i * 2.1) * .2, -.05, Math.sin(i * 2.1) * .2, .05, .14, 'glowI', { seg: 4, mat: 'glow' }); }, { cast: false });
    bar.add(cr); root.userData.float = 1;
  }
  else if (type === 'still') bar.add(part(k => k.ball(0, 0, 0, .001, 'copper')));
  else {
    const spin = G(); bar.add(spin); root.userData.spin = spin;
    const n = br === 'a' ? 2 : 1;
    for (let j = 0; j < n; j++) spin.add(part(k => { const oz = n > 1 ? (j ? .1 : -.1) : 0; for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; k.cyl(-.1, Math.cos(a) * .05, oz + Math.sin(a) * .05, .018, .48, br === 'b' && i % 2 ? 'gold' : 'steel', { rz: -Math.PI / 2, seg: 5, mat: 'metal' }); } k.cyl(-.12, 0, oz, .07, .14, 'iron', { rz: -Math.PI / 2, seg: 8, mat: 'metal' }); }));
    bar.add(part(k => { k.box(-.2, -.05, 0, .16, .12, .14, 'ironL', { mat: 'metal' }); k.box(-.28, -.02, .1, .06, .06, .1, 'gold', { mat: 'metal' }); }));
  }
  const s = 1 + Math.min(lvl, 8) * .03; root.scale.setScalar(s);
  root.traverse(o => { if (o.isMesh) { o.castShadow = o.material.type !== 'MeshBasicMaterial'; o.receiveShadow = true; } });
  return root;
}
