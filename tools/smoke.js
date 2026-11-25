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
    if (vis(card) && vis(strip) && hit(R(card), R(strip))) { const c = R(card), g = R(strip), u = document.querySelector('.play'); bad.push('the card covers the goods strip (card ' + Math.round(c.top) + '-' + Math.round(c.bottom) + ', strip ' + Math.round(g.top) + '-' + Math.round(g.bottom) + ', --striph ' + (u ? getComputedStyle(u).getPropertyValue('--striph') : '?') + ', chips ' + strip.children.length + ', ' + document.querySelector('#card h2').textContent + ')'); }
    for (const p of panes) if (p.id !== 'card' && vis(strip) && hit(R(p), R(strip))) bad.push('a sheet covers the goods strip'); // (review of 2026.11.19-7)
    // no level tag shows cut by a card, a sheet, the strip or the top bar
    { const boxes = [...panes, strip, ...document.querySelectorAll('.hud .hudleft, .hud .hudright')].filter(vis).map(R);
      for (const n of document.querySelectorAll('.tags .tag')) { if (!vis(n) || getComputedStyle(n).visibility === 'hidden' || document.documentElement.classList.contains('flat')) continue; const r = R(n); if (boxes.some(b => hit(r, b))) bad.push('a level tag is cut: ' + n.textContent); } }
    // and beside it every good's name shows whole (review of 2026.11.19-6: "Copper ..." beside a side card)
    if (vis(strip)) for (const n of strip.querySelectorAll('.gname')) if (n.scrollWidth > n.clientWidth + 1) bad.push('the goods strip cuts ' + n.textContent);
    if (vis(buy) && vis(card)) { const b = R(buy), c = R(card); if (b.top < c.top - 1 || b.bottom > c.bottom + 1 || b.bottom > innerHeight) bad.push('the card\'s ' + buy.textContent.split(' ')[0] + ' button is out of view'); }
    // no button or switch of the card sits partly under its pinned price bar (review of 2026.11.23-7: in landscape the
    // building card at level 10 scrolled with its foreman switch under the bar)
    if (vis(card)) {
      const pin = card.querySelector(':scope > .buybar:not(.pathbar), :scope > .row:has(> #buy)');
      if (vis(pin) && getComputedStyle(pin).position === 'sticky') {
        const p = R(pin), c = R(card);
        for (const n of card.querySelectorAll('button, .switch, [role=switch]')) {
          if (!vis(n) || pin.contains(n) || getComputedStyle(n).visibility === 'hidden') continue;
          const r = R(n); if (r.bottom <= c.top + 1 || r.top >= c.bottom - 1) continue; // scrolled out of the card whole
          if (r.bottom > p.top + 1 && r.top < p.bottom - 1 && r.top < p.top - 1) bad.push('the card\'s ' + (n.textContent.trim().slice(0, 24) || n.id || 'button') + ' sits half under its price bar');
        }
      }
    }
    return bad;
  });
}

/* Every red dot a top bar button can carry is wholly in view on its button: nothing clips it (a parent that hides
   overflow, the screen's edge) and nothing covers it (2026.11.23-10: the back button clipped its dot unseen for days).
   Each button is given its dot for the check, so every button that can ever carry one is measured. */
export async function dotsSeen(page) {
  return page.evaluate(() => {
    const bad = [];
    for (const id of ['mapBtn', 'backBtn', 'goodsBtn', 'researchBtn', 'perksBtn', 'autoBtn', 'armsBtn', 'menuBtn']) {
      const b = document.getElementById(id);
      if (!b || b.hidden || b.offsetParent === null) continue;
      const had = b.classList.contains('dot'); b.classList.add('dot');
      const r = b.getBoundingClientRect(), cs = getComputedStyle(b, '::after');
      const w = parseFloat(cs.width) + 2 * parseFloat(cs.borderTopWidth || 0), h = parseFloat(cs.height) + 2 * parseFloat(cs.borderTopWidth || 0);
      const top = r.top + parseFloat(cs.top), right = r.right - parseFloat(cs.right), d = { l: right - w, r: right, t: top, b: top + h };
      if (d.l < 0 || d.t < 0 || d.r > innerWidth || d.b > innerHeight) bad.push(id + ' dot off the screen');
      for (let p = b.parentElement; p && p !== document.body; p = p.parentElement) {
        const ps = getComputedStyle(p); if (ps.overflowX === 'visible' && ps.overflowY === 'visible') continue;
        const pr = p.getBoundingClientRect(); if (d.l < pr.left - .5 || d.r > pr.right + .5 || d.t < pr.top - .5 || d.b > pr.bottom + .5) bad.push(id + ' dot clipped by ' + (p.id || p.className));
      }
      // points inside the round dot: its middle and two points halfway out toward its edge (the corners of its box lie
      // outside the circle, where the browser finds what is under it, 2026.11.24-1)
      const cx = (d.l + d.r) / 2, cy = (d.t + d.b) / 2, q = Math.min(w, h) / 4;
      for (const [x, y] of [[cx, cy], [cx - q * .7, cy - q * .7], [cx + q * .7, cy + q * .7]]) {
        const hit = document.elementFromPoint(x, y);
        if (hit && hit !== b && !b.contains(hit)) { bad.push(id + ' dot covered by ' + (hit.id || hit.className || hit.tagName)); break; }
      }
      if (!had) b.classList.remove('dot');
    }
    return bad;
  });
}

export async function check(page) {
  return page.evaluate(() => {
    const bad = [], vw = innerWidth;
    const wide = [document.documentElement, document.body, document.getElementById('app')].some(e => e && e.scrollWidth > vw + 1);
    if (wide) bad.push('sideways scroll');
    // an element passed where text was meant shows as "[object HTMLLabelElement]" (2026.11.22-13: the Menu's Voice row)
    const junk = (document.body.innerText || '').match(/\[object \w+\]|\bundefined\b|\bNaN\b/);
    if (junk) bad.push('broken text on screen: ' + junk[0]);
    for (const b of document.querySelectorAll('button, a, [role=button]')) {
      const r = b.getBoundingClientRect();
      if (r.width && (r.width < 30 || r.height < 30)) bad.push('small target: ' + (b.id || b.textContent.trim().slice(0, 20)) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
      if (r.width && (r.right > vw + 1 || r.left < -1)) bad.push('off screen: ' + (b.id || b.textContent.trim().slice(0, 20)));
    }
    // a control another one covers, not only one the screen cuts (review of 2026.11.23-6: in landscape six side buttons
    // ran over Hold waves, which read "Resu"): at three points across each top bar button, the top element is that button
    const nm = n => n.id || n.textContent.trim().slice(0, 20);
    for (const b of document.querySelectorAll('.hud button')) {
      const r = b.getBoundingClientRect(); if (!r.width || getComputedStyle(b).visibility === 'hidden' || getComputedStyle(b).pointerEvents === 'none') continue;
      for (const fx of [.12, .5, .88]) {
        const x = r.left + r.width * fx, y = r.top + r.height / 2; if (x < 0 || y < 0 || x > vw || y > innerHeight) continue;
        const top = document.elementFromPoint(x, y);
        if (top && !b.contains(top) && top.closest('.hud')) { bad.push('covered: ' + nm(b) + ' under ' + nm(top.closest('button') || top)); break; }
      }
    }
    const card = document.getElementById('card');
    if (card && !card.hidden) { const r = card.getBoundingClientRect(); if (r.top < -1 || r.bottom > innerHeight + 1) bad.push('card taller than the screen'); }
    // a card or sheet never scrolls sideways (review of 2026.11.23-6: the Sharpshooter's name, level, Sell and Close)
    for (const p of document.querySelectorAll('#card, .sheet .sheetbody, .sheet')) if (p.getClientRects().length && !p.closest('[hidden]') && p.scrollWidth > p.clientWidth + 1) bad.push('sideways scroll in ' + (p.id || p.className) + ' (' + p.scrollWidth + ' > ' + p.clientWidth + ')');
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
      // the town's life (M5b): townsfolk or the wagon are out between waves, and none of it can be tapped
      const life = await page.evaluate(async () => {
        const L = CG.town.board.life, B = CG.town.board; await new Promise(r => setTimeout(r, 1500));
        const own = new Set(); L.group.traverse(o => own.add(o));
        let folk = 0; for (let i = 0; i < L.cloth.count; i++) if (L.cloth.instanceMatrix.array[i * 16] !== 0) folk++;
        return { picked: B.pickables.some(o => own.has(o)) || (B.hits || []).some(o => own.has(o)), folk, wagon: L.wagon.obj.visible };
      });
      if (life.picked || (!life.folk && !life.wagon)) bad.push('the town life is missing or can be tapped: ' + JSON.stringify(life));
      // buildings that grow (M5b part 3): every building at every level mark builds, stands taller from level 50, and
      // no building has its windows lit before level 25 that are dark after it; some light up at 25
      const grow = await page.evaluate(async () => {
        const { makeBuilding } = await import('./src/assets/models/gulch.js'), { BUILDINGS } = await import('./src/data/buildings.js');
        const out = [], glow = b => { let n = 0; b.obj.traverse(o => { if (o.isMesh && o.material.type === 'MeshBasicMaterial') n += o.geometry.attributes.position.count; }); return n; };
        for (const [id, def] of Object.entries(BUILDINGS)) {
          if (!def.model) continue;
          const t = [0, 1, 2, 3, 4].map(tier => makeBuilding(def.model, tier));
          if (!(t[3].top > t[2].top)) out.push(id + ' is no taller at level 50');
          if (glow(t[1]) > glow(t[2])) out.push(id + ' has more lit windows at level 10 than at 25');
          for (const b of t) b.obj.traverse(o => { if (o.isMesh) o.geometry.dispose(); });
        }
        let lit = 0; for (const def of Object.values(BUILDINGS)) if (def.model) { const a = makeBuilding(def.model, 1), b = makeBuilding(def.model, 2); if (glow(b) - glow(a) > 72) lit++; } // more than the two lanterns (36 corners each)
        if (!lit) out.push('no windows light up at level 25');
        return out;
      });
      if (grow.length) bad.push('buildings that grow: ' + grow.slice(0, 4).join(', '));
      const buy = await page.evaluate(async () => {
        const t = CG.game.town; t.coins = 100; CG.play.open('camp'); await new Promise(r => setTimeout(r, 100));
        const b = document.getElementById('buy'), before = t.level('camp'); b.click();
        await new Promise(r => setTimeout(r, 100));
        const own = document.querySelector('.tag[data-plot="camp"]'); // the open card names it, so its own tag is gone
        return { ok: t.level('camp') === before + 1, card: !document.getElementById('card').hidden, ownTag: !!own && !own.hidden };
      });
      if (!buy.ok || !buy.card) bad.push('the card did not buy a level');
      if (buy.ownTag) bad.push('the building whose card is open still shows its tag over the card');
      // a tower: build a crossbow on a spot through its card, then call the wave
      const tower = await page.evaluate(async () => {
        const t = CG.game.town; t.coins = 500; t.goods.timber = 50; CG.play.openSpot(3); await new Promise(r => setTimeout(r, 100));
        document.querySelector('#card .build[data-kind="crossbow"]').click();
        const built = t.towers.some(x => x.spot === 3 && x.kind === 'crossbow');
        document.getElementById('callWave').click();
        return { built, wave: t.waves.phase === 'wave' };
      });
      if (!tower.built || !tower.wave) bad.push('the tower card or the call button failed');
      // shadows (2026.11.21-4): raiders cast no sun shadow and have a soft one under them; the shadow map is drawn when
      // a building levels up, not every frame
      const shade = await page.evaluate(async () => {
        const v = CG.town, wait = ms => new Promise(r => setTimeout(r, ms)), sm = v.view.renderer.shadowMap;
        for (let i = 0; i < 40 && ![...v.battle.foes.values()].some(u => u.obj.visible); i++) await wait(100);
        const seen = [...v.battle.foes.values()].filter(u => u.obj.visible).length;
        let cast = 0; for (const u of v.battle.foes.values()) u.obj.traverse(o => { if (o.isMesh && o.castShadow) cast++; });
        const d0 = v.shadowDraws, f0 = v.frames; await wait(1000); const rate = (v.shadowDraws - d0) / Math.max(1, v.frames - f0);
        const t = CG.game.town, d1 = v.shadowDraws; t.buildings.camp = (t.buildings.camp || 0) + 1; await wait(700);
        return { seen, blobs: v.battle.blobs.count, cast, auto: sm.autoUpdate, rate: +rate.toFixed(2), redrawn: v.shadowDraws > d1 };
      });
      if (shade.seen && shade.blobs < shade.seen) bad.push('a raider has no soft shadow under it: ' + JSON.stringify(shade));
      // tapping a raider (owner, 2026-11-22): a real tap on a moving raider opens its card with its name and health, the
      // ring follows it, and the game keeps running
      const foeTap = await page.evaluate(async () => {
        const v = CG.town, wait = ms => new Promise(r => setTimeout(r, ms)), cv = document.getElementById('view'), t = CG.game.town, { FOES } = await import('./src/data/foes.js');
        CG.play.close();
        if (t.waves.phase === 'break') document.getElementById('callWave').click(); // the first wave may be over already
        let id = null, p = null;
        for (let i = 0; i < 80 && !p; i++) {
          for (const k of v.battle.foes.keys()) { const q = v.projectFoe(k); if (q && q.x > 20 && q.x < cv.clientWidth - 20 && q.y > 20 && q.y < cv.clientHeight - 20) { id = k; p = q; break; } }
          if (!p) await wait(100);
        }
        if (!p) return { none: true };
        const rc = cv.getBoundingClientRect(), x = rc.left + p.x + 4, y = rc.top + p.y + 3; // a little off its middle, as a finger is
        for (const type of ['pointerdown', 'pointerup']) cv.dispatchEvent(new PointerEvent(type, { pointerId: 1, clientX: x, clientY: y, bubbles: true, isPrimary: true, pointerType: 'touch' }));
        await wait(250);
        const card = document.getElementById('card'), sel = v.selection.target, f = sel && t.waves.foes.find(z => z.id === sel.foe);
        const name = (card.querySelector('h2') || {}).textContent, hp = (card.querySelector('.foestat.hp b') || {}).textContent || '';
        const want = f ? FOES[f.kind].name : null, steps = CG.game.stats.steps, wide = card.scrollWidth > card.clientWidth + 1; // never a sideways scroll (2026.11.22-9: "6.20K / 10.0K" ran out of its cell on a desktop)
        await wait(800);
        const u = sel && v.battle.foes.get(sel.foe), ring = v.selection.group.position, alive = !!(f && f.hp > 0 && u);
        const follows = !alive || Math.hypot(ring.x - u.obj.position.x, ring.z - u.obj.position.z) < .3;
        const out = { wide, open: !card.hidden && card.classList.contains('foecard'), name, want, hp, foe: sel && sel.foe, follows, runs: CG.game.stats.steps > steps, current: CG.play.current() };
        CG.play.close();
        return out;
      });
      if (!foeTap.none && (foeTap.wide || !foeTap.open || !foeTap.want || foeTap.name !== foeTap.want || !/^\S{1,4} \/ \S{1,4}$/.test(foeTap.hp) || !foeTap.follows || !foeTap.runs)) bad.push('tapping a raider: ' + JSON.stringify(foeTap));
      if (foeTap.none) bad.push('tapping a raider: no raider came into view to tap');
      // the boss bar (owner, 2026-11-22): a boss on the road shows a bar with its name, health and stage; it keeps one
      // width as its health falls and its stage starts, nothing else on the top bar moves, a tap opens the boss's
      // card, and once the boss falls it says so for a moment and goes
      const bossBar = await page.evaluate(async () => {
        const t = CG.game.town, ws = t.waves, wait = ms => new Promise(r => setTimeout(r, ms)), { FOES, STAGE_WORDS } = await import('./src/data/foes.js');
        const kind = t.def.boss || 'wagon', F = FOES[kind], bar = document.getElementById('bossBar');
        CG.play.close();
        const box = n => { if (!n || n.hidden) return null; const r = n.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)].join(','); };
        // laid-out places (offsets, not screen boxes), so a goal sliding in on its own never reads as the bar moving it
        const lay = n => (!n || n.hidden ? null : [n.offsetLeft, n.offsetTop, n.offsetWidth, n.offsetHeight].join(','));
        const others = () => ['#placeBar', '#wave', '.hudleft > .hudrow', '#goal', '.hudright'].map(s => lay(document.querySelector(s))).join('|');
        const before = others(), hiddenFirst = bar.hidden;
        if (ws.phase === 'break') document.getElementById('callWave').click();
        const lane = 0, s = Math.min(6, (ws.foes[0] && ws.foes[0].s) || 4), max = 1e9;
        const f = { id: ws.nextId++, kind, lane, hp: max, max, s, slow: 0, slowT: 0, frozenT: 0, poison: 0, poisonT: 0, rot: 0, eat: 0, brittle: 0 };
        ws.foes.push(f); await wait(400);
        const shown = !bar.hidden, name = (bar.querySelector('.bname') || {}).textContent, w0 = box(bar), mid = others();
        const widths = new Set([w0]);
        for (const k of [.9, .7, .55]) { f.hp = max * k; await wait(250); widths.add(box(bar)); }
        f.hp = max * (F.stages[0].at - .05); await wait(500); widths.add(box(bar));
        // the stage is a picture now, with its words as the label (review of 2026.11.23-9); the picture must be drawn
        const sn = bar.querySelector('.bstage'), stage = sn && sn.children.length === 2 ? sn.getAttribute('aria-label') : 'no picture', after = others();
        bar.click(); await wait(250);
        const card = document.getElementById('card'), cardName = (card.querySelector('h2') || {}).textContent, opened = !card.hidden && card.classList.contains('foecard');
        CG.play.close();
        f.hp = -1; await wait(400);
        const down = (bar.querySelector('.bname') || {}).textContent; widths.add(box(bar));
        await wait(2200);
        const gone = bar.hidden;
        ws.foes = ws.foes.filter(x => x.kind === F.stages[0].drop ? false : true);
        return { hiddenFirst, shown, name, want: F.name, widths: [...widths], stage, wantStage: STAGE_WORDS[F.stages[0].key], same: before === mid && mid === after, before, after, cardName, opened, down, gone };
      });
      // the workers called to arms can be tapped too (roadmap review 2026.11.22-9): a real tap on a pair by the road
      // opens their card with their building's name and the seconds left, the ring sits on them, and it says Back to work!
      // once the call ends
      const workers = await page.evaluate(async () => {
        const t = CG.game.town, v = CG.town, wait = ms => new Promise(r => setTimeout(r, ms)), cv = document.getElementById('view');
        CG.play.close();
        t.arms = { t: 30, cd: 300, clock: 0 }; await wait(700);
        const ids = Object.keys(t.def.board.plots || {}).filter(id => t.level(id) > 0);
        let id = null, p = null;
        for (const k of ids) { const q = v.projectWorker(k); if (q && q.x > 20 && q.x < cv.clientWidth - 20 && q.y > 200 && q.y < cv.clientHeight - 120) { id = k; p = q; break; } }
        if (!p) { t.arms.t = 0; return { none: true, ids: ids.length }; }
        const rc = cv.getBoundingClientRect(), x = rc.left + p.x + 3, y = rc.top + p.y + 2;
        for (const type of ['pointerdown', 'pointerup']) cv.dispatchEvent(new PointerEvent(type, { pointerId: 1, clientX: x, clientY: y, bubbles: true, isPrimary: true, pointerType: 'touch' }));
        await wait(300);
        const card = document.getElementById('card'), sel = v.selection.target, name = (card.querySelector('h2') || {}).textContent || '';
        const back = (card.querySelector('.foestat b') || {}).textContent || '', open = !card.hidden && card.classList.contains('workercard');
        const wide = card.scrollWidth > card.clientWidth + 1;
        t.arms.t = 0; await wait(500);
        const said = (card.querySelector('.foestat.gone .flabel') || {}).textContent || null;
        await wait(1900);
        const closed = card.hidden;
        return { id, open, name, back, sel: sel && sel.worker, said, closed, wide };
      });
      if (workers.none) bad.push('the workers card: no workers came into view to tap ' + JSON.stringify(workers));
      else if (!workers.open || !/ workers$/.test(workers.name) || !/^\d{1,2}s$/.test(workers.back) || workers.sel !== workers.id || workers.said !== 'Back to work!' || !workers.closed || workers.wide) bad.push('the workers card: ' + JSON.stringify(workers));
      if (!bossBar.hiddenFirst || !bossBar.shown || bossBar.name !== bossBar.want || bossBar.widths.length !== 1 || bossBar.stage !== bossBar.wantStage || !bossBar.same || !bossBar.opened || bossBar.cardName !== bossBar.want || bossBar.down !== bossBar.want + ' down!' || !bossBar.gone) bad.push('the boss bar: ' + JSON.stringify(bossBar));
      if (shade.cast || shade.auto || shade.rate > .5 || !shade.redrawn) bad.push('raiders cast a sun shadow, the shadow map is drawn every frame, or not after a level up: ' + JSON.stringify(shade));
      // a tower card with its damage opened up keeps Upgrade in view and clears Pause, Hold waves and the coins
      await page.evaluate(async () => { const t = CG.game.town, tw = t.towers.find(x => x.spot === 3); tw.level = 3; for (const g of ['timber', 'ore', 'copper', 'bricks', 'tools', 'planks', 'clay']) t.goods[g] = Math.max(t.goods[g] || 0, 4321); CG.play.close(); CG.play.openSpot(3); await new Promise(r => setTimeout(r, 150)); const b = document.querySelector('#card [data-why="dmg"]'); if (b) b.click(); await new Promise(r => setTimeout(r, 400)); });
      bad.push(...(await uncovered(page)).map(b => 'tower card: ' + b));
      await page.evaluate(async () => { CG.play.close(); CG.play.open('camp'); await new Promise(r => setTimeout(r, 150)); const b = document.querySelector('#card .stat'); if (b) b.click(); await new Promise(r => setTimeout(r, 400)); });
      bad.push(...(await uncovered(page)).map(b => 'building card: ' + b));
      await page.evaluate(() => CG.play.close());
      // the second fork at level 20 (M6a): a level-19 Still and a level-19 Cannon show both sides, and two taps on one takes it
      for (const [kind, want, took] of [['still', 'Slow Rot,Last Call', 'Slow Rot'], ['cannon', 'Rocket Battery,Big Shell', 'Rocket Battery'], ['crossbow', 'Piercing Bolts,Sharpshooter', 'Piercing Bolts'], ['frost', 'Blizzard,Cold Snap', 'Blizzard']]) {
      const fork = await page.evaluate(async kind => {
        const t = CG.game.town, keep = JSON.stringify(t.towers), goods = JSON.stringify(t.goods), coins = t.coins, wait = ms => new Promise(r => setTimeout(r, ms));
        t.towers = t.towers.filter(x => x.spot !== 2).concat([{ spot: 2, kind, level: 19, path: 'a', fork: null, cd: 0, spent: 0, pulses: 0 }]);
        CG.town.pause('smoke', true); t.coins = 1e15; for (const g of ['ore', 'planks', 'timber', 'copper', 'bricks', 'clay', 'tools']) t.goods[g] = Math.max(t.goods[g] || 0, 1e9); // paused, so the yard's cap does not trim them before the tap
        CG.play.close(); CG.play.openSpot(2); await wait(200);
        const opts = [...document.querySelectorAll('#card .option')].map(o => o.querySelector('b').textContent);
        const go = document.querySelector('#card [data-path="a"]'); if (go) { go.click(); await wait(100); const again = document.querySelector('#card [data-path="a"]'); if (again) again.click(); await wait(200); }
        const tw = t.towers.find(x => x.spot === 2), took = tw && tw.fork, name = (document.querySelector('#card h2') || {}).textContent;
        // on a short landscape screen both Choose buttons show without scrolling (review of 2026.11.21-8, fork-land)
        CG.play.close(); t.towers = t.towers.filter(x => x.spot !== 2).concat([{ spot: 2, kind, level: 19, path: 'a', fork: null, cd: 0, spent: 0, pulses: 0 }]); CG.play.openSpot(2); await wait(150);
        const c2 = document.querySelector('#card'), r2 = c2 && c2.getBoundingClientRect(), hidden = [...document.querySelectorAll('#card .option .btn')].filter(b => { const r = b.getBoundingClientRect(); return r.bottom > r2.bottom + 1 || r.top < r2.top - 1 || r.bottom > innerHeight; }).length;
        // each side's name on one line, clear of its Choose button (clarity fix 8b: "Rocket / Battery" wrapped in landscape)
        const wraps = [...document.querySelectorAll('#card .option')].filter(o => { const b = o.querySelector('b'), go = o.querySelector('.btn'), rg = document.createRange(); rg.selectNodeContents(b); const lines = new Set([...rg.getClientRects()].filter(r => r.width > 0).map(r => Math.round(r.top))).size, br = rg.getBoundingClientRect(), gr = go.getBoundingClientRect(); return lines > 1 || br.right > o.getBoundingClientRect().right - 2 || (br.right > gr.left && br.bottom > gr.top && br.top < gr.bottom); }).map(o => o.querySelector('b').textContent);
        // short of every good: each short good has its own line under the price, in view beside the gray Choose
        // buttons, and the buttons stay in view too (review of 2026.11.24-2: gray buttons with no reason in view)
        const D = await import(new URL('src/core/defense.js', location.href).href), needs = Object.keys(D.towerCost(t, kind, 19).goods).filter(g => D.towerCost(t, kind, 19).goods[g] > 0);
        for (const g of Object.keys(t.goods)) t.goods[g] = 0;
        CG.play.close(); t.towers = t.towers.filter(x => x.spot !== 2).concat([{ spot: 2, kind, level: 19, path: 'a', fork: null, cd: 0, spent: 0, pulses: 0 }]); CG.play.openSpot(2); await wait(150);
        const c3 = document.querySelector('#card'), r3 = c3.getBoundingClientRect(), inView = el => { const r = el.getBoundingClientRect(); return r.height > 0 && r.top >= r3.top - 1 && r.bottom <= Math.min(r3.bottom, innerHeight) + 1; };
        const notes = [...c3.querySelectorAll('.pathnotes > p')].filter(inView).length, gray = [...c3.querySelectorAll('.option .btn')], shortOk = notes >= needs.length && gray.every(b => b.disabled && inView(b));
        CG.play.close(); t.towers = JSON.parse(keep); const was = JSON.parse(goods); for (const g of Object.keys(t.goods)) t.goods[g] = was[g] || 0; t.coins = coins; CG.town.pause('smoke', false);
        return { opts, took, name, hidden, wraps, notes, needs: needs.length, shortOk };
      }, kind);
      if (fork.opts.join() !== want || fork.took !== 'a' || fork.name !== took || fork.hidden || fork.wraps.length || !fork.shortOk) bad.push('the level-20 fork card (' + kind + '): ' + JSON.stringify(fork));
      }
      // nothing half under a tower card's price bar (reviews of 2026.11.21-7 to -9): Sell is in the head and whole, and
      // every stat row sits above the pinned bar, on level-20 cards short of goods (the tallest) and a plain one
      const under = await page.evaluate(async () => {
        const t = CG.game.town, keep = JSON.stringify(t.towers), goods = JSON.stringify(t.goods), wait = ms => new Promise(r => setTimeout(r, ms)), out = [];
        CG.town.pause('smoke', true);
        for (const [kind, level, fork] of [['cannon', 20, 'b'], ['cannon', 20, 'a'], ['still', 20, 'a'], ['crossbow', 20, 'b'], ['frost', 20, 'b'], ['crossbow', 3, null]]) {
          t.towers = t.towers.filter(x => x.spot !== 2).concat([{ spot: 2, kind, level, path: level >= 5 ? 'a' : null, fork, cd: 0, spent: 5000, pulses: 0 }]);
          for (const g of Object.keys(t.goods)) t.goods[g] = 0;
          CG.play.close(); CG.play.openSpot(2); await wait(250);
          const card = document.getElementById('card'), bar = card.querySelector(':scope > .buybar:not(.pathbar)'); card.scrollTop = 0; await wait(50);
          if (!bar) { out.push(kind + level + ': no price bar'); continue; }
          const b = bar.getBoundingClientRect(), sell = document.getElementById('sellTowerHead'), sr = sell && sell.getBoundingClientRect();
          if (!sr || !sr.width || sr.bottom > b.top || sr.top < card.getBoundingClientRect().top - 1) out.push(kind + level + ': Sell not whole in the head');
          for (const e of card.querySelectorAll('.statrow, .statline')) { const r = e.getBoundingClientRect(); if (r.height && r.bottom > b.top + 1) out.push(kind + level + ': "' + e.textContent.slice(0, 24) + '" under the price bar'); }
          for (const e of card.querySelectorAll(':scope > p')) { const r = e.getBoundingClientRect(); if (r.height && r.top < b.top - 1 && r.bottom > b.top + 1) out.push(kind + level + ': "' + e.textContent.slice(0, 24) + '" half under the price bar'); }
        }
        CG.play.close(); t.towers = JSON.parse(keep); const was = JSON.parse(goods); for (const g of Object.keys(t.goods)) t.goods[g] = was[g] || 0; CG.town.pause('smoke', false);
        return out;
      });
      bad.push(...under);
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
        out.says = /Save timber for towers · On/.test(document.getElementById('card').textContent);
        document.getElementById('keepTowers').click(); await wait(50);
        out.off = !!t.reserveOff.timber && !t.keep.timber && /Off/.test(document.getElementById('keepTowers').textContent);
        document.getElementById('keepTowers').click(); await wait(50);
        out.on = !t.reserveOff.timber && t.keep.timber > 0;
        CG.town.pause('smoke', true); t.goods.timber = 0; CG.play.openSpot(3); await wait(400); // paused, so the camp makes none meanwhile
        const sh = document.querySelector('#card .short, #card .soon'), low = [...document.querySelectorAll('#card .costrow .need.low')].map(n => n.textContent);
        out.short = !!sh && /Lumber Camp|Enough timber in about/.test(sh.textContent); // a wait under 20 s has no advice
        // "Enough timber in about ..." is good news: plain ink, not red (#f07067)
        out.calm = !!sh && (/^Enough /.test(sh.textContent) === sh.classList.contains('soon')) && (!sh.classList.contains('soon') || !/240, 112, 103/.test(getComputedStyle(sh).color));
        out.haveNeed = low.some(x => /^\d+ timberhave 0$/.test(x)); // the price, then have under it, red when short (review of 2026.11.20-14)
        // coins too, kept up with the purse in place (review 2026-11-18): short shows red, enough shows plain
        // (the card is rebuilt when the coins cross the price, so the cell is looked up again each time)
        const cell = () => document.querySelector('#card .costrow .coinneed'), c0 = cell(), need = c0 ? +c0.dataset.need : 0, had = CG.game.shared.purse.coins;
        CG.game.shared.purse.coins = Math.max(0, need - 1); await wait(450);
        let cn = cell(); out.coinShort = !!cn && cn.classList.contains('low') && /^[\d.KM]+ coinshave [\d.KM]+$/.test(cn.textContent);
        CG.game.shared.purse.coins = need + 5; await wait(450);
        cn = cell(); out.coinOk = !!cn && !cn.classList.contains('low') && /^[\d.KM]+ coinshave [\d.KM]+$/.test(cn.textContent);
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
        bad.push(...(await check(page)).filter(b => b.startsWith('broken text')).map(b => open + ': ' + b));
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
      // Sell spare opens the four sell modes under its row; each pick sets the mode and closes them (Market depth, part 1)
      const goods = await page.evaluate(async () => {
        const wait = ms => new Promise(r => setTimeout(r, ms)), t = CG.game.town, out = {};
        const b = document.querySelector('#sheet .option button[data-good="timber"]'), pick = document.querySelector('#sheet .sellpick[data-good="timber"]');
        if (!b || !pick || document.getElementById('sheet').hidden) return { found: false };
        const was = t.sell.timber;
        for (const [mode, want] of [['skip', 'skip'], ['boom', 'boom'], ['off', false], ['always', undefined]]) {
          b.click(); await wait(80);
          const btns = [...pick.querySelectorAll('[data-mode]')], sheet = document.getElementById('sheet').getBoundingClientRect();
          out.opens = (out.opens ?? true) && !pick.hidden && btns.length === 4;
          out.fits = (out.fits ?? true) && btns.every(x => { const r = x.getBoundingClientRect(); return r.height >= 30 && r.left >= sheet.left - 1 && r.right <= sheet.right + 1 && x.scrollWidth <= x.clientWidth + 1; });
          btns.find(x => x.dataset.mode === mode).click(); await wait(80);
          out[mode] = t.sell.timber === want && pick.hidden && b.textContent.includes(({ always: 'Always', skip: 'Skip busts', boom: 'Booms only', off: 'Off' })[mode]);
        }
        if (was === undefined) delete t.sell.timber; else t.sell.timber = was;
        // a boom on timber: the strip chip gets its arrow and keeps its box
        const m = CG.game.shared.market, keep = { boom: m.boom, event: m.event, wait: m.wait };
        const chip = document.querySelector('#goodsStrip .goodchip[data-good="timber"]'), box = c => { const r = c.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.width), Math.round(r.top), Math.round(r.height)].join(); };
        const b0 = chip && box(chip);
        m.boom = { good: 'timber', f: 1.6, left: 75 }; m.event = { timber: 1.6 }; m.wait = 200; await wait(450);
        const row = document.querySelector('#sheet [data-why="timber"] .evword');
        out.chip = !!chip && chip.classList.contains('boom') && box(chip) === b0 && getComputedStyle(chip, '::after').borderBottomWidth === '7px' && getComputedStyle(chip).outlineStyle === 'solid';
        // the row: an arrow up and the time left, a picture, not the word Boom (review of 2026.11.23-6)
        const evl = document.querySelector('#sheet [data-why="timber"] .evline');
        out.row = !!row && !row.hidden && !!evl && !evl.hidden && /^Price up for \d:\d\d more$/.test(evl.textContent) && getComputedStyle(row, '::before').borderBottomWidth === '8px' && /^Price up for/.test(row.getAttribute('aria-label') || '');
        m.boom = { good: 'timber', f: .6, left: 30 }; m.event = { timber: .6 }; await wait(450);
        out.bust = !!chip && chip.classList.contains('bust') && box(chip) === b0 && !!row && !!evl && /^Price down for 0:\d\d more$/.test(evl.textContent) && evl.classList.contains('bust') && getComputedStyle(row, '::before').borderTopWidth === '8px' && /^Price down for/.test(row.getAttribute('aria-label') || '');
        Object.assign(m, keep); await wait(450);
        out.cleared = !!chip && !chip.classList.contains('boom') && !chip.classList.contains('bust') && !!row && row.hidden && !!evl && evl.hidden;
        return out;
      });
      for (const [k, v] of Object.entries(goods)) if (!v) bad.push('the Goods sheet sell modes: not ' + k);
      // town orders (Market depth, part 2): the board on the Goods sheet, Take with one tap, Switch with two, each
      // row inside the sheet with no sideways scroll, and the time left in a fixed cell
      const ord = await page.evaluate(async () => {
        const wait = ms => new Promise(r => setTimeout(r, ms)), t = CG.game.town, o = CG.game.shared.orders, out = {};
        const keep = { wait: o.wait, st: o.towns[t.id], seen: (CG.game.shared.seen || {}).orders };
        CG.game.shared.seen.orders = true; o.wait = 0;
        const offer = (id, rush) => ({ id, good: 'timber', need: 330, got: 0, coins: 396, minutes: 5.5, time: 660, left: 660, rush, age: 0 });
        const st = o.towns[t.id] = { rep: 24, offers: [offer(1, false), offer(2, true)], active: null, n: 3, wait: 999, filled: 0, missed: 0 };
        document.getElementById('sheetClose').click(); await wait(80); document.getElementById('goodsBtn').click(); await wait(400);
        const sheet = document.getElementById('sheet'), body = sheet.querySelector('.sheetbody'), sr = sheet.getBoundingClientRect();
        const inside = n => { const r = n.getBoundingClientRect(); return r.height >= 30 && r.left >= sr.left - 1 && r.right <= sr.right + 1; };
        out.board = !!document.getElementById('orders') && /^Reputation 24 of 100$/.test(document.querySelector('#orderRep b').textContent);
        // the sheet opens on the Orders heading and the reputation, not scrolled past them (2026.11.22-4 shots)
        const h = document.querySelector('#orders h3').getBoundingClientRect(), br = body.getBoundingClientRect(), pin = sheet.querySelector('.stockrow');
        out.headingShows = h.top >= (pin ? pin.getBoundingClientRect().bottom : br.top) - 1 && document.querySelector('#orderRep').getBoundingClientRect().bottom <= br.bottom + 1;
        const takes = [...sheet.querySelectorAll('button[data-order]')];
        out.offers = takes.length === 2 && takes.every(inside) && !!sheet.querySelector('#orders .lbl');
        out.noSideways = body.scrollWidth <= body.clientWidth + 1;
        takes[0].click(); await wait(400);
        out.took = !!st.active && st.active.id === 1 && !!document.getElementById('orderRun');
        const left = document.getElementById('orderLeft');
        out.left = !!left && /^\d+:\d\d left$/.test(left.textContent);
        const w0 = left && left.getBoundingClientRect().width; st.active.left = 9; await wait(400);
        out.fixed = !!left && left.isConnected && Math.abs(left.getBoundingClientRect().width - w0) < .5;
        const sw = sheet.querySelector('button[data-order="2"]');
        sw.click(); await wait(80); out.armed = st.active.id === 1 && /reputation/.test(sw.textContent);
        sw.click(); await wait(400); out.switched = !!st.active && st.active.id === 2 && st.rep === 9;
        document.getElementById('orderDrop').click(); await wait(60); document.getElementById('orderDrop').click(); await wait(400);
        out.gaveUp = !st.active && !document.getElementById('orderRun');
        o.wait = keep.wait; if (keep.st) o.towns[t.id] = keep.st; else delete o.towns[t.id];
        if (keep.seen) CG.game.shared.seen.orders = keep.seen; else delete CG.game.shared.seen.orders;
        document.getElementById('sheetClose').click(); await wait(80); document.getElementById('goodsBtn').click(); await wait(300);
        out.gone = !document.getElementById('orders');
        return out;
      });
      for (const [k, v] of Object.entries(ord)) if (!v) bad.push('the Goods sheet orders: not ' + k);
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
        // the drawing buffer follows the view's pixel ratio (sharper models, 2026-11-22: med draws at 1.5 with FXAA)
        const V = CG.town.view, cv = V.canvas, want = Math.round(cv.clientWidth * Math.min(V.ratio, devicePixelRatio || 1) * (V.tier === 'low' ? .85 : 1));
        out.sharp = Math.abs(cv.width - want) <= 1 && (V.tier !== 'med' || V.ratio >= 1.5);
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
        out.sheet = !sheet.hidden && sheet.dataset.id === 'perks' && /Sign now and get/.test(sheet.textContent) && !document.getElementById('signCharter').disabled;
        // clarity fix 9: the two plain lines show, and with no deeds held After signing stays hidden (it would only say the deed line again)
        out.lines = ['charterKeep', 'charterDeed'].every(id => { const e = document.getElementById(id); return e && e.offsetHeight > 0 && e.textContent.length > 20; }) && document.getElementById('deedsAfter').hidden === !CG.game.shared.charter.deeds;
        // Sign the charter whole in view without a scroll, above the scroll fade (clarity fix 8b: below the fold in landscape)
        { const bd = sheet.querySelector('.sheetbody'), sg = document.getElementById('signCharter'); bd.scrollTop = 0; await wait(80); const a = bd.getBoundingClientRect(), b = sg.getBoundingClientRect(); out.signInView = b.height > 20 && b.top >= a.top - 1 && b.bottom <= a.bottom - 6 && b.bottom <= innerHeight; if (!out.signInView) out.signAt = [Math.round(b.top), Math.round(b.bottom), Math.round(a.top), Math.round(a.bottom)].join(); }
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
        out.lineUp = !w.disabled && w.textContent === 'Research';
        w.click(); await wait(400); out.linedUp = t.labNext === 'walls' && w.textContent === 'Up next' && t.lab.id === 'saws';
        w.click(); await wait(400); out.offLine = t.labNext === null && w.textContent === 'Research';
        out.label = /^Research[0-9]+ (sec|min)$/.test(btn.textContent); // the time on its own line, so the column keeps its width
        out.tradeoff = /1 more timber for each copper or brick/.test(sheet.textContent);
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
        out.income = !sheet.hidden && sheet.dataset.id === 'income' && /Selling timber/.test(sheet.textContent) && / a second$/.test(sheet.querySelector('.explain .total b')?.textContent || '');
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
        // the card never covers the goods strip, so the stone the goal asks for stays in view (clarity fix 8b: the welcome
        // card lay over the strip while the goal asked for 4 more stone)
        { const st = document.getElementById('goodsStrip'), cc = document.querySelector('#coach .coachcard'); await wait(300); const a = st.getBoundingClientRect(), c = cc.getBoundingClientRect(); out.stripClear = st.hidden || !(a.left < c.right - 1 && c.left < a.right - 1 && a.top < c.bottom - 1 && c.top < a.bottom - 1); }
        CG.coach.skipAll(); await wait(100);
        // the goal strip starts on the first Crossbow, with the spotlight on a stone pad
        const gl = document.getElementById('goal'), gt = () => gl.hidden ? '' : gl.querySelector('.gtext').textContent.replace(/\s/g, ' '), mk = document.getElementById('goalMark');
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
        // before wave 1 the next step costs nothing: Call now, with the spotlight on it (clarity fix 4)
        if (t.wave === 1 && t.waves.phase === 'break') {
          const cb = document.getElementById('callWave'), mr0 = mk.getBoundingClientRect(), cr = cb.getBoundingClientRect();
          out.goalCall = gt() === 'Tap Call now to start wave 1 and get bonus coins' && !mk.hidden && mr0.left <= cr.left + 1 && mr0.right >= cr.right - 1 && mr0.top <= cr.top + 1 && mr0.bottom >= cr.bottom - 1;
          cb.click(); await wait(300); await wait(1800);
        } else out.goalCall = true; // wave 1 came on its own first: the step is done
        // with the lot's price as have / need (clarity pass)
        out.goalNext = /^Tap the Copper Camp lot, then tap Build(\. \d+ \/ \d+ coins.*)?$/.test(gt()) && !!g.shared.goals.done['dc-tower'] && !!g.shared.goals.done['dc-stone2'];
        const mr = mk.getBoundingClientRect(), tr = document.querySelector('.tag[data-plot="dmine"]').getBoundingClientRect();
        out.goalMarkOnTag = !mk.hidden && mr.left <= tr.left && mr.right >= tr.right && mr.top <= tr.top && mr.bottom >= tr.bottom;
        const r = gl.getBoundingClientRect(); out.goalOnScreen = r.left >= 0 && r.right <= innerWidth + .5 && r.bottom < innerHeight / 2;
        // a tap on the strip opens the card of the lot it names, with its Build button (clarity fix 3b part 2)
        gl.click(); await wait(150);
        out.goalOpensCard = CG.play.current() === 'dmine' && !!document.querySelector('#card #buy');
        CG.play.close(); await wait(100);
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
      // the first boom: its explainer shows once, with the spotlight on the good's chip (Market depth, part 1)
      const boomCard = await page.evaluate(async () => {
        const wait = ms => new Promise(r => setTimeout(r, ms)), m = CG.game.shared.market, chip = document.querySelector('#goodsStrip .goodchip');
        if (!chip) return 'no chip';
        const g = chip.dataset.good, keep = { boom: m.boom, event: m.event, wait: m.wait };
        delete CG.game.shared.seen.boom; m.boom = { good: g, f: 1.6, left: 80 }; m.event = { [g]: 1.6 }; m.wait = 300;
        for (let i = 0; i < 40 && CG.coach.current !== 'boom'; i++) await wait(100);
        if (CG.coach.current !== 'boom') return 'no card';
        const hole = document.querySelector('#coach .hole').getBoundingClientRect(), c = chip.getBoundingClientRect(), text = document.querySelector('#coach .coachcard p').textContent;
        const lit = !document.querySelector('#coach .hole').hidden && hole.left <= c.left && hole.right >= c.right && hole.top <= c.top && hole.bottom >= c.bottom;
        // a spotlight at the foot of the screen: the card covers neither it nor the place's name in the top bar
        // (review of 2026.11.24-2: on a short landscape screen the tip card covered "Dry" of Dry Creek)
        const cr = document.querySelector('#coach .coachcard').getBoundingClientRect(), pb = document.getElementById('placeBar').getBoundingClientRect();
        const meet = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
        // (on a phone held upright the card has no side to go to, so it takes the top there)
        const over = [meet(cr, hole) && 'the spotlight', innerWidth > innerHeight && pb.height && meet(cr, pb) && 'the place name'].filter(Boolean);
        CG.coach.dismiss(); Object.assign(m, keep);
        return lit && text.includes(chip.title.split(',')[0]) && !over.length ? '' : 'spotlight ' + lit + ' text ' + text + (over.length ? ' card covers ' + over.join(' and ') : '');
      });
      if (boomCard) bad.push('the boom explainer: ' + boomCard);
      // the workers' card: its spotlight lies on the workers by the road, not on their building (clarity fix 8b)
      const workCard = await page.evaluate(async () => {
        const wait = ms => new Promise(r => setTimeout(r, ms)), t = CG.game.town, keep = t.arms;
        delete CG.game.shared.seen['worker-tap']; t.arms = { t: 30, cd: 300, clock: 0 };
        for (let i = 0; i < 60 && CG.coach.current !== 'worker-tap'; i++) await wait(100);
        if (CG.coach.current !== 'worker-tap') { t.arms = keep; return 'no card'; }
        await wait(600);
        const tg = CG.coach.target(), id = tg && tg.worker, w = id && CG.town.projectWorker(id), home = id && CG.town.project(id), hb = document.querySelector('#coach .hole'), h = hb.getBoundingClientRect();
        const inside = p => !!p && p.x >= h.left && p.x <= h.right && p.y >= h.top && p.y <= h.bottom;
        const out = !hb.hidden && inside(w) && !inside(home) ? '' : 'box ' + [h.left, h.top, h.width, h.height].map(Math.round).join() + ' workers ' + (w ? Math.round(w.x) + ',' + Math.round(w.y) : '-') + ' building ' + (home ? Math.round(home.x) + ',' + Math.round(home.y) : '-');
        CG.coach.dismiss(); t.arms = { t: 0, cd: 0, clock: 0 }; await wait(200);
        return out;
      });
      if (workCard) bad.push('the workers card: ' + workCard);
      // town orders: their explainer shows once, with the spotlight on Goods (Market depth, part 2)
      const ordCard = await page.evaluate(async () => {
        const wait = ms => new Promise(r => setTimeout(r, ms)), t = CG.game.town, o = CG.game.shared.orders, keep = { wait: o.wait, st: o.towns[t.id] };
        const btn = document.getElementById('goodsBtn');
        if (!btn || btn.hidden) return 'no Goods button';
        delete CG.game.shared.seen.orders; o.wait = 0; o.towns[t.id] = { rep: 0, offers: [], active: null, n: 1, wait: 999, filled: 0, missed: 0 };
        for (let i = 0; i < 40 && CG.coach.current !== 'orders'; i++) await wait(100);
        const cur = CG.coach.current, hole = document.querySelector('#coach .hole').getBoundingClientRect(), c = btn.getBoundingClientRect();
        const lit = hole.left <= c.left && hole.right >= c.right && hole.top <= c.top && hole.bottom >= c.bottom;
        if (cur === 'orders') CG.coach.dismiss();
        o.wait = keep.wait; if (keep.st) o.towns[t.id] = keep.st; else delete o.towns[t.id];
        return cur !== 'orders' ? 'no card (' + cur + ')' : lit ? '' : 'no spotlight on Goods';
      });
      if (ordCard) bad.push('the orders explainer: ' + ordCard);
      // the Mortar's card spotlights a pit that the map first leaves under the top bar: the map slides the pit into
      // the free part, and the box lies on the pit, never on Hold waves (clarity fix 10, review 10). Seen red with the
      // slide taken out: the box lay on the top bar.
      const pitCard = await page.evaluate(async () => {
        const wait = ms => new Promise(r => setTimeout(r, ms)), t = CG.game.town, B = t.def.board;
        const pit = B.spots.findIndex((_, k) => (B.pits ? B.pits.includes(k) : k >= (B.far ?? B.spots.length)));
        if (pit < 0) return 'no pit';
        const hb = document.getElementById('holdWaves').getBoundingClientRect();
        CG.town.bring({ spot: pit }, hb.left + hb.width / 2, hb.top + hb.height / 2); await wait(900); // the pit now lies under Hold waves
        const keep = !!t.flags['open:mortar'];
        delete CG.game.shared.seen.mortar; t.flags['open:mortar'] = true;
        for (let i = 0; i < 40 && CG.coach.current !== 'mortar'; i++) await wait(100);
        if (CG.coach.current !== 'mortar') { if (!keep) delete t.flags['open:mortar']; return 'no card (' + CG.coach.current + ')'; }
        await wait(1200); // the map slides
        const tg = CG.coach.target(), p = CG.town.projectSpot(tg.spot), hn = document.querySelector('#coach .hole'), h = hn.getBoundingClientRect(), hw = document.getElementById('holdWaves').getBoundingClientRect();
        const on = !hn.hidden && p && p.x >= h.left && p.x <= h.right && p.y >= h.top && p.y <= h.bottom;
        const meet = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
        const onHold = !hn.hidden && meet(h, hw);
        CG.coach.dismiss(); if (!keep) delete t.flags['open:mortar'];
        return on && !onHold ? '' : 'box on the pit ' + on + ', on Hold waves ' + onHold;
      });
      if (pitCard) bad.push('the Mortar card spotlight: ' + pitCard);
      // the place bar: the name, Map, and the back button to Dry Creek, all on one row that fits the screen
      const chip = await page.evaluate(() => ({ goal: document.querySelector('#goal .gtext').textContent, dcGo: !!CG.game.shared.goals.done['dc-go'] }));
      if (!/^(Tap a stone pad and build a Crossbow|Wait for \d+ more (coins|timber|stone)( and \d+ more (timber|stone))?, then tap a stone pad)$/.test(chip.goal) || !chip.dcGo) bad.push('the Gulch goals did not start (' + chip.goal + ')');
      // after a charter the strip asks for an old tower back (the newcomer's Ridge wall): a low Crossbow stands where a
      // Frost Lens stood. The spotlight lies on the Crossbow, then on Sell in its card, then on the Frost Lens's Build
      const swap = await page.evaluate(async () => {
        const wait = ms => new Promise(r => setTimeout(r, ms)), g = CG.game, t = g.town, B = t.def.board;
        const D = await import(new URL('src/core/defense.js', location.href).href);
        const keep = { flag: t.flags['open:frost'], plan: t.plan, coins: g.shared.purse.coins, goods: { ...t.goods }, done: { ...g.shared.goals.done } };
        t.flags['open:frost'] = true; g.shared.purse.coins = Math.max(g.shared.purse.coins, 1e5);
        for (const k of ['timber', 'planks', 'clay']) t.goods[k] = Math.max(t.goods[k] || 0, 200);
        const spot = B.spots.findIndex((_, i) => !D.towerAt(t, i) && D.fitsSpot(t, i, 'crossbow'));
        if (spot < 0 || !D.buildTower(g, t, spot, 'crossbow')) return 'no free pad';
        t.plan = [{ spot, kind: 'frost' }];
        CG.play.close(); CG.town.bring({ spot }, innerWidth / 2, innerHeight * .6);
        const gl = document.getElementById('goal'), mk = document.getElementById('goalMark'), gt = () => gl.hidden ? '' : gl.querySelector('.gtext').textContent;
        const covers = (b) => { const m = mk.getBoundingClientRect(); return !mk.hidden && m.left <= b.left + 1 && m.right >= b.right - 1 && m.top <= b.top + 1 && m.bottom >= b.bottom - 1; };
        const holds = p => { const m = mk.getBoundingClientRect(); return !mk.hidden && p && p.x >= m.left && p.x <= m.right && p.y >= m.top && p.y <= m.bottom; };
        const out = [];
        for (let i = 0; i < 30 && !/Sell/.test(gt()); i++) await wait(100);
        await wait(900);
        if (!/^Tap the Crossbow, tap Sell, then build a Frost Lens there/.test(gt())) out.push('strip "' + gt() + '"');
        if (!holds(CG.town.projectSpot(spot))) out.push('no spotlight on the Crossbow');
        CG.play.openSpot(spot); await wait(500);
        const sell = document.getElementById('sellTowerHead');
        if (!sell || !covers(sell.getBoundingClientRect())) out.push('no spotlight on Sell');
        if (sell) sell.click(); await wait(500);
        const build = document.querySelector('#card .build[data-kind="frost"]');
        if (!build || !covers(build.getBoundingClientRect())) out.push('no spotlight on the Frost Lens Build');
        if (build) build.click(); await wait(200);
        if (!D.towerAt(t, spot) || D.towerAt(t, spot).kind !== 'frost') out.push('no Frost Lens built');
        CG.play.close();
        t.towers = t.towers.filter(x => x.spot !== spot);
        if (keep.flag) t.flags['open:frost'] = keep.flag; else delete t.flags['open:frost'];
        t.plan = keep.plan; g.shared.purse.coins = keep.coins; t.goods = keep.goods; g.shared.goals.done = keep.done;
        return out.join(', ');
      });
      if (swap) bad.push('the rebuild swap: ' + swap);
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
        const sum = rows.filter(t => t !== 'a little').reduce((a, t) => a + num(t), 0);
        return Math.abs(sum - total) <= Math.max(.051, total * .002) ? '' : rows.join(' + ') + ' is not ' + document.querySelector('.mapui .inc').textContent;
      });
      if (sums) bad.push('map labels: ' + sums);
      // every open place's label shows what its waves do (owner, 2026-11-20: "In map view it's hard to see the status of
      // the waves in each city"), a won outpost says Raids, and no label changes its size as the timers run
      const states = await page.evaluate(async () => {
        const read = () => Object.fromEntries([...document.querySelectorAll('.mapbadge')].filter(b => !b.hidden && CG.game.towns[b.dataset.site]).map(b => [b.dataset.site, { w: b.offsetWidth, h: b.offsetHeight, word: b.querySelector('.sword').textContent, mark: b.querySelector('.smark').dataset.mark, shown: !b.querySelector('.mstate').hidden }]));
        const a = read(); await new Promise(r => setTimeout(r, 2100)); const b = read(), out = [];
        for (const [id, x] of Object.entries(b)) {
          if (!x.shown || !x.mark || !/^(Fighting|On hold|No towers|Retry soon|(Wave|Raid) in \d:\d\d)$/.test(x.word)) out.push(id + ' shows "' + x.word + '"');
          if (CG.game.towns[id].won && !x.word.startsWith('Raid in') && x.word !== 'Fighting') out.push(id + ' is won but shows "' + x.word + '"');
          if (a[id] && (a[id].w !== x.w || a[id].h !== x.h) && a[id].word.split(' ')[0] === x.word.split(' ')[0]) out.push(id + ' changed size ' + a[id].w + 'x' + a[id].h + ' to ' + x.w + 'x' + x.h);
        }
        return out.join(', ');
      });
      if (states) bad.push('map states: ' + states);
      const m = await page.evaluate(() => ({
        canvases: document.querySelectorAll('canvas#view').length, town: !!CG.town, dio: CG.map.dioramas.join(), routes: CG.map.routes.join(), land: CG.map.land, kind: CG.map.routeKind,
        badges: [...document.querySelectorAll('.mapbadge')].filter(b => !b.hidden).map(b => b.dataset.site + (b.classList.contains('on') ? '*' : '')).join(),
        pause: !!document.getElementById('pauseBtn'), coins: document.getElementById('coins').textContent, back: document.getElementById('mapBack').getAttribute('aria-label'),
      }));
      // the look pass (M5b): no plate under any town, a surveyors' camp on land not open yet, dirt roads before the Rail Office
      if (m.land.plates || !m.land.camps.includes('falls') || !m.land.camps.includes('sandybend') || m.kind !== 'road') bad.push('the map land is wrong (' + JSON.stringify(m.land) + ', ' + m.kind + ')');
      if (m.canvases !== 1 || m.town || m.dio !== 'gulch,pinehollow,ridge' || m.routes !== 'gulch>ridge' || m.badges !== 'capital,drycreek,gulch*,pinehollow,ridge,sandybend,falls' || !m.pause || !/\d/.test(m.coins) || m.back !== 'Back to Copper Gulch') bad.push('the map is wrong (' + JSON.stringify(m) + ')');
      bad.push(...(await check(page)).map(b => 'map: ' + b));
      // no label covers more than a third of its own town, or any town's middle (two reviews of 2026.11.21-5: on a phone
      // the labels covered the Capital, the falls and most of Iron Ridge)
      { const cv = await page.evaluate(() => CG.mapui.cover()), big = Object.entries(cv.share).filter(([, v]) => v > 1 / 3);
        if (big.length || cv.mids.length) bad.push('map labels cover their towns (' + JSON.stringify(cv) + ')'); }
      // the ring, part 1c: at home no label sits nearer another place than its own (it reads as that place's name), and with
      // each open place's card open, that place is in the free part of the screen (not under the top bar or the card) and no
      // label covers another place's middle (seen red before 1c: Pine Hollow's label on Iron Ridge with the Ridge's card open)
      { const cv = await page.evaluate(() => CG.mapui.cover());
        if (cv.near.length) bad.push('map labels read as another place (' + cv.near.join(', ') + ')');
        const cards = await page.evaluate(async () => {
          const out = [], wait = ms => new Promise(r => setTimeout(r, ms)), r = CG.map.rig;
          for (const id of Object.keys(CG.game.towns)) {
            CG.mapui.close(); Object.assign(r.t, r.home); Object.assign(r.c, r.home); r.flick = null; await wait(300);
            CG.mapui.openSite(id); await wait(1600);
            const c = CG.mapui.cover(), other = c.mids.filter(m => !m.startsWith(m.split(' under ')[1] + ' '));
            const on = c.onOpen.map(o => o + ' on the open town');
            if (c.hid || other.length || on.length) out.push(id + ': ' + [c.hid].concat(other, on).filter(Boolean).join(', '));
            // its Play button whole and in view with the card scrolled to the top (clarity fix 8b: a long outpost card in
            // landscape had Play half under its foot)
            // the long case too: its vault under half adds a warning line (seen red that way on the old card; short cards fit)
            const T = CG.game.towns[id], hp = T.vault.hp;
            for (const low of [false, true]) {
              if (low) { T.vault.hp = Math.max(1, Math.floor(T.vault.max * .3)); await wait(1300); }
              const mc = document.getElementById('mapCard'), pb = document.getElementById('mapPlay');
              if (pb) { mc.scrollTop = 0; await wait(50); const a = mc.getBoundingClientRect(), b = pb.getBoundingClientRect(); if (b.top < a.top - 1 || b.bottom > a.bottom + 1 || b.bottom > innerHeight || b.height < 20) out.push(id + (low ? ' (vault low)' : '') + ': Play is not whole in view (' + Math.round(b.top) + '-' + Math.round(b.bottom) + ' in ' + Math.round(a.top) + '-' + Math.round(a.bottom) + ')'); }
            }
            T.vault.hp = Math.max(T.vault.hp, hp);
          }
          CG.mapui.close(); Object.assign(r.t, r.home); Object.assign(r.c, r.home); r.flick = null; await wait(900);
          return out;
        });
        if (cards.length) bad.push('map cards hide their town or labels sit on towns (' + cards.join('; ') + ')'); }
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
        // a rush contract (clarity fix 3b part 3a): its offer says Rush, its clock sits in a fixed cell that keeps one
        // width while it counts, and when it runs out the card ends it and a toast says so
        await page.evaluate(() => { const c = CG.game.shared.capital; c.opened = { rush: true, big: true }; CG.game.shared.seen['contract-rush'] = CG.game.shared.seen['contract-big'] = true; const o = c.offers[0]; o.id = c.n++; o.kind = 'rush'; o.time = 75; CG.mapui.openSite('capital'); });
        await sleep(500);
        const rushOffer = await page.evaluate(() => { const b = document.querySelector('#mapCard [data-contract]'); const row = b && b.closest('.option'); return row ? row.textContent : ''; });
        if (!/^Rush/.test(rushOffer) || !/Must arrive in .* or it is lost/.test(rushOffer)) bad.push('a rush offer does not say Rush and its time (' + rushOffer.slice(0, 80) + ')');
        await page.evaluate(() => document.querySelector('#mapCard [data-contract]').click()); await sleep(600);
        const box = () => page.evaluate(() => { const n = document.getElementById('contractLeft'); if (!n) return null; const r = n.getBoundingClientRect(); return { text: n.textContent, w: Math.round(r.width), x: Math.round(r.left) }; });
        const r1 = await box(); await sleep(2200); const r2 = await box();
        if (!r1 || !r2 || !/^1:[0-9][0-9] left$/.test(r1.text) || r1.text === r2.text || r1.w !== r2.w || r1.x !== r2.x) bad.push('the rush clock is missing, stuck or moves (' + JSON.stringify([r1, r2]) + ')');
        await page.evaluate(() => { CG.game.shared.capital.active.left = .5; });
        if (!await waitFor(page, () => !CG.game.shared.capital.active && [...document.querySelectorAll('.toast')].some(n => /ran out of time/.test(n.textContent)), 4000)) bad.push('a rush contract that ran out did not end or say so');
        bad.push(...(await check(page)).map(b => 'rush contract: ' + b));
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
        // the Rail Office lays rails on every route, and trains run on them in place of wagons
        const rail = await page.evaluate(async () => { CG.game.shared.purse.coins += 1e7; (await import('./src/core/tree.js')).foundInstitution(CG.game, 'transport'); for (let i = 0; i < 60 && !(CG.map.trains > 0 && !CG.map.wagons); i++) { CG.meter.flow['gulch>ridge'] = 4; await new Promise(r => setTimeout(r, 500)); } return { kind: CG.map.routeKind, trains: CG.map.trains, wagons: CG.map.wagons, routes: CG.map.routes.join(), fleets: CG.map.fleets }; }); // the wagons out on the road go home first, then the trains leave their depots (the ring, part 2)
        if (rail.kind !== 'rail' || !(rail.trains > 0) || rail.wagons || !rail.routes.includes('gulch>ridge')) bad.push('the Rail Office did not lay rails (' + JSON.stringify(rail) + ')');
        await page.evaluate(() => document.getElementById('capTabContracts').click()); await sleep(300);
        // with the Capital built and its card closed, at the home view, the labels still keep off the towns and the dome
        const cv = await page.evaluate(async () => { CG.mapui.close(); const r = CG.map.rig; Object.assign(r.t, r.home); Object.assign(r.c, r.home); r.flick = null; await new Promise(q => setTimeout(q, 900)); return CG.mapui.cover(); });
        if (Object.values(cv.share).some(v => v > 1 / 3) || cv.mids.length) bad.push('map labels cover their towns with the Capital built (' + JSON.stringify(cv) + ')');
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
      // the page before this one left a save, so What's new is up on the title: close it as a player would
      await page.evaluate(() => { const ok = document.getElementById('newsOk'); if (ok) ok.click(); localStorage.clear(); document.getElementById('play').click(); });
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
      if (sh.rows !== 'foremen-,towers+,retry+,research-,arms-' || sh.dot || !/Build the University at the Capital first/.test(sh.text)) bad.push('the Automation sheet is wrong (' + JSON.stringify({ ...sh, text: sh.text.slice(0, 200) }) + ')');
      bad.push(...(await check(page)).map(b => 'automation: ' + b));
      bad.push(...(await uncovered(page)).map(b => 'automation: ' + b));
      const before = await page.evaluate(() => CG.game.town.towers[0].level);
      await page.evaluate(() => document.querySelector('[data-auto="towers"]').click());
      if (!await waitFor(page, () => CG.game.town.towers[0].level > 1 && document.querySelector('[data-auto="towers"]').textContent === 'Turn off' && /Next upgrade in/.test(document.querySelector('.sheet').textContent), 4000)) bad.push('Auto-towers did not raise the tower (level ' + before + ')');
      bad.push(...(await check(page)).map(b => 'automation on: ' + b));
      // Keep trying the boss: on, then a lost war wagon: the waves play on (wave 19 again until a tower goes up, 2026.11.22-2) and the sheet says so
      await page.evaluate(() => document.querySelector('[data-auto="retry"]').click());
      if (!await waitFor(page, () => document.querySelector('[data-auto="retry"]').textContent === 'Turn off' && /Ready if a boss gets through/.test(document.querySelector('.sheet').textContent), 3000)) bad.push('Keep trying the boss did not switch on');
      await page.evaluate(() => { const t = CG.game.town; t.wave = 18; Object.assign(t.waves, { hold: true, autoHold: true, phase: 'break', timer: 0, queue: [], foes: [] }); t.lost = { why: 'boss', wave: 20, back: 18, coins: 900, at: t.t }; });
      if (!await waitFor(page, () => /Tries again after a tower|Tries again once Auto-towers|Trying wave 20 again/.test(document.querySelector('.sheet').textContent) && !CG.game.town.waves.hold, 3000)) bad.push('the sheet did not show the try (' + (await page.evaluate(() => document.querySelector('.sheet').textContent.slice(0, 300))) + ')');
      bad.push(...(await check(page)).map(b => 'retry: ' + b));
      // Call to arms (M6a): the War Office's Armory brings out To arms; its sheet says what a call costs; a call sends the
      // workers out (drawn on the board), stops the buildings, and the button shows the time in a fixed-width cell
      if (await page.evaluate(() => !document.getElementById('armsBtn').hidden)) bad.push('To arms showed before the Armory');
      const arms = await page.evaluate(async () => {
        const g = CG.game, t = g.town, wait = ms => new Promise(r => setTimeout(r, ms)), T = await import('./src/core/tree.js'), C = await import('./src/core/capital.js');
        CG.play.sheets.close(); C.capitalOf(g).influence = 1e4; for (let i = 0; i < 3; i++) T.buyNode(g, 'war');
        Object.assign(t.waves, { hold: false, autoHold: false, phase: 'break', timer: 0 }); t.lost = null; t.vault.hp = t.vault.max;
        for (let i = 0; i < 30 && document.getElementById('armsBtn').hidden; i++) await wait(100);
        const btn = document.getElementById('armsBtn'), out = { shown: !btn.hidden };
        if (!out.shown) return out;
        const w0 = btn.getBoundingClientRect().width;
        btn.click(); await wait(400);
        const sh = document.getElementById('sheet'); out.sheet = !sh.hidden && sh.dataset.id === 'arms' && /Workers from/.test(sh.textContent) && /Goods lost/.test(sh.textContent) && /About [0-9.]+[KMB]? coins/.test(sh.textContent);
        for (let i = 0; i < 40 && t.waves.phase !== 'wave'; i++) await wait(100);
        const go = document.getElementById('callArms'); out.lit = !!go && !go.disabled; if (go) go.click(); await wait(600);
        out.out = t.arms.t > 0 && /fighting/.test(sh.textContent) && go.disabled;
        out.drawn = CG.town.board.militia.out > 0 && CG.town.board.militia.out === 2 * Object.keys(t.def.board.plots).filter(id => t.level(id) > 0).length;
        out.pick = !CG.town.board.pickables.some(o => o.parent && o.parent.name === 'militia');
        CG.play.sheets.close(); await wait(400);
        const left = btn.querySelector('.btime'); out.timer = !!left && !left.hidden && /^Back in [0-9]:[0-5][0-9]$/.test(left.textContent);
        out.width = Math.abs(btn.getBoundingClientRect().width - w0) < 1;
        const made = JSON.stringify(t.made); await wait(600); out.stopped = JSON.stringify(t.made) === made;
        return out;
      });
      for (const [k, v] of Object.entries(arms)) if (!v) bad.push('Call to arms: not ' + k + ' ' + JSON.stringify(arms));
      bad.push(...(await check(page)).map(b => 'arms: ' + b));
      bad.push(...(await uncovered(page)).map(b => 'arms: ' + b));
      // every side button out, waves on hold (the widest words on Hold waves): nothing in the top bar covers another
      // control, at this size and, turned sideways, on three phones' landscape screens (review of 2026.11.23-6)
      await page.evaluate(() => { const g = CG.game, t = g.town; CG.play.sheets.close(); g.shared.charter.offered = true; t.flags['open:research'] = true; g.shared.seen = { ...(g.shared.seen || {}), goods: true }; t.waves.hold = true; });
      const crowdOut = await waitFor(page, () => ['goodsBtn', 'researchBtn', 'perksBtn', 'autoBtn', 'armsBtn', 'menuBtn'].every(id => !document.getElementById(id).hidden) && /Resume/.test(document.getElementById('holdWaves').textContent), 3000);
      if (!crowdOut) bad.push('crowded: the six side buttons did not all come out');
      for (const vp2 of name === 'land' ? [[860, 400], [844, 390], [667, 375], [932, 430]] : [vp]) {
        await page.setViewportSize({ width: vp2[0], height: vp2[1] }); await sleep(500);
        bad.push(...(await check(page)).map(b => 'crowded ' + vp2.join('x') + ': ' + b));
        bad.push(...(await dotsSeen(page)).map(b => 'crowded ' + vp2.join('x') + ': ' + b));
        await page.evaluate(() => CG.play.openSpot(3)); await sleep(400);
        bad.push(...(await uncovered(page)).map(b => 'crowded card ' + vp2.join('x') + ': ' + b));
        // a building at level 10 with its foreman row (review of 2026.11.23-7: the switch sat under the pinned price bar)
        await page.evaluate(() => { const t = CG.game.town; CG.play.close(); t.buildings.camp = Math.max(10, t.level('camp')); CG.play.open('camp'); }); await sleep(400);
        bad.push(...(await uncovered(page)).map(b => 'building card at level 10 ' + vp2.join('x') + ': ' + b));
        await page.evaluate(() => CG.play.close());
      }
      bad.push(...errs);
      console.log('auto ' + name, bad.length ? 'FAIL ' + bad.join('; ') : 'ok');
      failed += bad.length ? 1 : 0;
      await page.close();
    }
  } finally { await bA.close(); srvA.close(); }

  // Research everywhere (owner, 2026-11-20: "I got auto research somehow..but the research menu is gone?"): with
  // Auto-research on, every town and outpost shows Research, and its sheet shows the research running in Copper Gulch
  const srvL = await start(0), bL = await chromium.launch();
  try {
    const page = await bL.newPage({ viewport: { width: 400, height: 860 } }), errs = [], bad = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.goto(srvL.url + '?coach=off&start=gulch'); await waitFor(page, () => window.CG && CG.ready);
    await page.evaluate(() => { localStorage.clear(); document.getElementById('play').click(); });
    await waitFor(page, () => CG.town && CG.town.frames > 3);
    const ids = await page.evaluate(async () => {
      const g = CG.game, t = g.town; t.bestWave = 60; g.shared.purse.coins = 1e12;
      const E = await import('./src/core/empire.js');
      for (const id of ['drycreek', 'ridge', 'pinehollow', 'falls', 'sandybend']) { try { if (!g.towns[id]) E.foundTown(g, id); if (!g.towns[id]) g.addTown(id); } catch (e) { /* not foundable from here */ } if (g.towns[id]) g.towns[id].bestWave = Math.max(g.towns[id].bestWave || 0, 60); }
      (await import('./src/core/capital.js')).foundCapital(g); g.shared.purse.coins = 1e12;
      (await import('./src/core/tree.js')).foundInstitution(g, 'university');
      const R = await import('./src/core/research.js'), A = await import('./src/core/automation.js');
      t.buildings.saw = Math.max(1, t.buildings.saw || 0); t.flags['open:research'] = true; t.research.saws = 1;
      R.startResearch(g, t, 'saws'); if (t.lab) t.lab.left = t.lab.total = 9999;
      for (const id of Object.keys(g.towns)) A.setAuto(g, g.towns[id], 'research', true);
      return Object.keys(g.towns);
    });
    if (ids.length < 5) bad.push('only ' + ids.join(',') + ' were founded');
    for (const id of ids) {
      if (id !== 'gulch' || (await page.evaluate(() => CG.game.active)) !== 'gulch') {
        await page.evaluate(id => { CG.play && CG.play.sheets.close(); CG.go(id); }, id);
        if (!await waitFor(page, `CG.town && CG.game.active === '${id}' && CG.town.frames > 3`, 15000)) { bad.push(id + ': did not open'); continue; }
      }
      const r = await page.evaluate(async id => {
        const wait = ms => new Promise(res => setTimeout(res, ms)), b = document.getElementById('researchBtn'); await wait(500);
        const out = { button: !!b && !b.hidden };
        if (!out.button) return out;
        // the button shows only this place's own research time, never Copper Gulch's (owner, 2026-11-22)
        { const tm = b.querySelector('.btime'); out.ownTime = id === 'gulch' ? !!tm && !tm.hidden : !!CG.game.town.lab || !tm || tm.hidden; }
        b.click(); await wait(400);
        const sh = document.getElementById('sheet'), name = CG.game.town.def.short || CG.game.town.def.name;
        out.sheet = !sh.hidden && sh.dataset.id === 'research';
        // owner, 2026-11-22: the heading names the place, an outpost says it has no research of its own, and in a town
        // the other towns come after its own list, folded until tapped
        out.title = sh.querySelector('h2').textContent.replace(/\s/g, ' ') === 'Research · ' + name.replace(/\s/g, ' ');
        const outpost = CG.game.town.def.kind === 'outpost', fold = document.getElementById('labAwayFold'), awayList = document.getElementById('labAwayList');
        if (outpost) out.outpostLine = /has no research\. Each town researches on its own\./.test(document.getElementById('labClosed').textContent) && !awayList.hidden;
        else if (fold && fold.offsetParent) {
          out.folded = awayList.hidden; fold.click(); await wait(100); out.unfolds = !awayList.hidden;
          const own = sh.querySelector('.sheetbody > .goods.research');
          out.below = !own || own.hidden || own.getBoundingClientRect().top < document.getElementById('labAway').getBoundingClientRect().top;
        }
        const row = document.querySelector('#labAwayList [data-town="gulch"]');
        out.running = id === 'gulch' ? /Researching level/.test(sh.textContent) : !!row && /Sharp Saws · [0-9]+ (sec|min) left/.test(row.textContent);
        // a row under Your towns opens that town's Research
        if (id === 'drycreek' && row) {
          row.click();
          for (let i = 0; i < 40 && !(CG.game.active === 'gulch' && !document.getElementById('sheet').hidden); i++) await wait(100);
          out.goes = CG.game.active === 'gulch' && document.getElementById('sheet').dataset.id === 'research' && !document.getElementById('sheet').hidden;
        }
        document.getElementById('sheetClose').click(); await wait(200);
        return out;
      }, id);
      for (const [k, v] of Object.entries(r)) if (!v) bad.push(id + ': research ' + k);
      bad.push(...(await check(page)).map(b => id + ': ' + b));
    }
    // the Auto sheet names what Auto-research runs and opens Research
    await page.evaluate(() => { CG.play && CG.play.sheets.close(); CG.go('gulch'); });
    await waitFor(page, () => CG.town && CG.game.active === 'gulch' && CG.town.frames > 3, 15000);
    const au = await page.evaluate(async () => {
      const wait = ms => new Promise(res => setTimeout(res, ms)); document.getElementById('autoBtn').click(); await wait(500);
      const text = document.getElementById('sheet').textContent, see = document.getElementById('autoSeeResearch');
      const out = { names: /Sharp Saws · [0-9]+ (sec|min) left/.test(text), see: !!see && !see.hidden, title: /^Auto · Copper\sGulch$/.test(document.querySelector('#sheet h2').textContent), here: /in this town/.test(text) };
      { const n = document.querySelector('#sheet .sheetbody > p.note'), b = document.querySelector('#sheet .sheetbody').getBoundingClientRect(); out.noteShows = !!n && n.getBoundingClientRect().top >= b.top - 1 && /half your coins/.test(n.textContent); }
      if (see) { see.click(); await wait(400); out.opens = document.getElementById('sheet').dataset.id === 'research'; }
      document.getElementById('sheetClose').click();
      return out;
    });
    for (const [k, v] of Object.entries(au)) if (!v) bad.push('Auto-research line: not ' + k);
    bad.push(...errs);
    console.log('research everywhere', bad.length ? 'FAIL ' + bad.join('; ') : 'ok');
    failed += bad.length ? 1 : 0;
    await page.close();
  } finally { await bL.close(); srvL.close(); }

  // the explainers: a fresh game opens with the welcome card and a spotlight; the game waits; Got it dismisses it for good
  const srv3 = await start(0), b3 = await chromium.launch();
  try {
    const page = await b3.newPage({ viewport: { width: 400, height: 860 } }), errs = [];
    page.on('pageerror', e => errs.push(e.message));
    // a speech engine that only records what it is asked to say, with one on-device American voice (window.__voices
    // can be changed, then voiceschanged fired, to take the voice away)
    await page.addInitScript(() => {
      const subs = [];
      window.__voices = [{ name: 'Online', lang: 'en-US', localService: false }, { name: 'Device', lang: 'en-US', localService: true }];
      const fake = { said: [], cancels: 0, current: null, getVoices: () => window.__voices,
        speak(u) { this.said.push(u.text); this.current = u; }, cancel() { this.cancels++; const u = this.current; this.current = null; if (u && u.onend) u.onend(); },
        addEventListener: (ev, fn) => { if (ev === 'voiceschanged') subs.push(fn); }, fire: () => subs.forEach(fn => fn()) };
      Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true });
      window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
    });
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
      // the speaker button (owner, 2026-11-22): it reads exactly the card, a second tap stops it, closing stops it,
      // and with Read cards aloud on the next card reads itself
      const sp = await page.evaluate(async () => {
        const b = document.getElementById('coachSpeak'), r = b.getBoundingClientRect(), syn = window.speechSynthesis, card = document.querySelector('#coach .coachcard').getBoundingClientRect();
        const out = { shown: !b.hidden && r.width > 0, size: Math.round(Math.min(r.width, r.height)), inCard: r.left >= card.left && r.right <= card.right && r.top >= card.top, label: b.getAttribute('aria-label') };
        const want = CG.coach.words(), title = document.querySelector('#coach .coachcard b').textContent, text = document.querySelector('#coach .coachcard p').textContent;
        out.words = want.startsWith(title) && want.includes(text.split(' ').slice(0, 4).join(' '));
        b.click(); await new Promise(r => setTimeout(r, 50));
        out.said = syn.said.at(-1) === want; out.pressed = b.getAttribute('aria-pressed') === 'true' && CG.speech.speaking(); out.ducked = CG.audio.state().ducked;
        b.click(); await new Promise(r => setTimeout(r, 50));
        out.stopped = !CG.speech.speaking() && syn.cancels >= 1 && b.getAttribute('aria-pressed') === 'false' && !CG.audio.state().ducked;
        b.click(); await new Promise(r => setTimeout(r, 50));
        // the Stone Camp card comes once wave 1 is called (clarity fix 7), so a Crossbow goes up and wave 1 starts
        // first; the Call now card would come before it, so it counts as seen
        const d = await import(new URL('src/core/defense.js', location.href).href), g = CG.game, t = g.town;
        t.coins = Math.max(t.coins, 500); t.goods.stone = Math.max(t.goods.stone || 0, 50);
        d.buildTower(g, t, 0, 'crossbow'); d.callEarly(g, t); g.shared.seen.waves = true;
        const c0 = syn.cancels; CG.audio.set('read', 1); document.getElementById('coachOk').click();
        out.closeStops = !CG.speech.speaking() && syn.cancels > c0;
        for (let i = 0; i < 60 && CG.coach.current !== 'dc-stone'; i++) await new Promise(r => setTimeout(r, 100));
        await new Promise(r => setTimeout(r, 50));
        out.auto = CG.coach.current === 'dc-stone' && syn.said.at(-1) === CG.coach.words() && CG.speech.speaking();
        CG.audio.set('read', 0); CG.speech.stop();
        // no on-device voice: the button goes away
        window.__voices = [{ name: 'Online', lang: 'en-US', localService: false }]; syn.fire();
        out.hidden = document.getElementById('coachSpeak').hidden;
        window.__voices = [{ name: 'Device', lang: 'en-US', localService: true }]; syn.fire();
        return out;
      });
      for (const [k, v] of Object.entries(sp)) if (!v && k !== 'size' && k !== 'label') bad.push('speaker button: not ' + k);
      if (sp.size < 36) bad.push('speaker button is ' + sp.size + ' px, under 36');
      if (sp.label !== 'Read aloud') bad.push('speaker button label ' + sp.label);
      // the next card spotlights the Stone Camp (the speaker check above has already moved on to it)
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
      // the Menu's Read aloud section (with an on-device voice): the Voice slider and the Read cards aloud switch
      const menu = await page.evaluate(async () => { CG.coach.skipAll(); CG.play.openMenu(); await new Promise(r => setTimeout(r, 300)); const r = document.getElementById('readAloud'); const o = { voice: !!document.getElementById('voiceVol'), read: !!r && /Read cards aloud/.test(r.textContent) }; r.click(); o.on = CG.audio.get('read') === 1; r.click(); o.off = CG.audio.get('read') === 0; return o; });
      for (const [k, v] of Object.entries(menu)) if (!v) bad.push('Menu read aloud: not ' + k);
      bad.push(...(await check(page)).map(b => 'menu: ' + b));
      await page.evaluate(() => document.getElementById('sheetClose').click());
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
        // the map's camera flies in when it opens and the labels follow it: let it settle first, so a label still
        // off screen at rest fails and one caught mid-flight on a busy machine does not (2026.11.24-1: 1 run in 3)
        await waitFor(page, () => [...document.querySelectorAll('#mapBadges .mapbadge')].filter(b => !b.hidden).every(b => { const r = b.getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1; }), 4000);
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
