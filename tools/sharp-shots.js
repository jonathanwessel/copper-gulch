// node tools/sharp-shots.js <dir>: the Gulch at phone size, zoomed in on its buildings, once on each look the med tier
// has had (ratio 1.35 with no edge pass, as before 2026.11.22-12, and ratio 1.5, 1.75 and 2 with FXAA), for before and
// after reviews of the sharpness (sharper models, owner 2026-11-22). Also prints the drawing buffer's size for each.
import { start } from './serve.js';
import { chromium } from './cdp.js';
import fs from 'fs';
import path from 'path';

const dir = process.argv[2] || '.';
fs.mkdirSync(dir, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const LOOKS = [['before-1.35', 1.35, false], ['after-1.5', 1.5, true], ['climb-1.75', 1.75, true], ['climb-2', 2, true]];
const srv = await start(0), b = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle'] });
try {
  const p = await b.newPage({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 3, mobile: true });
  await p.goto(srv.url + '?coach=off&start=gulch');
  for (let i = 0; i < 100 && !(await p.evaluate(() => !!(window.CG && CG.ready))); i++) await sleep(100);
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('cg-gfx', JSON.stringify({ tier: 'med', auto: false })); document.getElementById('play').click(); });
  for (let i = 0; i < 100 && !(await p.evaluate(() => !!(CG.town && CG.town.frames > 3))); i++) await sleep(100);
  await p.evaluate(() => {
    const t = CG.game.town; t.coins = 1e9;
    for (const [id, n] of Object.entries({ camp: 12, mine: 8, pit: 6, saw: 8, smelter: 5, kiln: 6, toolsmith: 4 })) t.buildings[id] = n;
    CG.town.pause('shots', true);
  });
  await sleep(800);
  for (const [name, ratio, fxaa] of LOOKS) {
    const size = await p.evaluate(async ([ratio, fxaa]) => {
      const m = await import('./src/render/quality.js'); m.TIERS.med.fxaa = fxaa;
      const v = CG.town.view; v.setQuality('med', ratio);
      const r = CG.town.rig; r.t.dist = Math.max(r.min, 9); r.atHome = false;
      await new Promise(res => setTimeout(res, 900));
      return v.canvas.width + 'x' + v.canvas.height;
    }, [ratio, fxaa]);
    await p.screenshot({ path: path.join(dir, 'sharp-' + name + '.png') });
    console.log(name, size);
  }
} finally { await b.close(); srv.close(); }
