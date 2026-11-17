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
      // Pause stops the whole game and Resume starts it again; Hold waves keeps the next wave back until released
      const ctl = await page.evaluate(async () => {
        const wait = ms => new Promise(r => setTimeout(r, ms)), t = CG.game.town, out = {};
        document.getElementById('pauseBtn').click(); const t0 = t.t; await wait(900);
        out.paused = t.t === t0 && !document.getElementById('pausedBanner').hidden;
        document.getElementById('pauseBtn').click(); await wait(900);
        out.resumed = t.t > t0 && document.getElementById('pausedBanner').hidden;
        Object.assign(t.waves, { phase: 'break', timer: .5, queue: [], foes: [] });
        document.getElementById('holdWaves').click(); await wait(1500);
        out.held = t.waves.phase === 'break' && document.getElementById('holdWaves').textContent === 'Waves held';
        document.getElementById('holdWaves').click(); await wait(900);
        out.released = t.waves.phase === 'wave';
        return out;
      });
      for (const [k, v] of Object.entries(ctl)) if (!v) bad.push('Pause and Hold waves: not ' + k);
      await page.evaluate(() => CG.play.openSpot(4)); await sleep(350);
      bad.push(...(await check(page)).map(b => 'spot card: ' + b));
      // effects: cannon blasts and poison clouds fade and go back to the pool (none are left lying on the road).
      // Effect meshes are the only meshes placed straight in the battle group; once quiet, none may still show.
      const fx = await page.evaluate(async () => {
        const wait = ms => new Promise(r => setTimeout(r, ms)), t = CG.game.town, b = CG.town.battle;
        const effects = () => b.group.children.filter(o => o.isMesh);
        t.coins = 1e6; Object.assign(t.goods, { copper: 200, bricks: 200, tools: 200 }); t.sell = { copper: false, bricks: false, tools: false };
        for (const [s, k] of [[0, 'cannon'], [1, 'still'], [8, 'cannon']]) { CG.play.openSpot(s); document.querySelector('#card .build[data-kind="' + k + '"]').click(); }
        CG.play.close();
        Object.assign(t.waves, { phase: 'break', timer: 0, hold: false, queue: [], foes: [] }); await wait(9000); // a wave rides past them
        const made = effects().length;
        Object.assign(t.waves, { phase: 'break', timer: 99, hold: true, queue: [], foes: [] }); await wait(2000); // quiet for 2 s
        const showing = effects().filter(o => o.visible).length;
        t.waves.hold = false;
        return { made, showing };
      });
      if (!fx.made) bad.push('no cannon or still shots to check');
      if (fx.showing) bad.push(fx.showing + ' blasts or clouds still showing 2 s after the shooting stopped');
      // the selected thing is highlighted on the board while its card is open, and only then
      const sel = await page.evaluate(async () => {
        const g = CG.town.selection.group; CG.play.openSpot(4); await new Promise(r => setTimeout(r, 100));
        const open = g.visible; CG.play.close(); await new Promise(r => setTimeout(r, 100));
        const closed = !g.visible; CG.play.open('camp'); await new Promise(r => setTimeout(r, 100));
        const plot = g.visible && CG.town.selection.square.visible; CG.play.close();
        return open && closed && plot;
      });
      if (!sel) bad.push('the selection highlight did not follow the card');
      // mortar pits: a closed pit's card says what it is for; once open, a Mortar is built there through the card,
      // fires a shell, and its selection shows the dead zone
      const mortar = await page.evaluate(async () => {
        const wait = ms => new Promise(r => setTimeout(r, ms)), t = CG.game.town, pit = t.def.board.far, out = {};
        delete t.flags['open:mortar']; CG.play.openSpot(pit); await wait(100);
        out.closedText = /too far from the road/.test(document.getElementById('card').textContent) && !document.querySelector('#card .build');
        t.flags['open:mortar'] = true; t.coins = 1e6; Object.assign(t.goods, { copper: 500, bricks: 500 }); CG.play.close(); CG.play.openSpot(pit); await wait(100);
        const kinds = [...document.querySelectorAll('#card .build')].map(b => b.dataset.kind);
        out.onlyMortar = kinds.length === 1 && kinds[0] === 'mortar';
        document.querySelector('#card .build[data-kind="mortar"]').click();
        out.built = t.towers.some(x => x.spot === pit && x.kind === 'mortar');
        await wait(150); const S = CG.town.selection; out.deadZone = S.dead.visible && S.inner.visible && S.range.visible;
        CG.play.close();
        Object.assign(t.waves, { phase: 'break', timer: 0, hold: false, queue: [], foes: [] });
        const ev = []; const off = CG.game.bus.on('land', e => ev.push(e));
        for (let i = 0; i < 100 && !ev.length; i++) await wait(200);
        off(); out.landed = ev.length > 0;
        return out;
      });
      for (const [k, v] of Object.entries(mortar)) if (!v) bad.push('Mortar: not ' + k);
      // the side buttons: Goods and Menu open their sheets, Graphics changes the drawing tier and is kept
      await page.evaluate(() => document.getElementById('goodsBtn').click()); await sleep(350);
      bad.push(...(await check(page)).map(b => 'goods sheet: ' + b));
      const goods = await page.evaluate(() => {
        const t = CG.game.town, b = document.querySelector('#sheet [data-good="timber"]');
        if (!b || document.getElementById('sheet').hidden) return false;
        const was = t.sell.timber !== false; b.click(); const now = t.sell.timber !== false; b.click();
        return was !== now && (t.sell.timber !== false) === was;
      });
      if (!goods) bad.push('the Goods sheet did not switch selling');
      await page.evaluate(() => document.getElementById('menuBtn').click()); await sleep(350);
      bad.push(...(await check(page)).map(b => 'menu sheet: ' + b));
      const gfx = await page.evaluate(async () => {
        const wait = ms => new Promise(r => setTimeout(r, ms)), out = {};
        document.querySelector('#sheet [data-q="low"]').click(); await wait(300);
        out.low = CG.town.view.tier === 'low' && JSON.parse(localStorage.getItem('cg-gfx')).auto === false;
        out.drawing = CG.town.frames > 0;
        document.querySelector('#sheet [data-q="auto"]').click(); await wait(100);
        out.auto = JSON.parse(localStorage.getItem('cg-gfx')).auto === true && CG.town.quality === 'auto';
        const r = document.getElementById('sheet').getBoundingClientRect();
        out.fits = r.top >= -1 && r.bottom <= innerHeight + 1;
        document.getElementById('sheetClose').click(); await wait(100);
        out.closed = document.getElementById('sheet').hidden;
        return out;
      });
      for (const [k, v] of Object.entries(gfx)) if (!v) bad.push('Menu and Graphics: not ' + k);
      await sleep(400);
      bad.push(...(await check(page)).map(b => 'card: ' + b), ...errs);
      console.log(name, bad.length ? 'FAIL ' + bad.join('; ') : 'ok');
      failed += bad.length ? 1 : 0;
      await page.close();
    }
  } finally { await browser.close(); srv.close(); }

  // save slots: a new game in slot 2, a save loaded into it from text, back to slot 1, and the title says Continue
  const srv4 = await start(0), b4 = await chromium.launch();
  try {
    const page = await b4.newPage({ viewport: { width: 400, height: 860 } }), errs = [], bad = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.goto(srv4.url + '?coach=off');
    await waitFor(page, () => window.CG && CG.ready);
    await page.evaluate(() => { localStorage.clear(); document.getElementById('play').click(); });
    await waitFor(page, () => CG.town && CG.town.frames > 5);
    const tap = async sel => { await page.evaluate(q => { CG.play.openMenu(); setTimeout(() => document.querySelector(q).click(), 50); }, sel).catch(() => {}); };
    const inGame = () => waitFor(page, () => window.CG && CG.town && CG.town.frames > 5, 15000);
    await page.evaluate(() => { CG.game.town.coins = 12345; });
    await tap('#sheet [data-slot="2"]'); await sleep(500);
    if (!await inGame()) bad.push('slot 2 did not start');
    const s2 = await page.evaluate(() => ({ slot: localStorage.getItem('cg-slot'), coins: CG.game.town.coins }));
    if (s2.slot !== '2' || s2.coins > 1000) bad.push('slot 2 is not a new game (' + JSON.stringify(s2) + ')');
    // load slot 1's save into slot 2 through the paste box (two taps on Load save)
    await page.evaluate(async () => {
      CG.play.openMenu(); await new Promise(r => setTimeout(r, 50));
      const box = document.getElementById('saveIn'); box.value = localStorage.getItem('cg-save'); box.dispatchEvent(new Event('input'));
      document.getElementById('loadSave').click(); setTimeout(() => document.getElementById('loadSave').click(), 50);
    }).catch(() => {});
    await sleep(800);
    if (!await inGame()) bad.push('the loaded save did not start');
    const s3 = await page.evaluate(() => ({ slot: localStorage.getItem('cg-slot'), coins: CG.game.town.coins }));
    if (s3.slot !== '2' || s3.coins < 12000) bad.push('the pasted save did not load into slot 2 (' + JSON.stringify(s3) + ')');
    const junk = await page.evaluate(async () => {
      CG.play.openMenu(); await new Promise(r => setTimeout(r, 50));
      const box = document.getElementById('saveIn'); box.value = 'not a save'; document.getElementById('loadSave').click();
      const m = box.parentElement.querySelector('.warn'); return !!m && !m.hidden && /not a Copper Gulch save/.test(m.textContent);
    });
    if (!junk) bad.push('a bad save gave no plain message');
    await page.evaluate(() => { CG.game.town.coins = 777; });
    await tap('#sheet [data-slot="1"]'); await sleep(500);
    if (!await inGame()) bad.push('slot 1 did not start again');
    const s1 = await page.evaluate(() => ({ slot: localStorage.getItem('cg-slot'), coins: CG.game.town.coins, two: JSON.parse(localStorage.getItem('cg-save-2')).game.towns.gulch.coins }));
    if (s1.slot !== '1' || s1.coins < 12000 || Math.abs(s1.two - 777) > 200) bad.push('switching back lost a game (' + JSON.stringify(s1) + ')');
    bad.push(...(await check(page)).map(b => 'slots: ' + b));
    await page.evaluate(() => { CG.play.openMenu(); setTimeout(() => document.getElementById('toTitle').click(), 50); }).catch(() => {});
    await sleep(800); await waitFor(page, () => window.CG && CG.ready && document.getElementById('play'));
    const title = await page.evaluate(() => ({ play: document.getElementById('play').textContent, line: !document.getElementById('slotLine').hidden, game: !!CG.game }));
    if (title.play !== 'Continue' || !title.line || title.game) bad.push('the title did not offer Continue (' + JSON.stringify(title) + ')');
    bad.push(...errs);
    console.log('slots', bad.length ? 'FAIL ' + bad.join('; ') : 'ok');
    failed += bad.length ? 1 : 0;
  } finally { await b4.close(); srv4.close(); }

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
