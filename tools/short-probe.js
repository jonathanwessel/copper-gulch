// node tools/short-probe.js [dir]: cards on short screens (clarity fix 8u, 2026-11-27). In Copper Gulch with the top bar
// full, it opens a level-10 building card (the Lumber Camp with its foreman row) and a tower's path pick (a level-4
// Crossbow) at the short sizes smoke's crowded check runs (375 by 667, 360 by 740 and 640, and turned 740 and 640 by
// 360, plus 860 by 400), prints what smoke's uncovered check finds with the card's and its pinned bar's place, and saves
// a screenshot of each into dir.
import fs from 'node:fs';
import path from 'node:path';
import { start } from './serve.js';
import { chromium } from './cdp.js';
import { uncovered } from './smoke.js';

const dir = process.argv[2] || path.join('.checks', 'short');
fs.mkdirSync(dir, { recursive: true });
const SIZES = [[375, 667], [360, 740], [360, 640], [740, 360], [640, 360], [860, 400], [400, 860]];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const srv = await start(0), b = await chromium.launch();
let bad = 0;
try {
  const page = await b.newPage({ viewport: { width: 400, height: 860 } }), errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(srv.url + '?coach=off&start=gulch');
  for (let i = 0; i < 100 && !(await page.evaluate(() => !!(window.CG && CG.ready))); i++) await sleep(100);
  await page.evaluate(() => { const ok = document.getElementById('newsOk'); if (ok) ok.click(); localStorage.clear(); document.getElementById('play').click(); });
  for (let i = 0; i < 100 && !(await page.evaluate(() => !!(CG.town && CG.town.frames > 3))); i++) await sleep(100);
  await page.evaluate(async () => {
    const g = CG.game, t = g.town; t.bestWave = 20; t.coins = 1e9;
    (await import('./src/core/capital.js')).foundCapital(g); g.shared.purse.coins = 1e9;
    for (const k of ['war', 'university']) (await import('./src/core/tree.js')).foundInstitution(g, k);
    g.shared.tree.nodes.war = 3;
    g.shared.charter.offered = true; t.flags['open:research'] = true; g.shared.seen = { ...(g.shared.seen || {}), goods: true }; t.waves.hold = true;
    t.buildings.camp = Math.max(10, t.level('camp'));
  });
  await sleep(800);
  const cards = {
    building: async () => page.evaluate(() => { CG.play.close(); CG.play.open('camp'); }),
    pick: async () => page.evaluate(async () => {
      const t = CG.game.town, D = await import('./src/core/defense.js'); CG.play.close();
      if (!t.towers.some(x => x.spot === 3)) D.buildTower(CG.game, t, 3, 'crossbow');
      const tw = t.towers.find(x => x.spot === 3); tw.level = 4; tw.path = null; CG.play.openSpot(3);
    }),
  };
  for (const [w, h] of SIZES) {
    await page.setViewportSize({ width: w, height: h }); await sleep(600);
    for (const [name, open] of Object.entries(cards)) {
      await open(); await sleep(500);
      const out = await uncovered(page);
      const geo = await page.evaluate(() => {
        const c = document.getElementById('card'), r = c.getBoundingClientRect(), pin = c.querySelector(':scope > .buybar:not(.pathbar), :scope > .row:has(> #buy)');
        const p = pin && pin.getBoundingClientRect(), hud = document.querySelector('.hud').getBoundingClientRect();
        const picks = [...c.querySelectorAll('.pathbtn, .pick, button[data-path]')].map(n => { const q = n.getBoundingClientRect(); return Math.round(q.top) + '-' + Math.round(q.bottom); });
        const rows = [...c.children].filter(n => n.getClientRects().length).map(n => (n.className || n.tagName).toString().split(' ')[0] + ' ' + Math.round(n.getBoundingClientRect().height)).join(', ');
        return { rows, card: Math.round(r.top) + '-' + Math.round(r.bottom), scroll: c.scrollHeight - c.clientHeight, bar: p ? Math.round(p.top) + '-' + Math.round(p.bottom) : '-', hudBottom: Math.round(hud.bottom), picks: picks.join(' ') };
      });
      await page.screenshot({ path: path.join(dir, name + '-' + w + 'x' + h + '.png') });
      if (out.length) bad++;
      console.log(`${name} ${w}x${h}: ${out.length ? out.join('; ') : 'ok'} | card ${geo.card} (scrolls ${geo.scroll} px), bar ${geo.bar}, top bar to ${geo.hudBottom}${geo.picks ? ', picks ' + geo.picks : ''}${process.argv.includes('--rows') ? ' | rows ' + geo.rows : ''}`);
    }
  }
  if (errs.length) { console.log('page errors: ' + errs.join('; ')); bad++; }
} finally { await b.close(); srv.close(); }
console.log(bad ? 'short-probe: ' + bad + ' with problems' : 'short-probe ok');
process.exit(bad ? 1 : 0);
