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
  ['title', () => true],
  ['town', () => { localStorage.clear(); document.getElementById('play').click(); }],
  ['card', () => { const t = CG.game.town; t.coins = 400; CG.play.open('camp'); }],
  ['spot', () => { const t = CG.game.town; t.coins = 5000; t.goods.timber = 99; CG.play.openSpot(3); }],
  ['fight', () => { const t = CG.game.town; CG.play.close(); t.coins = 1e6; Object.assign(t.goods, { timber: 500, copper: 500, bricks: 500, tools: 500 }); t.sell = { timber: false, copper: false, bricks: false, tools: false }; for (const [s, k] of [[2, 'crossbow'], [3, 'cannon'], [8, 'frost'], [9, 'still']]) { CG.play.openSpot(s); document.querySelector('#card .build[data-kind="' + k + '"]').click(); } CG.play.close(); document.getElementById('callWave').click(); }],
  ['built', () => { const t = CG.game.town; t.coins = 1e7; for (const [id, n] of Object.entries({ camp: 12, mine: 6, pit: 5, saw: 6, smelter: 3 })) { CG.play.open(id); for (let i = 0; i < n; i++) document.getElementById('buy').click(); } CG.play.close(); }],
];
const sleep = ms => new Promise(r => setTimeout(r, ms));

fs.mkdirSync(dir, { recursive: true });
const srv = await start(0), b = await chromium.launch(), wrote = [];
try {
  for (const [size, [width, height]] of Object.entries(SIZES)) {
    const p = await b.newPage({ viewport: { width, height } });
    await p.goto(srv.url);
    for (let i = 0; i < 100 && !(await p.evaluate(() => !!(window.CG && CG.ready && (!CG.scene || CG.scene.frames > 2)))); i++) await sleep(100);
    for (const [name, go] of SCREENS) {
      await p.evaluate(go); await sleep(name === 'town' ? 3000 : name === 'fight' ? 12000 : 1200);
      const f = path.join(dir, `${name}-${size}.png`); await p.screenshot({ path: f }); wrote.push(f);
    }
    await p.close();
  }
} finally { await b.close(); srv.close(); }
console.log(wrote.join('\n'));
process.exit(0);
