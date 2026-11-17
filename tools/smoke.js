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
      // Call now is grayed while the wait for the next wave is long, and works once half of it is gone
      const callGate = await page.evaluate(async () => {
        const t = CG.game.town, ws = t.waves, keep = JSON.stringify(ws), bw = t.bestWave, b = document.getElementById('callWave');
        CG.town.pause('smoke', true); t.bestWave = Math.max(1, bw); Object.assign(ws, { phase: 'break', timer: 50, queue: [], foes: [] });
        await new Promise(r => setTimeout(r, 400));
        const early = !b.hidden && b.disabled; b.click(); const stayed = ws.phase === 'break';
        ws.timer = 10; await new Promise(r => setTimeout(r, 400));
        const open = !b.disabled; b.click(); const went = ws.phase === 'wave';
        Object.assign(t.waves, JSON.parse(keep)); t.bestWave = bw; CG.town.pause('smoke', false);
        return { early, stayed, open, went };
      });
      if (!callGate.early || !callGate.stayed || !callGate.open || !callGate.went) bad.push('Call now did not wait for half the wave wait: ' + JSON.stringify(callGate));
      // the tower reserve: the camp card says what it keeps and its switch turns it off and on; a short tower card
      // names the good, the amount and the building that makes it
      const reserve = await page.evaluate(async () => {
        const wait = ms => new Promise(r => setTimeout(r, ms)), t = CG.game.town, out = {};
        CG.play.open('camp'); await wait(100);
        out.says = /Keep \d+ for towers · On/.test(document.getElementById('card').textContent);
        document.getElementById('keepTowers').click(); await wait(50);
        out.off = !!t.reserveOff.timber && !t.keep.timber && /Off/.test(document.getElementById('keepTowers').textContent);
        document.getElementById('keepTowers').click(); await wait(50);
        out.on = !t.reserveOff.timber && t.keep.timber > 0;
        t.goods.timber = 0; CG.play.openSpot(3); await wait(400);
        const sh = document.querySelector('#card .short'), low = [...document.querySelectorAll('#card .costrow .need.low')].map(n => n.textContent);
        out.short = !!sh && /Lumber Camp/.test(sh.textContent);
        out.haveNeed = low.some(x => /^Timber0 \/ \d+$/.test(x)); // the cost says have / need, red when short
        CG.play.close();
        return out;
      });
      for (const [k, v] of Object.entries(reserve)) if (!v) bad.push('tower reserve: not ' + k);
      // the goods strip (owner rule): on screen with a count for each good, following the stock, and a tap opens Goods there
      const strip = await page.evaluate(async () => {
        const wait = ms => new Promise(r => setTimeout(r, ms)), t = CG.game.town, s = document.getElementById('goodsStrip'), out = {};
        const selling = t.sell.timber; t.sell.timber = false; t.goods.timber = 37; await wait(450); // held, so the count stays put while it is read
        const b = s && s.getBoundingClientRect(), chip = s && s.querySelector('[data-good="timber"]');
        out.shown = !!s && !s.hidden && b.width > 0 && b.left >= 0 && b.right <= innerWidth && b.bottom <= innerHeight;
        out.counts = !!chip && Math.abs(+chip.querySelector('b').textContent - t.goods.timber) <= 4 && [...s.querySelectorAll('.goodchip b')].every(n => /^\d/.test(n.textContent));
        out.texts = s ? [...s.querySelectorAll('.goodchip')].map(n => n.dataset.good + '=' + n.querySelector('b').textContent).join(' ') + ' have ' + t.goods.timber : 'none';
        out.size = !!chip && chip.getBoundingClientRect().height >= 30;
        out.noScroll = document.documentElement.scrollWidth <= innerWidth;
        chip.click(); await wait(400);
        const f = document.querySelector('.sheet .goods .focus');
        out.opens = !!f && f.dataset.why === 'timber' && /You get/.test(f.textContent);
        CG.play.sheets.close(); if (selling === undefined) delete t.sell.timber; else t.sell.timber = selling;
        return out;
      });
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
      // research: the button shows once research opens; its sheet starts an item, the others wait, and it finishes
      // the Perks button: hidden until the charter would pay a deed, then its sheet says what signing pays
      const perks = await page.evaluate(async () => {
        const wait = ms => new Promise(r => setTimeout(r, ms)), t = CG.game.town, btn = document.getElementById('perksBtn'), out = {};
        out.hiddenFirst = btn.hidden;
        const life = t.lifetime; t.lifetime = 9e4; await wait(600);
        out.offered = CG.game.shared.charter.offered && !btn.hidden && btn.classList.contains('on');
        btn.click(); await wait(300);
        const sheet = document.getElementById('sheet');
        out.sheet = !sheet.hidden && sheet.dataset.id === 'perks' && /Sign the charter to get 1 deed/.test(sheet.textContent) && !document.getElementById('signCharter').disabled;
        out.pairs = document.querySelectorAll('#sheet .pair').length >= 3 && /Needs 1 deed/.test(sheet.textContent);
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
        out.started = !!t.lab && t.lab.id === 'saws' && /ready in/.test(sheet.textContent);
        out.oneAtATime = document.querySelector('#sheet [data-research="walls"]').disabled;
        out.label = /Research · [0-9]+s/.test(btn.textContent);
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
        document.getElementById('goodsBtn').click(); await wait(300);
        sheet.querySelector('[data-why="timber"]').click(); await wait(400);
        out.price = /Base price/.test(sheet.textContent) && /You get/.test(sheet.textContent);
        return out;
      });
      bad.push(...(await check(page)).map(b => 'price why: ' + b));
      await page.evaluate(() => document.getElementById('sheetClose').click());
      for (const [k, v] of Object.entries({ ...why, ...why2 })) if (!v) bad.push('Tap to explain: not ' + k);
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
        out.noChip = document.getElementById('townChip').hidden;
        // two goals done (the Stone Camp to level 2, the Crossbow): Done shows, then the Mining Camp, its tag spotlit
        await wait(300); out.goalDone = gl.classList.contains('done');
        await wait(1800);
        out.goalNext = gt() === 'Tap Build to build the Mining Camp' && !!g.shared.goals.done['dc-tower'] && !!g.shared.goals.done['dc-stone2'];
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
      const chip = await page.evaluate(() => {
        const c = document.getElementById('townChip'), bs = [...c.querySelectorAll('button')];
        return { shown: !c.hidden, two: bs.map(b => b.dataset.town).join() === 'drycreek,gulch', on: (bs.find(b => b.classList.contains('on')) || {}).dataset?.town, canvases: document.querySelectorAll('canvas#view').length, goal: document.querySelector('#goal .gtext').textContent, dcGo: !!CG.game.shared.goals.done['dc-go'] };
      });
      if (!/^(Tap a stone pad and build a Crossbow|Wait for \d+ more (coins|timber|stone)( and \d+ more (timber|stone))?, then tap a stone pad)$/.test(chip.goal) || !chip.dcGo) bad.push('the Gulch goals did not start (' + chip.goal + ')');
      if (!chip.shown || !chip.two || chip.on !== 'gulch') bad.push('the town chip is wrong (' + JSON.stringify(chip) + ')');
      if (chip.canvases !== 1) bad.push(chip.canvases + ' canvases after switching');
      bad.push(...(await check(page)).map(b => 'gulch: ' + b));
      // the chip goes back to Dry Creek, which kept its tower, and then to the Gulch again
      await page.evaluate(() => document.querySelector('#townChip [data-town="drycreek"]').click());
      if (!await waitFor(page, () => CG.game.active === 'drycreek' && CG.town && CG.town.frames > 5 && CG.town.board.group.name === 'board:drycreek', 10000)) bad.push('the chip did not go to Dry Creek');
      const back = await page.evaluate(() => ({ tower: CG.game.town.towers.length > 0, won: CG.game.town.won, on: (document.querySelector('#townChip .on') || {}).dataset?.town }));
      if (!back.tower || !back.won || back.on !== 'drycreek') bad.push('Dry Creek is not as it was left (' + JSON.stringify(back) + ')');
      await page.evaluate(() => document.querySelector('#townChip [data-town="gulch"]').click());
      if (!await waitFor(page, () => CG.game.active === 'gulch' && CG.town && CG.town.frames > 5, 10000)) bad.push('the chip did not go back to the Gulch');
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
      const lock = await page.evaluate(() => { const b = document.querySelector('#townChip .locked'); return b ? { town: b.dataset.town, dot: b.classList.contains('dot') } : null; });
      if (!lock || lock.town !== 'ridge' || !lock.dot) bad.push('no locked Iron Ridge button with a dot (' + JSON.stringify(lock) + ')');
      bad.push(...(await check(page)).map(b => 'found card: ' + b));
      await page.evaluate(() => { CG.coach.dismiss(); document.querySelector('#townChip .locked').click(); });
      await sleep(300);
      const sheet = await page.evaluate(() => ({ id: document.getElementById('sheet').dataset.id, ready: !document.getElementById('foundTown').disabled, text: document.getElementById('sheet').textContent }));
      if (sheet.id !== 'found' || !sheet.ready || !/Beat wave 20 in Copper Gulch · Done/.test(sheet.text)) bad.push('the Iron Ridge sheet is wrong (' + JSON.stringify(sheet) + ')');
      bad.push(...(await check(page)).map(b => 'found sheet: ' + b));
      await page.evaluate(() => document.getElementById('foundTown').click());
      if (!await waitFor(page, () => CG.game.active === 'ridge' && CG.town && CG.town.frames > 5 && CG.town.board.group.name === 'board:ridge', 10000)) bad.push('Start did not open Iron Ridge');
      if (!await waitFor(page, () => CG.coach && CG.coach.current === 'ridge-welcome', 6000)) bad.push('no Iron Ridge welcome card');
      const ridge = await page.evaluate(() => ({ paid: CG.game.towns.gulch.coins <= 2e5 - CG.game.towns.ridge.def.found.coins + CG.game.towns.ridge.def.start.coins + CG.game.towns.pinehollow.def.start.coins + 200, towns: [...document.querySelectorAll('#townChip button')].map(b => b.dataset.town).join(), on: (document.querySelector('#townChip .on') || {}).dataset?.town, canvases: document.querySelectorAll('canvas#view').length }));
      if (!ridge.paid || ridge.towns !== 'gulch,ridge,pinehollow' || ridge.on !== 'ridge' || ridge.canvases !== 1) bad.push('Iron Ridge opened wrong (' + JSON.stringify(ridge) + ')');
      await page.evaluate(() => { CG.coach.dismiss(); CG.coach.skipAll(); delete CG.game.shared.seen['ph-welcome']; });
      await sleep(400);
      const cut = await page.evaluate(() => { const w = document.querySelector('#wave .winfo'); return w.scrollWidth > w.clientWidth + 1 ? w.textContent : ''; });
      if (cut) bad.push('the wave countdown is cut off in the Ridge (' + cut + ')');
      bad.push(...(await check(page)).map(b => 'ridge: ' + b));
      await page.evaluate(() => document.querySelector('#townChip [data-town="pinehollow"]').click());
      if (!await waitFor(page, () => CG.game.active === 'pinehollow' && CG.town && CG.town.frames > 5 && CG.town.board.group.name === 'board:pinehollow', 10000)) bad.push('the chip did not go to Pine Hollow');
      if (!await waitFor(page, () => CG.coach && CG.coach.current === 'ph-welcome', 6000)) bad.push('no Pine Hollow welcome card');
      bad.push(...(await check(page)).map(b => 'pine hollow: ' + b));
      bad.push(...errs);
      console.log('ridge ' + name, bad.length ? 'FAIL ' + bad.join('; ') : 'ok');
      failed += bad.length ? 1 : 0;
      await page.close();
    }
  } finally { await b8.close(); srv8.close(); }

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
      return { once: once === undefined, picked: g.shared.charter.perks.trade === 'a', counts: g.town.mods.factor('prod') > 1.19, shown: /You picked one/.test(document.getElementById('sheet').textContent), held: /You have 2 deeds/.test(document.getElementById('deedsHeld').textContent) };
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
    bad.push(...(await check(page)).map(b => 'news: ' + b));
    await page.evaluate(() => document.getElementById('newsOk').click()); await sleep(200);
    await page.reload(); await waitFor(page, () => window.CG && CG.ready);
    if (await page.evaluate(() => !!document.getElementById('news'))) bad.push('What\'s new came back after Got it');
    bad.push(...errs);
    console.log('news', bad.length ? 'FAIL ' + bad.join('; ') : 'ok');
    failed += bad.length ? 1 : 0;
  } finally { await b5.close(); srv5.close(); }

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
