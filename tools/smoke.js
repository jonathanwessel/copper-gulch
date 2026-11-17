// node tools/smoke.js: loads the game in headless Edge or Chrome at phone, landscape and desktop sizes and checks
// that it boots without errors, draws the 3D view, has no sideways scroll and no touch target under 30 px; then taps
// Play and checks the town the same way, opens a building card and buys a level with its button.
// Then it turns the server off and reloads, to prove the installed app runs offline.
// Prints one line per size ("phone ok") and exits non-zero on any failure.
import { start } from './serve.js';
import { chromium } from './cdp.js';

const SIZES = { phone: [400, 860], land: [860, 400], desk: [1366, 800] };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitFor(page, expr, ms = 15000) {
  for (let t = 0; t < ms; t += 100) { if (await page.evaluate(expr).catch(() => false)) return true; await sleep(100); }
  return false;
}

export async function check(page) {
  return page.evaluate(() => {
    const bad = [], vw = innerWidth;
    const wide = [document.documentElement, document.body, document.getElementById('app')].some(e => e && e.scrollWidth > vw + 1);
    if (wide) bad.push('sideways scroll');
    for (const b of document.querySelectorAll('button, a, [role=button]')) {
      const r = b.getBoundingClientRect();
      if (r.width && (r.width < 30 || r.height < 30)) bad.push('small target: ' + (b.id || b.textContent.trim().slice(0, 20)) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
      if (r.width && (r.right > vw + 1 || r.left < -1)) bad.push('off screen: ' + (b.id || b.textContent.trim().slice(0, 20)));
    }
    const card = document.getElementById('card');
    if (card && !card.hidden) { const r = card.getBoundingClientRect(); if (r.top < -1 || r.bottom > innerHeight + 1) bad.push('card taller than the screen'); }
    if (!window.CG) return [...bad, 'no game'];
    if (CG.town) { if (CG.town.frames < 3) bad.push('town not drawing'); }
    else if (CG.game) bad.push('no 3D town');
    else if (!document.getElementById('title')) bad.push('no title');
    else if (!CG.scene) bad.push('no 3D view');
    else if (CG.scene.frames < 3) bad.push('3D view not drawing');
    return bad;
  });
}

async function run() {
  const srv = await start(0), browser = await chromium.launch();
  let failed = 0;
  try {
    for (const [name, [width, height]] of Object.entries(SIZES)) {
      const page = await browser.newPage({ viewport: { width, height } }), errs = [];
      page.on('pageerror', e => errs.push(e.message));
      page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
      await page.goto(srv.url + '?coach=off');
      await waitFor(page, () => window.CG && CG.ready && (!CG.scene || CG.scene.frames > 3));
      await sleep(300);
      const bad = [...await check(page)];
      // the town: play, open the camp, buy a level
      await page.evaluate(() => { localStorage.clear(); document.getElementById('play').click(); });
      await waitFor(page, () => window.CG && CG.town && CG.town.frames > 5);
      await sleep(300);
      bad.push(...(await check(page)).map(b => 'town: ' + b));
      const buy = await page.evaluate(async () => {
        const t = CG.game.town; t.coins = 100; CG.play.open('camp'); await new Promise(r => setTimeout(r, 100));
        const b = document.getElementById('buy'), before = t.level('camp'); b.click();
        return { ok: t.level('camp') === before + 1, card: !document.getElementById('card').hidden };
      });
      if (!buy.ok || !buy.card) bad.push('the card did not buy a level');
      // a tower: build a crossbow on a spot through its card, then call the wave
      const tower = await page.evaluate(async () => {
        const t = CG.game.town; t.coins = 500; t.goods.timber = 50; CG.play.openSpot(3); await new Promise(r => setTimeout(r, 100));
        document.querySelector('#card .build[data-kind="crossbow"]').click();
        const built = t.towers.some(x => x.spot === 3 && x.kind === 'crossbow');
        document.getElementById('callWave').click();
        return { built, wave: t.waves.phase === 'wave' };
      });
      if (!tower.built || !tower.wave) bad.push('the tower card or the call button failed');
      await page.evaluate(() => CG.play.openSpot(4)); await sleep(350);
      bad.push(...(await check(page)).map(b => 'spot card: ' + b));
      await sleep(400);
      bad.push(...(await check(page)).map(b => 'card: ' + b), ...errs);
      console.log(name, bad.length ? 'FAIL ' + bad.join('; ') : 'ok');
      failed += bad.length ? 1 : 0;
      await page.close();
    }
  } finally { await browser.close(); srv.close(); }

  // the explainers: a fresh game opens with the welcome card and a spotlight; the game waits; Got it dismisses it for good
  const srv3 = await start(0), b3 = await chromium.launch();
  try {
    const page = await b3.newPage({ viewport: { width: 400, height: 860 } }), errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.goto(srv3.url);
    await waitFor(page, () => window.CG && CG.ready);
    await page.evaluate(() => { localStorage.clear(); document.getElementById('play').click(); });
    const shown = await waitFor(page, () => window.CG && CG.coach && CG.coach.current === 'welcome', 10000);
    const bad = shown ? [] : ['the welcome card did not show'];
    if (shown) {
      const st = await page.evaluate(async () => {
        const t0 = CG.game.town.t; await new Promise(r => setTimeout(r, 1200));
        const hole = document.querySelector('#coach .hole');
        return { paused: CG.game.town.t === t0, hole: !hole.hidden && hole.getBoundingClientRect().width > 0 };
      });
      if (!st.paused) bad.push('the game ran under the card');
      if (!st.hole) bad.push('no spotlight on the camp');
      bad.push(...(await check(page)).map(b => 'coach: ' + b));
      await page.evaluate(() => document.getElementById('coachOk').click());
      await sleep(300);
      const after = await page.evaluate(() => ({ hidden: document.getElementById('coach').hidden, seen: !!CG.game.shared.seen.welcome }));
      if (!after.hidden || !after.seen) bad.push('Got it did not dismiss the card');
      await page.reload(); await waitFor(page, () => window.CG && CG.ready);
      await page.evaluate(() => document.getElementById('play').click());
      await waitFor(page, () => CG.town && CG.town.frames > 5); await sleep(2500);
      if (await page.evaluate(() => CG.coach.current === 'welcome')) bad.push('the welcome card came back after a reload');
    }
    bad.push(...errs);
    console.log('coach', bad.length ? 'FAIL ' + bad.join('; ') : 'ok');
    failed += bad.length ? 1 : 0;
  } finally { await b3.close(); srv3.close(); }

  // offline: install the service worker, then stop the server and load again
  const srv2 = await start(0), b2 = await chromium.launch();
  try {
    const page = await b2.newPage({ viewport: { width: 400, height: 860 } }), errs = [];
    await page.goto(srv2.url);
    await waitFor(page, () => navigator.serviceWorker && navigator.serviceWorker.ready.then(() => true));
    await page.reload(); await waitFor(page, () => window.CG && CG.ready && !!navigator.serviceWorker.controller);
    await sleep(1500); // let the network-first copies land in the cache
    srv2.close(); await sleep(200);
    page.on('pageerror', e => errs.push(e.message));
    await page.reload();
    const ok = await waitFor(page, () => window.CG && CG.ready && CG.scene && CG.scene.frames > 3, 10000);
    const bad = ok ? [...await check(page), ...errs] : ['did not boot offline', ...errs];
    console.log('offline', bad.length ? 'FAIL ' + bad.join('; ') : 'ok');
    failed += bad.length ? 1 : 0;
  } finally { await b2.close(); }
  process.exitCode = failed ? 1 : 0;
}

if (import.meta.url.endsWith('/tools/smoke.js') && process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/smoke.js')) {
  run().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => setTimeout(() => process.exit(), 100));
}
