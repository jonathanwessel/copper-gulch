// node tools/shots.js <dir> [gulch|outpost|ridge|falls]: saves screenshots of every screen at phone, landscape and desktop sizes into <dir>,
// for a look before each release (and for fresh-eyes reviews). Prints the files it wrote.
import fs from 'node:fs';
import path from 'node:path';
import { start } from './serve.js';
import { chromium } from './cdp.js';

const dir = path.resolve(process.argv[2] || 'shots');
const ALL = { phone: [400, 860], land: [860, 400], desk: [1366, 800] };
// SHOT_SIZES=phone,land: only those sizes (for a quick look while fixing; a release takes them all)
const SIZES = process.env.SHOT_SIZES ? Object.fromEntries(process.env.SHOT_SIZES.split(',').map(k => [k, ALL[k]])) : ALL;
// each screen: a name and a function run in the page to reach it (screens grow with the game)
const SCREENS = [
  ['title', () => { const n = document.getElementById('newsOk'); if (n) n.click(); }], // What's new is checked by smoke.js
  ['town', () => { localStorage.clear(); document.getElementById('play').click(); }],
  // looking along the road toward where raiders come in, a few seconds before a wave (the dust plume) and as it starts
  ['entry', () => { const t = CG.game.town, r = CG.town.rig, v = { x: .4, z: 1.2, yaw: .35, pitch: .72, dist: 13 }; Object.assign(r.t, v); Object.assign(r.c, v); Object.assign(t.waves, { phase: 'break', timer: 4.5, hold: false, queue: [], foes: [] }); }],
  ['entry2', () => {}],
  ['card', () => { CG.town.rig.reset(); const t = CG.game.town; t.coins = 400; CG.play.open('camp'); }],
  ['spot', () => { const t = CG.game.town; t.coins = 5000; t.goods.timber = 99; CG.play.openSpot(3); }],
  ['fight', () => { const t = CG.game.town; CG.play.close(); t.coins = 1e6; Object.assign(t.goods, { timber: 500, ore: 500, copper: 500, bricks: 500, tools: 500, planks: 500, clay: 500 }); t.sell = { timber: false, ore: false, copper: false, bricks: false, tools: false, planks: false, clay: false }; for (const [s, k] of [[2, 'crossbow'], [3, 'cannon'], [8, 'frost'], [9, 'still']]) { CG.play.openSpot(s); document.querySelector('#card .build[data-kind="' + k + '"]').click(); } CG.play.close(); document.getElementById('callWave').click(); }],
  ['selected', () => { CG.play.openSpot(3); }],
  // a tower card short of a good: how much there is, about how long, and which building to upgrade
  ['strip', () => { const t = CG.game.town; CG.play.close(); t.goods.timber = 124; t.goods.planks = 18; t.goods.ore = 6; t.goods.clay = 40; }],
  ['short', () => { const t = CG.game.town; t.goods.ore = 2; t.buildings.mine = Math.max(5, t.level('mine')); CG.play.close(); CG.play.openSpot(3); }],
  ['foreman', () => { const t = CG.game.town; t.buildings.camp = Math.max(10, t.level('camp')); t.coins = 600; CG.play.close(); CG.play.open('camp'); }],
  ['foreman-wait', () => { const t = CG.game.town; delete t.sell.timber; t.coins = 1e6; t.foremen.camp = true; CG.game.shared.market.rate.timber = 1e5; t.goods.timber = 1e6; CG.play.close(); CG.play.open('camp'); }],
  ['pit', () => { CG.play.openSpot(CG.game.town.def.board.far); }],
  ['mortar', async () => { // a shell in flight, and the Mortar selected with both of its circles
    const t = CG.game.town, B = t.def.board, wait = ms => new Promise(r => setTimeout(r, ms));
    CG.play.close(); t.flags['open:mortar'] = true; t.coins = 1e7; Object.assign(t.goods, { copper: 900, bricks: 900 });
    for (const s of [B.far, B.far + 2]) { CG.play.openSpot(s); const b = document.querySelector('#card .build[data-kind="mortar"]'); if (b) b.click(); }
    CG.play.openSpot(B.far);
    Object.assign(t.waves, { phase: 'break', timer: 0, hold: false, queue: [], foes: [] });
    for (let i = 0; i < 150; i++) { await wait(100); const sh = t.waves.shells || []; if (sh.some(x => x.t > .9)) break; }
  }],
  ['path', async () => { const D = await import(new URL('src/core/defense.js', location.href).href), t = CG.game.town, tw = t.towers.find(x => x.spot === t.def.board.far); if (tw) { let spent = 0; for (let L = 0; L < 4; L++) spent += D.towerCost(t, tw.kind, L).coins; Object.assign(tw, { level: 4, spent }); } CG.play.close(); CG.play.openSpot(t.def.board.far); }], // spent counts every level, so its sell price is real (review of 2026.11.19-5: a level 4 Mortar sold for 240 like a new one)
  // the second fork at level 20 (M6a): a level-19 Still with both sides on its card, then a Still that took Slow Rot
  ['fork', async () => { const D = await import(new URL('src/core/defense.js', location.href).href), t = CG.game.town; CG.play.close(); t.towers = t.towers.filter(x => x.spot !== 2); let spent = 0; for (let L = 0; L < 19; L++) spent += D.towerCost(t, 'still', L).coins; t.towers.push({ spot: 2, kind: 'still', level: 19, path: 'a', fork: null, cd: 0, spent, pulses: 0 }); CG.play.openSpot(2); }],
  ['fork-rot', async () => { const t = CG.game.town, tw = t.towers.find(x => x.spot === 2); if (tw) Object.assign(tw, { level: 20, fork: 'a' }); CG.play.close(); CG.play.openSpot(2); }],
  ['fork-last', async () => { const t = CG.game.town, tw = t.towers.find(x => x.spot === 2); if (tw) Object.assign(tw, { level: 20, fork: 'b' }); CG.play.close(); CG.play.openSpot(2); }],
  // the wave bar (owner, 2026-11-19): the raiders card from the wave number, then the bar twice a few seconds apart, to
  // show it keeps its width while the timer runs, and the quiet building tags
  ['wave-card', () => { CG.play.close(); CG.play.sheets.close(); CG.play.openWave(); }],
  ['bar-1', () => { CG.play.sheets.close(); const ws = CG.game.town.waves; Object.assign(ws, { phase: 'break', hold: false, timer: Math.max(ws.timer, 20) }); }],
  ['bar-2', async () => { await new Promise(r => setTimeout(r, 3000)); }],
  // dots on Goods (a new good) and Research (nothing running, an item can be paid)
  ['dots', () => { CG.play.close(); const g = CG.game, t = g.town; (g.shared.seen ||= {}).goods = true; t.flags['open:research'] = true; t.coins = Math.max(t.coins, 5000); t.lab = null; for (const k of Object.keys(t.flags)) if (k.startsWith('listed:')) delete t.flags[k]; }],
  ['goods', () => { CG.play.close(); CG.play.openGoods(); }],
  ['menu', () => { CG.play.openMenu(); }],
  ['research', () => { const t = CG.game.town; t.flags['open:research'] = true; t.coins = 5000; t.research = { saws: 2 }; t.lab = { id: 'walls', left: 14, total: 20 }; CG.play.openResearch(); }],
  // the Perks sheet: a charter ready to sign, two deeds held, one pair picked and one open
  ['perks', async () => { CG.play.sheets.close(); const g = CG.game, t = g.town; Object.assign(g.shared.charter, { deeds: 2, offered: true, perks: { trade: 'a' } }); t.bestWave = Math.max(t.bestWave, 34); t.lifetime = Math.max(t.lifetime, 1e5); (await import(new URL('src/core/charter.js', location.href).href)).applyAll(g); CG.play.openPerks(); }],
  // tap a number: where coins come from, the vault, a tower's damage, a building's output and a good's price
  ['why-income', () => { CG.play.sheets.close(); CG.game.town.sell = {}; CG.play.openIncome(); }], // waits 6 s so the numbers settle
  ['why-vault', () => { CG.play.sheets.close(); CG.play.openVault(); }],
  ['why-tower', async () => { CG.play.sheets.close(); const D = await import(new URL('src/core/defense.js', location.href).href), t = CG.game.town, tw = t.towers.find(x => x.spot === 3); if (tw) { let spent = 0; for (let L = 0; L < 6; L++) spent += D.towerCost(t, tw.kind, L).coins; Object.assign(tw, { level: 6, path: 'a', spent }); } const R = await import(new URL('src/core/research.js', location.href).href); t.research.gunsmith = 2; R.applyResearch(t); CG.play.openSpot(3); const b = document.querySelector('#card [data-why="dmg"]'); if (b) b.click(); }], // spent counts every level, so its sell price is real
  // a signed town back on old ground: the tower's damage breakdown shows the Old ground factor, Call now is lit
  ['why-old', () => { CG.play.close(); const t = CG.game.town; t.record = Math.max(t.record || 0, t.wave + 20); Object.assign(t.waves, { phase: 'break', timer: 50, hold: true }); setTimeout(() => { CG.play.openSpot(3); const b = document.querySelector('#card [data-why="dmg"]'); if (b) b.click(); }, 400); }],
  // Powder Kegs, the research that opens at wave 26
  ['kegs', () => { CG.play.close(); const t = CG.game.town; t.record = 0; t.bestWave = Math.max(t.bestWave, 26); t.flags['open:research'] = true; t.coins = Math.max(t.coins, 9000); t.lab = null; setTimeout(() => { CG.play.openResearch(); setTimeout(() => { const b = document.querySelector('[data-research="kegs"]'); if (b) b.scrollIntoView({ block: 'center' }); }, 200); }, 400); }],
  ['why-output', () => { CG.play.close(); CG.play.open('camp'); document.querySelector('#card .stat').click(); }],
  ['why-price', () => { CG.play.close(); CG.play.openGoods(); const b = document.querySelector('#sheet [data-why="timber"]'); if (b) b.click(); }],
  ['built', () => { CG.play.sheets.close(); const t = CG.game.town; t.coins = 1e7; for (const [id, n] of Object.entries({ camp: 12, mine: 6, pit: 5, saw: 6, smelter: 3 })) { CG.play.open(id); for (let i = 0; i < n; i++) document.getElementById('buy').click(); } CG.play.close(); }],
  // boss waves are gates: the war wagon got through, the card says so and the waves hold
  // a stone pad once the town has as many towers as it had pads: its card says why a new one costs more (2026.11.20-17)
  ['crowd', async () => { CG.play.close(); CG.play.sheets.close(); const D = await import(new URL('src/core/defense.js', location.href).href), g = CG.game, t = g.town, B = t.def.board; g.shared.purse.coins = Math.max(g.shared.purse.coins, 1e8); for (const k of Object.keys(t.goods)) t.goods[k] = Math.max(t.goods[k] || 0, 1e5); const free = B.spots.map((_, i) => i).filter(i => !B.pits.includes(i) && !D.towerAt(t, i)); while (D.normalTowers(t) < B.crowd && free.length) D.buildTower(g, t, free.shift(), 'crossbow'); CG.play.openSpot(free[0]); }],
  ['boss-lost', async () => { CG.play.close(); const m = await import(new URL('src/core/defense.js', location.href).href), t = CG.game.town; t.wave = 20; t.bestWave = 19; t.recent = Math.max(t.recent || 0, 600); m.fall(CG.game, t, 'boss'); }],
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
  ['goal-call', () => { const t = CG.game.town; t.coins = Math.max(t.coins, 500); t.goods.stone = Math.max(t.goods.stone || 0, 100); for (const s of [0, 1, 2]) if (!t.towers.some(x => x.spot === s)) { CG.play.openSpot(s); const b = document.querySelector('#card .build[data-kind="crossbow"]'); if (b) b.click(); } CG.play.close(); for (const id of ['dc-tower', 'dc-stone2', 'dc-mine', 'dc-three', 'dc-up']) CG.game.shared.goals.done[id] = true; t.bestWave = Math.max(t.bestWave, 2); t.wave = Math.max(t.wave, 3); Object.assign(t.waves, { phase: 'break', timer: 30, hold: false, queue: [], foes: [] }); setTimeout(() => { t.waves.timer = 30; }, 1400); }], // the timer is put back once the Done flash has gone; the shot waits for the ring (review of 2026.11.20-6: it was taken before the ring came)
  ['outpost-entry', () => { const t = CG.game.town, r = CG.town.rig, B = t.def.board, v = { x: B.entrance.mouth[0], z: 2.6, yaw: 0, pitch: .5, dist: 10 }; Object.assign(r.t, v); Object.assign(r.c, v); Object.assign(t.waves, { phase: 'break', timer: 4.5, hold: false, queue: [], foes: [] }); }],
  ['outpost-fight', () => { CG.town.rig.reset(); const t = CG.game.town; t.coins = 5000; t.goods.stone = 500; t.buildings.quarry = 6; t.buildings.dmine = 3; for (const s of [0, 1, 2]) { CG.play.openSpot(s); const b = document.querySelector('#card .build[data-kind="crossbow"]'); if (b) b.click(); } CG.play.close(); document.getElementById('callWave').click(); }],
  // Dry Creek's boss: the bandit wagon at wave 10, close up as it comes down the road
  ['bandits', async () => {
    const t = CG.game.town, r = CG.town.rig, v = { x: 3.9, z: .2, yaw: -.9, pitch: .85, dist: 11 }, w = ms => new Promise(k => setTimeout(k, ms));
    Object.assign(t.waves, { phase: 'break', timer: 0, hold: false, queue: [], foes: [] }); t.wave = 10; t.bestWave = Math.max(t.bestWave, 9); Object.assign(r.t, v); Object.assign(r.c, v);
    for (let i = 0; i < 50 && t.waves.phase !== 'wave'; i++) await w(50);
    t.waves.queue = ['bandits'];
    let f = null;
    for (let i = 0; i < 300; i++) { f = t.waves.foes.find(x => x.kind === 'bandits'); if (f) { f.hp = f.max = 1e6; if (f.s >= 5.6) break; } await w(50); }
  }],
  ['won', () => { delete CG.game.shared.seen['dc-won']; CG.game.town.bestWave = 10; }],
  ['chip', async () => { for (let i = 0; i < 50 && (!document.getElementById('coachGo') || document.getElementById('coachGo').hidden); i++) await new Promise(r => setTimeout(r, 100)); document.getElementById('coachGo').click(); await new Promise(r => setTimeout(r, 800)); CG.coach.skipAll(); }],
  // the back button's card, the first time there is somewhere to go back to
  ['back-card', async () => { delete CG.game.shared.seen.back; for (let i = 0; i < 60 && CG.coach.current !== 'back'; i++) await new Promise(r => setTimeout(r, 100)); }],
];
// Iron Ridge: a Gulch at wave 20 with the coins, the locked Iron Ridge button, its sheet, Start, then the Ridge itself
const RIDGE = [
  ['found-chip', async () => {
    const n = document.getElementById('newsOk'); if (n) n.click();
    localStorage.clear(); document.getElementById('play').click();
    for (let i = 0; i < 100 && !(window.CG && CG.town && CG.play); i++) await new Promise(r => setTimeout(r, 100));
    const t = CG.game.town; t.bestWave = 20; t.wave = 21; t.coins = 2e5;
    // what a player at wave 21 has built (review of 2026.11.20-11: a Gulch at wave 21 with only a Lumber Camp looked like a broken save)
    Object.assign(t.buildings, { camp: 9, mine: 7, pit: 6, saw: 5, smelter: 4, kiln: 3 });
    const D = await import('./src/core/defense.js');
    for (const [i, k, L] of [[2, 'crossbow', 4], [3, 'cannon', 3], [5, 'crossbow', 3], [8, 'frost', 2], [9, 'still', 2], [11, 'cannon', 2]]) {
      if (D.towerAt(t, i)) continue; if (!D.fitsSpot(t, i, k)) continue; t.towers.push({ spot: i, kind: k, level: L, spent: 300 * L, path: null, cd: 0, pulses: 0 });
    }
    (await import('./src/core/outpost.js')).grantOutpost(CG.game, 'drycreek'); // every player in the Gulch has won Dry Creek
  }],
  // the goal strip once wave 20 is beaten and the coins are short: hold the waves and save
  ['ridge-save', async () => {
    const t = CG.game.town, d = CG.game.shared.goals.done;
    for (const id of ['g-tower', 'g-camp3', 'g-mine', 'g-cannon', 'g-camp5', 'g-saw', 'g-research', 'g-pit', 'g-frost', 'g-mine5', 'g-smelter', 'g-path', 'g-wave10', 'g-mortar']) d[id] = true;
    t.coins = 4000;
  }],
  ['ridge-ready', () => { CG.game.town.coins = 2e5; }],
  // the card that points at Map once Iron Ridge is in sight
  ['found-card', async () => { delete CG.game.shared.seen.found; for (let i = 0; i < 60 && CG.coach.current !== 'found'; i++) await new Promise(r => setTimeout(r, 100)); }],
  ['found', async () => { CG.coach.dismiss(); document.getElementById('mapBtn').click(); for (let i = 0; i < 80 && !(CG.mapui && CG.map && CG.map.frames > 10); i++) await new Promise(r => setTimeout(r, 100)); CG.mapui.openSite('ridge'); await new Promise(r => setTimeout(r, 1200)); }],
  ['ridge', async () => { document.getElementById('mapFound').click(); for (let i = 0; i < 60 && !(CG.town && CG.game.active === 'ridge'); i++) await new Promise(r => setTimeout(r, 100)); }],
  ['ridge-entry', () => { const t = CG.game.town, r = CG.town.rig, B = t.def.board, v = { x: B.entrance.mouth[0] - 1, z: 1.6, yaw: 0, pitch: .5, dist: 10 }; Object.assign(r.t, v); Object.assign(r.c, v); Object.assign(t.waves, { phase: 'break', timer: 4.5, hold: false, queue: [], foes: [] }); }],
  ['ridge-built', () => {
    CG.town.rig.reset(); const t = CG.game.town; t.coins = 1e8;
    const G = CG.game.towns.gulch; G.buildings.pit = Math.max(5, G.level('pit')); G.buildings.kiln = Math.max(3, G.level('kiln')); // as for any player who reached the Ridge (review of 2026.11.19-12: "Build a Kiln" beside a Gulch that had one)
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
    const t = CG.game.town, r = CG.town.rig, m = t.def.board.entrance.mouth, v = { x: m[0] - .4, z: m[1] + 2.2, yaw: .5, pitch: .6, dist: 10 }, w = ms => new Promise(k => setTimeout(k, ms));
    Object.assign(t.waves, { phase: 'break', timer: 0, hold: false, queue: [], foes: [] }); t.wave = 10; Object.assign(r.t, v); Object.assign(r.c, v);
    for (let i = 0; i < 50 && t.waves.phase !== 'wave'; i++) await w(50);
    t.waves.queue = ['train'];
    let f = null;
    for (let i = 0; i < 300; i++) { f = t.waves.foes.find(x => x.kind === 'train'); if (f) { f.hp = f.max = 1e6; if (f.s >= 5.4) break; } await w(50); }
  }],
  ['ridge-goods', () => { CG.town.rig.reset(); const t = CG.game.town; t.shipped = { bricks: 12 }; t.goods.bricks = 6; CG.play.openGoods(); }],
  ['ridge-income', () => { CG.play.sheets.close(); CG.play.openIncome(); }], // one purse: a line for each other town and outpost (waits 6 s)
  ['pinehollow', async () => { CG.play.sheets.close(); CG.go('pinehollow'); for (let i = 0; i < 60 && !(CG.town && CG.game.active === 'pinehollow'); i++) await new Promise(r => setTimeout(r, 100)); }],
  // Research from an outpost (owner, 2026-11-20): the button is there and the sheet shows what the Gulch is researching
  ['outpost-research', async () => { const G = CG.game.towns.gulch; G.flags['open:research'] = true; G.lab = { id: 'saws', left: 42, total: 80 }; await new Promise(r => setTimeout(r, 400)); CG.play.openResearch(); }],
  ['pinehollow-entry', () => { CG.play.sheets.close(); CG.game.towns.gulch.lab = null; const t = CG.game.town, r = CG.town.rig, B = t.def.board, v = { x: B.entrance.mouth[0], z: 2.6, yaw: 0, pitch: .5, dist: 10 }; Object.assign(r.t, v); Object.assign(r.c, v); Object.assign(t.waves, { phase: 'break', timer: 4.5, hold: false, queue: [], foes: [] }); }],
  ['pinehollow-fight', () => { CG.town.rig.reset(); const t = CG.game.town; t.coins = 5000; t.goods.timber = 500; t.buildings.logcamp = 6; t.buildings.claybank = 3; for (const [s, k] of [[0, 'crossbow'], [1, 'cannon'], [2, 'crossbow']]) { CG.play.openSpot(s); const b = document.querySelector('#card .build[data-kind="' + k + '"]'); if (b) b.click(); } CG.play.close(); document.getElementById('callWave').click(); }],
  // the Gulch, out of play, loses to the war wagon: its waves hold themselves and a toast says so
  ['lost-toast', () => { const G = CG.game.towns.gulch; G.wave = 18; Object.assign(G.waves, { hold: true, autoHold: true, phase: 'break', timer: 0, queue: [], foes: [] }); G.lost = { why: 'boss', wave: 20, back: 18, coins: 900, at: G.t }; CG.game.bus.emit('breach', { town: 'gulch', wave: 20, lost: 900, why: 'boss', back: 18, held: true }); }],
  // the empire map: every town as a small model with its badge, wagons on the roads, a town's card and the Capital's site
  ['map', async () => { const R = CG.game.towns.ridge; R.bestWave = Math.max(R.bestWave, R.wave - 1); (await import('./src/core/outpost.js')).grantOutpost(CG.game, 'drycreek'); CG.game.towns.gulch.drawn = { ore: 20 }; CG.game.towns.ridge.drawn = { timber: 8 }; CG.openMap(); for (let i = 0; i < 40 && !(CG.map && CG.map.frames > 5); i++) await new Promise(r => setTimeout(r, 100)); for (const k of ['drycreek>gulch', 'gulch>ridge', 'pinehollow>ridge']) CG.meter.flow[k] = 4; }],
  // every wave state on the map labels (owner, 2026-11-20): Iron Ridge fighting, the Gulch on hold, Dry Creek won with
  // its raids, Pine Hollow counting down; then the same map a few seconds later, where no label may change its size
  ['map-states', async () => { const D = await import('./src/core/defense.js'), g = CG.game, R = g.towns.ridge, G = g.towns.gulch; if (R.waves.phase === 'break') { R.waves.hold = false; D.startWave(g, R); } Object.assign(G.waves, { phase: 'break', queue: [], foes: [], timer: 20 }); D.setHold(g, G, true); const P = g.towns.pinehollow; if (P && P.waves.phase === 'break') Object.assign(P.waves, { timer: 40, hold: false }); window.__mb = [...document.querySelectorAll('#mapBadges .mapbadge')].filter(b => !b.hidden).map(b => [b.dataset.site, b.offsetWidth, b.offsetHeight]); }],
  ['map-states2', () => { const now = [...document.querySelectorAll('#mapBadges .mapbadge')].filter(b => !b.hidden).map(b => [b.dataset.site, b.offsetWidth, b.offsetHeight]); const was = Object.fromEntries((window.__mb || []).map(x => [x[0], x])); const bad = now.filter(x => was[x[0]] && (was[x[0]][1] !== x[1] || was[x[0]][2] !== x[2])); if (bad.length) setTimeout(() => { throw new Error('a map label changed size: ' + bad.map(x => x[0] + ' ' + was[x[0]][1] + 'x' + was[x[0]][2] + ' to ' + x[1] + 'x' + x[2]).join(', ')); }); }],
  ['map-card', () => { CG.mapui.openSite('ridge'); }],
  ['map-raids', () => { CG.mapui.openSite('drycreek'); }],
  ['map-capital', () => { CG.mapui.openSite('capital'); }],
  ['map-lost', () => { CG.mapui.openSite('gulch'); }],
  // the Capital: ready to build, then its contracts with one running
  ['capital-ready', () => { const r = CG.game.towns.ridge; r.bestWave = 30; CG.game.town.coins = 4e5; CG.mapui.openSite('capital'); }],
  ['capital', async () => { document.getElementById('mapFound').click(); await new Promise(r => setTimeout(r, 300)); const c = CG.game.shared.capital; if (c.offers[0]) { document.querySelector('#mapCard [data-contract]').click(); const a = c.active; if (a) a.got = a.need * .4; } }],
  // institutions: one founded with an upgrade bought, one ready to buy, the rest with their founding price
  ['capital-institutions', async () => { document.getElementById('capTabInst').click(); await new Promise(r => setTimeout(r, 200)); const c = CG.game.shared.capital; CG.game.shared.purse.coins = Math.max(CG.game.shared.purse.coins, 2e5); c.influence = 20; document.querySelector('#mapCard [data-found="market"]').click(); await new Promise(r => setTimeout(r, 200)); document.querySelector('#mapCard [data-node="market"]').click(); await new Promise(r => setTimeout(r, 200)); CG.game.shared.purse.coins = 6e4; }],
  // the Capital's city up close: four institutions standing, then the University rising out of its lot
  ['capital-city', async () => { CG.mapui.close(); (await import('./src/ui/play.js')).dropToasts('capital'); const T = await import('./src/core/tree.js'); CG.game.shared.purse.coins = 1e7; for (const id of ['bank', 'war', 'transport']) T.foundInstitution(CG.game, id); const r = CG.map.rig, v = { x: 0, z: -.3, yaw: 0, pitch: .78, dist: innerWidth < innerHeight ? 15 : 7 }; await new Promise(res => setTimeout(res, 500)); Object.assign(r.t, v); Object.assign(r.c, v); r.flick = null; await new Promise(res => setTimeout(res, 1600)); for (let i = 0; i < 20 && document.querySelector('.toast.out'); i++) await new Promise(res => setTimeout(res, 50)); }], // never mid-fade (review of 2026.11.20-4)
  ['capital-rise', async () => { const T = await import('./src/core/tree.js'); setTimeout(() => T.foundInstitution(CG.game, 'university'), 1200 - 450); }],
  ['map-fly', () => { CG.mapui.close(); const r = CG.map.rig; Object.assign(r.c, r.home); Object.assign(r.t, r.home); r.flick = null; CG.flyTo('gulch'); }], // from the whole map, as a player flies (the capital close-up dove over bare ground)
  // Automation in the Gulch (the War Office and the University stand): Auto-towers on, Auto-research off
  ['auto', async () => { for (let i = 0; i < 60 && !(CG.town && CG.game.active === 'gulch' && CG.play); i++) await new Promise(r => setTimeout(r, 100)); await new Promise(r => setTimeout(r, 1500)); const A = await import('./src/core/automation.js'); const G = CG.game.town; if (!G.towers.length) G.towers.push({ spot: 0, kind: 'crossbow', level: 3, path: null, cd: 0, spent: 0, pulses: 0 }); A.setAuto(CG.game, G, 'towers', true); CG.play.openAuto(); }],
  // Keep trying the boss on, right after the war wagon got through: the sheet says what it waits for, then the map badge
  ['auto-retry', async () => { const A = await import('./src/core/automation.js'), G = CG.game.town; A.setAuto(CG.game, G, 'retry', true); if (!G.towers.length) G.towers.push({ spot: 0, kind: 'crossbow', level: 1, path: null, cd: 0, spent: 0, pulses: 0 }); for (const k of Object.keys(G.goods)) { G.goods[k] = Math.max(G.goods[k], 5000); G.sell[k] = false; } A.autoOf(CG.game, G).wait = 30; G.wave = 18; Object.assign(G.waves, { hold: true, autoHold: true, phase: 'break', timer: 0, queue: [], foes: [] }); G.lost = { why: 'boss', wave: 20, back: 18, coins: 900, at: G.t }; CG.play.sheets.close(); CG.play.openAuto(); }],
  ['map-retry', async () => { CG.play.sheets.close(); CG.openMap(); for (let i = 0; i < 40 && !(CG.map && CG.map.frames > 5); i++) await new Promise(r => setTimeout(r, 100)); CG.mapui.openSite('gulch'); }],
];
// Silver Falls: in sight on the map with its deeds rule, then founded: both entrances, the river with boats and the
// bridges, the power card, the ironclad steamer, and Sandy Bend
const FALLS = [
  ['falls-sight', async () => { const wait = ms => new Promise(r => setTimeout(r, ms));
    const n = document.getElementById('newsOk'); if (n) n.click();
    localStorage.clear(); document.getElementById('play').click();
    for (let i = 0; i < 150 && !(window.CG && CG.game && CG.town && CG.play); i++) await wait(100);
    const g = CG.game; (await import('./src/core/outpost.js')).grantOutpost(g, 'drycreek'); g.addTown('ridge'); g.addTown('pinehollow'); g.towns.ridge.bestWave = 57; g.shared.charter.deeds = 3; g.shared.purse.coins = 2e6; // Pine Hollow too, as founding the Ridge leaves it
    CG.openMap(); for (let i = 0; i < 60 && !(CG.mapui && CG.map && CG.map.frames > 10); i++) await wait(100);
    CG.mapui.openSite('falls'); await wait(1000);
  }],
  ['falls', async () => { const wait = ms => new Promise(r => setTimeout(r, ms)); CG.game.shared.charter.deeds = 5; CG.mapui.openSite('falls'); await wait(400); document.getElementById('mapFound').click(); for (let i = 0; i < 60 && !(CG.town && CG.game.active === 'falls'); i++) await wait(100); }],
  ['falls-entry', () => { const t = CG.game.town, r = CG.town.rig, v = { x: 7.2, z: 1.4, yaw: 0, pitch: .5, dist: 10.5 }; Object.assign(r.t, v); Object.assign(r.c, v); Object.assign(t.waves, { phase: 'break', timer: 4.5, hold: false, queue: [], foes: [] }); }],
  ['falls-built', () => {
    CG.town.rig.reset(); const t = CG.game.town; t.coins = 1e9;
    for (const [id, n] of Object.entries({ sandpit: 12, quartzmine: 10, waterwheel: 6, glassworks: 8, wiremill: 6, bulbworks: 5, dynamo: 3, telegraph: 2 })) { CG.play.open(id); for (let i = 0; i < n; i++) document.getElementById('buy').click(); }
    CG.play.close();
  }],
  ['falls-power', () => { CG.play.open('glassworks'); }],
  ['falls-wheel', () => { CG.play.close(); CG.play.open('waterwheel'); }],
  ['falls-fight', () => {
    const t = CG.game.town; CG.play.close(); t.flags['open:mortar'] = true; Object.assign(t.goods, { sand: 900, quartz: 900, glass: 900 }); t.sell = { sand: false, quartz: false, glass: false };
    for (const [s, k] of [[0, 'crossbow'], [1, 'cannon'], [2, 'frost'], [3, 'still'], [4, 'crossbow'], [5, 'cannon'], [t.def.board.far, 'mortar']]) { CG.play.openSpot(s); const b = document.querySelector('#card .build[data-kind="' + k + '"]'); if (b) b.click(); }
    CG.play.close(); t.wave = Math.max(t.wave, 5); document.getElementById('callWave').click();
  }],
  // the ironclad steamer, close up as it comes round the bend under the broken bridge
  ['steamer', async () => { const wait = ms => new Promise(r => setTimeout(r, ms));
    const t = CG.game.town, r = CG.town.rig, m = t.def.board.river.entrance.mouth, v = { x: m[0] + .3, z: m[1] + 2.4, yaw: -.4, pitch: .6, dist: 10 };
    Object.assign(t.waves, { phase: 'break', timer: 0, hold: false, queue: [], foes: [] }); t.wave = 10; Object.assign(r.t, v); Object.assign(r.c, v);
    for (let i = 0; i < 50 && t.waves.phase !== 'wave'; i++) await wait(50);
    t.waves.queue = ['steamer'];
    for (let i = 0; i < 300; i++) { const f = t.waves.foes.find(x => x.kind === 'steamer'); if (f) { f.hp = f.max = 1e6; if (f.s >= 4.6) break; } await wait(50); }
  }],
  ['sandybend', async () => { const wait = ms => new Promise(r => setTimeout(r, ms)); CG.town.rig.reset(); CG.go('sandybend'); for (let i = 0; i < 60 && !(CG.town && CG.game.active === 'sandybend'); i++) await wait(100); }],
  ['sandybend-entry', () => { const t = CG.game.town, r = CG.town.rig, B = t.def.board, v = { x: B.entrance.mouth[0], z: 2.6, yaw: 0, pitch: .5, dist: 10 }; Object.assign(r.t, v); Object.assign(r.c, v); Object.assign(t.waves, { phase: 'break', timer: 4.5, hold: false, queue: [], foes: [] }); }],
  ['falls-map', async () => { const wait = ms => new Promise(r => setTimeout(r, ms)); CG.openMap(); for (let i = 0; i < 40 && !(CG.map && CG.map.frames > 5); i++) await wait(100); CG.mapui.openSite('falls'); }],
];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ONLY = process.argv[3]; // optional: only this run (gulch, outpost, ridge or falls)

fs.mkdirSync(dir, { recursive: true });
const srv = await start(0), b = await chromium.launch(), wrote = [], errs = [];
/* Each shot also records where the wave bar sits: the top-left block (place, wave bar, Pause, goal) never moves from
   screen to screen at one size (review of 2026.11.20-11: it sat 20 to 45 px lower beside a taller side column). */
const waveTops = {};
async function shot(pg, f, size) {
  await pg.screenshot({ path: f }); wrote.push(f);
  const top = await pg.evaluate(() => { const w = document.getElementById('wave'), r = w && w.getBoundingClientRect(); return r && r.height > 0 && getComputedStyle(w).visibility !== 'hidden' ? Math.round(r.top) : null; });
  if (top !== null) (waveTops[size] ||= []).push([path.basename(f), top]);
}
const watch = (pg, size) => { pg.on('pageerror', e => errs.push(size + ': ' + String(e.message).split('\n')[0])); return pg; };
try {
  for (const [size, [width, height]] of Object.entries(SIZES)) {
    if (!ONLY || ONLY === 'gulch') {
    const p = watch(await b.newPage({ viewport: { width, height } }), size);
    await p.goto(srv.url + '?coach=off&start=gulch');
    for (let i = 0; i < 100 && !(await p.evaluate(() => !!(window.CG && CG.ready && (!CG.scene || CG.scene.frames > 2)))); i++) await sleep(100);
    for (const [name, go] of SCREENS) {
      await p.evaluate(go); if (name === 'town') for (let i = 0; i < 100 && !(await p.evaluate(() => !!(window.CG && CG.game && CG.town))); i++) await sleep(100); /* a slow start once left the next scene with no game */ await sleep(name === 'town' ? 3000 : name === 'fight' ? 12000 : name === 'mortar' ? 450 : name === 'entry' ? 3500 : name === 'entry2' ? 4000 : name === 'why-income' ? 6000 : name === 'foreman' ? 1800 : 1200); // foreman: past the goal's Done strip for the level the jump to 10 passed (review of 2026.11.20-7)
      const f = path.join(dir, `${name}-${size}.png`); await shot(p, f, size);
    }
    await p.close();
    }
    if (!ONLY || ONLY === 'outpost') {
    const q = watch(await b.newPage({ viewport: { width, height } }), size);
    await q.goto(srv.url);
    for (let i = 0; i < 100 && !(await q.evaluate(() => !!(window.CG && CG.ready))); i++) await sleep(100);
    for (const [name, go] of OUTPOST) {
      await q.evaluate(go); if (name === 'goal-call') for (let i = 0; i < 40 && await q.evaluate(() => document.getElementById('goalMark').hidden); i++) await sleep(100); await sleep(name === 'outpost' ? 3000 : name === 'goal-done' ? 450 : name === 'goal' ? 2000 : name === 'outpost-entry' ? 3500 : name === 'outpost-fight' ? 9000 : name === 'bandits' ? 150 : name === 'won' ? 2500 : 1500);
      const f = path.join(dir, `${name}-${size}.png`); await shot(q, f, size);
      if (process.env.SHOT_PROBE) console.log(name, size, JSON.stringify(await q.evaluate(new Function('return (' + process.env.SHOT_PROBE + ')'))));
    }
    await q.close();
    }
    if (!ONLY || ONLY === 'ridge') {
      const r = watch(await b.newPage({ viewport: { width, height } }), size);
      await r.goto(srv.url + '?coach=off&start=gulch');
      for (let i = 0; i < 100 && !(await r.evaluate(() => !!(window.CG && CG.ready))); i++) await sleep(100);
      for (const [name, go] of RIDGE) {
        await r.evaluate(go); await sleep(name === 'found-chip' ? 3000 : name === 'ridge-save' ? 4000 : name === 'ridge-income' ? 6000 : name === 'ridge' || name === 'pinehollow' || name === 'map' ? 3000 : name === 'map-fly' ? 120 : name.endsWith('-entry') ? 3500 : name.endsWith('-fight') ? 9000 : name === 'train' ? 150 : 1200);
        const f = path.join(dir, `${name}-${size}.png`); await shot(r, f, size);
      }
      await r.close();
    }
    if (!ONLY || ONLY === 'falls') {
      const r = watch(await b.newPage({ viewport: { width, height } }), size);
      await r.goto(srv.url + '?coach=off&start=gulch');
      for (let i = 0; i < 100 && !(await r.evaluate(() => !!(window.CG && CG.ready))); i++) await sleep(100);
      for (const [name, go] of FALLS) {
        await r.evaluate(go); await sleep(name === 'falls' || name === 'sandybend' || name === 'falls-sight' ? 3000 : name.endsWith('-entry') ? 3500 : name.endsWith('-fight') ? 7000 : name === 'steamer' ? 150 : 1200);
        const f = path.join(dir, `${name}-${size}.png`); await shot(r, f, size);
      }
      await r.close();
    }
  }
} finally { await b.close(); srv.close(); }
console.log(wrote.join('\n'));
for (const [size, list] of Object.entries(waveTops)) {
  const tops = list.map(x => x[1]), lo = Math.min(...tops), hi = Math.max(...tops);
  if (hi - lo > 2) errs.push(size + ': the wave bar moves between ' + lo + ' and ' + hi + ' px (' + list.filter(x => x[1] !== lo).map(x => x[0] + ' ' + x[1]).slice(0, 6).join(', ') + ')');
}
// an error on any page fails the run (2026.11.20-11: the steamer's stack check threw every frame in Silver Falls)
if (errs.length) { console.log('page errors:\n' + [...new Set(errs)].slice(0, 20).join('\n')); process.exit(1); }
process.exit(0);
