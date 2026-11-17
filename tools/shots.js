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
  ['fight', () => { const t = CG.game.town; CG.play.close(); t.coins = 1e6; Object.assign(t.goods, { timber: 500, ore: 500, copper: 500, bricks: 500, tools: 500, planks: 500, clay: 500 }); t.sell = { timber: false, ore: false, copper: false, bricks: false, tools: false, planks: false, clay: false }; for (const [s, k] of [[2, 'crossbow'], [3, 'cannon'], [8, 'frost'], [9, 'still']]) { CG.play.openSpot(s); document.querySelector('#card .build[data-kind="' + k + '"]').click(); } CG.play.close(); document.getElementById('callWave').click(); }],
  ['selected', () => { CG.play.openSpot(3); }],
  // a tower card short of a good: how much there is, about how long, and which building to upgrade
  ['short', () => { const t = CG.game.town; t.goods.ore = 2; t.buildings.mine = Math.max(5, t.level('mine')); CG.play.close(); CG.play.openSpot(3); }],
  ['foreman', () => { const t = CG.game.town; t.buildings.camp = Math.max(10, t.level('camp')); t.coins = 600; CG.play.close(); CG.play.open('camp'); }],
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
  // dots on Goods (a new good) and Research (nothing running, an item can be paid)
  ['dots', () => { CG.play.close(); const g = CG.game, t = g.town; (g.shared.seen ||= {}).goods = true; t.flags['open:research'] = true; t.coins = Math.max(t.coins, 5000); t.lab = null; for (const k of Object.keys(t.flags)) if (k.startsWith('listed:')) delete t.flags[k]; }],
  ['goods', () => { CG.play.close(); CG.play.openGoods(); }],
  ['menu', () => { CG.play.openMenu(); }],
  ['research', () => { const t = CG.game.town; t.flags['open:research'] = true; t.coins = 5000; t.research = { saws: 2 }; t.lab = { id: 'walls', left: 14, total: 20 }; CG.play.openResearch(); }],
  // the Perks sheet: a charter ready to sign, two deeds held, one pair picked and one open
  ['perks', () => { CG.play.sheets.close(); const g = CG.game, t = g.town; Object.assign(g.shared.charter, { deeds: 2, offered: true, perks: { trade: 'a' } }); t.bestWave = Math.max(t.bestWave, 34); t.lifetime = Math.max(t.lifetime, 1e5); CG.play.openPerks(); }],
  // tap a number: where coins come from, the vault, a tower's damage, a building's output and a good's price
  ['why-income', () => { CG.play.sheets.close(); CG.game.town.sell = {}; CG.play.openIncome(); }], // waits 6 s so the numbers settle
  ['why-vault', () => { CG.play.sheets.close(); CG.play.openVault(); }],
  ['why-tower', () => { CG.play.sheets.close(); const t = CG.game.town, tw = t.towers.find(x => x.spot === 3); if (tw) Object.assign(tw, { level: 6, path: 'a' }); t.mods.set('towerDmg', 'Gunsmith research', { mul: 1.3 }); CG.play.openSpot(3); const b = document.querySelector('#card [data-why="dmg"]'); if (b) b.click(); }],
  ['why-output', () => { CG.play.close(); CG.play.open('camp'); document.querySelector('#card .stat').click(); }],
  ['why-price', () => { CG.play.close(); CG.play.openGoods(); const b = document.querySelector('#sheet [data-why="timber"]'); if (b) b.click(); }],
  ['built', () => { CG.play.sheets.close(); const t = CG.game.town; t.coins = 1e7; for (const [id, n] of Object.entries({ camp: 12, mine: 6, pit: 5, saw: 6, smelter: 3 })) { CG.play.open(id); for (let i = 0; i < n; i++) document.getElementById('buy').click(); } CG.play.close(); }],
];
// a new game, which starts in Dry Creek Outpost (cards on, so the win card can be shown)
const OUTPOST = [
  ['outpost', async () => {
    const n = document.getElementById('newsOk'); if (n) n.click();
    localStorage.clear(); document.getElementById('play').click();
    for (let i = 0; i < 100 && !(window.CG && CG.coach && CG.town); i++) await new Promise(r => setTimeout(r, 100));
    CG.coach.skipAll();
  }],
  // the goal strip: a goal just done, then the next one with its spotlight
  ['goal-done', () => { const t = CG.game.town; t.coins = Math.max(t.coins, 200); t.goods.stone = Math.max(t.goods.stone || 0, 30); CG.play.openSpot(0); const b = document.querySelector('#card .build[data-kind="crossbow"]'); if (b) b.click(); CG.play.close(); }],
  ['goal', () => {}],
  ['outpost-entry', () => { const t = CG.game.town, r = CG.town.rig, B = t.def.board, v = { x: B.entrance.mouth[0], z: 4, yaw: 0, pitch: .32, dist: 8.5 }; Object.assign(r.t, v); Object.assign(r.c, v); Object.assign(t.waves, { phase: 'break', timer: 4.5, hold: false, queue: [], foes: [] }); }],
  ['outpost-fight', () => { CG.town.rig.reset(); const t = CG.game.town; t.coins = 5000; t.goods.stone = 500; t.buildings.quarry = 6; t.buildings.dmine = 3; for (const s of [0, 1, 2]) { CG.play.openSpot(s); const b = document.querySelector('#card .build[data-kind="crossbow"]'); if (b) b.click(); } CG.play.close(); document.getElementById('callWave').click(); }],
  ['won', () => { delete CG.game.shared.seen['dc-won']; CG.game.town.bestWave = 10; }],
  ['chip', async () => { for (let i = 0; i < 50 && (!document.getElementById('coachGo') || document.getElementById('coachGo').hidden); i++) await new Promise(r => setTimeout(r, 100)); document.getElementById('coachGo').click(); await new Promise(r => setTimeout(r, 800)); CG.coach.skipAll(); }],
];
const sleep = ms => new Promise(r => setTimeout(r, ms));

fs.mkdirSync(dir, { recursive: true });
const srv = await start(0), b = await chromium.launch(), wrote = [];
try {
  for (const [size, [width, height]] of Object.entries(SIZES)) {
    const p = await b.newPage({ viewport: { width, height } });
    await p.goto(srv.url + '?coach=off&start=gulch');
    for (let i = 0; i < 100 && !(await p.evaluate(() => !!(window.CG && CG.ready && (!CG.scene || CG.scene.frames > 2)))); i++) await sleep(100);
    for (const [name, go] of SCREENS) {
      await p.evaluate(go); await sleep(name === 'town' ? 3000 : name === 'fight' ? 12000 : name === 'mortar' ? 450 : name === 'entry' ? 3500 : name === 'entry2' ? 4000 : name === 'why-income' ? 6000 : 1200);
      const f = path.join(dir, `${name}-${size}.png`); await p.screenshot({ path: f }); wrote.push(f);
    }
    await p.close();
    const q = await b.newPage({ viewport: { width, height } });
    await q.goto(srv.url);
    for (let i = 0; i < 100 && !(await q.evaluate(() => !!(window.CG && CG.ready))); i++) await sleep(100);
    for (const [name, go] of OUTPOST) {
      await q.evaluate(go); await sleep(name === 'outpost' ? 3000 : name === 'goal-done' ? 450 : name === 'goal' ? 2000 : name === 'outpost-entry' ? 3500 : name === 'outpost-fight' ? 9000 : name === 'won' ? 2500 : 1500);
      const f = path.join(dir, `${name}-${size}.png`); await q.screenshot({ path: f }); wrote.push(f);
    }
    await q.close();
  }
} finally { await b.close(); srv.close(); }
console.log(wrote.join('\n'));
process.exit(0);
