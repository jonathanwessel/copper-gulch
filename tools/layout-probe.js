// node tools/layout-probe.js [phone,land,desk]: what clarity fix 8g measures, without a whole smoke run (a minute or two).
// 1. The empire map with every open place's card open in turn: for each other place's label, whether it shows in full,
//    shows its name alone (small) or is hidden, and how much of its own town each label covers.
// 2. A Mortar with its level-5 path card and a level-19 Still with its level-20 choice card: where the selected tower
//    sits beside the card (its point, and the share of its ring on screen and clear of the card).
// Prints one JSON line per size and check.
import { start } from './serve.js';
import { chromium } from './cdp.js';

const ALL = { phone: [400, 860], land: [860, 400], desk: [1366, 800] };
const pick = (process.argv[2] || 'phone,land,desk').split(',');
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(page, expr, ms = 15000) {
  for (let t = 0; t < ms; t += 100) { if (await page.evaluate(expr).catch(() => false)) return true; await sleep(100); }
  return false;
}

/* The selected tower beside its card: its point outside the card and on screen, and the share of 24 points round its
   ring (or round the tower when the ring is too big for the screen) that sit on screen and clear of the card. */
export const TOWER_CHECK = async spot => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await wait(1500);
  const c = document.getElementById('card').getBoundingClientRect(), p = CG.town.projectSpot(spot), cv = document.getElementById('view');
  const W = cv.clientWidth, H = cv.clientHeight, top = Math.max(...[...document.querySelectorAll('.hud .hudleft, .hud .hudright')].map(n => n.getBoundingClientRect().bottom));
  const inCard = q => q.x > c.left && q.x < c.right && q.y > c.top && q.y < c.bottom;
  const onScreen = q => q.x > 0 && q.x < W && q.y > top && q.y < H;
  const v = CG.town.view, V = v.cam.position.constructor, [x, z] = CG.game.town.def.board.spots[spot], rad = CG.town.selection.reach || 0;
  let ring = 0; const n = 24;
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, q = new V(x + Math.cos(a) * rad, .05, z + Math.sin(a) * rad).project(v.cam), s = { x: (q.x + 1) / 2 * W, y: (1 - q.y) / 2 * H }; if (onScreen(s) && !inCard(s)) ring++; }
  return { card: [Math.round(c.left), Math.round(c.top), Math.round(c.right), Math.round(c.bottom)], at: p && [Math.round(p.x), Math.round(p.y)], clear: !!p && onScreen(p) && !inCard(p), ring: +(ring / n).toFixed(2), rad: +rad.toFixed(2), dist: +CG.town.rig.c.dist.toFixed(1), max: CG.town.rig.max, title: (document.querySelector('#card h2') || {}).textContent };
};

const srv = await start(0), b = await chromium.launch();
try {
  for (const size of pick) {
    const [width, height] = ALL[size];
    const page = await b.newPage({ viewport: { width, height } }), errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.goto(srv.url + '?coach=off&start=gulch'); await waitFor(page, () => window.CG && CG.ready);
    await page.evaluate(() => { localStorage.clear(); document.getElementById('play').click(); });
    await waitFor(page, () => window.CG && CG.town && CG.town.frames > 5);
    // the towers first, in the Gulch
    const towers = await page.evaluate(async check => {
      const D = await import('./src/core/defense.js'), t = CG.game.town, B = t.def.board, out = {}, fn = new Function('return (' + check + ')')();
      t.flags['open:mortar'] = true; t.coins = 1e9; Object.assign(t.goods, { copper: 9e4, bricks: 9e4, timber: 9e4, ore: 9e4, planks: 9e4, tools: 9e4, clay: 9e4 });
      let spent = 0; for (let L = 0; L < 4; L++) spent += D.towerCost(t, 'mortar', L).coins;
      t.towers.push({ spot: B.far, kind: 'mortar', level: 4, path: null, fork: null, cd: 0, spent, pulses: 0 });
      spent = 0; for (let L = 0; L < 19; L++) spent += D.towerCost(t, 'still', L).coins;
      t.towers = t.towers.filter(x => x.spot !== 2); t.towers.push({ spot: 2, kind: 'still', level: 19, path: 'a', fork: null, cd: 0, spent, pulses: 0 });
      await new Promise(r => setTimeout(r, 600));
      // from the home view, then straight from the other card as the shots do (no reset between)
      for (const [name, s] of [['path', B.far], ['fork', 2]]) { CG.play.close(); CG.town.rig.reset(); await new Promise(r => setTimeout(r, 400)); CG.play.openSpot(s); out[name] = await fn(s); }
      for (const [name, s] of [['path2', B.far], ['fork2', 2]]) { CG.play.close(); CG.play.openSpot(s); out[name] = await fn(s); }
      CG.play.close();
      return out;
    }, TOWER_CHECK.toString());
    console.log(size, 'towers', JSON.stringify(towers));
    // the map with every place open
    await page.evaluate(async () => {
      const g = CG.game, t = g.town; t.bestWave = 60; g.shared.purse.coins = 1e12;
      const E = await import('./src/core/empire.js');
      for (const id of ['drycreek', 'ridge', 'pinehollow']) { try { if (!g.towns[id]) E.foundTown(g, id); if (!g.towns[id]) g.addTown(id); } catch (e) { /* not foundable */ } }
      for (const T of Object.values(g.towns)) T.vault.hp = Math.max(1, Math.round(T.vault.max * .8));
      CG.openMap();
    });
    await waitFor(page, () => CG.map && CG.map.frames > 10 && CG.mapui, 10000); await sleep(1500);
    const map = await page.evaluate(async () => {
      const wait = ms => new Promise(r => setTimeout(r, ms)), r = CG.map.rig, out = {};
      const read = () => Object.fromEntries([...document.querySelectorAll('.mapbadge')].map(x => [x.dataset.site, x.hidden ? 'hidden' : x.classList.contains('small') ? 'small' : 'full']));
      CG.mapui.close(); Object.assign(r.t, r.home); Object.assign(r.c, r.home); r.flick = null; await wait(1200);
      out.home = { labels: read(), share: CG.mapui.cover().share, near: CG.mapui.cover().near };
      for (const id of Object.keys(CG.game.towns)) {
        CG.mapui.close(); Object.assign(r.t, r.home); Object.assign(r.c, r.home); r.flick = null; await wait(400);
        CG.mapui.openSite(id); await wait(1800);
        const c = CG.mapui.cover();
        const mc = document.getElementById('mapCard').getBoundingClientRect(), vis = {};
        for (const s of CG.map.sites) { const m = CG.map.siteBox && CG.map.siteBox(s.id); if (m) vis[s.id] = [Math.round(m.x), Math.round(m.y)]; }
        out[id] = { labels: read(), own: c.share[id], share: c.share, mids: c.mids, onOpen: c.onOpen, card: [Math.round(mc.left), Math.round(mc.top), Math.round(mc.right), Math.round(mc.bottom)], mid: vis };
      }
      CG.mapui.close();
      return out;
    });
    for (const [k, v] of Object.entries(map)) console.log(size, 'map', k, JSON.stringify(v));
    if (errs.length) console.log(size, 'errors', errs.slice(0, 5).join(' | '));
    await page.close();
  }
} finally { await b.close(); srv.close(); }
