// node tools/perf.js [--dpr 2] [--throttle 4] [--seconds 6] [--tier low|med|high] [--eval "js run in the page first"]
// Frame time in headless Edge or Chrome at phone size (400x860), with the CPU throttled (Emulation.setCPUThrottlingRate)
// to stand in for a mid-range phone. The page is a touch phone, so the game picks its phone tier by itself. It plays a town that is busy (buildings up, towers on the road, a wave running),
// measures every frame for a few seconds, and prints the median and 90th percentile frame time, the frames per second,
// the draw calls and triangles per frame and the render size. Fails (exit 1) when the median is over 33 ms.
// Each frame waits for the GPU (a one-pixel read). Headless browsers draw WebGL in software, so absolute times are
// pessimistic and the GPU part is not throttled; the numbers are for comparing builds and catching heavy drawing.
import { start } from './serve.js';
import { chromium } from './cdp.js';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const DPR = +arg('dpr', 2), THROTTLE = +arg('throttle', 4), SECONDS = +arg('seconds', 6), EVAL = arg('eval', ''), LIMIT = 33;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// software WebGL (SwiftShader): its cost grows with pixels, passes, lights and shadow taps the way a phone GPU's does
const srv = await start(0), b = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--disable-gpu-compositing'] });
let out = null, startTier = null;
try {
  const p = await b.newPage({ viewport: { width: 400, height: 860 }, deviceScaleFactor: DPR, mobile: true });
  await p.goto(srv.url + '?coach=off');
  for (let i = 0; i < 100 && !(await p.evaluate(() => !!(window.CG && CG.ready))); i++) await sleep(100);
  const TIER = arg('tier', '');
  await p.evaluate(t => { localStorage.clear(); if (t) localStorage.setItem('cg-gfx', JSON.stringify({ tier: t, auto: false })); document.getElementById('play').click(); }, TIER);
  for (let i = 0; i < 100 && !(await p.evaluate(() => !!(CG.town && CG.town.frames > 3))); i++) await sleep(100);
  // a busy town: buildings up, four towers, a wave on the road
  await p.evaluate(() => {
    const t = CG.game.town; t.coins = 1e9; Object.assign(t.goods, { timber: 500, copper: 500, bricks: 500, tools: 500 }); t.sell = { timber: false, copper: false, bricks: false, tools: false };
    for (const [id, n] of Object.entries({ camp: 12, mine: 8, pit: 6, saw: 8, smelter: 5, kiln: 3 })) t.buildings[id] = n;
    for (const [s, k] of [[1, 'crossbow'], [2, 'cannon'], [3, 'crossbow'], [8, 'frost'], [9, 'still']]) { CG.play.openSpot(s); document.querySelector('#card .build[data-kind="' + k + '"]').click(); }
    CG.play.close(); document.getElementById('callWave').click();
  });
  if (EVAL) await p.evaluate(EVAL);
  await sleep(2500);
  startTier = await p.evaluate(() => CG.town.view.tier);
  await p.cdp('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
  out = await p.evaluate(async sec => {
    const times = []; let last = performance.now();
    const gl = CG.town.view.renderer.getContext(), px = new Uint8Array(4);
    // wait for the GPU every frame (a one-pixel read), so the time includes drawing, not just the script
    await new Promise(done => { const t0 = last; const f = now => { gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); now = performance.now(); times.push(now - last); last = now; if (now - t0 < sec * 1000) requestAnimationFrame(f); else done(); }; requestAnimationFrame(f); });
    times.shift(); times.sort((a, b) => a - b);
    const q = k => times[Math.min(times.length - 1, Math.floor(times.length * k))];
    const v = CG.town.view, s = v.stats || {};
    return { frames: times.length, median: q(.5), p90: q(.9), fps: 1000 / q(.5), calls: s.calls, triangles: s.triangles, size: s.w + 'x' + s.h, tier: s.tier, foes: CG.game.town.waves.foes.length };
  }, SECONDS);
  await p.cdp('Emulation.setCPUThrottlingRate', { rate: 1 });
} finally { await b.close(); srv.close(); }
out.startTier = startTier;
// a pass needs the frame time, and no automatic step-down below the tier the phone started at
const ok = out && out.median <= LIMIT && out.tier === startTier;
console.log(JSON.stringify({ ...out, median: +out.median.toFixed(1), p90: +out.p90.toFixed(1), fps: +out.fps.toFixed(1), dpr: DPR, throttle: THROTTLE }));
console.log(ok ? 'ok' : out.tier !== startTier ? `FAIL frames were slow enough to step down from ${startTier} to ${out.tier}` : `FAIL median frame ${out.median.toFixed(1)} ms is over ${LIMIT} ms`);
process.exitCode = ok ? 0 : 1;
setTimeout(() => process.exit(), 100);
