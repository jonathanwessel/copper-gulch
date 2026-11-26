/* Lane entrances: where raiders come from, so a lane never starts at a bare patch of ground. Each town names its
   entrance in its board data (board.entrance.kind); tools/audit.js fails a lane whose kind has no builder here.
   A builder returns { obj, plume, shade } built from merged kit parts:
     obj: the static model, merged by material;   plume: [x, y, z] where the wave's dust rises (behind the entrance);
     shade: { x, z0, z1, w } a strip of road to darken (the inside of the entrance), or null.
   Outposts: wash (Dry Creek), chute (Pine Hollow). Towns: canyon (Copper Gulch), tunnel (Iron Ridge). Later (GDD.md): bend (Silver Falls), clouds (Thunder Mesa), fissure (Radium Springs). */
import * as THREE from 'three';
import { Kit, rng } from '../../render/kit.js';

export const ENTRANCES = {
  /* Copper Gulch: a slot canyon. Tall walls of layered rock run from the mouth off the edge of the board; inside, the
     road comes out of a timber mine portal cut through a rockfall that fills the canyon behind it. A collapsed trestle
     leans by the mouth and a signpost carries a wanted poster. e: { mouth: [x, z], portal: [x, z], width, mesa: [4
     colors] } with the canyon running toward -z. Thunder Mesa's rock cut sets pit, trestle and rise (clarity fix 8p:
     its low thin walls, thinned for the Gulch's mortar pit, and the Gulch's fallen trestle read as debris): pit false
     keeps the east wall whole, trestle false leaves the trestle out, rise is how far in the walls reach full height. */
  canyon: e => {
    const k = new Kit({ aoH: 3 }), R = rng(17), [mx, mz] = e.mouth, [, pz] = e.portal, half = e.width / 2;
    const strata = [...(e.mesa || ['#b35a3a', '#d98a55', '#a94f33', '#e0a46c']), '#8f4a33'];
    // the walls: blocks of stacked layers, low at the mouth and rising to full height a little way in
    for (const side of [-1, 1]) {
      for (let z = mz + .4, i = 0; z > mz - 9.5; i++) { // past here the camera never looks; the mesas carry on
        // thin and low by the mortar pit east of the mouth, broad and tall farther in (review of 2026.11.20-6: the pit
        // looked as if it sat on the canyon's rock)
        const byPit = e.pit !== false && side > 0 && z > mz - 6, len = 1.8 + R() * 1.4, rise = Math.min(1, (mz + .4 - z) / (e.rise || 4)), H = (1.2 + rise * 1.9) * (.9 + R() * .2) * (byPit ? .5 : 1);
        const thick = (byPit ? .6 : 1.3 + R() * .5), x0 = mx + side * ((byPit ? half * .78 : half) + thick / 2 + R() * (byPit ? 0 : .15)); // pulled in toward the road there, so a gap of open ground parts it from the pit
        // layers are added top first: seen from above, each upper layer hides the one below, and drawing it first
        // lets the depth test skip the hidden faces instead of painting every layer over the last (overdraw)
        const layers = [];
        let y = -.4;
        for (let l = 0; y < H; l++) { const h = 1 + R() * .5, inset = l * .1 * (1 + R()); layers.push([x0 + side * inset, y, thick - inset * 1.5, h + .02, strata[(l + i) % strata.length]]); y += h; }
        if (R() < .5) k.box(x0, y, z - len / 2, thick * .6, .2, len * .5, strata[3], { ao: false }); // a cap ledge
        for (const [x, yy, w, h, c] of layers.reverse()) k.box(x, yy, z - len / 2, w, h, len + .04, c, { jit: .12, ao: false });
        // a rock cut without the Gulch's trestle (Thunder Mesa) breaks each block's flat top and foot with boulders, so
        // seen from above it reads as rock and not as slabs
        if (e.trestle === false) for (let j = 0; j < 3; j++) {
          const top = j < 2, r = top ? .35 + R() * .3 : .25 + R() * .2, bx = top ? x0 + (R() - .5) * thick * .7 : x0 - side * (thick / 2 + .05);
          k.dode(bx, top ? y - .1 : r * .4, z - len * (.2 + R() * .6), r, strata[(i + j) % strata.length], { jit: .2 });
        }
        z -= len;
      }
    }
    // the rockfall that fills the canyon behind the portal, and the portal through it
    for (let i = 0; i < 14; i++) {
      const x = mx + (R() * 2 - 1) * (half + .3), z = pz - .4 - R() * 3.6, r = .35 + R() * .55;
      if (Math.abs(x - mx) < .85 && z > pz - 1.2) continue; // keep the portal clear
      k.dode(x, r * .5 + (z < pz - 1.5 ? R() * 1.2 : 0), z, r, R() < .5 ? 'rock' : 'rockD', { jit: .15 });
    }
    for (let i = 0; i < 5; i++) k.dode(mx + (i - 2) * .5, 1.55 + (i % 2) * .25, pz - .75 - (i % 3) * .35, .48 + (i % 3) * .1, i % 2 ? 'rock' : 'rockR', { jit: .2 }); // rocks piled over the portal
    k.box(mx, 1.2, pz - 1.1, 1.9, .5, 1.6, 'rockD', { jit: .2 });
    k.box(mx, -.05, pz - .95, 1.5, 1.42, 1.6, 'black', { ao: false });                        // the dark inside
    for (const sx of [-1, 1]) {
      k.box(mx + sx * .74, 0, pz, .14, 1.42, .14, 'woodD');                                   // posts
      k.box(mx + sx * .74, 1.15, pz - .1, .1, .1, .5, 'woodD', { rx: .5 });                   // knee braces
    }
    k.box(mx, 1.38, pz, 1.78, .16, .18, 'wood');                                              // the lintel
    k.box(mx, 1.56, pz + .02, .9, .22, .04, 'plank', { rz: .04 });                            // its name board
    k.box(mx - .25, 0, pz + .25, .5, .06, .14, 'iron', { ry: .2 });                           // a bit of mine rail
    k.box(mx + .25, 0, pz + .45, .5, .06, .14, 'iron', { ry: -.15 });
    // the collapsed trestle in front of the east wall: two bents standing, the third fallen, a beam down across them
    const tz = mz + .55;
    if (e.trestle !== false) for (let b = 0; b < 3; b++) {
      const x = mx + half + .35 + b * .62, fall = b === 2 ? 1.1 : b * .1;
      for (const sz of [-1, 1]) k.box(x, 0, tz + sz * .2, .07, 1.15 - b * .2, .07, 'wood', { rx: sz * .1, rz: -fall, ao: false });
      k.box(x, .5, tz, .06, .06, .48, 'woodD', { rx: .6, rz: -fall });
    }
    if (e.trestle !== false) { k.box(mx + half + .9, .75, tz, 1.5, .08, .08, 'woodL', { rz: -.35 }); k.box(mx + half + 1.5, 0, tz + .45, 1.1, .07, .07, 'wood', { ry: .7 }); }
    // the signpost with a wanted poster, west of the mouth
    const sx0 = mx - half - .1, sz0 = mz + .85;
    k.box(sx0, 0, sz0, .09, 1.15, .09, 'woodD');
    k.box(sx0 + .02, .7, sz0, .62, .42, .05, 'plank', { ry: .35 });
    k.box(sx0 + .02, .74, sz0 + .03, .3, .34, .02, 'cream', { ry: .35, ao: false });
    k.box(sx0 + .02, .95, sz0 + .04, .22, .06, .015, 'paintR', { ry: .35, ao: false });
    k.box(sx0 + .02, .8, sz0 + .04, .1, .1, .015, 'ink', { ry: .35, ao: false });
    return { obj: k.build({ cast: true }), plume: [mx, 1.8, pz - 2.6], shade: { x: mx, z0: mz + .2, z1: pz - .2, w: e.width } };
  },
  /* Dry Creek Outpost: a dry wash through a gap in a low rock ridge. The ridge runs east and west across the top of
     the board; the wash bed comes down through the gap between two rock shoulders, and at the back the road ducks
     under a natural rock arch, dark inside, where raiders wait. A broken windmill stands at the mouth, one blade
     fallen in the sand. e: { mouth: [x, z], portal: [x, z], width, mesa } with the wash running toward -z. */
  wash: e => {
    const k = new Kit({ aoH: 3 }), R = rng(23), [mx, mz] = e.mouth, [, pz] = e.portal, half = e.width / 2;
    const tones = e.mesa || ['#a8705a', '#c99a6c', '#9a6650', '#d8b282'];
    // the ridge: rounded blocks of rock, tall at the gap and lower toward the ends, set back from the board
    for (const side of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        const x = mx + side * (half + .7 + i * 1.25 + R() * .3), z = mz - .8 - R() * .9 - (i > 2 ? .6 : 0);
        const H = (1.9 - i * .16) * (.85 + R() * .3), w = 1.2 + R() * .5, d = 1.4 + R() * .6;
        let y = -.3;
        for (let l = 0; y < H; l++) { const h = .55 + R() * .3; k.box(x + (R() - .5) * .15, y, z, w - l * .14, h + .02, d - l * .16, tones[(l + i) % tones.length], { jit: .1, ao: false }); y += h; }
        if (R() < .6) k.dode(x + (R() - .5) * .6, .2, z + d / 2 + .25, .25 + R() * .2, R() < .5 ? 'rock' : 'rockR', { jit: .15 });
      }
      // the wash's banks: low rocks along both sides of the bed, from the mouth back to the arch
      for (let z = mz + .2; z > pz + .3; z -= .7 + R() * .3) k.dode(mx + side * (half + .15 + R() * .25), .1, z, .26 + R() * .2, R() < .5 ? 'rock' : 'rockD', { jit: .2 });
    }
    // the arch over the back of the wash, dark underneath
    k.box(mx, -.05, pz - .7, e.width * .7, 1.3, 1.2, 'black', { ao: false });
    for (const sx of [-1, 1]) k.box(mx + sx * (half * .7 + .25), -.1, pz - .55, .7, 1.45, 1.5, tones[0], { jit: .12 });
    k.box(mx, 1.2, pz - .55, e.width * .7 + 1.2, .55, 1.5, tones[1], { jit: .15 });
    k.box(mx, 1.7, pz - .9, e.width * .6, .4, 1.1, tones[2], { jit: .15 });
    for (let i = 0; i < 6; i++) k.dode(mx + (R() * 2 - 1) * (half + 1), .9 + R() * 1.1, pz - 1.6 - R() * 1.6, .45 + R() * .4, R() < .5 ? 'rock' : 'rockR', { jit: .15 });
    // the broken windmill at the mouth, west of the road: a leaning timber tower, its head tipped, two blades left
    const wx = mx - half - .95, wz = mz + .55;
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box(wx + dx * .26, 0, wz + dz * .26, .07, 1.75, .07, 'woodD', { rz: -dx * .1, rx: dz * .1 });
    for (const y of [.45, 1.05]) { k.box(wx, y, wz - .22, .5, .05, .05, 'wood'); k.box(wx, y, wz + .22, .5, .05, .05, 'wood'); }
    k.box(wx, 1.72, wz, .38, .06, .38, 'wood');                                                 // the platform
    k.box(wx + .02, 1.78, wz, .2, .22, .34, 'iron', { rz: .25 });                               // the head, tipped
    k.box(wx - .02, 1.88, wz + .3, .05, .05, .3, 'iron', { rz: .25 });                          // the hub
    k.box(wx - .1, 1.9, wz + .44, .07, .62, .03, 'plank', { rz: .5 });                          // the blades left
    k.box(wx + .18, 1.75, wz + .44, .07, .5, .03, 'plank', { rz: -1.9 });
    k.box(wx + .34, 1.9, wz - .1, .03, .18, .5, 'iron', { rx: .3 });                            // the bent tail vane
    k.box(wx + .5, 0, wz + .55, .62, .025, .07, 'plank', { ry: .6, ao: false });                // a blade fallen in the sand
    k.box(wx - .45, 0, wz + .35, .32, .28, .32, 'woodD');                                       // a dry trough
    k.box(wx - .45, .26, wz + .35, .26, .03, .26, 'sand', { ao: false });
    return { obj: k.build({ cast: true }), plume: [mx, 1.8, pz - 2.4], shade: { x: mx, z0: mz + .2, z1: pz - .2, w: e.width * .8 } };
  },
  /* Iron Ridge: a railway tunnel. A gray mountain shoulder of stacked granite rises across the top of the board; the
     line runs out of a dressed-stone portal with a keystone and a date board, dark inside, where raiders wait. A
     signal post with a red arm stands at the mouth and a water tank on legs to the west. e: { mouth, portal, width,
     mesa } with the tunnel running toward -z. */
  tunnel: e => {
    const k = new Kit({ aoH: 3 }), R = rng(41), [mx, mz] = e.mouth, [, pz] = e.portal, half = e.width / 2;
    const m = new Kit({ aoH: 3 }); // the mountain: it stands off the board, so it casts no shadow (a big shadow pass cost 2 ms on a phone)
    const tones = e.mesa || ['#6f6a62', '#8a8478', '#5d5850', '#9b9488'];
    // the mountain: blocks of layered granite, highest round the portal, falling away to both sides
    // Layers go in top first (as in the canyon): seen from above each upper layer hides the one below, and drawing it
    // first lets the depth test skip the hidden faces instead of painting every layer over the last (overdraw).
    const layers = [];
    m.box(mx, 2.9, pz - 1.8, e.width + .6, .9, 1.8, tones[3], { jit: .12 });           // over the portal, top first
    m.box(mx, 1.7, pz - 1.4, e.width + 1.6, 1.4, 2.6, tones[1], { jit: .12 });
    for (const side of [-1, 1]) for (let i = 0; i < 5; i++) {
      const x = mx + side * (half + .55 + i * 1.4 + R() * .3), z = pz - .2 - R() * 1.2 + (i > 1 ? i * .25 : 0);
      const H = (3 - i * .4) * (.85 + R() * .3), w = 1.5 + R() * .5, d = 2.2 + R() * .8;
      let y = -.3;
      for (let l = 0; y < H; l++) { const h = .75 + R() * .35; layers.push([x, y, z - d / 2, w - l * .15, h + .02, d - l * .2, tones[(l + i) % tones.length]]); y += h; }
      if (R() < .6) k.dode(x + (R() - .5) * .8, .2, z + .3, .3 + R() * .2, R() < .5 ? 'stone' : 'stoneD', { jit: .15 });
    }
    for (const [x, y, z, w, h, d, c] of layers.sort((a, b) => b[1] - a[1])) m.box(x, y, z, w, h, d, c, { jit: .1, ao: false });
    // the portal: dressed stone jambs, an arch of voussoirs with a keystone, dark inside
    k.box(mx, -.05, pz - .9, e.width * .72, 1.55, 1.7, 'black', { ao: false });
    for (const sx of [-1, 1]) k.box(mx + sx * (half * .72 + .2), -.05, pz - .05, .42, 1.55, .5, 'stoneL', { jit: .05 });
    for (let i = 0; i < 7; i++) { const a = Math.PI * i / 6, r = half * .72 + .2; k.box(mx - Math.cos(a) * r, 1.4 + Math.sin(a) * .45, pz - .05, .34, .26, .52, i === 3 ? 'stone' : 'stoneL', { rz: (a - Math.PI / 2) * .7, jit: .04 }); }
    k.box(mx, 2.0, pz + .22, .7, .2, .04, 'plank');                                    // the date board
    // rails along the road from inside the tunnel to the mouth
    for (const o of [-.28, .28]) k.box(mx + o, 0, (mz + pz) / 2 - .4, .05, .05, Math.abs(mz - pz) + 1.4, 'steel', { mat: 'metal' });
    for (let z = mz + .2; z > pz - .8; z -= .34) k.box(mx, 0, z, .9, .03, .1, 'woodD', { ao: false });
    // the signal post at the mouth, east of the line
    const sx0 = mx + half + .35, sz0 = mz + .4;
    k.box(sx0, 0, sz0, .08, 1.5, .08, 'iron', { mat: 'metal' }); k.box(sx0 - .2, 1.3, sz0, .42, .09, .03, 'paintR', { rz: .35 });
    k.box(sx0, 1.18, sz0 + .05, .1, .1, .03, 'glowO', { mat: 'glow' });
    // a water tank on legs to the west
    const wx = mx - half - 1.1, wz = mz + .3;
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box(wx + dx * .25, 0, wz + dz * .25, .07, 1.1, .07, 'woodD');
    k.cyl(wx, 1.1, wz, .42, .55, 'wood', { seg: 10 }); k.cone(wx, 1.65, wz, .46, .25, 'roofS', { seg: 10 });
    for (const y of [1.2, 1.5]) k.torus(wx, y, wz, .42, .015, 'iron', { rx: Math.PI / 2, ts: 14, mat: 'metal' });
    k.box(wx + .38, 1.2, wz, .3, .05, .05, 'iron', { rz: -.5, mat: 'metal' });
    const obj = new THREE.Group(); obj.add(m.build({ cast: false }), k.build({ cast: true }));
    return { obj, plume: [mx, 2.2, pz - 2.6], shade: { x: mx, z0: mz + .2, z1: pz - .2, w: e.width * .8 } };
  },
  /* Pine Hollow: a logging chute down a wooded slope. Dark pines crowd both sides of a gap in the trees; down the
     middle runs a chute of two log rails on trestles, a pile of logs at its foot, and the road comes out of the
     shadow under the trees. e: { mouth, portal, width, mesa } with the slope running toward -z. */
  chute: e => {
    const k = new Kit({ aoH: 3 }), R = rng(53), [mx, mz] = e.mouth, [, pz] = e.portal, half = e.width / 2;
    const tones = e.mesa || ['#7d6a4a', '#9a8458', '#6b5a3e', '#a99a6a'];
    // the slope: earth banks rising toward the back
    for (const side of [-1, 1]) for (let i = 0; i < 5; i++) {
      const x = mx + side * (half + .8 + i * 1.3), z = pz - .4 - R() * .8;
      k.box(x, -.3, z, 1.5, 1.1 + (4 - i) * .2 + R() * .3, 2.6, tones[i % tones.length], { jit: .12, ao: false });
    }
    k.box(mx, -.3, pz - 2.4, e.width + 3, 2.2, 2.2, tones[2], { jit: .12, ao: false });
    // pines: dense on both sides and across the back, leaving the gap for the road
    for (let i = 0; i < 26; i++) {
      const side = i % 2 ? 1 : -1, back = i >= 20;
      const x = back ? mx + (R() * 2 - 1) * (half + 2) : mx + side * (half + .5 + R() * 4.5), z = back ? pz - 1.6 - R() * 1.6 : mz - .2 - R() * (mz - pz + 1.2);
      const y = back ? 1.6 : Math.max(0, (mz - z) * .25), h = .9 + R() * .7;
      k.cyl(x, y, z, .06, .3, 'bark', { seg: 5 });
      for (let j = 0; j < 3; j++) k.cone(x, y + .2 + j * h * .28, z, (.42 - j * .1) * (h / 1.2), h * .45, j % 2 ? 'leafD' : '#2f5a34', { seg: 6, jit: .1 });
    }
    // the dark gap under the trees, where raiders wait
    k.box(mx, -.05, pz - .7, e.width * .7, 1.3, 1.2, 'black', { ao: false });
    // the chute: two log rails on trestles running down the west side of the road, and logs at its foot
    const cx = mx - half - .25;
    for (let z = mz; z > pz; z -= 1.1) { const h = (mz - z) * .25 + .25; k.box(cx - .18, 0, z, .06, h, .06, 'woodD'); k.box(cx + .18, 0, z, .06, h, .06, 'woodD'); k.box(cx, h - .05, z, .44, .05, .06, 'wood'); }
    const dz = mz - pz, len = Math.hypot(dz, dz * .25);
    for (const o of [-.1, .1]) k.log(cx + o, (dz * .25) / 2 + .2, (mz + pz) / 2, len, .05, 'log', { ry: Math.PI / 2, rx: Math.atan(.25) });
    for (let i = 0; i < 4; i++) k.log(cx - .2 + (i % 2) * .15, (i > 1 ? .12 : 0), mz + .7 + (i % 2) * .05, .8, .07, i % 2 ? 'log' : 'woodL', { ry: Math.PI / 2 * 0 + .3 });
    return { obj: k.build({ cast: true }), plume: [mx, 2.2, pz - 2.4], shade: { x: mx, z0: mz + .2, z1: pz - .2, w: e.width * .8 } };
  },
  /* Silver Falls, the river: boats come round a bend between wooded rock banks, under a stone bridge that has fallen
     in the middle (its two arches stand, the deck between them hangs in the water). Low mist lies on the water inside.
     e: { mouth, portal, width, mesa } with the river running toward -z. */
  bend: e => {
    const k = new Kit({ aoH: 3 }), R = rng(71), [mx, mz] = e.mouth, [, pz] = e.portal, half = e.width / 2;
    const tones = e.mesa || ['#6f7a7c', '#8a9496', '#5d686a', '#9aa4a4'];
    // the banks: rock shelves stepping up away from the water, the far ones curving across behind the bend
    for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
      const x = mx + side * (half + .5 + i * .9), z = mz - .6 - i * .35 - R() * .4;
      k.box(x, -.3, z - 1.4, 1, .7 + i * .35 + R() * .25, mz - pz + 1.2, tones[i % tones.length], { jit: .12, ao: false });
    }
    k.box(mx + half * .6, -.3, pz - 1.6, e.width + 2.4, 1.6, 1.6, tones[2], { jit: .1, ao: false }); // the bend's far bank
    for (let i = 0; i < 16; i++) { // pines on the banks
      const side = i % 2 ? 1 : -1, x = mx + side * (half + 1 + R() * 2.6), z = mz - .4 - R() * (mz - pz + 1), y = .5 + R() * .6, h = .8 + R() * .5;
      k.cyl(x, y, z, .05, .26, 'bark', { seg: 5 });
      for (let j = 0; j < 3; j++) k.cone(x, y + .18 + j * h * .27, z, (.36 - j * .09) * (h / 1.1), h * .42, j % 2 ? 'leafD' : '#2f5a44', { seg: 6, jit: .1 });
    }
    // the broken bridge across the mouth: a pier on each bank, an arch from each, and the fallen middle in the water
    const bz = mz - .5;
    for (const side of [-1, 1]) {
      const x = mx + side * (half + .15);
      k.box(x, -.2, bz, .5, 1.2, .55, 'stone', { jit: .1 });
      k.box(x - side * .35, .85, bz, .55, .2, .5, 'stoneL', { jit: .08 });           // the arch's springing
      k.box(x - side * .62, .75, bz, .3, .16, .48, 'stone', { rz: side * .5, jit: .1 }); // where it broke off
    }
    // the fallen deck and its rubble lie along the banks, clear of the channel (review of 2026.11.20-9: the steamer sailed
    // through the deck lying mid-river)
    k.box(mx - half + .3, -.15, bz + .1, .7, .2, .45, 'stoneD', { rz: .35, ry: .2, jit: .12 });
    k.dode(mx + half - .2, 0, bz - .2, .22, 'stone', { jit: .15 });
    // mist on the water inside the bend
    for (let i = 0; i < 4; i++) k.cyl(mx + (R() - .5) * e.width * .4, -.01 + i * .005, mz - 1.4 - i * .7, .55 + R() * .2, .02, '#b9d3da', { seg: 9, sx: 1.4, ao: false });
    return { obj: k.build({ cast: true }), plume: [mx, 1.6, pz - 1.4], shade: { x: mx, z0: mz - .2, z1: pz - .2, w: e.width * .7 } };
  },
  /* Sandy Bend: a dry riverbed between sandy banks, under a wooden water tower that has fallen across it (its tank on
     its side, its legs snapped). e: { mouth, portal, width, mesa } with the bed running toward -z. */
  riverbed: e => {
    const k = new Kit({ aoH: 3 }), R = rng(83), [mx, mz] = e.mouth, [, pz] = e.portal, half = e.width / 2;
    const tones = e.mesa || ['#c9a46a', '#dcb97c', '#b08e58', '#e6c890'];
    for (const side of [-1, 1]) for (let i = 0; i < 5; i++) { // cut banks, layered, higher farther in
      const x = mx + side * (half + .7 + i * 1.1), z = pz - .3 - R() * .6;
      k.box(x, -.3, z + (mz - pz) / 2 - .2, 1.2, .8 + (4 - i) * .15 + R() * .3, mz - pz + 1.6, tones[i % tones.length], { jit: .12, ao: false });
    }
    k.box(mx, -.3, pz - 1.8, e.width + 3, 1.7, 1.8, tones[2], { jit: .12, ao: false });
    rocks(k, mx, (mz + pz) / 2, 'rock', 'rockD', 8, half * .8, 87);
    // the fallen water tower: the round tank lying across the bed's far side, staves and hoops, its legs broken
    const tz = pz + .9;
    k.cyl(mx + .2, .45, tz, .5, 1.5, 'wood', { rz: Math.PI / 2, seg: 10, jit: .08 });
    for (const o of [-.55, 0, .55]) k.cyl(mx + .2 + o, .45, tz, .52, .05, 'iron', { rz: Math.PI / 2, seg: 10 });
    k.cone(mx - .75, .45, tz, .55, .4, 'roofS', { rz: Math.PI / 2, seg: 10 }); // its roof, now pointing sideways
    for (const [x, z, r] of [[mx + 1.3, tz - .3, .4], [mx + 1.2, tz + .4, -.5], [mx - 1.4, tz + .5, .9]]) k.box(x, 0, z, .08, .9, .08, 'woodD', { rz: r, ry: r });
    k.box(mx + 1.5, 0, tz - .6, .1, .5, .1, 'woodD'); k.box(mx - 1.5, 0, tz - .5, .1, .4, .1, 'woodD'); // the stumps of the legs
    return { obj: k.build({ cast: true }), plume: [mx, 2, pz - 1.6], shade: { x: mx, z0: mz + .2, z1: pz - .2, w: e.width * .8 } };
  },
};
function rocks(k, x, z, c1, c2, n, r, seed) { const R = rng(seed); for (let i = 0; i < n; i++) { const a = R() * 6.28, d = R() * r; k.dode(x + Math.cos(a) * d, .05 + R() * .08, z + Math.sin(a) * d, .1 + R() * .14, R() < .5 ? c1 : c2, { ry: R() * 3, sy: .7 + R() * .4 }); } }
