// node tools/smoke.js: loads the game in headless Edge or Chrome at phone, landscape and desktop sizes and checks
// that it boots without errors, draws the 3D view, has no sideways scroll and no touch target under 30 px; then taps
// Play and checks the town the same way, opens a building card and buys a level with its button.
// Then it turns the server off and reloads, to prove the installed app runs offline.
// Prints one line per size ("phone ok") and exits non-zero on any failure.
import { start } from './serve.js';
import { chromium } from './cdp.js';
import { NODE_COST } from '../src/data/institutions.js';

const SIZES = { phone: [400, 860], land: [860, 400], desk: [1366, 800] };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitFor(page, expr, ms = 15000) {
  for (let t = 0; t < ms; t += 100) { if (await page.evaluate(expr).catch(() => false)) return true; await sleep(100); }
  return false;
}

/* With a card or sheet open: it never covers Pause, Hold waves or the coins, and its Build or Upgrade button is on
   screen inside it (Evaluation 2: in landscape a side card covered the coins, cut Hold waves and pushed Upgrade off). */
export async function uncovered(page) {
  return page.evaluate(() => {
    const bad = [], vis = n => n && !n.hidden && n.getClientRects().length, R = n => n.getBoundingClientRect();
    const hit = (a, b) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
    const panes = [...document.querySelectorAll('#card, .sheet')].filter(vis);
    for (const p of panes) {
      const r = R(p);
      for (const [name, sel] of [['Pause', '#pauseBtn'], ['Hold waves', '#holdWaves'], ['the coins', '.play .coins']]) {
        const n = document.querySelector(sel); if (vis(n) && hit(R(n), r)) bad.push((p.id === 'card' ? 'the card' : 'a sheet') + ' covers ' + name);
      }
      if (r.bottom > innerHeight + 1 || r.top < -1) bad.push((p.id === 'card' ? 'the card' : 'a sheet') + ' runs off the screen');
      // a sheet never shows a side button cut in half (review of 2026.11.19-6: the Perks sheet cut Perks and hid Menu)
      if (p.id === 'sheet') for (const n of document.querySelectorAll('.side .btn')) if (vis(n) && getComputedStyle(n).visibility !== 'hidden' && hit(R(n), r)) bad.push('a sheet cuts ' + n.textContent.trim());
    }
    const buy = document.querySelector('#card #buy'), card = document.getElementById('card');
    // a card at the bottom opens above the goods strip, so the counts stay in view (review of 2026.11.19-4)
    const strip = document.getElementById('goodsStrip');
    if (vis(card) && vis(strip) && hit(R(card), R(strip))) bad.push('the card covers the goods strip');
    for (const p of panes) if (p.id !== 'card' && vis(strip) && hit(R(p), R(strip))) bad.push('a sheet covers the goods strip'); // (review of 2026.11.19-7)
    // no level tag shows cut by a card, a sheet, the strip or the top bar
    { const boxes = [...panes, strip, ...document.querySelectorAll('.hud .hudleft, .hud .hudright')].filter(vis).map(R);
      for (const n of document.querySelectorAll('.tags .tag')) { if (!vis(n) || getComputedStyle(n).visibility === 'hidden' || document.documentElement.classList.contains('flat')) continue; const r = R(n); if (boxes.some(b => hit(r, b))) bad.push('a level tag is cut: ' + n.textContent); } }
    // and beside it every good's name shows whole (review of 2026.11.19-6: "Copper ..." beside a side card)
    if (vis(strip)) for (const n of strip.querySelectorAll('.gname')) if (n.scrollWidth > n.clientWidth + 1) bad.push('the goods strip cuts ' + n.textContent);
    if (vis(buy) && vis(card)) { const b = R(buy), c = R(card); if (b.top < c.top - 1 || b.bottom > c.bottom + 1 || b.bottom > innerHeight) bad.push('the card\'s ' + buy.textContent.split(' ')[0] + ' button is out of view'); }
    return bad;
  });
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
    else if (CG.map) { if (CG.map.frames < 3) bad.push('map not drawing'); }
    else if (CG.game) bad.push('no 3D town');
    else if (!document.getElementById('title')) bad.push('no title');
    else if (!CG.scene) bad.push('no 3D view');
    else if (CG.scene.frames < 3) bad.push('3D view not drawing');
    return bad;
  });
}

/* Click the middle of every tower pad and plot with real input, in three camera views; returns { tried, skipped, miss }. */
export async function tapEverything(page) {
  const out = { tried: 0, skipped: 0, miss: [] }, wait = ms => new Promise(r => setTimeout(r, ms));
  const views = [['home', () => { CG.town.rig.reset && CG.town.rig.reset(); }], ['turned', () => { const r = CG.town.rig; r.t.yaw += 1.1; r.c.yaw = r.t.yaw; }], ['zoomed', () => { const r = CG.town.rig; r.t.dist *= .6; r.c.dist = r.t.dist; }]];
  await page.evaluate(() => { const n = document.getElementById('newsOk'); if (n) n.click(); for (let i = 0; i < 9; i++) { const c = document.getElementById('coachOk'); if (c && !c.closest('[hidden]')) c.click(); } });
  for (const [name, fn] of views) {
    await page.evaluate(`(${fn})()`); await wait(900);
    // the camera eases toward its target (and refits after a turn of the screen): wait until it holds still, or a tap
    // aimed from one frame lands a few pixels off on the next (the top edge of a landscape screen moved most)
    await page.evaluate(async () => {
      const r = CG.town.rig, key = () => [r.c.x, r.c.z, r.c.dist, r.c.yaw, r.c.pitch].map(v => v.toFixed(4)).join();
      for (let i = 0, last = key(); i < 60; i++) { await new Promise(res => setTimeout(res, 50)); const k = key(); if (k === last) break; last = k; }
    });
    const list = await page.evaluate(() => {
      const B = CG.game.town.def.board, t = CG.game.town;
      return [...B.spots.map((_, i) => ({ id: 'spot:' + i, spot: i, tower: t.towers.some(x => x.spot === i) })), ...Object.keys(B.plots).map(id => ({ id, plot: id }))];
    });
    for (const o of list) {
      const p = await page.evaluate(async o => {
        CG.play.close();
        for (let k = 0; k < 2; k++) await new Promise(r => requestAnimationFrame(r)); // the tags a card covered show again on the next frame
        // a card that covered its object slid the camera, and closing it slides back: aim once it holds still (a tap aimed
        // mid-slide landed on the next pad at the top edge of a landscape screen with the wider card of 2026.11.20-4)
        { const r = CG.town.rig, key = () => [r.c.x, r.c.z, r.c.dist, r.c.yaw, r.c.pitch].map(v => v.toFixed(4)).join();
          for (let i = 0, last = key(); i < 40; i++) { await new Promise(res => setTimeout(res, 50)); const k = key(); if (k === last) break; last = k; } }
        const B = CG.game.town.def.board, [x, z] = o.plot ? B.plots[o.plot] : B.spots[o.spot];
        const q = CG.town.projectPoint(x, o.plot ? .5 : o.tower ? .6 : .1, z);
        if (!q) return { skip: 'behind' };
        const cv = document.getElementById('view').getBoundingClientRect(), X = q.x + cv.left, Y = q.y + cv.top;
        if (X < 4 || Y < 4 || X > innerWidth - 4 || Y > innerHeight - 4) return { skip: 'off screen' };
        const at = document.elementFromPoint(X, Y);
        if (at && at.id !== 'view') {
          const tag = at.closest('.tag');
          if (tag && tag.dataset.plot === o.plot) return { x: X, y: Y };
          if (at.closest('button, .card, .sheet, .coach, .news')) return { skip: 'under ' + (at.closest('button') ? 'a button' : 'a panel') };
          // a box the player can see (a panel with a background) may cover the map; an invisible one may not
          for (let n = at; n && n.id !== 'app' && n !== document.body; n = n.parentElement) { const bg = getComputedStyle(n).backgroundColor, al = bg.startsWith('rgba') ? parseFloat(bg.split(',')[3]) : bg === 'transparent' ? 0 : 1; if (al > 0) return { skip: 'under a panel' }; }
          return { box: (at.className || at.tagName) + '' };
        }
        return { x: X, y: Y };
      }, o);
      if (p.skip) { out.skipped++; continue; }
      if (p.box) { out.miss.push(name + ' view: ' + o.id + ' is under a HUD box that takes taps (' + p.box + ')'); continue; }
      for (const type of ['mousePressed', 'mouseReleased']) await page.cdp('Input.dispatchMouseEvent', { type, x: p.x, y: p.y, button: 'left', clickCount: 1 });
      await wait(60);
      const got = await page.evaluate(() => CG.play.current());
      out.tried++;
      if (got !== o.id) out.miss.push(name + ' view: a tap on ' + o.id + ' at ' + Math.round(p.x) + ',' + Math.round(p.y) + ' opened ' + got);
    }
  }
  await page.evaluate(() => { CG.play.close(); CG.town.rig.reset && CG.town.rig.reset(); }); await wait(600);
  return out;
}

/* The place bar (name, Map, back button) as the test sees it. */
const placeBar = page => page.evaluate(() => {
  const bar = document.getElementById('placeBar'), r = bar.getBoundingClientRect(), bk = document.getElementById('backBtn'), mp = document.getElementById('mapBtn');
  const kids = [...bar.children].filter(n => !n.hidden).map(n => n.getBoundingClientRect());
  return { name: bar.querySelector('.townname').textContent, map: !mp.hidden, back: bk.hidden ? '' : bk.textContent, label: bk.getAttribute('aria-label'), dot: bk.classList.contains('dot'),
    oneRow: kids.every(k => Math.abs(k.top + k.height / 2 - kids[0].top - kids[0].height / 2) < 3), inside: r.left >= 0 && r.right <= innerWidth + .5, big: [bk, mp].every(b => b.hidden || b.getBoundingClientRect().height >= 30),
    whole: [bar.querySelector('.townname'), bk].every(n => n.hidden || n.scrollWidth <= n.clientWidth + 1), // no name cut short
    canvases: document.querySelectorAll('canvas#view').length, active: CG.game.active };
});
async function run() {
  const srv = await start(0), browser = await chromium.launch();
  let failed = 0;
  try {
    for (const [name, [width, height]] of Object.entries(SIZES)) {
      const page = await browser.newPage({ viewport: { width, height } }), errs = [];
      page.on('pageerror', e => errs.push(e.message));
      page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
      await page.goto(srv.url + '?coach=off&start=gulch');
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
      // a tower card with its damage opened up keeps Upgrade in view and clears Pause, Hold waves and the coins
      await page.evaluate(async () => { const t = CG.game.town, tw = t.towers.find(x => x.spot === 3); tw.level = 3; for (const g of ['timber', 'ore', 'copper', 'bricks', 'tools', 'planks', 'clay']) t.goods[g] = Math.max(t.goods[g] || 0, 4321); CG.play.close(); CG.play.openSpot(3); await new Promise(r => setTimeout(r, 150)); const b = document.querySelector('#card [data-why="dmg"]'); if (b) b.click(); await new Promise(r => setTimeout(r, 400)); });
      bad.push(...(await uncovered(page)).map(b => 'tower card: ' + b));
      await page.evaluate(async () => { CG.play.close(); CG.play.open('camp'); await new Promise(r => setTimeout(r, 150)); const b = document.querySelector('#card .stat'); if (b) b.click(); await new Promise(r => setTimeout(r, 400)); });
      bad.push(...(await uncovered(page)).map(b => 'building card: ' + b));
      await page.evaluate(() => CG.play.close());
      // Call now is never locked (owner rule): with the whole wait still ahead it is lit and starts the wave, paying for the wait
      const callGate = await page.evaluate(async () => {
        const t = CG.game.town, ws = t.waves, keep = JSON.stringify(ws), bw = t.bestWave, b = document.getElementById('callWave');
        CG.town.pause('smoke', true); t.bestWave = Math.max(1, bw); Object.assign(ws, { phase: 'break', timer: 50, queue: [], foes: [] });
        await new Promise(r => setTimeout(r, 400));
        const open = !b.hidden && !b.disabled, c0 = t.coins; b.click();
        const went = ws.phase === 'wave', paid = t.coins > c0;
        Object.assign(t.waves, JSON.parse(keep)); t.bestWave = bw; CG.town.pause('smoke', false);
        return { open, went, paid };
      });
      if (!callGate.open || !callGate.went || !callGate.paid) bad.push('Call now was not open from the start of the wait: ' + JSON.stringify(callGate));
      // boss waves are gates (owner rule): a boss that gets through in the town in play shows the lost card, drops the
      // town back and holds its waves; Got it closes the card
      const gate = await page.evaluate(async () => {
        const m = await import(new URL('src/core/defense.js', location.href).href);
        const t = CG.game.town, keep = JSON.stringify(t.waves), w = t.wave, bw = t.bestWave, coins = t.coins, br = t.breaches;
        CG.town.pause('smoke', true); t.wave = 10; t.bestWave = 9; t.coins = 400; t.recent = 400;
        m.fall(CG.game, t, 'boss'); await new Promise(r => setTimeout(r, 300));
        const c = document.getElementById('lostCard'), out = {
          card: !!c && c.getBoundingClientRect().width > 0, text: c ? c.textContent : '', back: t.wave === 8, held: !!t.waves.autoHold,
          resume: document.getElementById('holdWaves').textContent === 'Resume waves',
        };
        if (c) document.getElementById('lostOk').click();
        await new Promise(r => setTimeout(r, 100));
        out.closed = !document.getElementById('lostCard');
        Object.assign(t.waves, JSON.parse(keep), { hold: false, autoHold: false }); delete t.lost;
        Object.assign(t, { wave: w, bestWave: bw, coins, breaches: br }); CG.town.pause('smoke', false);
        return out;
      });
      if (!gate.card || !/got through. You dropped back/.test(gate.text) || !gate.back || !gate.held || !gate.resume || !gate.closed) bad.push('a boss that got through did not lose the wave with its card: ' + JSON.stringify(gate));
      // the tower reserve: the camp card says what it keeps and its switch turns it off and on; a short tower card
      // names the good, the amount and the building that makes it
      const reserve = await page.evaluate(async () => {
        const wait = ms => new Promise(r => setTimeout(r, ms)), t = CG.game.town, out = {};
        CG.play.open('camp'); await wait(100);
        out.says = /Keep for towers · On/.test(document.getElementById('card').textContent);
        document.getElementById('keepTowers').click(); await wait(50);
        out.off = !!t.reserveOff.timber && !t.keep.timber && /Off/.test(document.getElementById('keepTowers').textContent);
        document.getElementById('keepTowers').click(); await wait(50);
        out.on = !t.reserveOff.timber && t.keep.timber > 0;
        CG.town.pause('smoke', true); t.goods.timber = 0; CG.play.openSpot(3); await wait(400); // paused, so the camp makes none meanwhile
        const sh = document.querySelector('#card .short, #card .soon'), low = [...document.querySelectorAll('#card .costrow .need.low')].map(n => n.textContent);
        out.short = !!sh && /Lumber Camp|enough timber in about/.test(sh.textContent); // a wait under 20 s has no advice
        // "You will have enough timber in about ..." is good news: plain ink, not red (#f07067)
        out.calm = !!sh && (/^You will have enough/.test(sh.textContent) === sh.classList.contains('soon')) && (!sh.classList.contains('soon') || !/240, 112, 103/.test(getComputedStyle(sh).color));
        out.haveNeed = low.some(x => /^Timber0 \/ \d+$/.test(x)); // the cost says have / need, red when short
        // coins too, kept up with the purse in place (review 2026-11-18): short shows red, enough shows plain
        // (the card is rebuilt when the coins cross the price, so the cell is looked up again each time)
        const cell = () => document.querySelector('#card .costrow .coinneed'), c0 = cell(), need = c0 ? +c0.dataset.need : 0, had = CG.game.shared.purse.coins;
        CG.game.shared.purse.coins = Math.max(0, need - 1); await wait(450);
        let cn = cell(); out.coinShort = !!cn && cn.classList.contains('low') && / \/ [\d.KM]+ coins$/.test(cn.textContent);
        CG.game.shared.purse.coins = need + 5; await wait(450);
        cn = cell(); out.coinOk = !!cn && !cn.classList.contains('low') && / \/ [\d.KM]+ coins$/.test(cn.textContent);
        CG.game.shared.purse.coins = had;
        CG.town.pause('smoke', false); CG.play.close();
        return out;
      });
      for (const [k, v] of Object.entries(reserve)) if (!v) bad.push('tower reserve: not ' + k);
      // the goods strip (owner rule): on screen with a count for each good, following the stock, and a tap opens Goods there
      const strip = await page.evaluate(async () => {
        const wait = ms => new Promise(r => setTimeout(r, ms)), t = CG.game.town, s = document.getElementById('goodsStrip'), out = {};
        const selling = t.sell.timber; t.sell.timber = false; t.goods.timber = Math.ceil((t.keep || {}).timber || 0) + 37; await wait(450); // more than the towers keep, so its price rows show // held, so the count stays put while it is read
        const b = s && s.getBoundingClientRect(), chip = s && s.querySelector('[data-good="timber"]');
        out.shown = !!s && !s.hidden && b.width > 0 && b.left >= 0 && b.right <= innerWidth && b.bottom <= innerHeight;
        out.counts = !!chip && Math.abs(+chip.querySelector('b').textContent - t.goods.timber) <= 4 && [...s.querySelectorAll('.goodchip b')].every(n => /^\d/.test(n.textContent));
        out.texts = s ? [...s.querySelectorAll('.goodchip')].map(n => n.dataset.good + '=' + n.querySelector('b').textContent).join(' ') + ' have ' + t.goods.timber : 'none';
        out.size = !!chip && chip.getBoundingClientRect().height >= 30;
        out.noScroll = document.documentElement.scrollWidth <= innerWidth;
        chip.click(); await wait(400);
        const f = document.querySelector('.sheet .goods .focus');
        out.opens = !!f && f.dataset.why === 'timber' && f.getAttribute('aria-expanded') === 'true' && !!f.querySelector('.explain, p.uses'); // opened with its price explained
        CG.play.sheets.close(); if (selling === undefined) delete t.sell.timber; else t.sell.timber = selling;
        return out;
      });
      // live numbers never change the size or place of anything (owner rule): grow every good, the coins, the coin rate,
      // the wave number and the countdown from one digit to millions, and every HUD cell must keep its box
      const still = await page.evaluate(async () => {
        const wait = ms => new Promise(r => setTimeout(r, ms)), t = CG.game.town, ws = t.waves, out = { moved: [] }, { fmtLive } = await import('./src/ui/format.js');
        const keep = { goods: { ...t.goods }, sell: { ...t.sell }, coins: t.coins, wave: t.wave, ws: JSON.stringify(ws) };
        CG.town.pause('smoke', true);
        const cells = () => [...document.querySelectorAll('#goodsStrip .goodchip, .hud .coins, #wave, #waveBtn, #vaultBtn, #callWave, #pauseBtn, #holdWaves')];
        const boxes = () => cells().map(n => { const r = n.getBoundingClientRect(); return [n.id || n.dataset.good || n.className, Math.round(r.left * 2) / 2, Math.round(r.width * 2) / 2, Math.round(r.top * 2) / 2]; });
        const inc = document.querySelector('.hud .coins .inc'), winfo = document.querySelector('#wave .winfo');
        Object.assign(ws, { phase: 'break', timer: 30, queue: [], foes: [] });
        let first = null, painted = true;
        const steps = [[1, 1, 'in 9s'], [9, 9, 'in 44s'], [37, 10, 'On hold'], [99, 12, 'Fighting'], [999, 40, 'in 58s'], [1000, 99, 'Fighting'],
          [4840, 99, 'in 1s'], [9999, 9, 'in 30s'], [56789, 10, 'On hold'], [99999, 100, 'in 9s'], [100000, 1, 'in 44s'], [999999, 50, 'in 7s'], [1.25e6, 99, 'in 120s'], [9.99e8, 10, 'in 3s']];
        for (const [n, w, info] of steps) {
          for (const g of Object.keys(t.goods)) { t.goods[g] = n; t.sell[g] = false; }
          t.coins = n * 10; t.wave = w;
          await wait(450); // the HUD repaints 5 times a second
          painted = painted && document.querySelector('#goodsStrip .goodchip b').textContent === fmtLive(n);
          for (const r of ['+0/s', '+8.1/s', '+999/s', '+99.9K/s', '+1.00M/s']) {
            inc.textContent = r; winfo.textContent = info;
            const b = boxes(); first ??= b;
            b.forEach((x, i) => { const f0 = first[i]; if (!f0 || f0[0] !== x[0] || f0[1] !== x[1] || f0[2] !== x[2] || f0[3] !== x[3]) out.moved.push(x[0] + ' at ' + n + '/' + w + '/' + r + ': ' + JSON.stringify(f0) + ' -> ' + JSON.stringify(x)); });
          }
        }
        out.painted = painted;
        // a wave on the road hides Call now in its place: the wave bar keeps its width (owner, 2026-11-19)
        const chip = () => Math.round(document.getElementById('wave').getBoundingClientRect().width);
        const w0 = chip(); Object.assign(ws, { phase: 'wave', queue: ['raider', 'raider'], foes: [], type: 'mixed', timer: 99, age: 0 }); await wait(450);
        out.chip = getComputedStyle(document.getElementById('callWave')).visibility === 'hidden' && document.querySelector('#wave .winfo').textContent === 'Fighting' && Math.abs(chip() - w0) <= 1 ? true : 'break ' + w0 + ' wave ' + chip();
        // the wave number opens the raiders card
        document.getElementById('waveBtn').click(); await wait(300);
        out.waveCard = !document.getElementById('sheet').hidden && document.getElementById('sheet').dataset.id === 'wave' && / left./.test(document.getElementById('sheet').textContent);
        CG.play.sheets.close();
        Object.assign(t.goods, keep.goods); t.sell = keep.sell; t.coins = keep.coins; t.wave = keep.wave; Object.assign(t.waves, JSON.parse(keep.ws));
        CG.town.pause('smoke', false); await wait(300);
        out.moved = out.moved.slice(0, 4);
        return out;
      });
      if (!still.painted) bad.push('live numbers: the HUD did not repaint the goods strip');
      if (still.chip !== true) bad.push('the wave chip changed width when a wave started: ' + still.chip);
      if (!still.waveCard) bad.push('the wave number did not open the raiders card');
      for (const m of still.moved) bad.push('live numbers: a HUD cell moved or changed size: ' + m);
      // every object opens with one tap (owner rule): a real click (browser hit testing, so a HUD box over the map counts)
      // on the middle of every pad and plot, in the home view, turned and zoomed in, must open that object's card. A
      // middle under a real button or off screen is skipped (the player moves the map), and the skips are counted.
      const taps = await tapEverything(page);
      for (const m of taps.miss.slice(0, 5)) bad.push('tap: ' + m);
      if (taps.tried < 20) bad.push('tap: only ' + taps.tried + ' objects could be tapped (' + taps.skipped + ' covered)');
      // time away counts when the app was only in the background (owner rule), unless the player pressed Pause
      const away = await page.evaluate(async () => {
        const wait = ms => new Promise(r => setTimeout(r, ms)), g = CG.game, t = g.town, out = {};
        const snap = () => ({ coins: t.lifetime, timber: t.made.timber || 0, sold: Object.values(g.shared.market.sold).reduce((a, b) => a + b, 0), steps: g.stats.steps, price: JSON.stringify(g.shared.market.rate) });
        CG.town.pause('player', true); CG.away.hide(); CG.away.since(Date.now() - 600e3);
        let a = snap(); CG.away.show(); let b = snap();
        out.pauseKept = b.steps === a.steps && b.coins === a.coins;
        CG.town.pause('player', false); await wait(100);
        CG.away.hide(); CG.away.since(Date.now() - 600e3);
        a = snap(); const r = CG.away.show(); b = snap();
        out.caughtUp = !!r && r.seconds >= 599 && b.steps - a.steps >= 600 * 4 * .9;
        out.coins = b.coins > a.coins;
        out.goods = b.timber > a.timber;
        out.market = b.sold > a.sold && b.price !== a.price;
        // it goes to the front of the toast line: look for it for up to 6 s
        const re = /^Welcome back\. While you were away, your towns earned [\d.,KM]+ coins and sold [\d.,KM]+ goods\.$/; let seen = [];
        for (let i = 0; i < 30 && !seen.some(x => re.test(x)); i++) { await wait(200); seen = [...document.querySelectorAll('.toast')].map(n => n.textContent); }
        out.toast = seen.some(x => re.test(x));
        return out;
      });
      for (const [k, v] of Object.entries(away)) if (!v) bad.push('time in the background: not ' + k);
      for (const [k, v] of Object.entries(strip)) if (!v) bad.push('goods strip: not ' + k + (k === 'counts' ? ' (' + strip.texts + ')' : ''));
      // a foreman: the camp card offers one at level 10, hiring it makes the camp buy levels by itself, and its switch stops that
      const boss = await page.evaluate(async () => {
        const wait = ms => new Promise(r => setTimeout(r, ms)), t = CG.game.town, out = {};
        t.buildings.camp = 9; CG.play.open('camp'); await wait(100);
        out.notYet = !document.getElementById('hireForeman');
        t.buildings.camp = 10; t.coins = 1e5; CG.play.open('camp'); await wait(100);
        const h = document.getElementById('hireForeman'); out.offered = !!h && !h.disabled; h.click(); await wait(400);
        out.hired = t.foremen.camp === true && t.level('camp') > 10;
        document.getElementById('foremanSwitch').click(); await wait(50);
        const L = t.level('camp'); await wait(500);
        out.off = t.foremen.camp === false && t.level('camp') === L && /Off/.test(document.getElementById('foremanSwitch').textContent);
        // working again on a flooded good nobody is short of: the card says it waits
        document.getElementById('foremanSwitch').click(); CG.game.shared.market.rate.timber = 1e5; t.goods.timber = 1e6; const L2 = t.level('camp'); await wait(500);
        out.waits = /Foreman paused while the timber price is low./.test(document.getElementById('card').textContent) && t.level('camp') === L2;
        t.goods.timber = 50;
        CG.play.close();
        return out;
      });
      for (const [k, v] of Object.entries(boss)) if (!v) bad.push('Foreman: not ' + k);
      // Pause stops the whole game and Resume starts it again; Hold waves keeps the next wave back until released
      const ctl = await page.evaluate(async () => {
        const wait = ms => new Promise(r => setTimeout(r, ms)), t = CG.game.town, out = {};
        document.getElementById('pauseBtn').click(); const t0 = t.t; await wait(900);
        out.paused = t.t === t0 && !document.getElementById('pausedBanner').hidden;
        document.getElementById('pauseBtn').click(); await wait(900);
        out.resumed = t.t > t0 && document.getElementById('pausedBanner').hidden;
        Object.assign(t.waves, { phase: 'break', timer: .5, queue: [], foes: [], hold: false, autoHold: false }); // time away above may have held them
        document.getElementById('holdWaves').click(); await wait(1500);
        out.held = t.waves.phase === 'break' && document.getElementById('holdWaves').textContent === 'Resume waves';
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
        t.coins = 1e6; Object.assign(t.goods, { ore: 200, copper: 200, bricks: 200, tools: 200, planks: 200, clay: 200 }); t.sell = { ore: false, copper: false, bricks: false, tools: false, planks: false, clay: false };
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
      // framing: at home every stone pad is at least 30 px across; with its card open, a selected tower (and a far
      // mortar pit) sits on screen, below the top bar and clear of the card; closing the card slides the camera back
      const frame = await page.evaluate(async () => {
        const wait = ms => new Promise(r => setTimeout(r, ms)), rig = CG.town.rig, t = CG.game.town, B = t.def.board, out = { pad: 0, bad: [] };
        rig.reset(); await wait(1500); out.pad = Math.round(rig.padPx());
        const coins = t.coins, timber = t.goods.timber; t.coins = 1e5; t.goods.timber = 500;
        const spot = 11; if (!t.towers.some(x => x.spot === spot)) { CG.play.openSpot(spot); const b = document.querySelector('#card .build[data-kind="crossbow"]'); if (b) b.click(); }
        CG.play.close(); t.coins = coins; t.goods.timber = timber; rig.reset(); await wait(1200);
        const home = { x: rig.c.x, z: rig.c.z };
        for (const s of [spot, B.far + 3]) {
          CG.play.openSpot(s); await wait(1600);
          const [x, z] = B.spots[s], p = CG.town.projectPoint(x, .3, z), c = document.getElementById('card').getBoundingClientRect();
          const under = p && p.x > c.left && p.x < c.right && p.y > c.top && p.y < c.bottom;
          const off = !p || p.x < 0 || p.x > innerWidth || p.y < rig.view.top || p.y > innerHeight;
          if (under || off) out.bad.push('spot ' + s + (under ? ' under its card' : ' off screen') + ' at ' + (p ? Math.round(p.x) + ',' + Math.round(p.y) : '-'));
          CG.play.close(); await wait(1600);
          const back = Math.hypot(rig.c.x - home.x, rig.c.z - home.z);
          if (back > .15) out.bad.push('the camera did not slide back after spot ' + s + ' (' + back.toFixed(2) + ' away)');
        }
        return out;
      });
      if (!(frame.pad >= 30)) bad.push('a stone pad is ' + frame.pad + ' px across at home (needs 30)');
      bad.push(...frame.bad);
      // the camera moves the map under the fingers: after a pan, a twist-and-pinch, a wheel zoom and a Shift-drag turn,
      // the ground that was grabbed is back under the fingers (within 4 px)
      const cam = await page.evaluate(async () => {
        const wait = ms => new Promise(r => setTimeout(r, ms)), cv = document.getElementById('view'), rig = CG.town.rig, W = innerWidth, H = innerHeight;
        const ev = (type, id, x, y, o = {}) => cv.dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, bubbles: true, isPrimary: id === 1, pointerType: 'touch', ...o }));
        const off = (g, x, y) => { const p = CG.town.projectPoint(g.x, 0, g.z); return p ? Math.hypot(p.x - x, p.y - y) : 999; };
        const out = {}; rig.reset(); await wait(1500);
        // pan
        let a = [W * .45, H * .55], A = rig.ground(...a);
        ev('pointerdown', 1, ...a); for (let i = 1; i <= 6; i++) { ev('pointermove', 1, a[0] + i * 10, a[1] + i * 8); await wait(16); }
        await wait(50); out.pan = off(A, a[0] + 60, a[1] + 48); ev('pointerup', 1, a[0] + 60, a[1] + 48); await wait(400);
        // twist and pinch: two fingers turn a quarter of the way round and spread apart
        a = [W * .38, H * .5]; let b = [W * .62, H * .5]; A = rig.ground(...a); const B = rig.ground(...b);
        ev('pointerdown', 1, ...a); ev('pointerdown', 2, ...b);
        const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], r0 = (b[0] - a[0]) / 2; let ea, eb;
        for (let i = 1; i <= 8; i++) {
          const ang = i / 8 * .7, r = r0 * (1 + i / 8 * .35);
          ea = [m[0] - Math.cos(ang) * r, m[1] - Math.sin(ang) * r]; eb = [m[0] + Math.cos(ang) * r, m[1] + Math.sin(ang) * r];
          ev('pointermove', 1, ...ea); ev('pointermove', 2, ...eb); await wait(16);
        }
        await wait(50); out.twistA = off(A, ...ea); out.twistB = off(B, ...eb); out.turned = Math.abs(rig.c.yaw - rig.home.yaw) > .3;
        ev('pointerup', 2, ...eb); ev('pointerup', 1, ...ea); await wait(400);
        // wheel zoom toward the pointer
        a = [W * .3, H * .4]; A = rig.ground(...a); const d0 = rig.c.dist;
        cv.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, clientX: a[0], clientY: a[1], bubbles: true, cancelable: true }));
        await wait(50); out.wheel = off(A, ...a); out.zoomed = rig.c.dist < d0;
        // Shift-drag turns the map around the point under the pointer, and dragging right moves what is above it right
        a = [W * .5, H * .55]; A = rig.ground(...a); const N = rig.ground(a[0], a[1] - H * .12), n0 = CG.town.projectPoint(N.x, 0, N.z);
        ev('pointerdown', 1, ...a, { shiftKey: true, pointerType: 'mouse' });
        for (let i = 1; i <= 6; i++) { ev('pointermove', 1, a[0] + i * 12, a[1], { shiftKey: true, pointerType: 'mouse' }); await wait(16); }
        await wait(50); out.turnPivot = off(A, ...a); const n1 = CG.town.projectPoint(N.x, 0, N.z); out.turnRight = n1.x > n0.x + 5;
        ev('pointerup', 1, a[0] + 72, a[1], { pointerType: 'mouse' });
        rig.reset(); await wait(1200);
        return out;
      });
      for (const k of ['pan', 'twistA', 'twistB', 'wheel', 'turnPivot']) if (!(cam[k] <= 4)) bad.push('camera: ' + k + ' off by ' + Math.round(cam[k]) + ' px');
      for (const k of ['turned', 'zoomed', 'turnRight']) if (!cam[k]) bad.push('camera: not ' + k);
      // mortar pits: a closed pit's card says what it is for; once open, a Mortar is built there through the card,
      // fires a shell, and its selection shows the dead zone
      const mortar = await page.evaluate(async () => {
        const wait = ms => new Promise(r => setTimeout(r, ms)), t = CG.game.town, pit = t.def.board.far, out = {};
        delete t.flags['open:mortar']; CG.play.openSpot(pit); await wait(100);
        out.closedText = /build a Mortar here at wave|build it at wave/.test(document.getElementById('card').textContent) && !document.querySelector('#card .build');
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
      // buttons that come out when useful (src/core/reveal.js): Pause, Hold waves and Menu always; Goods with a second
      // good, carrying a dot until the list is opened; toasts one at a time, never the same line twice
      const reveal = await page.evaluate(async () => {
        const wait = ms => new Promise(r => setTimeout(r, ms)), g = CG.game, t = g.town, btn = document.getElementById('goodsBtn'), out = {};
        const seen = g.shared.seen || (g.shared.seen = {}), was = seen.goods, kept = { ...t.buildings };
        delete seen.goods; t.buildings = { camp: Math.max(1, kept.camp || 0) }; await wait(500);
        out.always = ['pauseBtn', 'holdWaves', 'menuBtn'].every(id => document.getElementById(id).offsetParent !== null);
        out.hiddenFirst = btn.hidden;
        for (const k of Object.keys(t.flags)) if (k.startsWith('listed:')) delete t.flags[k];
        t.buildings.saw = 1; await wait(500);
        out.shows = !btn.hidden && btn.offsetParent !== null && btn.classList.contains('dot');
        btn.click(); await wait(300); out.dotGone = !btn.classList.contains('dot');
        document.getElementById('sheetClose').click();
        t.buildings = kept; if (was) seen.goods = was;
        const { toast } = await import(new URL('src/ui/play.js', location.href));
        for (const n of [1, 2, 3]) toast('Smoke line', 800);
        toast('Smoke line two', 800); await wait(100);
        out.oneAtATime = document.querySelectorAll('.toast').length === 1;
        await wait(1800); out.queued = /Smoke line two/.test(document.querySelector('.toast')?.textContent || '');
        return out;
      });
      for (const [k, v] of Object.entries(reveal)) if (!v) bad.push('buttons and toasts: not ' + k);
      // a toast never covers the top bar (Pause, the wave row, the coins) or an open sheet: with no room it waits until the
      // sheet closes (review of 2026.11.19-5: a toast over Pause on the Perks sheet)
      for (const open of ['openPerks', 'openMenu', 'openGoods']) { // every side button shows whole or not at all under a sheet
        await page.evaluate(o => { CG.play[o](); }, open); await sleep(700);
        bad.push(...(await uncovered(page)).map(b => open + ': ' + b));
        await page.evaluate(() => document.getElementById('sheetClose').click()); await sleep(200);
      }
      const overSheet = await page.evaluate(async () => {
        const wait = ms => new Promise(r => setTimeout(r, ms)), { toast } = await import(new URL('src/ui/play.js', location.href));
        for (let i = 0; i < 40 && document.querySelector('.toast'); i++) await wait(100); // the lines before it go first
        CG.play.openPerks(); await wait(300);
        toast('Smoke sheet line.', 1200);
        let t = null; for (let i = 0; i < 20 && !t; i++) { await wait(100); t = [...document.querySelectorAll('.toast')].find(n => n.textContent === 'Smoke sheet line.'); }
        if (!t) return 'no toast';
        const hit = (a, r) => a.left < r.right && a.right > r.left && a.top < r.bottom && a.bottom > r.top;
        const covers = t.classList.contains('wait') ? [] : [...document.querySelectorAll('.hud .hudleft, .hud .hudright, .sheet, #pauseBtn, #holdWaves, #goodsStrip')].filter(n => { const r = n.getBoundingClientRect(); return r.width && hit(t.getBoundingClientRect(), r); }).map(n => n.id || n.className);
        const waited = t.classList.contains('wait');
        document.getElementById('sheetClose').click(); await wait(600);
        if (covers.length) return 'covers ' + covers.join(', ');
        if (waited && (!t.isConnected || t.classList.contains('wait'))) return 'did not show once the sheet closed';
        return '';
      });
      if (overSheet) bad.push('a toast over the Perks sheet: ' + overSheet);
      // a toast in the town covers no building's level tag: the tags under it hide until it goes (review of 2026.11.19-6)
      const onTag = await page.evaluate(async () => {
        const wait = ms => new Promise(r => setTimeout(r, ms)), { toast } = await import(new URL('src/ui/play.js', location.href));
        for (let i = 0; i < 40 && document.querySelector('.toast'); i++) await wait(100);
        toast('Smoke tag line.', 1500); await wait(500);
        const t = [...document.querySelectorAll('.toast')].find(n => n.textContent === 'Smoke tag line.'); if (!t) return 'no toast';
        if (t.classList.contains('wait')) return '';
        const a = t.getBoundingClientRect();
        const under = [...document.querySelectorAll('.tags .tag')].filter(n => { const r = n.getBoundingClientRect(); return r.width && !n.hidden && getComputedStyle(n).visibility !== 'hidden' && a.left < r.right && a.right > r.left && a.top < r.bottom && a.bottom > r.top; }).map(n => n.textContent);
        await wait(2400);
        const left = document.querySelectorAll('.tag.undertoast').length;
        return (under.length ? 'covers ' + under.join(', ') : '') + (left ? ' tags stay hidden after it' : '');
      });
      if (onTag) bad.push('a toast over level tags: ' + onTag);
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
      // the sheet's counts read as the strip's in every frame (review of 2026.11.19-7: 46 copper ore beside the strip's 45)
      const goodsDiff = await page.evaluate(async () => {
        const wait = ms => new Promise(r => setTimeout(r, ms)), out = [];
        for (let k = 0; k < 12; k++) {
          await new Promise(r => requestAnimationFrame(r));
          for (const row of document.querySelectorAll('#sheet [data-why]')) {
            const g = row.dataset.why, chip = document.querySelector('#goodsStrip .goodchip[data-good="' + g + '"] b'), line = row.querySelector('span');
            if (!chip || !line) continue;
            const a = line.textContent.split(' in stock')[0], b = chip.textContent;
            if (a !== b) out.push(g + ' ' + a + ' / ' + b);
          }
          await wait(170);
        }
        return [...new Set(out)].slice(0, 4).join(', ');
      });
      if (goodsDiff) bad.push('the Goods sheet and the strip disagree: ' + goodsDiff);
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
      // Sound: a tap starts the music, the Menu's Music and Sound sliders are kept under cg-audio, and the app in the
      // background suspends it all (src/audio/audio.js)
      await page.evaluate(() => document.getElementById('menuBtn').click()); await sleep(350);
      const snd = await page.evaluate(async () => {
        const wait = ms => new Promise(r => setTimeout(r, ms)), out = {}, A = CG.audio;
        document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); await wait(700);
        const st = A.state();
        out.started = st.ctx === 'running' && st.bars > 0 && ['town', 'wave', 'boss'].includes(st.mood);
        const m = document.getElementById('musicVol'), so = document.getElementById('soundVol');
        out.sliders = !!(m && so) && m.closest('.sec').querySelector('h3').textContent === 'Volume';
        const row = m && m.closest('.slider'), r = row && row.getBoundingClientRect();
        out.fits = !!r && r.left >= 0 && r.right <= innerWidth + .5 && r.height >= 30;
        const set = (el, v) => { el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
        set(m, 0); set(so, 35);
        const kept = JSON.parse(localStorage.getItem('cg-audio') || '{}');
        out.kept = kept.music === 0 && Math.abs(kept.sound - .35) < 1e-9 && A.get('music') === 0;
        out.offLabel = m.parentElement.querySelector('.val').textContent === 'Off' && so.parentElement.querySelector('.val').textContent === '35%';
        const b0 = A.state().bars; await wait(900); out.musicOff = A.state().bars === b0;
        set(m, 50); set(so, 60); await wait(700);
        out.back = A.state().bars > b0;
        // the app goes to the background and comes back
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        document.dispatchEvent(new Event('visibilitychange')); await wait(300);
        out.hiddenQuiet = A.state().ctx === 'suspended';
        const b1 = A.state().bars; await wait(800); out.hiddenNoBars = A.state().bars === b1;
        delete document.hidden;
        document.dispatchEvent(new Event('visibilitychange')); await wait(500);
        out.wakes = A.state().ctx === 'running' && A.state().bars > b1;
        document.getElementById('sheetClose').click(); await wait(100);
        return out;
      });
      for (const [k, v] of Object.entries(snd)) if (!v) bad.push('Music and sound: not ' + k);
      // research: the button shows once research opens; its sheet starts an item, the others wait, and it finishes
      // the Perks button: hidden until the charter would pay a deed, then its sheet says what signing pays
      const perks = await page.evaluate(async () => {
        const wait = ms => new Promise(r => setTimeout(r, ms)), t = CG.game.town, btn = document.getElementById('perksBtn'), out = {};
        out.hiddenFirst = btn.hidden;
        const life = t.lifetime; t.lifetime = 9e4; await wait(600);
        out.offered = CG.game.shared.charter.offered && !btn.hidden && btn.classList.contains('on');
        btn.click(); await wait(300);
        const sheet = document.getElementById('sheet');
        out.sheet = !sheet.hidden && sheet.dataset.id === 'perks' && /After signing\s*1 deed/.test(sheet.textContent) && !document.getElementById('signCharter').disabled;
        out.pairs = [...document.querySelectorAll('#sheet .pair .pairhead')].filter(h => /^Needs/.test(h.textContent)).length === 1 && /Needs 1 deed/.test(sheet.textContent); // one locked pair at a time (review of 2026.11.20-10)
        t.lifetime = life;
        return out;
      });
      for (const [k, v] of Object.entries(perks)) if (!v) bad.push('Perks: not ' + k);
      bad.push(...(await check(page)).map(b => 'perks sheet: ' + b));
      await page.evaluate(() => document.getElementById('sheetClose').click());
      const lab = await page.evaluate(async () => {
        const wait = ms => new Promise(r => setTimeout(r, ms)), t = CG.game.town, btn = document.getElementById('researchBtn'), out = {};
        delete t.flags['open:research']; t.buildings.saw = 0; await wait(400); out.hiddenFirst = btn.hidden;
        t.buildings.saw = 1; await wait(600); out.opens = !!t.flags['open:research'] && !btn.hidden;
        btn.click(); await wait(200);
        const sheet = document.getElementById('sheet'); out.sheet = !sheet.hidden && sheet.dataset.id === 'research';
        t.coins = 1e6; t.lab = null; const before = t.research.saws || 0;
        document.querySelector('#sheet [data-research="saws"]').click(); await wait(400);
        out.started = !!t.lab && t.lab.id === 'saws' && /Researching level/.test(sheet.textContent) && /[0-9]+ (sec|min) left/.test(document.querySelector('#sheet [data-research="saws"]').textContent);
        // one runs at a time, and another lines up next with a tap (review of 2026.11.20-6: no grayed Busy), off with a second tap
        const w = document.querySelector('#sheet [data-research="walls"]');
        out.lineUp = !w.disabled && w.textContent === 'Do next';
        w.click(); await wait(400); out.linedUp = t.labNext === 'walls' && w.textContent === 'Up next' && t.lab.id === 'saws';
        w.click(); await wait(400); out.offLine = t.labNext === null && w.textContent === 'Do next';
        out.label = /^Research[0-9]+ (sec|min)$/.test(btn.textContent); // the time on its own line, so the column keeps its width
        out.tradeoff = /burn one more timber/.test(sheet.textContent);
        return out;
      });
      for (const [k, v] of Object.entries(lab)) if (!v) bad.push('Research: not ' + k);
      bad.push(...(await check(page)).map(b => 'research sheet: ' + b));
      const labDone = await page.evaluate(async () => {
        const t = CG.game.town, before = t.research.saws || 0; t.lab.left = .1; await new Promise(r => setTimeout(r, 900));
        const ok = (t.research.saws || 0) === before + 1 && !t.lab; document.getElementById('sheetClose').click(); return ok;
      });
      if (!labDone) bad.push('Research: the item did not finish');
      // tap a number, see where it comes from: the coins open Income, the wave and vault bar open the Vault sheet, and
      // a tower's Damage and Range, a building's output and a good's price each open their breakdown
      const why = await page.evaluate(async () => {
        const wait = ms => new Promise(r => setTimeout(r, ms)), t = CG.game.town, out = {}, sheet = document.getElementById('sheet'), card = document.getElementById('card');
        const box = () => card.querySelector('.explain.why');
        document.getElementById('coins').click(); await wait(700);
        out.income = !sheet.hidden && sheet.dataset.id === 'income' && /Selling timber/.test(sheet.textContent) && /^\+.*\/s$/.test(sheet.querySelector('.explain .total b')?.textContent || '');
        document.getElementById('sheetClose').click(); await wait(100);
        document.getElementById('vaultBtn').click(); await wait(300);
        out.vault = !sheet.hidden && sheet.dataset.id === 'vault' && /Hits left/.test(sheet.textContent) && /War wagon/.test(sheet.textContent);
        document.getElementById('sheetClose').click(); await wait(100);
        const tw = t.towers[0]; CG.play.openSpot(tw.spot); await wait(200);
        out.best = !['crossbow', 'still', 'mortar'].includes(tw.kind) || /Best against/.test(card.textContent); // what the tower is best against
        card.querySelector('[data-why="dmg"]').click(); await wait(150);
        out.damage = !!box() && box().children.length >= 1 && card.querySelector('[data-why="dmg"]').getAttribute('aria-expanded') === 'true';
        card.querySelector('[data-why="range"]').click(); await wait(150);
        out.range = !!box() && /Short|Medium|Long/.test(box().textContent);
        out.oneAtATime = card.querySelectorAll('.explain.why').length === 1;
        return out;
      });
      bad.push(...(await check(page)).map(b => 'tower why: ' + b));
      const why2 = await page.evaluate(async () => {
        const wait = ms => new Promise(r => setTimeout(r, ms)), out = {}, sheet = document.getElementById('sheet'), card = document.getElementById('card');
        CG.play.close(); CG.play.open('camp'); await wait(150);
        card.querySelector('.stat').click(); await wait(150);
        out.output = /Level [0-9]+/.test(card.querySelector('.explain.why')?.textContent || '');
        CG.play.close();
        // timber to sell, so its price rows show; then none, so one plain line says what it would pay (review of 2026.11.19-9)
        // (and a fresh market, since a price of almost 0 also reads as one line)
        const T = CG.game.town, was = T.goods.timber, mk = CG.game.shared.market, rate = mk.rate.timber; mk.rate.timber = 0; T.goods.timber = Math.ceil((T.keep || {}).timber || 0) + 60;
        document.getElementById('goodsBtn').click(); await wait(300);
        sheet.querySelector('[data-why="timber"]').click(); await wait(400);
        out.price = /Base price/.test(sheet.textContent) && /coins? (each|per)/.test(sheet.querySelector('[data-why="timber"] .plabel')?.textContent || ''); // the price bar's front says the price (no total row, review of 2026.11.20-7)
        T.goods.timber = 0; await wait(600);
        out.noneToSell = /once you have some to sell/.test(sheet.textContent) && !/Base price/.test(sheet.textContent);
        if (!out.price || !out.noneToSell) out.priceText = sheet.textContent.slice(0, 400);
        T.goods.timber = was; mk.rate.timber = rate;
        return out;
      });
      bad.push(...(await check(page)).map(b => 'price why: ' + b));
      await page.evaluate(() => document.getElementById('sheetClose').click());
      for (const [k, v] of Object.entries({ ...why, ...why2 })) if (k === 'priceText') bad.push('the Goods sheet read ' + JSON.stringify(v)); else if (!v) bad.push('Tap to explain: not ' + k);
      await sleep(400);
      bad.push(...(await check(page)).map(b => 'card: ' + b), ...errs);
      console.log(name, bad.length ? 'FAIL ' + bad.join('; ') : 'ok');
      failed += bad.length ? 1 : 0;
      await page.close();
    }
  } finally { await browser.close(); srv.close(); }

  // the outpost: a new game starts in Dry Creek, its Stone Camp and a Crossbow are bought through their cards, the win
  // card's button opens Copper Gulch, and the town chip switches both ways, at every size
  const srv7 = await start(0), b7 = await chromium.launch();
  try {
    for (const [name, [width, height]] of Object.entries(SIZES)) {
      const page = await b7.newPage({ viewport: { width, height } }), errs = [], bad = [];
      page.on('pageerror', e => errs.push(e.message));
      page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
      await page.goto(srv7.url); await waitFor(page, () => window.CG && CG.ready);
      await page.evaluate(() => { localStorage.clear(); document.getElementById('play').click(); });
      await waitFor(page, () => window.CG && CG.town && CG.town.frames > 5 && CG.coach && CG.coach.current === 'dc-welcome', 10000);
      const begin = await page.evaluate(async () => {
        const wait = ms => new Promise(r => setTimeout(r, ms)), g = CG.game, out = {};
        out.drycreek = g.active === 'drycreek' && !g.towns.gulch && CG.town.board.group.name === 'board:drycreek';
        out.welcome = CG.coach.current === 'dc-welcome';
        CG.coach.skipAll(); await wait(100);
        // the goal strip starts on the first Crossbow, with the spotlight on a stone pad
        const gl = document.getElementById('goal'), gt = () => gl.hidden ? '' : gl.querySelector('.gtext').textContent, mk = document.getElementById('goalMark');
        out.goalFirst = /^(Tap a stone pad and build a Crossbow|Wait for \d+ more (coins|timber|stone)( and \d+ more (timber|stone))?, then tap a stone pad)$/.test(gt()); // or what to wait for, until a Crossbow can be paid
        for (let i = 0; i < 10 && mk.hidden; i++) await wait(100); // the frame is placed five times a second
        out.goalMark = !mk.hidden;
        const t = g.town; t.coins = 500; t.goods.stone = 50;
        await wait(400); out.goalPaid = gt() === 'Tap a stone pad and build a Crossbow';
        CG.play.open('quarry'); await wait(100); const L = t.level('quarry'); document.getElementById('buy').click();
        out.camp = t.level('quarry') === L + 1;
        CG.play.openSpot(0); await wait(100);
        out.onlyCrossbow = [...document.querySelectorAll('#card .build')].map(b => b.dataset.kind).join() === 'crossbow';
        document.querySelector('#card .build[data-kind="crossbow"]').click(); CG.play.close();
        out.tower = t.towers.some(x => x.spot === 0);
        out.noPlaces = document.getElementById('backBtn').hidden && document.getElementById('mapBtn').hidden; // one town: no Map, no back
        // two goals done (the Stone Camp to level 2, the Crossbow): Done shows, then the Copper Camp, its tag spotlit
        await wait(300); out.goalDone = gl.classList.contains('done');
        await wait(1800);
        out.goalNext = gt() === 'Tap the Copper Camp lot, then tap Build' && !!g.shared.goals.done['dc-tower'] && !!g.shared.goals.done['dc-stone2'];
        const mr = mk.getBoundingClientRect(), tr = document.querySelector('.tag[data-plot="dmine"]').getBoundingClientRect();
        out.goalMarkOnTag = !mk.hidden && mr.left <= tr.left && mr.right >= tr.right && mr.top <= tr.top && mr.bottom >= tr.bottom;
        const r = gl.getBoundingClientRect(); out.goalOnScreen = r.left >= 0 && r.right <= innerWidth + .5 && r.bottom < innerHeight / 2;
        return out;
      });
      for (const [k, v] of Object.entries(begin)) if (!v) bad.push('outpost start: not ' + k);
      bad.push(...(await check(page)).map(b => 'outpost: ' + b));
      // win it: the win card shows, with a button that goes to Copper Gulch
      await page.evaluate(() => { delete CG.game.shared.seen['dc-won']; CG.game.town.bestWave = 10; });
      if (!await waitFor(page, () => CG.coach.current === 'dc-won', 8000)) bad.push('the win card did not show');
      bad.push(...(await check(page)).map(b => 'win card: ' + b));
      // the countdown to the next raid is never cut off (the raid type may be, the number never)
      await sleep(400);
      const cut = await page.evaluate(() => { const w = document.querySelector('#wave .winfo'); return w.scrollWidth > w.clientWidth + 1 ? w.textContent : ''; });
      if (cut) bad.push('the wave countdown is cut off (' + cut + ')');
      await page.evaluate(() => document.getElementById('coachGo').click());
      await sleep(300);
      if (!await waitFor(page, () => CG.game.active === 'gulch' && CG.town && CG.town.frames > 5 && CG.town.board.group.name === 'board:gulch', 10000)) bad.push('the win card did not open Copper Gulch');
      await page.evaluate(() => CG.coach.skipAll());
      // the place bar: the name, Map, and the back button to Dry Creek, all on one row that fits the screen
      const chip = await page.evaluate(() => ({ goal: document.querySelector('#goal .gtext').textContent, dcGo: !!CG.game.shared.goals.done['dc-go'] }));
      if (!/^(Tap a stone pad and build a Crossbow|Wait for \d+ more (coins|timber|stone)( and \d+ more (timber|stone))?, then tap a stone pad)$/.test(chip.goal) || !chip.dcGo) bad.push('the Gulch goals did not start (' + chip.goal + ')');
      const pg = await placeBar(page);
      if (pg.name !== 'Copper Gulch' || !pg.map || pg.back !== 'Dry Creek' || pg.label !== 'Back to Dry Creek' || !pg.oneRow || !pg.whole || !pg.inside || !pg.big) bad.push('the place bar is wrong in the Gulch (' + JSON.stringify(pg) + ')');
      if (pg.canvases !== 1) bad.push(pg.canvases + ' canvases after switching');
      bad.push(...(await check(page)).map(b => 'gulch: ' + b));
      // the back button goes to Dry Creek, which kept its tower, and then back to the Gulch
      await page.evaluate(() => document.getElementById('backBtn').click());
      if (!await waitFor(page, () => CG.game.active === 'drycreek' && CG.town && CG.town.frames > 5 && CG.town.board.group.name === 'board:drycreek', 10000)) bad.push('the back button did not go to Dry Creek');
      await sleep(300);
      const back = await page.evaluate(() => ({ tower: CG.game.town.towers.length > 0, won: CG.game.town.won }));
      const pd = await placeBar(page);
      if (!back.tower || !back.won) bad.push('Dry Creek is not as it was left (' + JSON.stringify(back) + ')');
      if (!/^Dry Creek/.test(pd.name) || pd.back !== 'Copper Gulch' || !pd.oneRow || !pd.whole || !pd.inside) bad.push('the place bar is wrong in Dry Creek (' + JSON.stringify(pd) + ')');
      await page.evaluate(() => document.getElementById('backBtn').click());
      if (!await waitFor(page, () => CG.game.active === 'gulch' && CG.town && CG.town.frames > 5, 10000)) bad.push('the back button did not go back to the Gulch');
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('cg-save')).game.active);
      if (saved !== 'gulch') bad.push('the switch was not saved');
      bad.push(...errs);
      console.log('outpost ' + name, bad.length ? 'FAIL ' + bad.join('; ') : 'ok');
      failed += bad.length ? 1 : 0;
      await page.close();
    }
  } finally { await b7.close(); srv7.close(); }

  // Iron Ridge: at Gulch wave 20 with the coins, the locked Iron Ridge button carries a dot and its card shows; its
  // sheet starts it; the Ridge opens with its welcome card, Pine Hollow comes with it, and the chip reaches both
  const srv8 = await start(0), b8 = await chromium.launch();
  try {
    for (const [name, [width, height]] of Object.entries(SIZES)) {
      const page = await b8.newPage({ viewport: { width, height } }), errs = [], bad = [];
      page.on('pageerror', e => errs.push(e.message));
      page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
      await page.goto(srv8.url + '?start=gulch'); await waitFor(page, () => window.CG && CG.ready);
      await page.evaluate(() => { localStorage.clear(); document.getElementById('play').click(); });
      await waitFor(page, () => window.CG && CG.town && CG.town.frames > 5 && CG.coach, 10000);
      await page.evaluate(() => { CG.coach.skipAll(); for (const id of ['found', 'ridge-welcome', 'ridge-route', 'ridge-boss', 'ph-welcome']) delete CG.game.shared.seen[id]; const t = CG.game.town; t.bestWave = 20; t.wave = 21; t.coins = 2e5; });
      if (!await waitFor(page, () => CG.coach.current === 'found', 8000)) bad.push('the new town card did not show');
      // Iron Ridge is ready: Map carries a dot. Places (the map for a device with no 3D) lists it with its Start sheet
      const lock = await page.evaluate(() => { const b = document.getElementById('mapBtn'); return { shown: !b.hidden, dot: b.classList.contains('dot') }; });
      if (!lock.shown || !lock.dot) bad.push('no Map button with a dot for Iron Ridge (' + JSON.stringify(lock) + ')');
      bad.push(...(await check(page)).map(b => 'found card: ' + b));
      await page.evaluate(() => { CG.coach.dismiss(); CG.play.openPlaces(); });
      await sleep(300);
      const places = await page.evaluate(() => { const r = document.getElementById('place-ridge'), h = document.getElementById('place-gulch'); return { id: document.getElementById('sheet').dataset.id, ridge: !!r && r.classList.contains('dot'), here: !!h && h.disabled, dc: !!document.getElementById('place-drycreek') }; });
      if (places.id !== 'places' || !places.ridge || !places.here || places.dc) bad.push('the places list is wrong (' + JSON.stringify(places) + ')');
      await page.evaluate(() => document.getElementById('place-ridge').click());
      await sleep(300);
      const sheet = await page.evaluate(() => ({ id: document.getElementById('sheet').dataset.id, ready: !document.getElementById('foundTown').disabled, text: document.getElementById('sheet').textContent }));
      if (sheet.id !== 'found' || !sheet.ready || !/Beat wave 20 in Copper Gulch · Done/.test(sheet.text)) bad.push('the Iron Ridge sheet is wrong (' + JSON.stringify(sheet) + ')');
      bad.push(...(await check(page)).map(b => 'found sheet: ' + b));
      // the map itself: Map opens it, Iron Ridge's card has Start, and Start flies into the new town
      await page.evaluate(() => { CG.play.sheets.close(); document.getElementById('mapBtn').click(); });
      if (!await waitFor(page, () => CG.map && CG.map.frames > 5 && CG.mapui, 8000)) { bad.push('Map did not open the map'); await page.evaluate(() => CG.play.openPlaces()); }
      else await page.evaluate(() => CG.mapui.openSite('ridge'));
      await sleep(400);
      const mc = await page.evaluate(() => ({ start: !!document.getElementById('mapFound'), dot: !!document.querySelector('.mapbadge[data-site="ridge"].dot') }));
      if (!mc.start || !mc.dot) bad.push('the Iron Ridge map card is wrong (' + JSON.stringify(mc) + ')');
      await page.evaluate(() => (document.getElementById('mapFound') || document.getElementById('place-ridge')).click());
      if (!await waitFor(page, () => CG.game.active === 'ridge' && CG.town && CG.town.frames > 5 && CG.town.board.group.name === 'board:ridge', 10000)) bad.push('Start did not open Iron Ridge');
      if (!await waitFor(page, () => CG.coach && CG.coach.current === 'ridge-welcome', 6000)) bad.push('no Iron Ridge welcome card');
      await sleep(300);
      const ridge = await page.evaluate(() => ({ paid: CG.game.towns.gulch.coins <= 2e5 - CG.game.towns.ridge.def.found.coins + CG.game.towns.ridge.def.start.coins + CG.game.towns.pinehollow.def.start.coins + 200, canvases: document.querySelectorAll('canvas#view').length, towns: Object.keys(CG.game.towns).sort().join() }));
      const pr = await placeBar(page);
      if (!ridge.paid || ridge.canvases !== 1 || ridge.towns !== 'gulch,pinehollow,ridge' || pr.back !== 'Copper Gulch' || !pr.map || !pr.oneRow || !pr.whole || !pr.inside) bad.push('Iron Ridge opened wrong (' + JSON.stringify({ ...ridge, ...pr }) + ')');
      await page.evaluate(() => { CG.coach.dismiss(); CG.coach.skipAll(); delete CG.game.shared.seen['ph-welcome']; });
      await sleep(400);
      const cut = await page.evaluate(() => { const w = document.querySelector('#wave .winfo'); return w.scrollWidth > w.clientWidth + 1 ? w.textContent : ''; });
      if (cut) bad.push('the wave countdown is cut off in the Ridge (' + cut + ')');
      bad.push(...(await check(page)).map(b => 'ridge: ' + b));
      await page.evaluate(() => { CG.play.openPlaces(); document.getElementById('place-pinehollow').click(); });
      if (!await waitFor(page, () => CG.game.active === 'pinehollow' && CG.town && CG.town.frames > 5 && CG.town.board.group.name === 'board:pinehollow', 10000)) bad.push('Places did not go to Pine Hollow');
      await sleep(300);
      const pp = await placeBar(page);
      if (pp.back !== 'Iron Ridge' || !pp.oneRow || !pp.whole || !pp.inside) bad.push('the place bar is wrong in Pine Hollow (' + JSON.stringify(pp) + ')');
      if (!await waitFor(page, () => CG.coach && CG.coach.current === 'ph-welcome', 6000)) bad.push('no Pine Hollow welcome card');
      bad.push(...(await check(page)).map(b => 'pine hollow: ' + b));
      bad.push(...errs);
      console.log('ridge ' + name, bad.length ? 'FAIL ' + bad.join('; ') : 'ok');
      failed += bad.length ? 1 : 0;
      await page.close();
    }
  } finally { await b8.close(); srv8.close(); }

  // the empire map: Map shows once a second town is open; it draws every town with a badge, moves under the finger,
  // a tap on a town opens its card with its ring, Pause carries into the town, Play flies in, zooming a town all the way
  // out opens the map again, and Back returns to the town in play
  const srv9 = await start(0), b9 = await chromium.launch();
  try {
    for (const [name, [width, height]] of Object.entries(SIZES)) {
      const page = await b9.newPage({ viewport: { width, height } }), errs = [], bad = [];
      page.on('pageerror', e => errs.push(e.message));
      page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
      await page.goto(srv9.url + '?coach=off&start=gulch'); await waitFor(page, () => window.CG && CG.ready);
      await page.evaluate(() => { localStorage.clear(); document.getElementById('play').click(); });
      await waitFor(page, () => window.CG && CG.town && CG.town.frames > 5, 10000);
      await sleep(400);
      if (await page.evaluate(() => !document.getElementById('mapBtn').hidden)) bad.push('Map shows with one town');
      const waveTop = () => page.evaluate(() => Math.round(document.getElementById('wave').getBoundingClientRect().top)); // the wave bar never drops when Map appears (review of 2026.11.19-14)
      const wt0 = await waveTop();
      await page.evaluate(async () => { const { foundTown } = await import('./src/core/empire.js'); const t = CG.game.town; t.bestWave = 20; t.coins = 1e6; foundTown(CG.game, 'ridge'); t.drawn = { ore: 5 }; CG.game.towns.ridge.shipped = { bricks: 5 }; });
      if (!await waitFor(page, () => !document.getElementById('mapBtn').hidden, 3000)) bad.push('no Map button with three towns');
      { await sleep(300); const wt1 = await waveTop(); if (wt1 !== wt0) bad.push('the wave bar moved from ' + wt0 + ' to ' + wt1 + ' px when Map appeared'); }
      // a lost toast from the town goes when the map opens (review of 2026.11.19-3: it covered the town labels)
      await page.evaluate(async () => { const { toast } = await import('./src/ui/play.js'); toast('Smoke lost line.', 6000, { kind: 'lost' }); });
      await page.evaluate(() => document.getElementById('mapBtn').click());
      if (!await waitFor(page, () => CG.map && CG.map.frames > 10 && CG.mapui, 8000)) bad.push('Map did not open the map');
      if (await page.evaluate(() => [...document.querySelectorAll('.toast')].some(t => t.textContent === 'Smoke lost line.'))) bad.push('the lost toast stayed over the map');
      await sleep(900);
      // a toast on the map moves off the town labels (review of 2026.11.19-4: toasts over the labels on the Capital screens)
      const onBadge = await page.evaluate(async () => {
        const { toast } = await import('./src/ui/play.js'); toast('Smoke map line.', 2000); await new Promise(r => setTimeout(r, 500));
        const t = [...document.querySelectorAll('.toast')].find(n => n.textContent === 'Smoke map line.'); if (!t) return 'no toast';
        if (t.classList.contains('wait')) return ''; // no free place: it waits, covering nothing
        const a = t.getBoundingClientRect();
        return [...document.querySelectorAll('.mapbadge:not(.undertoast)')].filter(n => { const r = n.getBoundingClientRect(); return r.width && a.left < r.right && a.right > r.left && a.top < r.bottom && a.bottom > r.top; }).map(n => n.textContent.slice(0, 20)).join(' | ');
      });
      if (onBadge) bad.push('a toast on the map covers ' + onBadge);
      // the labels' rates add up to the top bar's +N/s (review of 2026.11.19-6), read in the same paint
      const sums = await page.evaluate(async () => {
        const num = t => { const m = /\+?([\d.]+)(K|M|B)?\/s/.exec(t); return m ? +m[1] * ({ K: 1e3, M: 1e6, B: 1e9 }[m[2]] || 1) : 0; };
        for (let i = 0; i < 30; i++) { await new Promise(r => setTimeout(r, 100)); if (num(document.querySelector('.mapui .inc').textContent) > 0) break; }
        const total = num(document.querySelector('.mapui .inc').textContent), rows = [...document.querySelectorAll('.mapbadge .minc')].map(n => n.textContent);
        const sum = rows.filter(t => !t.startsWith('under')).reduce((a, t) => a + num(t), 0);
        return Math.abs(sum - total) <= Math.max(.051, total * .002) ? '' : rows.join(' + ') + ' is not ' + document.querySelector('.mapui .inc').textContent;
      });
      if (sums) bad.push('map labels: ' + sums);
      const m = await page.evaluate(() => ({
        canvases: document.querySelectorAll('canvas#view').length, town: !!CG.town, dio: CG.map.dioramas.join(), routes: CG.map.routes.join(),
        badges: [...document.querySelectorAll('.mapbadge')].filter(b => !b.hidden).map(b => b.dataset.site + (b.classList.contains('on') ? '*' : '')).join(),
        pause: !!document.getElementById('pauseBtn'), coins: document.getElementById('coins').textContent, back: document.getElementById('mapBack').getAttribute('aria-label'),
      }));
      if (m.canvases !== 1 || m.town || m.dio !== 'gulch,pinehollow,ridge' || m.routes !== 'gulch>ridge' || m.badges !== 'capital,drycreek,gulch*,pinehollow,ridge,sandybend,falls' || !m.pause || !/\d/.test(m.coins) || m.back !== 'Back to Copper Gulch') bad.push('the map is wrong (' + JSON.stringify(m) + ')');
      bad.push(...(await check(page)).map(b => 'map: ' + b));
      // the ground under the finger stays under it
      const pan = await page.evaluate(async () => {
        const wait = ms => new Promise(r => setTimeout(r, ms)), cv = document.getElementById('view'), rig = CG.map.rig, W = innerWidth, H = innerHeight;
        const ev = (type, x, y) => cv.dispatchEvent(new PointerEvent(type, { pointerId: 1, clientX: x, clientY: y, bubbles: true, isPrimary: true, pointerType: 'touch' }));
        const a = [W * .5, H * .6], A = rig.ground(...a);
        ev('pointerdown', ...a); for (let i = 1; i <= 6; i++) { ev('pointermove', a[0] - i * 9, a[1] - i * 7); await wait(16); }
        await wait(50);
        const v = new (CG.map.view.cam.position.constructor)(A.x, 0, A.z).project(CG.map.view.cam), x = (v.x + 1) / 2 * cv.clientWidth, y = (1 - v.y) / 2 * cv.clientHeight;
        ev('pointerup', a[0] - 54, a[1] - 42); await wait(100); rig.reset(); await wait(1200);
        return Math.hypot(x - (a[0] - 54), y - (a[1] - 42));
      });
      if (!(pan <= 4)) bad.push('map pan: the ground slid ' + Math.round(pan) + ' px from the finger');
      // tap Iron Ridge on the map: its card and its ring
      await page.evaluate(() => { const p = CG.map.projectSite('ridge'), cv = document.getElementById('view'); for (const t of ['pointerdown', 'pointerup']) cv.dispatchEvent(new PointerEvent(t, { pointerId: 1, clientX: p.x, clientY: p.y, bubbles: true, isPrimary: true, pointerType: 'touch' })); });
      await sleep(700);
      const card = await page.evaluate(() => ({ site: document.getElementById('mapCard').dataset.site, ring: CG.map.selected, text: document.getElementById('mapCard').textContent, play: !!document.getElementById('mapPlay') }));
      if (card.site !== 'ridge' || card.ring !== 'ridge' || !card.play || !/Gets bricks from Copper Gulch/.test(card.text)) bad.push('the Iron Ridge card is wrong (' + JSON.stringify(card) + ')');
      bad.push(...(await check(page)).map(b => 'map card: ' + b));
      // Pause on the map carries into the town; Play flies in
      await page.evaluate(() => { document.getElementById('pauseBtn').click(); document.getElementById('mapPlay').click(); });
      if (!await waitFor(page, () => CG.town && CG.town.frames > 5 && CG.game.active === 'ridge' && CG.town.board.group.name === 'board:ridge' && !CG.map, 8000)) bad.push('Play did not fly into Iron Ridge');
      const after = await page.evaluate(() => ({ paused: CG.town && CG.town.holds.has('player'), canvases: document.querySelectorAll('canvas#view').length, ui: !!document.getElementById('map-ui') }));
      if (!after.paused || after.canvases !== 1 || after.ui) bad.push('after flying in (' + JSON.stringify(after) + ')');
      await page.evaluate(() => document.getElementById('pauseBtn').click());
      // the town waits while the camera dives in, then runs (review of 2026.11.19-13: "in 1s" before the camera settled)
      if (!await waitFor(page, () => CG.town && !CG.town.holds.has('fly'), 4000)) bad.push('the fly-in hold never let go');
      { const t1 = await page.evaluate(() => CG.game.town.t); await sleep(600); if (!((await page.evaluate(() => CG.game.town.t)) > t1)) bad.push('the town did not run after flying in'); }
      // zooming the town all the way out opens the map; Back returns to the town in play
      await page.evaluate(async () => {
        const cv = document.getElementById('view'), wait = ms => new Promise(r => setTimeout(r, ms));
        for (let i = 0; i < 60 && !CG.map; i++) { cv.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, clientX: innerWidth / 2, clientY: innerHeight / 2, bubbles: true, cancelable: true })); await wait(20); }
      });
      if (!await waitFor(page, () => CG.map && CG.map.frames > 5, 6000)) bad.push('zooming out did not open the map');
      else {
        await page.evaluate(() => document.getElementById('mapBack').click());
        if (!await waitFor(page, () => CG.town && CG.town.frames > 5 && CG.game.active === 'ridge' && !CG.map, 6000)) bad.push('Back did not return to Iron Ridge');
      }
      // the Capital: Map gets a dot once it can be built; its card's Build button pays for it; a contract taken shows on
      // its badge, and a full one pays Influence and says so
      await page.evaluate(() => { const r = CG.game.towns.ridge; Object.assign(r.buildings, { rquarry: 12, ironmine: 12, colliery: 12, furnace: 10, steelmill: 8 }); r.bestWave = 30; r.coins = 1e6; });
      if (!await waitFor(page, () => document.getElementById('mapBtn').classList.contains('dot'), 3000)) bad.push('no dot on Map when the Capital can be built');
      await page.evaluate(() => document.getElementById('mapBtn').click());
      if (!await waitFor(page, () => CG.map && CG.map.frames > 5 && CG.mapui, 8000)) bad.push('Map did not open the map for the Capital');
      else {
        await page.evaluate(() => CG.mapui.openSite('capital')); await sleep(500);
        const lock = await page.evaluate(() => ({ build: (document.getElementById('mapFound') || {}).textContent, dot: !!document.querySelector('.mapbadge[data-site="capital"].dot') }));
        if (lock.build !== 'Build the Capital' || !lock.dot) bad.push('the Capital card before it is built is wrong (' + JSON.stringify(lock) + ')');
        await page.evaluate(() => document.getElementById('mapFound').click()); await sleep(700);
        // the map brings its dioramas in step once a second, so a busy machine can take longer than the sleep
        await waitFor(page, () => CG.map.dioramas.includes('capital'), 3000);
        // no toast covers the open card (review 2026-11-18: "The Capital is built." sat on the card's title in landscape;
        // that toast is gone, the card shows it) and no toast repeats it
        const covers = await page.evaluate(() => { const c = document.getElementById('mapCard').getBoundingClientRect(); return [...document.querySelectorAll('.toast')].filter(n => !n.classList.contains('out')).map(n => [n.textContent, n.getBoundingClientRect()]).filter(([x, a]) => /Capital is built/.test(x) || (a.left < c.right && a.right > c.left && a.top < c.bottom && a.bottom > c.top)).map(([x]) => x); });
        if (covers.length) bad.push('a toast covers or repeats the Capital card: ' + covers.join(' | '));
        const open =await page.evaluate(() => ({ open: CG.game.shared.capital.open, takes: document.querySelectorAll('#mapCard [data-contract]').length, text: document.getElementById('mapCard').textContent, dio: CG.map.dioramas.includes('capital') }));
        if (!open.open || open.takes < 1 || !/Influence/.test(open.text) || !open.dio) bad.push('the Capital card after it is built is wrong (' + JSON.stringify({ ...open, text: open.text.slice(0, 120) }) + ')');
        bad.push(...(await check(page)).map(b => 'capital card: ' + b));
        await page.evaluate(() => document.querySelector('#mapCard [data-contract]').click()); await sleep(700);
        const run = await page.evaluate(() => ({ active: !!CG.game.shared.capital.active, drop: !!document.getElementById('contractDrop'), badge: document.querySelector('.mapbadge[data-site="capital"]').textContent }));
        if (!run.active || !run.drop || !/Sent [0-9]/.test(run.badge)) bad.push('taking a contract did not show it (' + JSON.stringify(run) + ')');
        await page.evaluate(() => { const a = CG.game.shared.capital.active; a.got = a.need; });
        if (!await waitFor(page, () => CG.game.shared.capital.filled === 1 && CG.game.shared.capital.influence > 0 && [...document.querySelectorAll('.toast')].some(n => /delivered. You got/.test(n.textContent)), 4000)) bad.push('a full contract did not pay or say so');
        bad.push(...(await check(page)).map(b => 'capital contract: ' + b));
        // Institutions: the tab lists every institution with have / need coins; Found pays from the purse, then the
        // row offers its first upgrade for Influence, and Buy puts the bonus on every town
        await page.evaluate(() => document.getElementById('capTabInst').click()); await sleep(500);
        const inst = await page.evaluate(() => ({ rows: document.querySelectorAll('#mapCard [data-found]').length, pressed: document.getElementById('capTabInst').getAttribute('aria-pressed'), text: document.getElementById('mapCard').textContent }));
        if (inst.rows !== 5 || inst.pressed !== 'true' || !/ coins/.test(inst.text)) bad.push('the Institutions tab is wrong (' + JSON.stringify({ ...inst, text: inst.text.slice(0, 160) }) + ')');
        bad.push(...(await check(page)).map(b => 'institutions: ' + b));
        await page.evaluate(() => { CG.game.shared.purse.coins = Math.max(CG.game.shared.purse.coins, 1e6); CG.game.shared.capital.influence = 50; });
        await sleep(500);
        await page.evaluate(() => document.querySelector('#mapCard [data-found="bank"]').click()); await sleep(600);
        // its toast may wait behind the contract's one
        const toasted = await waitFor(page, () => [...document.querySelectorAll('.toast')].some(n => /is built./.test(n.textContent)), 8000);
        const buy = await page.evaluate(() => ({ founded: CG.game.shared.tree.founded.join(','), buy: !!document.querySelector('#mapCard [data-node="bank"]') }));
        buy.toast = toasted;
        if (buy.founded !== 'bank' || !buy.buy || !buy.toast) bad.push('founding the Bank did not work (' + JSON.stringify(buy) + ')');
        else {
          const before = await page.evaluate(() => CG.game.towns.gulch.mods.factor('income'));
          await page.evaluate(() => document.querySelector('#mapCard [data-node="bank"]').click()); await sleep(600);
          const after = await page.evaluate(() => ({ income: CG.game.towns.gulch.mods.factor('income'), n: CG.game.shared.tree.nodes.bank, left: CG.game.shared.capital.influence, line: document.getElementById('mapCard').textContent }));
          if (after.n !== 1 || !(Math.abs(after.income / before - 1.1) < 1e-6) || after.left !== 50 - NODE_COST[0] || !/1 of 5 upgrades/.test(after.line)) bad.push('buying a Bank upgrade did not work (' + JSON.stringify({ ...after, line: after.line.slice(0, 160) }) + ')');
        }
        bad.push(...(await check(page)).map(b => 'institutions bought: ' + b));
        // the city: the Bank stands on its lot (risen and merged back in), the capitol's badge floats over it, and no
        // road between two towns runs across the plaza
        await sleep(1200);
        const city = await page.evaluate(() => { const c = CG.map.city, p = CG.map.badgePoint('capital'), q = CG.map.projectSite('capital'); return c && { ...c, above: p && q ? q.y - p.y : 0 }; });
        if (!city || city.founded.join() !== 'bank' || city.rising.length || !(city.clear > .45) || !(city.above > 0)) bad.push('the Capital city is wrong (' + JSON.stringify(city) + ')');
        await page.evaluate(() => document.getElementById('capTabContracts').click()); await sleep(300);
      }
      bad.push(...errs);
      console.log('map ' + name, bad.length ? 'FAIL ' + bad.join('; ') : 'ok');
      failed += bad.length ? 1 : 0;
      await page.close();
    }
  } finally { await b9.close(); srv9.close(); }

  // save slots: a new game in slot 2, a save loaded into it from text, back to slot 1, and the title says Continue
  const srv4 = await start(0), b4 = await chromium.launch();
  try {
    const page = await b4.newPage({ viewport: { width: 400, height: 860 } }), errs = [], bad = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.goto(srv4.url + '?coach=off&start=gulch');
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

  // the charter: two taps on Sign the charter start the town over (the page reloads into it) with the deed kept; a
  // perk is picked with two taps and counts
  const srv6 = await start(0), b6 = await chromium.launch();
  try {
    const page = await b6.newPage({ viewport: { width: 400, height: 860 } }), errs = [], bad = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.goto(srv6.url + '?coach=off&start=gulch'); await waitFor(page, () => window.CG && CG.ready);
    await page.evaluate(() => { localStorage.clear(); document.getElementById('play').click(); });
    await waitFor(page, () => CG.town && CG.town.frames > 5);
    await page.evaluate(async () => {
      const wait = ms => new Promise(r => setTimeout(r, ms)), t = CG.game.town;
      t.buildings.saw = 8; t.bestWave = 34; t.wave = 34; t.coins = 5e4; t.lifetime = 1e5; await wait(600);
      document.getElementById('perksBtn').click(); await wait(200);
      const s = document.getElementById('signCharter'); s.click(); await wait(100); s.click();
    }).catch(() => {});
    await sleep(800);
    if (!await waitFor(page, () => window.CG && CG.town && CG.town.frames > 5, 15000)) bad.push('the game did not come back after signing');
    const after = await page.evaluate(() => { const g = CG.game, t = g.town; return { deeds: g.shared.charter.deeds, wave: t.wave, saw: t.level('saw'), coins: t.coins, perks: !document.getElementById('perksBtn').hidden, on: document.getElementById('perksBtn').classList.contains('on') }; });
    if (after.deeds !== 2 || after.wave !== 1 || after.saw || after.coins < 4e4) bad.push('signing did not start the town over with 2 deeds and the purse kept (' + JSON.stringify(after) + ')');
    if (!after.perks || !after.on) bad.push('the Perks button is not waiting for a pick');
    const pick = await page.evaluate(async () => {
      const wait = ms => new Promise(r => setTimeout(r, ms)), g = CG.game;
      document.getElementById('perksBtn').click(); await wait(300);
      const go = document.querySelector('#sheet [data-perk="trade:a"]'); go.click(); await wait(100);
      const once = g.shared.charter.perks.trade; document.querySelector('#sheet [data-perk="trade:a"]').click(); await wait(400);
      return { once: once === undefined, picked: g.shared.charter.perks.trade === 'a', counts: g.town.mods.factor('prod') > 1.19, shown: /Your perk/.test(document.getElementById('sheet').textContent), held: /You have\s*2 deeds/.test(document.getElementById('deedsHeld').textContent) };
    });
    for (const [k, v] of Object.entries(pick)) if (!v) bad.push('perk pick: not ' + k);
    bad.push(...(await check(page)).map(b => 'charter: ' + b), ...errs);
    console.log('charter', bad.length ? 'FAIL ' + bad.join('; ') : 'ok');
    failed += bad.length ? 1 : 0;
  } finally { await b6.close(); srv6.close(); }

  // What's new: a device with a save that last saw an older version gets the card on the title; Got it closes it for
  // good; a brand-new player never sees it
  const srv5 = await start(0), b5 = await chromium.launch();
  try {
    const page = await b5.newPage({ viewport: { width: 400, height: 860 } }), errs = [], bad = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.goto(srv5.url + '?coach=off&start=gulch'); await waitFor(page, () => window.CG && CG.ready);
    if (await page.evaluate(() => !!document.getElementById('news'))) bad.push('a new player saw What\'s new');
    await page.evaluate(() => { document.getElementById('play').click(); });
    await waitFor(page, () => CG.town && CG.town.frames > 3);
    await page.evaluate(() => { CG.leave('title'); }).catch(() => {});
    await sleep(800); await waitFor(page, () => window.CG && CG.ready);
    await page.evaluate(() => localStorage.setItem('cg-news', '2026.11.16-12')); await page.reload(); await waitFor(page, () => window.CG && CG.ready && (!CG.scene || CG.scene.frames > 3));
    const shown = await page.evaluate(() => { const n = document.getElementById('news'); return n ? n.querySelectorAll('li').length : 0; });
    if (!shown) bad.push('What\'s new did not show after an update');
    // in landscape every line can be reached: Got it stays on screen and the list scrolls (2026.11.18-15 review)
    await page.setViewportSize({ width: 860, height: 400 }); await sleep(300);
    const land = await page.evaluate(() => { const ok = document.getElementById('newsOk').getBoundingClientRect(), b = document.querySelector('#news .newsbody');
      b.scrollTop = b.scrollHeight; const last = [...b.querySelectorAll('li')].pop().getBoundingClientRect(), br = b.getBoundingClientRect();
      return { ok: ok.bottom <= innerHeight && ok.top >= 0, last: last.bottom <= br.bottom + 1 && last.top >= br.top - 1 }; });
    if (!land.ok) bad.push('in landscape Got it on What\'s new is off the screen');
    if (!land.last) bad.push('in landscape the last line of What\'s new cannot be scrolled to');
    if (process.env.CG_NEWS_SHOT) await page.screenshot({ path: process.env.CG_NEWS_SHOT });
    await page.setViewportSize({ width: 400, height: 860 }); await sleep(300);
    bad.push(...(await check(page)).map(b => 'news: ' + b));
    await page.evaluate(() => document.getElementById('newsOk').click()); await sleep(200);
    await page.reload(); await waitFor(page, () => window.CG && CG.ready);
    if (await page.evaluate(() => !!document.getElementById('news'))) bad.push('What\'s new came back after Got it');
    bad.push(...errs);
    console.log('news', bad.length ? 'FAIL ' + bad.join('; ') : 'ok');
    failed += bad.length ? 1 : 0;
  } finally { await b5.close(); srv5.close(); }

  // Automation: once the War Office stands, the Auto button comes out with a dot and its card; the sheet has Foremen,
  // Auto-towers and Auto-research; switching Auto-towers on raises a tower; at phone, landscape and desktop sizes
  const srvA = await start(0), bA = await chromium.launch();
  try {
    for (const [name, vp] of Object.entries({ phone: [400, 860], land: [860, 400], desk: [1366, 800] })) {
      const page = await bA.newPage({ viewport: { width: vp[0], height: vp[1] } }), errs = [], bad = [];
      page.on('pageerror', e => errs.push(e.message));
      await page.goto(srvA.url + '?coach=off&start=gulch'); await waitFor(page, () => window.CG && CG.ready);
      await page.evaluate(() => { localStorage.clear(); document.getElementById('play').click(); });
      await waitFor(page, () => CG.town && CG.town.frames > 3);
      if (await page.evaluate(() => !document.getElementById('autoBtn').hidden)) bad.push('Auto showed before the War Office');
      await page.evaluate(async () => {
        const g = CG.game, t = g.town; t.bestWave = 20; t.coins = 1e9;
        (await import('./src/core/empire.js')).foundTown(g, 'ridge'); g.towns.ridge.bestWave = 30; g.towns.ridge.waves.hold = true;
        (await import('./src/core/capital.js')).foundCapital(g); g.shared.purse.coins = 1e9;
        (await import('./src/core/tree.js')).foundInstitution(g, 'war');
        Object.assign(t.goods, { timber: 9999, ore: 9999, copper: 9999, bricks: 9999, planks: 9999, tools: 9999, clay: 9999 });
        for (const k of Object.keys(t.goods)) t.sell[k] = false;
        (await import('./src/core/defense.js')).buildTower(g, t, 2, 'crossbow');
      });
      if (!await waitFor(page, () => { const b = document.getElementById('autoBtn'); return b && !b.hidden && b.classList.contains('dot'); }, 3000)) bad.push('Auto did not come out with a dot');
      await page.evaluate(() => document.getElementById('autoBtn').click()); await sleep(500);
      const sh = await page.evaluate(() => ({ rows: [...document.querySelectorAll('[data-auto]')].map(b => b.dataset.auto + (b.disabled ? '-' : '+')).join(), text: (document.querySelector('.sheet') || document.body).textContent, dot: document.getElementById('autoBtn').classList.contains('dot') }));
      if (sh.rows !== 'foremen-,towers+,retry+,research-' || sh.dot || !/Build the University at the Capital first/.test(sh.text)) bad.push('the Automation sheet is wrong (' + JSON.stringify({ ...sh, text: sh.text.slice(0, 200) }) + ')');
      bad.push(...(await check(page)).map(b => 'automation: ' + b));
      bad.push(...(await uncovered(page)).map(b => 'automation: ' + b));
      const before = await page.evaluate(() => CG.game.town.towers[0].level);
      await page.evaluate(() => document.querySelector('[data-auto="towers"]').click());
      if (!await waitFor(page, () => CG.game.town.towers[0].level > 1 && document.querySelector('[data-auto="towers"]').textContent === 'Turn off' && /Next upgrade in/.test(document.querySelector('.sheet').textContent), 4000)) bad.push('Auto-towers did not raise the tower (level ' + before + ')');
      bad.push(...(await check(page)).map(b => 'automation on: ' + b));
      // Keep trying the boss: on, then a lost war wagon holds the waves and the sheet says what it waits for
      await page.evaluate(() => document.querySelector('[data-auto="retry"]').click());
      if (!await waitFor(page, () => document.querySelector('[data-auto="retry"]').textContent === 'Turn off' && /Ready if a boss gets through/.test(document.querySelector('.sheet').textContent), 3000)) bad.push('Keep trying the boss did not switch on');
      await page.evaluate(() => { const t = CG.game.town; t.wave = 18; Object.assign(t.waves, { hold: true, autoHold: true, phase: 'break', timer: 0, queue: [], foes: [] }); t.lost = { why: 'boss', wave: 20, back: 18, coins: 900, at: t.t }; });
      if (!await waitFor(page, () => /On hold for now|Trying wave 20 again/.test(document.querySelector('.sheet').textContent), 3000)) bad.push('the sheet did not show the try (' + (await page.evaluate(() => document.querySelector('.sheet').textContent.slice(0, 300))) + ')');
      bad.push(...(await check(page)).map(b => 'retry: ' + b));
      bad.push(...errs);
      console.log('auto ' + name, bad.length ? 'FAIL ' + bad.join('; ') : 'ok');
      failed += bad.length ? 1 : 0;
      await page.close();
    }
  } finally { await bA.close(); srvA.close(); }

  // the explainers: a fresh game opens with the welcome card and a spotlight; the game waits; Got it dismisses it for good
  const srv3 = await start(0), b3 = await chromium.launch();
  try {
    const page = await b3.newPage({ viewport: { width: 400, height: 860 } }), errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.goto(srv3.url);
    await waitFor(page, () => window.CG && CG.ready);
    await page.evaluate(() => { localStorage.clear(); document.getElementById('play').click(); });
    const shown = await waitFor(page, () => window.CG && CG.coach && CG.coach.current === 'dc-welcome', 10000);
    const bad = shown ? [] : ['the welcome card did not show'];
    if (shown) {
      const st = await page.evaluate(async () => {
        const t0 = CG.game.town.t; await new Promise(r => setTimeout(r, 1200));
        return { paused: CG.game.town.t === t0 };
      });
      if (!st.paused) bad.push('the game ran under the card');
      bad.push(...(await check(page)).map(b => 'coach: ' + b));
      await page.evaluate(() => document.getElementById('coachOk').click());
      // the next card spotlights the Stone Camp
      if (!await waitFor(page, () => CG.coach.current === 'dc-stone', 6000)) bad.push('the Stone Camp card did not follow');
      const hole = await page.evaluate(() => { const h = document.querySelector('#coach .hole'); return !h.hidden && h.getBoundingClientRect().width > 0; });
      if (!hole) bad.push('no spotlight on the Stone Camp');
      await page.evaluate(() => document.getElementById('coachOk').click());
      await sleep(300);
      const after = await page.evaluate(() => !!CG.game.shared.seen['dc-welcome'] && !!CG.game.shared.seen['dc-stone']);
      if (!after) bad.push('Got it did not dismiss the cards');
      await page.reload(); await waitFor(page, () => window.CG && CG.ready);
      await page.evaluate(() => document.getElementById('play').click());
      await waitFor(page, () => CG.town && CG.town.frames > 5); await sleep(2500);
      if (await page.evaluate(() => ['dc-welcome', 'dc-stone'].includes(CG.coach.current))) bad.push('the welcome cards came back after a reload');
    }
    bad.push(...errs);
    console.log('coach', bad.length ? 'FAIL ' + bad.join('; ') : 'ok');
    failed += bad.length ? 1 : 0;
  } finally { await b3.close(); srv3.close(); }

  // only the map zooms, never the page (owner rule): on a phone (touch, mobile viewport), pinch with two fingers over
  // the top bar and over the map; the page's zoom (visualViewport.scale) stays 1
  const srvP = await start(0), bP = await chromium.launch();
  try {
    const page = await bP.newPage({ viewport: { width: 400, height: 860 }, mobile: true }), bad = [];
    await page.goto(srvP.url + '?coach=off&start=gulch'); await waitFor(page, () => window.CG && CG.ready);
    await page.evaluate(() => { localStorage.clear(); document.getElementById('play').click(); });
    await waitFor(page, () => window.CG && CG.town && CG.town.frames > 5); await sleep(300);
    const spots = await page.evaluate(() => { const w = document.getElementById('wave').getBoundingClientRect(); return { hud: [Math.round(w.left + w.width / 2), Math.round(w.top + w.height / 2)], map: [200, 520] }; });
    for (const [where, [x, y]] of Object.entries(spots)) for (const scaleFactor of [2.2, .5]) {
      await page.cdp('Input.synthesizePinchGesture', { x, y, scaleFactor, gestureSourceType: 'touch', relativeSpeed: 600 });
      await sleep(250);
      const scale = await page.evaluate(() => window.visualViewport ? visualViewport.scale : 1);
      if (Math.abs(scale - 1) > .01) bad.push('a pinch over the ' + where + ' zoomed the page to ' + scale.toFixed(2));
    }
    // headless Chrome does not zoom the page on a pretend pinch even without these, so check the settings themselves
    const set = await page.evaluate(() => {
      const meta = (document.querySelector('meta[name=viewport]') || {}).content || '', css = n => getComputedStyle(n).touchAction;
      return { meta: /maximum-scale=1(,|$)/.test(meta) && /user-scalable=no/.test(meta), html: css(document.documentElement) === 'none', body: css(document.body) === 'none', canvas: css(document.getElementById('view')) === 'none' };
    });
    for (const [k, v] of Object.entries(set)) if (!v) bad.push('page zoom is not blocked: ' + (k === 'meta' ? 'the viewport meta lacks maximum-scale=1 and user-scalable=no' : k + ' lacks touch-action none'));
    console.log('pinch', bad.length ? 'FAIL ' + bad.join('; ') : 'ok');
    failed += bad.length ? 1 : 0;
  } finally { await bP.close(); srvP.close(); }

  // turning the phone (owner bug, 2026-11-18): portrait 400x800 to landscape 900x400 and back, on the title, in a town
  // and on the empire map. The canvas and its drawing buffer fill the screen each time, taps still open cards, and
  // nothing in the HUD is cut off
  const srvR = await start(0), bR = await chromium.launch();
  try {
    const page = await bR.newPage({ viewport: { width: 400, height: 800 } }), errs = [], bad = [];
    page.on('pageerror', e => errs.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    const fills = async where => {
      await sleep(700);
      const f = await page.evaluate(() => {
        const c = document.getElementById('view'), r = c.getBoundingClientRect(), W = innerWidth, H = innerHeight, cut = [];
        for (const n of document.querySelectorAll('.hud .hudleft, .hud .hudright, #goodsStrip, #placeBar, #callWave, #pauseBtn, #holdWaves')) {
          const b = n.getBoundingClientRect(); if (!b.width || n.closest('[hidden]')) continue;
          if (b.left < -1 || b.top < -1 || b.right > W + 1 || b.bottom > H + 1) cut.push(n.id || n.className);
        }
        return { css: [Math.round(r.width), Math.round(r.height)], screen: [W, H], buf: [c.width, c.height], cut };
      });
      if (Math.abs(f.css[0] - f.screen[0]) > 1 || Math.abs(f.css[1] - f.screen[1]) > 1) bad.push(where + ': the canvas is ' + f.css.join('x') + ' on a ' + f.screen.join('x') + ' screen');
      if (Math.abs(f.buf[0] / f.buf[1] - f.screen[0] / f.screen[1]) > .03) bad.push(where + ': the drawing buffer is ' + f.buf.join('x') + ' on a ' + f.screen.join('x') + ' screen');
      if (f.cut.length) bad.push(where + ': cut off ' + f.cut.join(', '));
      bad.push(...(await check(page)).map(b => where + ': ' + b));
    };
    await page.goto(srvR.url + '?coach=off&start=gulch'); await waitFor(page, () => window.CG && CG.ready && (!CG.scene || CG.scene.frames > 3));
    await fills('title portrait');
    await page.setViewportSize({ width: 900, height: 400 }); await fills('title landscape');
    await page.setViewportSize({ width: 400, height: 800 }); await fills('title back to portrait');
    await page.evaluate(() => { localStorage.clear(); document.getElementById('play').click(); });
    await waitFor(page, () => window.CG && CG.town && CG.town.frames > 5); await sleep(300);
    await fills('town portrait');
    for (const [where, width, height] of [['town landscape', 900, 400], ['town back to portrait', 400, 800]]) {
      await page.setViewportSize({ width, height }); await fills(where);
      const taps = await tapEverything(page);
      if (!taps.tried) bad.push(where + ': no object could be tapped');
      bad.push(...taps.miss.map(m => where + ': ' + m));
    }
    // the empire map measures the canvas too
    await page.evaluate(() => { const t = CG.game.town; t.bestWave = 20; t.wave = 21; });
    if (!await waitFor(page, () => !document.getElementById('mapBtn').hidden, 6000)) bad.push('no Map button');
    else {
      await page.evaluate(() => { if (CG.coach && CG.coach.skipAll) CG.coach.skipAll(); document.getElementById('mapBtn').click(); });
      if (!await waitFor(page, () => CG.map && CG.map.frames > 5, 8000)) bad.push('Map did not open the map');
      else {
        await fills('map portrait');
        await page.setViewportSize({ width: 900, height: 400 }); await fills('map landscape');
        await page.setViewportSize({ width: 400, height: 800 }); await fills('map back to portrait');
      }
    }
    bad.push(...errs);
    console.log('rotate', bad.length ? 'FAIL ' + bad.join('; ') : 'ok');
    failed += bad.length ? 1 : 0;
  } finally { await bR.close(); srvR.close(); }

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
