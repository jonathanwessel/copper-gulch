/* Lane entrances: where raiders come from, so a lane never starts at a bare patch of ground. Each town names its
   entrance in its board data (board.entrance.kind); tools/audit.js fails a lane whose kind has no builder here.
   A builder returns { obj, plume, shade } built from merged kit parts:
     obj: the static model, merged by material;   plume: [x, y, z] where the wave's dust rises (behind the entrance);
     shade: { x, z0, z1, w } a strip of road to darken (the inside of the entrance), or null.
   Later towns (GDD.md): tunnel (Iron Ridge), bend (Silver Falls), clouds (Thunder Mesa), fissure (Radium Springs). */
import { Kit, rng } from '../../render/kit.js';

export const ENTRANCES = {
  /* Copper Gulch: a slot canyon. Tall walls of layered rock run from the mouth off the edge of the board; inside, the
     road comes out of a timber mine portal cut through a rockfall that fills the canyon behind it. A collapsed trestle
     leans by the mouth and a signpost carries a wanted poster. e: { mouth: [x, z], portal: [x, z], width, mesa: [4
     colors] } with the canyon running toward -z. */
  canyon: e => {
    const k = new Kit({ aoH: 3 }), R = rng(17), [mx, mz] = e.mouth, [, pz] = e.portal, half = e.width / 2;
    const strata = [...(e.mesa || ['#b35a3a', '#d98a55', '#a94f33', '#e0a46c']), '#8f4a33'];
    // the walls: blocks of stacked layers, low at the mouth and rising to full height a little way in
    for (const side of [-1, 1]) {
      for (let z = mz + .4, i = 0; z > mz - 9.5; i++) { // past here the camera never looks; the mesas carry on
        const len = 1.8 + R() * 1.4, rise = Math.min(1, (mz + .4 - z) / 4), H = (1.2 + rise * 1.9) * (.9 + R() * .2);
        // thin by the mortar pit east of the mouth, broad farther in
        const thick = (side > 0 && z > mz - 6 ? 1 : 1.3 + R() * .5), x0 = mx + side * (half + thick / 2 + R() * .15);
        // layers are added top first: seen from above, each upper layer hides the one below, and drawing it first
        // lets the depth test skip the hidden faces instead of painting every layer over the last (overdraw)
        const layers = [];
        let y = -.4;
        for (let l = 0; y < H; l++) { const h = 1 + R() * .5, inset = l * .1 * (1 + R()); layers.push([x0 + side * inset, y, thick - inset * 1.5, h + .02, strata[(l + i) % strata.length]]); y += h; }
        if (R() < .5) k.box(x0, y, z - len / 2, thick * .6, .2, len * .5, strata[3], { ao: false }); // a cap ledge
        for (const [x, yy, w, h, c] of layers.reverse()) k.box(x, yy, z - len / 2, w, h, len + .04, c, { jit: .12, ao: false });
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
    for (let b = 0; b < 3; b++) {
      const x = mx + half + .35 + b * .62, fall = b === 2 ? 1.1 : b * .1;
      for (const sz of [-1, 1]) k.box(x, 0, tz + sz * .2, .07, 1.15 - b * .2, .07, 'wood', { rx: sz * .1, rz: -fall, ao: false });
      k.box(x, .5, tz, .06, .06, .48, 'woodD', { rx: .6, rz: -fall });
    }
    k.box(mx + half + .9, .75, tz, 1.5, .08, .08, 'woodL', { rz: -.35 });
    k.box(mx + half + 1.5, 0, tz + .45, 1.1, .07, .07, 'wood', { ry: .7 });
    // the signpost with a wanted poster, west of the mouth
    const sx0 = mx - half - .1, sz0 = mz + .85;
    k.box(sx0, 0, sz0, .09, 1.15, .09, 'woodD');
    k.box(sx0 + .02, .7, sz0, .62, .42, .05, 'plank', { ry: .35 });
    k.box(sx0 + .02, .74, sz0 + .03, .3, .34, .02, 'cream', { ry: .35, ao: false });
    k.box(sx0 + .02, .95, sz0 + .04, .22, .06, .015, 'paintR', { ry: .35, ao: false });
    k.box(sx0 + .02, .8, sz0 + .04, .1, .1, .015, 'ink', { ry: .35, ao: false });
    return { obj: k.build({ cast: true }), plume: [mx, 1.8, pz - 2.6], shade: { x: mx, z0: mz + .2, z1: pz - .2, w: e.width } };
  },
};
