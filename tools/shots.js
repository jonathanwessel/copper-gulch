// node tools/shots.js <dir> [gulch|outpost|ridge]: saves screenshots of every screen at phone, landscape and desktop sizes into <dir>,
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
  // a signed town back on old ground: the tower's damage breakdown shows the Old ground factor, Call now is lit
  ['why-old', () => { CG.play.close(); const t = CG.game.town; t.record = Math.max(t.record || 0, t.wave + 20); Object.assign(t.waves, { phase: 'break', timer: 50, hold: true }); setTimeout(() => { CG.play.openSpot(3); const b = document.querySelector('#card [data-why="dmg"]'); if (b) b.click(); }, 400); }],
  // Powder Kegs, the research that opens at wave 26
  ['kegs', () => { CG.play.close(); const t = CG.game.town; t.record = 0; t.bestWave = Math.max(t.bestWave, 26); t.flags['open:research'] = true; t.coins = Math.max(t.coins, 9000); t.lab = null; setTimeout(() => { CG.play.openResearch(); setTimeout(() => { const b = document.querySelector('[data-research="kegs"]'); if (b) b.scrollIntoView({ block: 'center' }); }, 200); }, 400); }],
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
  // the Call now goal: three Crossbows up, two waves beaten, the wait half gone, so the button is lit and spotlit
  ['goal-call', () => { const t = CG.game.town; t.coins = Math.max(t.coins, 500); t.goods.stone = Math.max(t.goods.stone || 0, 100); for (const s of [0, 1, 2]) if (!t.towers.some(x => x.spot === s)) { CG.play.openSpot(s); const b = document.querySelector('#card .build[data-kind="crossbow"]'); if (b) b.click(); } CG.play.close(); for (const id of ['dc-tower', 'dc-stone2', 'dc-mine', 'dc-three', 'dc-up']) CG.game.shared.goals.done[id] = true; t.bestWave = Math.max(t.bestWave, 2); t.wave = Math.max(t.wave, 3); Object.assign(t.waves, { phase: 'break', timer: 30, hold: false, queue: [], foes: [] }); }],
  ['outpost-entry', () => { const t = CG.game.town, r = CG.town.rig, B = t.def.board, v = { x: B.entrance.mouth[0], z: 4, yaw: 0, pitch: .32, dist: 8.5 }; Object.assign(r.t, v); Object.assign(r.c, v); Object.assign(t.waves, { phase: 'break', timer: 4.5, hold: false, queue: [], foes: [] }); }],
  ['outpost-fight', () => { CG.town.rig.reset(); const t = CG.game.town; t.coins = 5000; t.goods.stone = 500; t.buildings.quarry = 6; t.buildings.dmine = 3; for (const s of [0, 1, 2]) { CG.play.openSpot(s); const b = document.querySelector('#card .build[data-kind="crossbow"]'); if (b) b.click(); } CG.play.close(); document.getElementById('callWave').click(); }],
  // Dry Creek's boss: the bandit wagon at wave 10, close up as it comes down the road
  ['bandits', async () => {
    const t = CG.game.town, r = CG.town.rig, v = { x: 3.9, z: .2, yaw: .5, pitch: .5, dist: 4.2 }, w = ms => new Promise(k => setTimeout(k, ms));
    Object.assign(t.waves, { phase: 'break', timer: 0, hold: false, queue: [], foes: [] }); t.wave = 10; Object.assign(r.t, v); Object.assign(r.c, v);
    for (let i = 0; i < 50 && t.waves.phase !== 'wave'; i++) await w(50);
    t.waves.queue = ['bandits'];
    let f = null;
    for (let i = 0; i < 300; i++) { f = t.waves.foes.find(x => x.kind === 'bandits'); if (f) { f.hp = f.max = 1e6; if (f.s >= 5.6) break; } await w(50); }
  }],
  ['won', () => { delete CG.game.shared.seen['dc-won']; CG.game.town.bestWave = 10; }],
  ['chip', async () => { for (let i = 0; i < 50 && (!document.getElementById('coachGo') || document.getElementById('coachGo').hidden); i++) await new Promise(r => setTimeout(r, 100)); document.getElementById('coachGo').click(); await new Promise(r => setTimeout(r, 800)); CG.coach.skipAll(); }],
];
// Iron Ridge: a Gulch at wave 20 with the coins, the locked Iron Ridge button, its sheet, Start, then the Ridge itself
const RIDGE = [
  ['found-chip', async () => {
    const n = document.getElementById('newsOk'); if (n) n.click();
    localStorage.clear(); document.getElementById('play').click();
    for (let i = 0; i < 100 && !(window.CG && CG.town && CG.play); i++) await new Promise(r => setTimeout(r, 100));
    const t = CG.game.town; t.bestWave = 20; t.wave = 21; t.coins = 2e5;
  }],
  // the goal strip once wave 20 is beaten and the coins are short: hold the waves and save
  ['ridge-save', async () => {
    const t = CG.game.town, d = CG.game.shared.goals.done;
    for (const id of ['g-tower', 'g-camp3', 'g-mine', 'g-cannon', 'g-camp5', 'g-saw', 'g-research', 'g-pit', 'g-frost', 'g-mine5', 'g-smelter', 'g-path', 'g-wave10', 'g-mortar']) d[id] = true;
    t.coins = 4000;
  }],
  ['ridge-ready', () => { CG.game.town.coins = 2e5; }],
  ['found', () => { document.querySelector('#townChip .locked').click(); }],
  ['ridge', async () => { document.getElementById('foundTown').click(); for (let i = 0; i < 60 && !(CG.town && CG.game.active === 'ridge'); i++) await new Promise(r => setTimeout(r, 100)); }],
  ['ridge-entry', () => { const t = CG.game.town, r = CG.town.rig, B = t.def.board, v = { x: B.entrance.mouth[0] - 1, z: 3, yaw: 0, pitch: .32, dist: 9 }; Object.assign(r.t, v); Object.assign(r.c, v); Object.assign(t.waves, { phase: 'break', timer: 4.5, hold: false, queue: [], foes: [] }); }],
  ['ridge-built', () => {
    CG.town.rig.reset(); const t = CG.game.town; t.coins = 1e8;
    for (const [id, n] of Object.entries({ rquarry: 12, ironmine: 10, colliery: 10, furnace: 10, steelmill: 8, rolling: 6, boilershop: 5, loco: 2 })) { CG.play.open(id); for (let i = 0; i < n; i++) document.getElementById('buy').click(); }
    CG.play.close();
  }],
  ['ridge-route', () => { CG.play.open('boilershop'); }],
  ['ridge-fight', () => {
    const t = CG.game.town; CG.play.close(); t.flags['open:mortar'] = true; Object.assign(t.goods, { stone: 900, iron: 900, coal: 900, pigiron: 900 }); t.sell = { stone: false, iron: false, coal: false, pigiron: false };
    for (const [s, k] of [[0, 'crossbow'], [1, 'cannon'], [2, 'frost'], [3, 'still'], [4, 'crossbow'], [5, 'cannon'], [t.def.board.far, 'mortar']]) { CG.play.openSpot(s); const b = document.querySelector('#card .build[data-kind="' + k + '"]'); if (b) b.click(); }
    CG.play.close(); document.getElementById('callWave').click();
  }],
  // the armored train, close up as it comes out of the tunnel
  ['train', async () => {
    const t = CG.game.town, r = CG.town.rig, m = t.def.board.entrance.mouth, v = { x: m[0] - .4, z: m[1] + 2.2, yaw: .5, pitch: .5, dist: 4.4 }, w = ms => new Promise(k => setTimeout(k, ms));
    Object.assign(t.waves, { phase: 'break', timer: 0, hold: false, queue: [], foes: [] }); t.wave = 10; Object.assign(r.t, v); Object.assign(r.c, v);
    for (let i = 0; i < 50 && t.waves.phase !== 'wave'; i++) await w(50);
    t.waves.queue = ['train'];
    let f = null;
    for (let i = 0; i < 300; i++) { f = t.waves.foes.find(x => x.kind === 'train'); if (f) { f.hp = f.max = 1e6; if (f.s >= 5.4) break; } await w(50); }
  }],
  ['ridge-goods', () => { CG.town.rig.reset(); const t = CG.game.town; t.shipped = { bricks: 12 }; t.goods.bricks = 6; CG.play.openGoods(); }],
  ['pinehollow', async () => { CG.play.sheets.close(); CG.go('pinehollow'); for (let i = 0; i < 60 && !(CG.town && CG.game.active === 'pinehollow'); i++) await new Promise(r => setTimeout(r, 100)); }],
  ['pinehollow-entry', () => { const t = CG.game.town, r = CG.town.rig, B = t.def.board, v = { x: B.entrance.mouth[0], z: 4, yaw: 0, pitch: .32, dist: 8.5 }; Object.assign(r.t, v); Object.assign(r.c, v); Object.assign(t.waves, { phase: 'break', timer: 4.5, hold: false, queue: [], foes: [] }); }],
  ['pinehollow-fight', () => { CG.town.rig.reset(); const t = CG.game.town; t.coins = 5000; t.goods.timber = 500; t.buildings.logcamp = 6; t.buildings.claybank = 3; for (const [s, k] of [[0, 'crossbow'], [1, 'cannon'], [2, 'crossbow']]) { CG.play.openSpot(s); const b = document.querySelector('#card .build[data-kind="' + k + '"]'); if (b) b.click(); } CG.play.close(); document.getElementById('callWave').click(); }],
];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ONLY = process.argv[3]; // optional: only this run (gulch, outpost or ridge)

fs.mkdirSync(dir, { recursive: true });
const srv = await start(0), b = await chromium.launch(), wrote = [];
try {
  for (const [size, [width, height]] of Object.entries(SIZES)) {
    if (!ONLY || ONLY === 'gulch') {
    const p = await b.newPage({ viewport: { width, height } });
    await p.goto(srv.url + '?coach=off&start=gulch');
    for (let i = 0; i < 100 && !(await p.evaluate(() => !!(window.CG && CG.ready && (!CG.scene || CG.scene.frames > 2)))); i++) await sleep(100);
    for (const [name, go] of SCREENS) {
      await p.evaluate(go); await sleep(name === 'town' ? 3000 : name === 'fight' ? 12000 : name === 'mortar' ? 450 : name === 'entry' ? 3500 : name === 'entry2' ? 4000 : name === 'why-income' ? 6000 : 1200);
      const f = path.join(dir, `${name}-${size}.png`); await p.screenshot({ path: f }); wrote.push(f);
    }
    await p.close();
    }
    if (!ONLY || ONLY === 'outpost') {
    const q = await b.newPage({ viewport: { width, height } });
    await q.goto(srv.url);
    for (let i = 0; i < 100 && !(await q.evaluate(() => !!(window.CG && CG.ready))); i++) await sleep(100);
    for (const [name, go] of OUTPOST) {
      await q.evaluate(go); await sleep(name === 'outpost' ? 3000 : name === 'goal-done' ? 450 : name === 'goal' ? 2000 : name === 'outpost-entry' ? 3500 : name === 'outpost-fight' ? 9000 : name === 'bandits' ? 150 : name === 'won' ? 2500 : 1500);
      const f = path.join(dir, `${name}-${size}.png`); await q.screenshot({ path: f }); wrote.push(f);
    }
    await q.close();
    }
    if (!ONLY || ONLY === 'ridge') {
      const r = await b.newPage({ viewport: { width, height } });
      await r.goto(srv.url + '?coach=off&start=gulch');
      for (let i = 0; i < 100 && !(await r.evaluate(() => !!(window.CG && CG.ready))); i++) await sleep(100);
      for (const [name, go] of RIDGE) {
        await r.evaluate(go); await sleep(name === 'found-chip' ? 3000 : name === 'ridge-save' ? 4000 : name === 'ridge' || name === 'pinehollow' ? 3000 : name.endsWith('-entry') ? 3500 : name.endsWith('-fight') ? 9000 : name === 'train' ? 150 : 1200);
        const f = path.join(dir, `${name}-${size}.png`); await r.screenshot({ path: f }); wrote.push(f);
      }
      await r.close();
    }
  }
} finally { await b.close(); srv.close(); }
console.log(wrote.join('\n'));
process.exit(0);
