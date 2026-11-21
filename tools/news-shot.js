// node tools/news-shot.js <dir>: the What's new card as a returning player sees it after this release, at phone size,
// for the screenshot-only words review (release checklist step 5). Seen version: the one before the newest entry.
import path from 'node:path';
import fs from 'node:fs';
import { start } from './serve.js';
import { chromium } from './cdp.js';
import { NEWS } from '../src/data/news.js';

const dir = path.resolve(process.argv[2] || 'shots'), sleep = ms => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(dir, { recursive: true });
const srv = await start(0), b = await chromium.launch();
try {
  const p = await b.newPage({ viewport: { width: 400, height: 860 } });
  await p.goto(srv.url + '?coach=off');
  for (let i = 0; i < 100 && !(await p.evaluate(() => !!(window.CG && CG.ready))); i++) await sleep(100);
  // a returning player: a save from the game itself, and the last version seen before this release
  await p.evaluate(() => { const n = document.getElementById('newsOk'); if (n) n.click(); document.getElementById('play').click(); });
  await sleep(2500);
  await p.evaluate(seen => { CG.save && CG.save(); localStorage.setItem('cg-news', seen); }, (NEWS[1] || NEWS[0]).v);
  await p.goto(srv.url + '?coach=off');
  for (let i = 0; i < 100 && !(await p.evaluate(() => !!document.getElementById('newsOk'))); i++) await sleep(100);
  await sleep(600);
  const f = path.join(dir, 'news-phone.png'); await p.screenshot({ path: f }); console.log(f);
} finally { await b.close(); srv.close(); }
