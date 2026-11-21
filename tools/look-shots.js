// node tools/look-shots.js <dir> [town,...|map]: the look pass (PLAN.md M5b) before and after shots. Every town's home view at
// phone, landscape and desktop sizes, a low view across the town, and the town built up (every plot at level 30, so the
// buildings show their later steps), and the steps: every plot at a level mark in turn (1, 10, 25, 50, 100). Faster than tools/shots.js, and only the board, so the look can be judged alone.
// `map`: the empire map early (the Gulch, Dry Creek and Iron Ridge open, the rest surveyed land) and full (every town,
// outpost and the Capital), each at the whole map and a few close views.
import fs from 'node:fs';
import path from 'node:path';
import { start } from './serve.js';
import { chromium } from './cdp.js';

const dir = path.resolve(process.argv[2] || 'shots');
const TOWNS = (process.argv[3] || 'drycreek,gulch,pinehollow,ridge,falls').split(',');
const SIZES = process.env.SHOT_SIZES ? Object.fromEntries(process.env.SHOT_SIZES.split(',').map(k => [k, { phone: [400, 860], land: [860, 400], desk: [1366, 800] }[k]])) : { phone: [400, 860], land: [860, 400], desk: [1366, 800] };
const VIEWS = [
  ['home', () => { CG.town.rig.reset(); }],
  ['low', () => { const r = CG.town.rig, B = CG.game.town.def.board, v = { x: B.cols / 2, z: B.rows / 2 + 1, yaw: .5, pitch: .55, dist: 11 }; Object.assign(r.t, v); Object.assign(r.c, v); }],
  ['built', () => { const t = CG.game.town; for (const id of Object.keys(t.def.board.plots)) t.buildings[id] = 30; CG.town.rig.reset(); }],
  ['built-low', () => { const r = CG.town.rig, B = CG.game.town.def.board, v = { x: B.cols / 2 - 1, z: B.rows / 2, yaw: -.6, pitch: .5, dist: 10 }; Object.assign(r.t, v); Object.assign(r.c, v); }],
  // every plot at one of the level marks in turn (1, 10, 25, 50, 100), so the steps a building grows by show side by side
  ['steps', () => { const t = CG.game.town, L = [1, 10, 25, 50, 100]; Object.keys(t.def.board.plots).forEach((id, i) => { t.buildings[id] = L[i % L.length]; }); CG.town.rig.reset(); }],
  ['steps-low', () => { const r = CG.town.rig, B = CG.game.town.def.board, v = { x: B.cols / 2 - 1, z: B.rows / 2, yaw: -.6, pitch: .5, dist: 10 }; Object.assign(r.t, v); Object.assign(r.c, v); }],
];

// the empire map: an early empire (some land still surveyed) and a full one, routes carrying goods
const MAPSTATES = {
  early: async () => {
    const g = CG.game, t = g.town; t.bestWave = 20; t.coins = 1e7;
    for (const [id, n] of Object.entries({ camp: 12, mine: 8, pit: 6, saw: 8, smelter: 5, kiln: 3 })) t.buildings[id] = n;
    (await import('./src/core/empire.js')).foundTown(g, 'ridge'); (await import('./src/core/outpost.js')).grantOutpost(g, 'drycreek');
    for (const [id, n] of Object.entries({ rquarry: 12, ironmine: 10, colliery: 10, furnace: 10 })) g.towns.ridge.buildings[id] = n;
    t.drawn = { ore: 20 }; g.towns.ridge.shipped = { bricks: 9 };
  },
  // the smoke test's map: the early empire with the Capital built (its label sat nearer Iron Ridge, 2026.11.21-6)
  capital: async () => {
    const g = CG.game, t = g.town; t.bestWave = 20; t.coins = 1e7;
    (await import('./src/core/empire.js')).foundTown(g, 'ridge'); t.drawn = { ore: 5 }; g.towns.ridge.shipped = { bricks: 5 };
    (await import('./src/core/capital.js')).foundCapital(g); g.shared.purse.coins = 1e9;
    const T = await import('./src/core/tree.js'); for (const id of ['bank', 'transport']) T.foundInstitution(g, id);
  },
  full: async () => {
    const g = CG.game, t = g.town; t.bestWave = 30; t.coins = 1e9;
    for (const [id, n] of Object.entries({ camp: 12, mine: 10, pit: 8, saw: 10, smelter: 8, kiln: 8, toolsmith: 6 })) t.buildings[id] = n;
    const op = await import('./src/core/outpost.js'); op.grantOutpost(g, 'drycreek');
    const r = g.addTown('ridge'); g.addTown('pinehollow'); op.grantOutpost(g, 'pinehollow'); r.bestWave = 52;
    for (const [id, n] of Object.entries({ rquarry: 12, ironmine: 10, colliery: 10, furnace: 10, steelmill: 8, rolling: 10, boilershop: 5, loco: 3 })) r.buildings[id] = n;
    (await import('./src/core/capital.js')).foundCapital(g);
    const T = await import('./src/core/tree.js'); g.shared.purse.coins = 1e9; for (const id of ['market', 'bank', 'war', 'university', 'transport']) T.foundInstitution(g, id);
    g.addTown('falls'); op.grantOutpost(g, 'sandybend');
    for (const [id, n] of Object.entries({ sandpit: 12, quartzmine: 10, waterwheel: 8, glassworks: 8 })) g.towns.falls.buildings[id] = n;
    t.drawn = { ore: 20 }; r.shipped = { bricks: 9 }; r.drawn = { timber: 5 }; g.towns.falls.drawn = { sand: 4 }; t.shipped = { bricks: 5, tools: 3 };
  },
};
const MAPVIEWS = [
  ['home', () => { const r = CG.map.rig; Object.assign(r.t, r.home); Object.assign(r.c, r.home); r.flick = null; }],
  ['low', () => { const r = CG.map.rig, v = { x: 0, z: 4, yaw: .4, pitch: .5, dist: 22 }; Object.assign(r.t, v); Object.assign(r.c, v); r.flick = null; }],
  ['near', () => { const r = CG.map.rig, v = { x: -7, z: 12, yaw: -.3, pitch: .7, dist: 13 }; Object.assign(r.t, v); Object.assign(r.c, v); r.flick = null; }],
  ['north', () => { const r = CG.map.rig, v = { x: 7, z: -12, yaw: 0, pitch: .7, dist: 14 }; Object.assign(r.t, v); Object.assign(r.c, v); r.flick = null; }],
];
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(dir, { recursive: true });
const srv = await start(0), b = await chromium.launch(), wrote = [], errs = [];
try {
  if (TOWNS[0] === 'map') for (const [state, setup] of Object.entries(MAPSTATES)) for (const [size, [width, height]] of Object.entries(SIZES)) {
    const p = await b.newPage({ viewport: { width, height } });
    p.on('pageerror', e => errs.push('map ' + size + ': ' + String(e.message).split('\n')[0]));
    await p.goto(srv.url + '?coach=off&start=gulch');
    for (let i = 0; i < 100 && !(await p.evaluate(() => !!(window.CG && CG.ready))); i++) await sleep(100);
    await p.evaluate(() => { const n = document.getElementById('newsOk'); if (n) n.click(); localStorage.clear(); document.getElementById('play').click(); });
    for (let i = 0; i < 100 && !(await p.evaluate(() => !!(CG.town && CG.town.frames > 2))); i++) await sleep(100);
    await p.evaluate(setup);
    await p.evaluate(() => { for (const x of Object.values(CG.game.towns)) if (x.waves) x.waves.hold = true; CG.openMap(); });
    for (let i = 0; i < 100 && !(await p.evaluate(() => !!(CG.map && CG.map.frames > 5))); i++) await sleep(100);
    await sleep(1500);
    await p.evaluate(() => { for (const k of Object.keys(CG.meter.flow)) CG.meter.flow[k] = 4; });
    for (const [name, go] of MAPVIEWS) {
      if (state !== 'full' && name === 'north') continue;
      await p.evaluate(go); await sleep(1500);
      const f = path.join(dir, `map-${state}-${name}-${size}.png`); await p.screenshot({ path: f }); wrote.push(f);
      // how much of each town its label covers, and any town's middle under a label (M6a, map labels on a phone)
      const cv = await p.evaluate(() => CG.mapui.cover()); console.log(`map-${state}-${name}-${size}`, JSON.stringify(cv.share), cv.mids.concat(cv.near).join(", "));
    }
    await p.close();
  }
  else for (const town of TOWNS) for (const [size, [width, height]] of Object.entries(SIZES)) {
    const p = await b.newPage({ viewport: { width, height } });
    p.on('pageerror', e => errs.push(town + ' ' + size + ': ' + String(e.message).split('\n')[0]));
    await p.goto(srv.url + '?coach=off' + (town === 'drycreek' ? '' : '&start=' + town));
    for (let i = 0; i < 100 && !(await p.evaluate(() => !!(window.CG && CG.ready))); i++) await sleep(100);
    await p.evaluate(() => { const n = document.getElementById('newsOk'); if (n) n.click(); localStorage.clear(); document.getElementById('play').click(); });
    for (let i = 0; i < 100 && !(await p.evaluate(() => !!(CG.town && CG.town.frames > 2))); i++) await sleep(100);
    await p.evaluate(() => { CG.game.town.waves.hold = true; });
    for (const [name, go] of VIEWS) {
      await p.evaluate(go); await sleep(name === 'home' ? 2500 : 1500);
      const f = path.join(dir, `${town}-${name}-${size}.png`); await p.screenshot({ path: f }); wrote.push(f);
    }
    await p.close();
  }
} finally { await b.close(); srv.close(); }
console.log(wrote.join('\n'));
if (errs.length) { console.log('page errors:\n' + [...new Set(errs)].slice(0, 20).join('\n')); process.exit(1); }
