// node tools/perf.js [--dpr 2] [--throttle 4] [--seconds 6] [--tier low|med|high] [--eval "js run in the page first"]
// Frame time in headless Edge or Chrome at phone size (400x860), with the CPU throttled (Emulation.setCPUThrottlingRate)
// to stand in for a mid-range phone. The page is a touch phone, so the game picks its phone tier by itself. It plays a town that is busy (buildings up, towers on the road, a wave running),
// measures every frame for a few seconds, and prints the median and 90th percentile frame time, the frames per second,
// the draw calls and triangles per frame and the render size. Fails (exit 1) when the median is over 33 ms.
// Smoothness: it follows one raider on screen every frame and fails when any frame's jump is over 3 times the median
// jump, or when the raider only moves on some frames (a sign of drawing straight from the 0.25 s simulation steps).
// A near miss on frame time (within 15%) is measured once more; "retried" in the output gives the first median.
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
  const measure = () => p.evaluate(async sec => {
    const times = []; let last = performance.now();
    const gl = CG.town.view.renderer.getContext(), px = new Uint8Array(4), track = [];
    const battle = CG.town.battle; let id = null;
    // wait for the GPU every frame (a one-pixel read), so the time includes drawing, not just the script
    await new Promise(done => { const t0 = last; const f = now => { gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); now = performance.now(); times.push(now - last); last = now;
        // follow one raider on screen while the clock says three seconds have not passed since tracking began
        if (now - t0 < 3000 && !CG.town.paused) {
          if (id === null || !battle.foes.has(id)) id = [...battle.foes.keys()].find(k => battle.foes.get(k).obj.position.x > -50) ?? null;
          const u = id !== null && battle.foes.get(id);
          if (u) { const p = CG.town.projectPoint(u.obj.position.x, .5, u.obj.position.z); if (p) track.push([p.x, p.y, id]); }
        } if (now - t0 < sec * 1000) requestAnimationFrame(f); else done(); }; requestAnimationFrame(f); });
    times.shift(); times.sort((a, b) => a - b);
    const q = k => times[Math.min(times.length - 1, Math.floor(times.length * k))];
    const jumps = [];
    for (let i = 1; i < track.length; i++) if (track[i][2] === track[i - 1][2]) jumps.push(Math.hypot(track[i][0] - track[i - 1][0], track[i][1] - track[i - 1][1]));
    const sj = jumps.slice().sort((a, b) => a - b), jmed = sj[sj.length >> 1] || 0, jmax = sj[sj.length - 1] || 0;
    const still = jumps.filter(j => j < .05).length / Math.max(1, jumps.length);
    const v = CG.town.view, s = v.stats || {};
    return { frames: times.length, median: q(.5), p90: q(.9), fps: 1000 / q(.5), calls: s.calls, triangles: s.triangles, size: s.w + 'x' + s.h, tier: s.tier, foes: CG.game.town.waves.foes.length, smooth: { samples: jumps.length, medianJump: +jmed.toFixed(2), maxJump: +jmax.toFixed(2), stillFrames: +still.toFixed(2) } };
  }, SECONDS);
  out = await measure();
  // the software GPU is noisy on a busy machine: a near miss (within 15%) is measured once more, and the better run counts
  if (out.median > LIMIT && out.median <= LIMIT * 1.15) {
    const again = await measure(), first = +out.median.toFixed(1);
    if (again.median < out.median) out = again;
    out.retried = first;
  }
  await p.cdp('Emulation.setCPUThrottlingRate', { rate: 1 });
} finally { await b.close(); srv.close(); }
out.startTier = startTier;
// a pass needs the frame time, no automatic step-down below the tier the phone started at, and smooth motion
const sm = out.smooth, jerky = sm.samples < 20 ? 'too few frames with a raider on screen to judge smoothness'
  : sm.stillFrames > .3 ? `the raider stood still on ${Math.round(sm.stillFrames * 100)}% of frames (it moves in steps)`
  : sm.maxJump > 3 * sm.medianJump ? `a raider jumped ${sm.maxJump} px in one frame, over 3 times the median ${sm.medianJump} px` : null;
const ok = out && out.median <= LIMIT && out.tier === startTier && !jerky;
console.log(JSON.stringify({ ...out, median: +out.median.toFixed(1), p90: +out.p90.toFixed(1), fps: +out.fps.toFixed(1), dpr: DPR, throttle: THROTTLE }));
console.log(ok ? 'ok' : jerky ? 'FAIL not smooth: ' + jerky : out.tier !== startTier ? `FAIL frames were slow enough to step down from ${startTier} to ${out.tier}` : `FAIL median frame ${out.median.toFixed(1)} ms is over ${LIMIT} ms`);
process.exitCode = ok ? 0 : 1;
setTimeout(() => process.exit(), 100);
