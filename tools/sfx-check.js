// node tools/sfx-check.js: plays a Gulch wave with four towers in headless Chrome and reports what the audio did:
// shots fired by the core, effects played, bars of music and the audio clock. A quick look when tuning sound.
import { start } from './serve.js';
import { chromium } from './cdp.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const srv = await start(0), b = await chromium.launch();
try {
  const p = await b.newPage({ viewport: { width: 400, height: 860 } });
  await p.goto(srv.url + '?coach=off&start=gulch');
  for (let i = 0; i < 100 && !(await p.evaluate(() => !!(window.CG && CG.ready))); i++) await sleep(100);
  await p.evaluate(() => { localStorage.clear(); document.getElementById('play').click(); });
  for (let i = 0; i < 100 && !(await p.evaluate(() => !!(CG.town && CG.town.frames > 2))); i++) await sleep(100);
  const r = await p.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms)), g = CG.game, t = g.town;
    document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); await wait(300);
    t.coins = 1e6; for (const k of Object.keys(t.goods)) t.goods[k] = 999;
    for (const [s, k] of [[4, 'crossbow'], [5, 'cannon'], [6, 'crossbow'], [8, 'frost']]) { CG.play.openSpot(s); const btn = document.querySelector('#card .build[data-kind="' + k + '"]'); if (btn) btn.click(); }
    CG.play.close();
    let shots = 0, kills = 0; g.bus.on('shot', e => { if (e.town === g.active) shots++; }); g.bus.on('kill', () => kills++);
    const s0 = CG.audio.state(), c0 = performance.now();
    document.getElementById('callWave').click(); await wait(30000);
    const s1 = CG.audio.state();
    return { towers: t.towers.length, shots, kills, sounds: s1.sounds - s0.sounds, bars: s1.bars - s0.bars, mood: s1.mood, ctx: s1.ctx, wallSec: (performance.now() - c0) / 1000 };
  });
  console.log(JSON.stringify(r));
} finally { await b.close(); srv.close(); }
process.exit(0);
