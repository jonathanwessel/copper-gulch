// node tools/look-shots.js <dir> [town,...]: the look pass (PLAN.md M5b) before and after shots. Every town's home view at
// phone, landscape and desktop sizes, a low view across the town, and the town built up (every plot at level 30, so the
// buildings show their later steps), and the steps: every plot at a level mark in turn (1, 10, 25, 50, 100). Faster than tools/shots.js, and only the board, so the look can be judged alone.
import fs from 'node:fs';
import path from 'node:path';
import { start } from './serve.js';
import { chromium } from './cdp.js';

const dir = path.resolve(process.argv[2] || 'shots');
const TOWNS = (process.argv[3] || 'drycreek,gulch,pinehollow,ridge,falls').split(',');
const SIZES = process.env.SHOT_SIZES ? Object.fromEntries(process.env.SHOT_SIZES.split(',').map(k => [k, { phone: [400, 860], land: [860, 400], desk: [1366, 800] }[k]])) : { phone: [400, 860], land: [860, 400], desk: [1366, 800] };
const VIEWS = [
  ['home', () => { CG.town.rig.reset(); }],
  ['low', () => { const r = CG.town.rig, B = CG.game.town.def.board, v = { x: B.cols / 2, z: B.rows / 2 + 1, yaw: .5, pitch: .55, dist: 11 }; Object.assign(r.t, v); Object.assign(r.c, v); }],
  ['built', () => { const t = CG.game.town; for (const id of Object.keys(t.def.board.plots)) t.buildings[id] = 30; CG.town.rig.reset(); }],
  ['built-low', () => { const r = CG.town.rig, B = CG.game.town.def.board, v = { x: B.cols / 2 - 1, z: B.rows / 2, yaw: -.6, pitch: .5, dist: 10 }; Object.assign(r.t, v); Object.assign(r.c, v); }],
  // every plot at one of the level marks in turn (1, 10, 25, 50, 100), so the steps a building grows by show side by side
  ['steps', () => { const t = CG.game.town, L = [1, 10, 25, 50, 100]; Object.keys(t.def.board.plots).forEach((id, i) => { t.buildings[id] = L[i % L.length]; }); CG.town.rig.reset(); }],
  ['steps-low', () => { const r = CG.town.rig, B = CG.game.town.def.board, v = { x: B.cols / 2 - 1, z: B.rows / 2, yaw: -.6, pitch: .5, dist: 10 }; Object.assign(r.t, v); Object.assign(r.c, v); }],
];
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(dir, { recursive: true });
const srv = await start(0), b = await chromium.launch(), wrote = [], errs = [];
try {
  for (const town of TOWNS) for (const [size, [width, height]] of Object.entries(SIZES)) {
    const p = await b.newPage({ viewport: { width, height } });
    p.on('pageerror', e => errs.push(town + ' ' + size + ': ' + String(e.message).split('\n')[0]));
    await p.goto(srv.url + '?coach=off' + (town === 'drycreek' ? '' : '&start=' + town));
    for (let i = 0; i < 100 && !(await p.evaluate(() => !!(window.CG && CG.ready))); i++) await sleep(100);
    await p.evaluate(() => { const n = document.getElementById('newsOk'); if (n) n.click(); localStorage.clear(); document.getElementById('play').click(); });
    for (let i = 0; i < 100 && !(await p.evaluate(() => !!(CG.town && CG.town.frames > 2))); i++) await sleep(100);
    await p.evaluate(() => { CG.game.town.waves.hold = true; });
    for (const [name, go] of VIEWS) {
      await p.evaluate(go); await sleep(name === 'home' ? 2500 : 1500);
      const f = path.join(dir, `${town}-${name}-${size}.png`); await p.screenshot({ path: f }); wrote.push(f);
    }
    await p.close();
  }
} finally { await b.close(); srv.close(); }
console.log(wrote.join('\n'));
if (errs.length) { console.log('page errors:\n' + [...new Set(errs)].slice(0, 20).join('\n')); process.exit(1); }
