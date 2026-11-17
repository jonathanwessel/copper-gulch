// node tools/frame-shots.js <dir>: a quick look at how the camera frames the Gulch at every size: the home view, a
// tower card open, a far Mortar pit selected and a built-up town. Faster than tools/shots.js when tuning the camera.
import fs from 'node:fs';
import path from 'node:path';
import { start } from './serve.js';
import { chromium } from './cdp.js';

const dir = path.resolve(process.argv[2] || 'shots');
const SIZES = { phone: [400, 860], land: [860, 400], desk: [1366, 800] };
const SCREENS = [
  ['town', () => {}],
  ['card', () => { const t = CG.game.town; t.coins = 5000; t.goods.timber = 99; CG.play.openSpot(8); }],
  ['card2', () => { CG.play.close(); CG.play.openSpot(11); }],
  ['pit', () => { CG.play.close(); CG.play.openSpot(CG.game.town.def.board.far + 3); }],
  ['plot', () => { CG.play.close(); CG.play.open('wagonworks'); }],
  ['closed', () => { CG.play.close(); }],
];
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(dir, { recursive: true });
const srv = await start(0), b = await chromium.launch(), wrote = [];
try {
  for (const [size, [width, height]] of Object.entries(SIZES)) {
    const p = await b.newPage({ viewport: { width, height } });
    await p.goto(srv.url + '?coach=off&start=gulch');
    for (let i = 0; i < 100 && !(await p.evaluate(() => !!(window.CG && CG.ready))); i++) await sleep(100);
    await p.evaluate(() => { const n = document.getElementById('newsOk'); if (n) n.click(); localStorage.clear(); document.getElementById('play').click(); });
    for (let i = 0; i < 100 && !(await p.evaluate(() => !!(CG.town && CG.town.frames > 2))); i++) await sleep(100);
    for (const [name, go] of SCREENS) {
      await p.evaluate(go); await sleep(name === 'town' ? 2500 : 1500);
      const f = path.join(dir, `${name}-${size}.png`); await p.screenshot({ path: f }); wrote.push(f);
    }
    await p.close();
  }
} finally { await b.close(); srv.close(); }
console.log(wrote.join('\n'));
process.exit(0);
