// node tools/narrow-probe.js [dir]: the play screen on a 360 px phone (clarity fix 8s, 2026-11-27). Many Android phones are
// 360 px wide, and no check ran there until this box. In Copper Gulch with the top bar full (every side button, waves on
// hold, the back button with the two longest place names, a boss on the road and its bar), at 360 by 740 and 360 by 640
// and turned (740 by 360, 640 by 360), it prints what smoke's checks find (a control under another, a cut word, a
// sideways scroll) and saves a screenshot of each size into dir. Smoke runs the same checks at 360 (tools/smoke.js).
import fs from 'node:fs';
import path from 'node:path';
import { start } from './serve.js';
import { chromium } from './cdp.js';
import { check, uncovered, dotsSeen } from './smoke.js';

const dir = process.argv[2] || path.join('.checks', 'narrow');
fs.mkdirSync(dir, { recursive: true });
const SIZES = [[360, 740], [360, 640], [740, 360], [640, 360]];
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
    (await import('./src/core/empire.js')).foundTown(g, 'ridge'); g.towns.ridge.bestWave = 30; g.towns.ridge.waves.hold = true;
    (await import('./src/core/capital.js')).foundCapital(g); g.shared.purse.coins = 1e9;
    for (const k of ['war', 'university']) (await import('./src/core/tree.js')).foundInstitution(g, k);
    g.shared.charter.offered = true; t.flags['open:research'] = true; g.shared.seen = { ...(g.shared.seen || {}), goods: true };
    g.shared.tree.nodes.war = 3; // To arms comes out
    // the two longest place names: here and on the back button
    const { TOWNS } = await import('./src/data/towns/index.js');
    const names = Object.values(TOWNS).map(d => d.short || d.name).sort((a, c) => c.length - a.length);
    t.def.short = names[0]; TOWNS.ridge.short = names[1];
  });
  // a trip to Iron Ridge and back, so the back button shows (it names the last place)
  await page.evaluate(() => CG.go('ridge'));
  for (let i = 0; i < 100 && !(await page.evaluate(() => !!(CG.town && CG.game.active === 'ridge' && CG.town.frames > 3))); i++) await sleep(100);
  await page.evaluate(() => CG.go('gulch'));
  for (let i = 0; i < 100 && !(await page.evaluate(() => !!(CG.town && CG.game.active === 'gulch' && CG.town.frames > 3))); i++) await sleep(100);
  await page.evaluate(() => { const g = CG.game, t = g.town; g.shared.charter.offered = true; t.flags['open:research'] = true; });
  await sleep(1200);
  console.log('setup', JSON.stringify(await page.evaluate(() => ({ back: CG.game.back, backShown: !document.getElementById('backBtn').hidden, arms: !document.getElementById('armsBtn').hidden, name: document.querySelector('#placeBar .townname').textContent }))));
  // two states: a break with Call now, and a wave with the war wagon on the road and its bar
  const states = {
    calls: () => { const t = CG.game.town; Object.assign(t.waves, { hold: false, phase: 'break', timer: 50, queue: [], foes: [] }); },
    boss: () => { const t = CG.game.town, ws = t.waves; Object.assign(ws, { hold: false, phase: 'wave', timer: 999, queue: [] }); ws.foes = [{ id: 9001, kind: 'wagon', lane: 0, hp: 5e8, max: 1e9, s: 5, slow: 0, slowT: 0, frozenT: 1e9, poison: 0, poisonT: 0, rot: 0, eat: 0, brittle: 0 }]; },
  };
  for (const [state, set] of Object.entries(states)) for (const [w, h] of SIZES) {
    await page.evaluate(set); await sleep(300);
    await page.setViewportSize({ width: w, height: h }); await sleep(700);
    const out = [];
    out.push(...(await check(page)), ...(await dotsSeen(page)), ...(await uncovered(page)));
    const cut = await page.evaluate(() => [document.querySelector('#placeBar .townname'), document.getElementById('backBtn'), document.querySelector('#wave .winfo')]
      .filter(x => x && !x.hidden && x.scrollWidth > x.clientWidth + 1).map(x => x.textContent).join(' and '));
    if (cut) out.push('cut: ' + cut);
    const side = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1 ? 'sideways scroll ' + document.documentElement.scrollWidth : '');
    if (side) out.push(side);
    // Call now keeps clear of the side buttons: at least 4 px between them, not only "not under"
    const gap = await page.evaluate(() => { const c = document.getElementById('callWave'), r = c.getBoundingClientRect(), sb = [...document.querySelectorAll('.hudright .side .btn')].filter(n => !n.hidden && n.offsetParent).map(n => n.getBoundingClientRect()).filter(q => q.top < r.bottom && q.bottom > r.top); return c.offsetParent && sb.length ? Math.round(Math.min(...sb.map(q => q.left)) - r.right) : null; });
    if (gap !== null && gap < 4) out.push('Call now is ' + gap + ' px from a side button');
    await page.screenshot({ path: path.join(dir, `narrow-${state}-${w}x${h}.png`) });
    // a tower card open on the same screen
    await page.evaluate(() => CG.play.openSpot(3)); await sleep(400);
    out.push(...(await uncovered(page)).map(x => 'card: ' + x));
    await page.screenshot({ path: path.join(dir, `narrow-${state}-card-${w}x${h}.png`) });
    await page.evaluate(() => CG.play.close()); await sleep(200);
    console.log(`${state} ${w}x${h}`, out.length ? 'FAIL ' + out.join('; ') : 'ok');
    bad += out.length ? 1 : 0;
  }
  // the empire map at the same sizes, with a town's card open: no sideways scroll, no control under another, and every
  // town's label whole on the screen
  await page.evaluate(() => CG.openMap());
  for (let i = 0; i < 100 && !(await page.evaluate(() => !!(CG.map && CG.map.frames > 5))); i++) await sleep(100);
  for (const [w, h] of SIZES) for (const open of [false, true]) {
    await page.setViewportSize({ width: w, height: h }); await sleep(700);
    if (open) { await page.evaluate(() => CG.mapui.openSite('ridge')); await sleep(500); }
    const out = [...(await check(page)), ...(await uncovered(page))];
    const r = await page.evaluate(() => ({
      side: document.documentElement.scrollWidth > innerWidth + 1,
      cut: [...document.querySelectorAll('#mapBadges .mapbadge')].filter(n => n.offsetParent && !n.hidden).filter(n => { const b = n.getBoundingClientRect(); return b.left < -1 || b.right > innerWidth + 1; }).map(n => n.textContent.slice(0, 20)),
    }));
    if (r.side) out.push('sideways scroll');
    if (r.cut.length) out.push('labels off the edge: ' + r.cut.join(', '));
    await page.screenshot({ path: path.join(dir, `narrow-map${open ? '-card' : ''}-${w}x${h}.png`) });
    if (open) await page.evaluate(() => { const c = document.getElementById('mapClose'); if (c) c.click(); });
    console.log(`map${open ? ' card' : ''} ${w}x${h}`, out.length ? 'FAIL ' + out.join('; ') : 'ok');
    bad += out.length ? 1 : 0;
  }
  if (errs.length) { console.log('errors', errs.slice(0, 3).join('; ')); bad++; }
} finally { await b.close(); srv.close(); }
process.exit(bad ? 1 : 0);
