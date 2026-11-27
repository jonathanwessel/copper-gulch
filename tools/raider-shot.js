// node tools/raider-shot.js <dir> [--town gulch|falls|mesa]: a phone-sized shot of a town mid-wave, zoomed in on the
// road, to look at raiders as they are drawn (perf headroom box, 2026.11.27-5: raiders moved to batches, one draw call a
// part for every raider of a kind). Writes <dir>/raiders-<town>.png and prints the raiders and batch parts drawn.
import fs from 'node:fs';
import path from 'node:path';
import { start } from './serve.js';
import { chromium } from './cdp.js';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const dir = process.argv[2], TOWN = arg('town', 'gulch');
if (!dir || dir.startsWith('--')) { console.error('usage: node tools/raider-shot.js <dir> [--town gulch]'); process.exit(2); }
fs.mkdirSync(dir, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const srv = await start(0), b = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle'] });
try {
  const p = await b.newPage({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 2, mobile: true });
  await p.goto(srv.url + '?coach=off&start=' + TOWN);
  for (let i = 0; i < 100 && !(await p.evaluate(() => !!(window.CG && CG.ready))); i++) await sleep(100);
  await p.evaluate(() => { localStorage.clear(); document.getElementById('play').click(); });
  for (let i = 0; i < 100 && !(await p.evaluate(() => !!(CG.town && CG.town.frames > 3))); i++) await sleep(100);
  await p.evaluate(() => { const t = CG.game.town; t.coins = 1e9; t.wave = Math.max(t.wave, 8); CG.play.close(); document.getElementById('callWave').click(); });
  // wait until a few raiders are out of the entrance and some are hurt, then hold still for the shot
  for (let i = 0; i < 120; i++) { await sleep(250); if (await p.evaluate(() => [...CG.town.battle.foes.values()].filter(u => u.obj.visible).length >= 4)) break; }
  await sleep(1500);
  const info = await p.evaluate(() => { CG.town.holds.add('shot'); return { raiders: [...CG.town.battle.foes.values()].filter(u => u.obj.visible).length, ...CG.town.battle.foeBatches.stats() }; });
  await sleep(300);
  const file = path.join(dir, 'raiders-' + TOWN + '.png');
  await p.screenshot({ path: file });
  console.log(JSON.stringify({ file, ...info }));
} finally { await b.close(); srv.close(); }
