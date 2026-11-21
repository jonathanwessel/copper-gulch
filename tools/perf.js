// node tools/perf.js [--dpr 2] [--throttle 4] [--seconds 6] [--tier low|med|high] [--town gulch|drycreek|ridge|falls|empire|falls-empire|map] [--limit 33] [--eval "js run in the page first"] [--report "js read after"] [--profile] [--script ms] [--calls n]
// --town map: the empire map with every town open, built up, wagons on the roads and the Capital's city with all five
//   institutions (no raider to follow there).
// --town falls-empire: Silver Falls in play with the Gulch, the Ridge, the Capital, Dry Creek, Pine Hollow and Sandy Bend
//   all working behind it (M5: phone performance with every board so far).
// --town empire: Iron Ridge in play, founded from a built-up Copper Gulch, with the Gulch, Dry Creek and Pine Hollow
//   all working behind it (so every frame also steps four towns), a wave on the road. The M3 target runs it with
//   --script 10 --calls 300: the frame under the phone limit, the game's own work in it under 10 ms, fewer than 300 draw calls.
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
const TOWN = arg('town', 'gulch'), DPR = +arg('dpr', 2), THROTTLE = +arg('throttle', 4), SECONDS = +arg('seconds', 6), EVAL = arg('eval', ''), REPORT = arg('report', ''), LIMIT = +arg('limit', 33);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// software WebGL (SwiftShader): its cost grows with pixels, passes, lights and shadow taps the way a phone GPU's does
const srv = await start(0), b = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--disable-gpu-compositing'] });
let out = null, startTier = null;
const errs = []; // a page that throws every frame skips its work and reads fast: any error fails the run (2026-11-19)
try {
  const p = await b.newPage({ viewport: { width: 400, height: 860 }, deviceScaleFactor: DPR, mobile: true });
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(srv.url + '?coach=off' + (TOWN === 'drycreek' ? '' : '&start=' + (TOWN === 'map' || TOWN === 'empire' || TOWN === 'falls-empire' ? 'gulch' : TOWN)));
  for (let i = 0; i < 100 && !(await p.evaluate(() => !!(window.CG && CG.ready))); i++) await sleep(100);
  const TIER = arg('tier', '');
  await p.evaluate(([t, NOAUDIO]) => { localStorage.clear(); if (t) localStorage.setItem('cg-gfx', JSON.stringify({ tier: t, auto: false })); document.getElementById('play').click(); if (!NOAUDIO) CG.audio.start(); }, [TIER, process.argv.includes('--no-audio')]);
  for (let i = 0; i < 100 && !(await p.evaluate(() => !!(CG.town && CG.town.frames > 3))); i++) await sleep(100);
  // a busy town: buildings up, four towers, a wave on the road (Dry Creek: both camps up and a Crossbow on every pad)
  if (TOWN === 'drycreek') await p.evaluate(() => {
    const t = CG.game.town; t.coins = 1e9; t.goods.stone = 5000; t.sell = { stone: false };
    Object.assign(t.buildings, { quarry: 12, dmine: 8 });
    for (let s = 0; s < t.def.board.spots.length; s++) { CG.play.openSpot(s); document.querySelector('#card .build[data-kind="crossbow"]').click(); }
    CG.play.close(); document.getElementById('callWave').click();
  });
  else if (TOWN === 'ridge') await p.evaluate(() => {
    const t = CG.game.town; t.coins = 1e9; Object.assign(t.goods, { stone: 500, iron: 500, coal: 500, pigiron: 500 }); t.sell = { stone: false, iron: false, coal: false, pigiron: false };
    for (const [id, n] of Object.entries({ rquarry: 12, ironmine: 10, colliery: 10, furnace: 10, steelmill: 8, rolling: 10, boilershop: 5, loco: 3 })) t.buildings[id] = n;
    for (const [s, k] of [[4, 'crossbow'], [5, 'cannon'], [6, 'crossbow'], [8, 'frost'], [9, 'still']]) { CG.play.openSpot(s); document.querySelector('#card .build[data-kind="' + k + '"]').click(); }
    CG.play.close(); document.getElementById('callWave').click(); // like the Gulch: wave 1, towers down the line so raiders stay on screen
  });
  else if (TOWN === 'falls') await p.evaluate(() => { // two lanes: raiders on the road and boats on the river
    const t = CG.game.town; t.coins = 1e9; Object.assign(t.goods, { sand: 500, quartz: 500, glass: 500 }); t.sell = { sand: false, quartz: false, glass: false };
    for (const [id, n] of Object.entries({ sandpit: 12, quartzmine: 10, waterwheel: 8, glassworks: 8, wiremill: 6, bulbworks: 5, dynamo: 3, telegraph: 2 })) t.buildings[id] = n;
    for (const [s, k] of [[2, 'crossbow'], [3, 'cannon'], [4, 'crossbow'], [8, 'frost'], [9, 'still']]) { CG.play.openSpot(s); document.querySelector('#card .build[data-kind="' + k + '"]').click(); }
    CG.play.close(); document.getElementById('callWave').click();
  });
  else if (TOWN === 'empire') await p.evaluate(async () => {
    const g = CG.game, t = g.town; t.coins = 1e9; t.bestWave = 20;
    for (const [id, n] of Object.entries({ camp: 12, mine: 8, pit: 6, saw: 8, smelter: 5, kiln: 6, toolsmith: 4 })) t.buildings[id] = n;
    (await import('./src/core/empire.js')).foundTown(g, 'ridge');
    const op = await import('./src/core/outpost.js'); op.grantOutpost(g, 'drycreek'); op.grantOutpost(g, 'pinehollow');
    g.towns.pinehollow.won = true;
    CG.go('ridge');
    for (let i = 0; i < 100 && !(CG.town && CG.town.frames > 3); i++) await new Promise(r => setTimeout(r, 100));
    const r = g.towns.ridge; t.coins = 1e9; Object.assign(r.goods, { stone: 500, iron: 500, coal: 500, pigiron: 500 }); r.sell = { stone: false, iron: false, coal: false, pigiron: false };
    for (const [id, n] of Object.entries({ rquarry: 12, ironmine: 10, colliery: 10, furnace: 10, steelmill: 8, rolling: 10, boilershop: 5, loco: 3 })) r.buildings[id] = n;
    for (const [s, k] of [[4, 'crossbow'], [5, 'cannon'], [6, 'crossbow'], [8, 'frost'], [9, 'still']]) { CG.play.openSpot(s); document.querySelector('#card .build[data-kind="' + k + '"]').click(); }
    CG.play.close(); document.getElementById('callWave').click();
  });
  else if (TOWN === 'falls-empire') await p.evaluate(async () => { // M5: the Falls in play, every board before it working behind it
    const g = CG.game, t = g.town, wait = () => new Promise(r => setTimeout(r, 100)); t.coins = 1e9; t.bestWave = 30;
    const tower = (x, spot, kind, level) => x.towers.push({ spot, kind, level, path: null, cd: 0, spent: 0, pulses: 0 });
    for (const [id, n] of Object.entries({ camp: 12, mine: 10, pit: 8, saw: 10, smelter: 8, kiln: 8, toolsmith: 6 })) t.buildings[id] = n;
    for (const [s, k] of [[1, 'crossbow'], [2, 'cannon'], [3, 'crossbow'], [8, 'frost'], [9, 'still']]) tower(t, s, k, 12);
    const op = await import('./src/core/outpost.js'); op.grantOutpost(g, 'drycreek');
    const r = g.addTown('ridge'); g.addTown('pinehollow'); op.grantOutpost(g, 'pinehollow'); g.towns.pinehollow.won = true; r.bestWave = 52;
    for (const [id, n] of Object.entries({ rquarry: 12, ironmine: 10, colliery: 10, furnace: 10, steelmill: 8, rolling: 10, boilershop: 5, loco: 3 })) r.buildings[id] = n;
    for (const [s, k] of [[4, 'crossbow'], [5, 'cannon'], [6, 'crossbow'], [8, 'frost'], [9, 'still']]) tower(r, s, k, 12);
    (await import('./src/core/capital.js')).foundCapital(g);
    g.addTown('falls'); op.grantOutpost(g, 'sandybend'); g.towns.sandybend.won = true;
    for (const x of Object.values(g.towns)) if (x.waves) x.waves.hold = false;
    CG.go('falls');
    for (let i = 0; i < 100 && !(CG.town && CG.town.frames > 3); i++) await wait();
    const f = g.towns.falls; f.coins = 1e9; Object.assign(f.goods, { sand: 500, quartz: 500, glass: 500 }); f.sell = { sand: false, quartz: false, glass: false };
    for (const [id, n] of Object.entries({ sandpit: 12, quartzmine: 10, waterwheel: 8, glassworks: 8, wiremill: 6, bulbworks: 5, dynamo: 3, telegraph: 2 })) f.buildings[id] = n;
    for (const [s, k] of [[2, 'crossbow'], [3, 'cannon'], [4, 'crossbow'], [8, 'frost'], [9, 'still']]) { CG.play.openSpot(s); document.querySelector('#card .build[data-kind="' + k + '"]').click(); }
    CG.play.close(); document.getElementById('callWave').click();
  });
  else if (TOWN === 'map') await p.evaluate(async () => {
    const g = CG.game, t = g.town; t.coins = 1e9; t.bestWave = 20;
    for (const [id, n] of Object.entries({ camp: 12, mine: 8, pit: 6, saw: 8, smelter: 5, kiln: 3 })) t.buildings[id] = n;
    (await import('./src/core/empire.js')).foundTown(g, 'ridge'); (await import('./src/core/outpost.js')).grantOutpost(g, 'drycreek');
    for (const [id, n] of Object.entries({ rquarry: 12, ironmine: 10, colliery: 10, furnace: 10, steelmill: 8 })) g.towns.ridge.buildings[id] = n;
    t.drawn = { ore: 20 }; g.towns.ridge.shipped = { bricks: 9 }; g.towns.ridge.drawn = { timber: 5 };
    // the Capital built, with every institution standing in its city
    g.towns.ridge.bestWave = 30; (await import('./src/core/capital.js')).foundCapital(g);
    const T = await import('./src/core/tree.js'); for (const id of ['market', 'bank', 'war', 'university', 'transport']) T.foundInstitution(g, id);
    CG.openMap();
    await new Promise(r => setTimeout(r, 1500));
    for (const k of Object.keys(CG.meter.flow)) CG.meter.flow[k] = 4;
  });
  else await p.evaluate(() => {
    const t = CG.game.town; t.coins = 1e9; Object.assign(t.goods, { timber: 500, copper: 500, bricks: 500, tools: 500, planks: 500, clay: 500 }); t.sell = { timber: false, copper: false, bricks: false, tools: false, planks: false, clay: false };
    for (const [id, n] of Object.entries({ camp: 12, mine: 8, pit: 6, saw: 8, smelter: 5, kiln: 3 })) t.buildings[id] = n;
    for (const [s, k] of [[1, 'crossbow'], [2, 'cannon'], [3, 'crossbow'], [8, 'frost'], [9, 'still']]) { CG.play.openSpot(s); document.querySelector('#card .build[data-kind="' + k + '"]').click(); }
    CG.play.close(); document.getElementById('callWave').click();
  });
  if (EVAL) await p.evaluate(EVAL);
  await sleep(2500);
  startTier = await p.evaluate(() => (CG.town || CG.map).view.tier);
  await p.cdp('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
  const measure = () => p.evaluate(async sec => {
    const times = [], gpu = []; let last = performance.now();
    const gl = (CG.town || CG.map).view.renderer.getContext(), px = new Uint8Array(4), track = [];
    const battle = CG.town && CG.town.battle; let id = null;
    // wait for the GPU every frame (a one-pixel read), so the time includes drawing, not just the script
    await new Promise(done => { const t0 = last; const f = now => { const w0 = performance.now(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); now = performance.now(); gpu.push(now - w0); times.push(now - last); last = now;
        // follow one raider on screen while the clock says three seconds have not passed since tracking began
        if (battle && now - t0 < 3000 && !CG.town.paused) {
          if (id === null || !battle.foes.has(id)) id = [...battle.foes.keys()].find(k => battle.foes.get(k).obj.position.x > -50) ?? null;
          const u = id !== null && battle.foes.get(id);
          if (u) { const p = CG.town.projectPoint(u.obj.position.x, .5, u.obj.position.z); if (p) track.push([p.x, p.y, id]); }
        } if (now - t0 < sec * 1000) requestAnimationFrame(f); else done(); }; requestAnimationFrame(f); });
    // script: each frame's time less its wait for the GPU (the game's own work: simulation, interface, three's setup)
    const script = times.map((x, i) => Math.max(0, x - gpu[i])); script.shift(); script.sort((a, b) => a - b);
    times.shift(); times.sort((a, b) => a - b);
    const q = k => times[Math.min(times.length - 1, Math.floor(times.length * k))];
    const jumps = [];
    for (let i = 1; i < track.length; i++) if (track[i][2] === track[i - 1][2]) jumps.push(Math.hypot(track[i][0] - track[i - 1][0], track[i][1] - track[i - 1][1]));
    const sj = jumps.slice().sort((a, b) => a - b), jmed = sj[sj.length >> 1] || 0, jmax = sj[sj.length - 1] || 0;
    const still = jumps.filter(j => j < .05).length / Math.max(1, jumps.length);
    const v = (CG.town || CG.map).view, s = v.stats || {};
    return { towns: Object.keys(CG.game.towns).length, inPlay: CG.game.active, frames: times.length, median: q(.5), script: script[script.length >> 1], p90: q(.9), fps: 1000 / q(.5), calls: s.calls, triangles: s.triangles, size: s.w + 'x' + s.h, tier: s.tier, foes: CG.game.town.waves.foes.length, smooth: { samples: jumps.length, medianJump: +jmed.toFixed(2), maxJump: +jmax.toFixed(2), stillFrames: +still.toFixed(2) } };
  }, SECONDS);
  const PROFILE = process.argv.includes('--profile');
  if (PROFILE) { await p.cdp('Profiler.enable'); await p.cdp('Profiler.start'); }
  out = await measure();
  if (REPORT) console.log('report ' + JSON.stringify(await p.evaluate(REPORT))); // --report "js": a value read from the page after measuring
  if (PROFILE) { // --profile: the functions that took the most time of their own while measuring, with their share
    const { profile } = await p.cdp('Profiler.stop'), self = new Map(), dt = profile.timeDeltas || [];
    const byId = new Map(profile.nodes.map(n => [n.id, n])); let total = 0;
    (profile.samples || []).forEach((id, i) => { const c = byId.get(id).callFrame, k = (c.functionName || '(anon)') + ' ' + c.url.split('/').slice(-2).join('/') + ':' + (c.lineNumber + 1);
      self.set(k, (self.get(k) || 0) + (dt[i] || 0)); total += dt[i] || 0; });
    for (const [k, v] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 30)) console.log((100 * v / total).toFixed(1).padStart(5) + '%  ' + k);
    // and by file, the game's own files only, as a share of the time spent in them (where the script part goes)
    const files = new Map(); let own = 0;
    for (const [k, v] of self) { const f = k.slice(k.lastIndexOf(' ') + 1).split(':')[0]; if (!/^(core|ui|render|data|audio|assets|models|art|src)\//.test(f)) continue; files.set(f, (files.get(f) || 0) + v); own += v; }
    console.log('game files (' + (100 * own / total).toFixed(1) + '% of all):');
    for (const [f, v] of [...files].sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log((100 * v / own).toFixed(1).padStart(5) + '%  ' + f);
  }
  // the software GPU is noisy on a busy machine: a near miss (within 15%) is measured once more, and the better run counts
  if (out.median > LIMIT && out.median <= LIMIT * 1.15) {
    const again = await measure(), first = +out.median.toFixed(1);
    if (again.median < out.median) out = again;
    out.retried = first;
  }
  // and so is the script part (PLAN.md: a close script gate is measured twice; 2026.11.21-3 read 8.9-10.8 ms with
  // nothing changed): a near miss is measured once more, and the better of the two runs counts
  const SCRIPT_GATE = +arg('script', 0);
  if (SCRIPT_GATE && out.script > SCRIPT_GATE && out.script <= SCRIPT_GATE * 1.15) {
    const again = await measure(), first = +out.script.toFixed(1);
    if (again.script < out.script) out = again;
    out.scriptRetried = first;
  }
  out.audio = await p.evaluate(() => { const s = CG.audio.state(); return s.ctx + ' ' + s.mood + ' bars ' + s.bars + ' sounds ' + s.sounds; }).catch(() => 'none'); // music and sound play during the run, as on a phone
  await p.cdp('Emulation.setCPUThrottlingRate', { rate: 1 });
} finally { await b.close(); srv.close(); }
out.startTier = startTier;
// a pass needs the frame time, no automatic step-down below the tier the phone started at, and smooth motion
const sm = out.smooth, jerky = TOWN === 'map' ? null : sm.samples < 20 ? 'too few frames with a raider on screen to judge smoothness'
  : sm.stillFrames > .3 ? `the raider stood still on ${Math.round(sm.stillFrames * 100)}% of frames (it moves in steps)`
  : sm.maxJump > 3 * sm.medianJump ? `a raider jumped ${sm.maxJump} px in one frame, over 3 times the median ${sm.medianJump} px` : null;
const SCRIPT = +arg('script', 0); // --script ms: the median script part of a frame must stay under it too
const slowScript = SCRIPT && out.script > SCRIPT;
const CALLS = +arg('calls', 0), manyCalls = CALLS && out.calls >= CALLS; // --calls n: fewer draw calls than n

const ok = out && !errs.length && out.median <= LIMIT && !slowScript && !manyCalls && out.tier === startTier && !jerky;
console.log(JSON.stringify({ ...out, median: +out.median.toFixed(1), script: +out.script.toFixed(1), p90: +out.p90.toFixed(1), fps: +out.fps.toFixed(1), dpr: DPR, throttle: THROTTLE }));
console.log(ok ? 'ok' : errs.length ? 'FAIL the page threw: ' + errs[0].split('\n')[0] : manyCalls ? `FAIL ${out.calls} draw calls, not fewer than ${CALLS}` : slowScript ? `FAIL the script part of a frame is ${out.script.toFixed(1)} ms, over ${SCRIPT} ms` : jerky ? 'FAIL not smooth: ' + jerky : out.tier !== startTier ? `FAIL frames were slow enough to step down from ${startTier} to ${out.tier}` : `FAIL median frame ${out.median.toFixed(1)} ms is over ${LIMIT} ms`);
// gates within 10% of their limit print "close", like the bots' gate margins (2026.11.21-3: the Silver Falls script
// part sat at 9.5 ms against 10 and read 8.9-10.8 run to run, so a change that cost nothing seemed to break it)
for (const [name, v, lim] of [['frame', out.median, LIMIT], ['script', out.script, SCRIPT], ['draw calls', out.calls, CALLS]]) if (lim && v <= lim && v > lim * .9) console.log(`close ${name} ${+v.toFixed(1)} against ${lim}`);
process.exitCode = ok ? 0 : 1;
setTimeout(() => process.exit(), 100);
