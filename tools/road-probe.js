// node tools/road-probe.js [400x860,360x780,...]: how much of each lane's road shows at the home view, per town, at
// phone sizes (the phone home view box, 2026.11.26-4). A road point counts as shown when a raider standing on it is
// whole on screen: ROAD_EDGE pixels inside the left and right edges, below the top bar and above the goods strip.
// Also prints the smallest pad's size and how many pads the screen's edge cuts. One JSON line per town and size.
import { start } from './serve.js';
import { chromium } from './cdp.js';

const sizes = (process.argv[2] || '400x860,360x780,430x930').split(',').map(s => s.split('x').map(Number));
const towns = (process.argv[3] || 'drycreek,gulch,ridge,pinehollow,falls').split(',');
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(page, expr, ms = 20000) {
  for (let t = 0; t < ms; t += 100) { if (await page.evaluate(expr).catch(() => false)) return true; await sleep(100); }
  return false;
}

/* Runs in the page: the share of each lane on screen at home (the same function smoke uses). */
export const ROAD_CHECK = async () => {
  const D = await import('./src/core/defense.js'), C = await import('./src/render/camera.js'), P = await import('./src/core/path.js');
  const t = CG.game.town, v = CG.town.view, rig = CG.town.rig;
  Object.assign(rig.t, rig.home); Object.assign(rig.c, rig.home); rig.flick = null; await new Promise(r => setTimeout(r, 300));
  const cv = document.getElementById('view');
  const W = cv.clientWidth, H = cv.clientHeight, E = C.ROAD_EDGE || 14;
  const top = Math.max(...[...document.querySelectorAll('.hud .hudleft, .hud .hudright')].map(n => n.getBoundingClientRect().bottom));
  const strip = document.getElementById('goodsStrip'), low = strip && !strip.hidden ? strip.getBoundingClientRect().top : H;
  const V = v.cam.position.constructor, lanes = D.lanesOf(t), B = t.def.board, T = await import('./src/data/towns/index.js'), hides = T.laneHides(B);
  // each lane's own hide, and the sky lane (part 2b) at the height its airships fly
  const ys = T.laneDefs(B).map(l => (l.key === 'sky' ? (B.sky.height || 1.7) + .3 : .3));
  const out = [], side = [], up = [];
  lanes.forEach((L, i) => {
    let n = 0, on = 0, sd = 0, tp = 0;
    const from = hides[i] || 0;
    for (let s = from; s <= L.length; s += .1) {
      const [x, z] = P.pointAt(L, s), q = new V(x, ys[i], z).project(v.cam), p = { x: (q.x + 1) / 2 * W, y: (1 - q.y) / 2 * H };
      const inX = p.x >= E && p.x <= W - E, inY = p.y >= top && p.y <= low;
      n++; if (inX && inY) on++; if (!inX) sd++; else if (!inY) tp++;
    }
    out.push(+(on / Math.max(1, n)).toFixed(3)); side.push(+(sd / Math.max(1, n)).toFixed(3)); up.push(+(tp / Math.max(1, n)).toFixed(3));
  });
  // pads the screen's left or right edge cuts through (half on screen), which read as broken
  let cut = 0;
  for (const [x, z] of B.spots) {
    const xs = [[.5, 0], [-.5, 0], [0, .5], [0, -.5]].map(([dx, dz]) => { const q = new V(x + dx, 0, z + dz).project(v.cam); return (q.x + 1) / 2 * W; });
    const a = Math.min(...xs), b = Math.max(...xs);
    if ((a < 2 && b > 2) || (a < W - 2 && b > W - 2)) cut++;
  }
  return { lanes: out, side, underBars: up, cutPads: cut, padPx: +rig.padPx().toFixed(1), atHome: rig.atHome };
};

if (process.argv[1] && process.argv[1].endsWith('road-probe.js')) {
  const srv = await start(0), b = await chromium.launch();
  try {
    for (const [width, height] of sizes) for (const town of towns) {
      const page = await b.newPage({ viewport: { width, height } }), errs = [];
      page.on('pageerror', e => errs.push(e.message));
      await page.goto(srv.url + '?coach=off&start=' + town); await waitFor(page, () => window.CG && CG.ready);
      await page.evaluate(() => { localStorage.clear(); document.getElementById('play').click(); });
      await waitFor(page, () => window.CG && CG.town && CG.town.frames > 5);
      await sleep(2500); // the fly-in settles
      const r = await page.evaluate(ROAD_CHECK.toString().replace(/^async \(\) => /, 'async () => ') && `(${ROAD_CHECK.toString()})()`);
      console.log(JSON.stringify({ size: width + 'x' + height, town, ...r, errs: errs.slice(0, 2) }));
      await page.close();
    }
  } finally { await b.close(); srv.close(); }
}
