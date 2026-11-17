// node tools/shots.js <dir>: saves screenshots of every screen at phone, landscape and desktop sizes into <dir>,
// for a look before each release (and for fresh-eyes reviews). Prints the files it wrote.
import fs from 'node:fs';
import path from 'node:path';
import { start } from './serve.js';
import { chromium } from './cdp.js';

const dir = path.resolve(process.argv[2] || 'shots');
const SIZES = { phone: [400, 860], land: [860, 400], desk: [1366, 800] };
// each screen: a name and a function run in the page to reach it (screens grow with the game)
const SCREENS = [
  ['title', () => { const n = document.getElementById('newsOk'); if (n) n.click(); }], // What's new is checked by smoke.js
  ['town', () => { localStorage.clear(); document.getElementById('play').click(); }],
  // looking along the road toward where raiders come in, a few seconds before a wave (the dust plume) and as it starts
  ['entry', () => { const t = CG.game.town, r = CG.town.rig, v = { x: .4, z: 3, yaw: 0, pitch: .3, dist: 9 }; Object.assign(r.t, v); Object.assign(r.c, v); Object.assign(t.waves, { phase: 'break', timer: 4.5, hold: false, queue: [], foes: [] }); }],
  ['entry2', () => {}],
  ['card', () => { CG.town.rig.reset(); const t = CG.game.town; t.coins = 400; CG.play.open('camp'); }],
  ['spot', () => { const t = CG.game.town; t.coins = 5000; t.goods.timber = 99; CG.play.openSpot(3); }],
  ['fight', () => { const t = CG.game.town; CG.play.close(); t.coins = 1e6; Object.assign(t.goods, { timber: 500, copper: 500, bricks: 500, tools: 500 }); t.sell = { timber: false, copper: false, bricks: false, tools: false }; for (const [s, k] of [[2, 'crossbow'], [3, 'cannon'], [8, 'frost'], [9, 'still']]) { CG.play.openSpot(s); document.querySelector('#card .build[data-kind="' + k + '"]').click(); } CG.play.close(); document.getElementById('callWave').click(); }],
  ['selected', () => { CG.play.openSpot(3); }],
  // a tower card short of a good: how much there is, about how long, and which building to upgrade
  ['short', () => { const t = CG.game.town; t.goods.copper = 2; t.buildings.mine = Math.max(5, t.level('mine')); t.buildings.smelter = Math.max(1, t.level('smelter')); CG.play.close(); CG.play.openSpot(3); }],
  ['pit', () => { CG.play.openSpot(CG.game.town.def.board.far); }],
  ['mortar', async () => { // a shell in flight, and the Mortar selected with both of its circles
    const t = CG.game.town, B = t.def.board, wait = ms => new Promise(r => setTimeout(r, ms));
    CG.play.close(); t.flags['open:mortar'] = true; t.coins = 1e7; Object.assign(t.goods, { copper: 900, bricks: 900 });
    for (const s of [B.far, B.far + 2]) { CG.play.openSpot(s); const b = document.querySelector('#card .build[data-kind="mortar"]'); if (b) b.click(); }
    CG.play.openSpot(B.far);
    Object.assign(t.waves, { phase: 'break', timer: 0, hold: false, queue: [], foes: [] });
    for (let i = 0; i < 150; i++) { await wait(100); const sh = t.waves.shells || []; if (sh.some(x => x.t > .9)) break; }
  }],
  ['path', () => { const t = CG.game.town, tw = t.towers.find(x => x.spot === CG.game.town.def.board.far); if (tw) tw.level = 4; CG.play.close(); CG.play.openSpot(CG.game.town.def.board.far); }],
  ['goods', () => { CG.play.close(); CG.play.openGoods(); }],
  ['menu', () => { CG.play.openMenu(); }],
  ['research', () => { const t = CG.game.town; t.flags['open:research'] = true; t.coins = 5000; t.research = { saws: 2 }; t.lab = { id: 'walls', left: 14, total: 20 }; CG.play.openResearch(); }],
  ['built', () => { CG.play.sheets.close(); const t = CG.game.town; t.coins = 1e7; for (const [id, n] of Object.entries({ camp: 12, mine: 6, pit: 5, saw: 6, smelter: 3 })) { CG.play.open(id); for (let i = 0; i < n; i++) document.getElementById('buy').click(); } CG.play.close(); }],
];
const sleep = ms => new Promise(r => setTimeout(r, ms));

fs.mkdirSync(dir, { recursive: true });
const srv = await start(0), b = await chromium.launch(), wrote = [];
try {
  for (const [size, [width, height]] of Object.entries(SIZES)) {
    const p = await b.newPage({ viewport: { width, height } });
    await p.goto(srv.url + '?coach=off');
    for (let i = 0; i < 100 && !(await p.evaluate(() => !!(window.CG && CG.ready && (!CG.scene || CG.scene.frames > 2)))); i++) await sleep(100);
    for (const [name, go] of SCREENS) {
      await p.evaluate(go); await sleep(name === 'town' ? 3000 : name === 'fight' ? 12000 : name === 'mortar' ? 450 : name === 'entry' ? 3500 : name === 'entry2' ? 4000 : 1200);
      const f = path.join(dir, `${name}-${size}.png`); await p.screenshot({ path: f }); wrote.push(f);
    }
    await p.close();
  }
} finally { await b.close(); srv.close(); }
console.log(wrote.join('\n'));
process.exit(0);
