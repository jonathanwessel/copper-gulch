import { start } from './serve.js';
import { chromium } from './cdp.js';
const srv = await start(0), b = await chromium.launch();
const wait = ms => new Promise(r => setTimeout(r, ms));
try {
  const p = await b.newPage({ viewport: { width: 1366, height: 800 } });
  await p.goto(srv.url + '?coach=off&start=gulch');
  for (let i = 0; i < 100 && !(await p.evaluate(() => !!(window.CG && CG.ready && CG.game))); i++) await wait(100);
  await p.evaluate(() => document.getElementById('play').click());
  for (let i = 0; i < 100 && !(await p.evaluate(() => !!(CG.town && CG.scene && CG.scene.frames > 2))); i++) await wait(100);
  await wait(2500);
  console.log(JSON.stringify(await p.evaluate(async () => {
    const r = CG.town.rig, w = ms => new Promise(x => setTimeout(x, ms));
    const before = { ...r.t };
    CG.play.openSpot(CG.game.town.def.board.far); await w(1500);
    return { before, t: r.t, keepKey: r.keepKey, keepAt: r.keepAt, keepG: r.keepG, g: r.gestures, cover: r.view.cover, top: r.view.top, reach: CG.town.selection.reach, size: r.size, home: r.home, fx: r.fx, slid: r.slid, zoomKey: r.zoomKey };
  })));
} catch (e) { console.log('ERR', e.message); } finally { await b.close(); srv.close(); }
