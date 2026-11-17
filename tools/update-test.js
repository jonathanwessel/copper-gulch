// node tools/update-test.js: serves a copy of the game with GitHub Pages-style 10-minute cache headers, lets it install
// its service worker, publishes a newer version into the copy, and checks that the open game shows "Update ready" and
// lands on the new version after one tap. Then it stops the server and reloads, to check the new version runs offline
// from the files the service worker listed. Prints "ok" on success.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { start, root } from './serve.js';
import { chromium } from './cdp.js';

const repo = process.argv[2] || root;
const site = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-site-'));
for (const f of ['index.html', 'sw.js', 'manifest.webmanifest', 'version.json']) fs.copyFileSync(path.join(repo, f), path.join(site, f));
for (const d of ['src', 'icons', 'vendor']) if (fs.existsSync(path.join(repo, d))) fs.cpSync(path.join(repo, d), path.join(site, d), { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const srv = await start(0, site, { 'Cache-Control': 'max-age=600' });
const b = await chromium.launch();
let ok = false;
try {
  const pg = await b.newPage({ viewport: { width: 400, height: 860 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(srv.url); await sleep(2500);
  await pg.reload(); await sleep(2000); // the second load runs under the service worker, like an installed app
  const before = await pg.evaluate(() => ({ v: CG.version, controlled: !!navigator.serviceWorker.controller }));
  // publish a newer version into the served copy
  const NEW = '2099.01.01-1';
  for (const f of ['src/version.js', 'sw.js']) {
    const p = path.join(site, f);
    fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/(GAME_VERSION|VERSION) = '[^']+'/, `$1 = '${NEW}'`));
  }
  fs.writeFileSync(path.join(site, 'version.json'), JSON.stringify({ version: NEW, notes: 'test release' }));
  await pg.evaluate(() => CG.checkUpdates(true)); await sleep(3000);
  const mid = await pg.evaluate(() => ({ bar: !!document.getElementById('updateBar'), waiting: !!CG.APP.waiting, status: CG.APP.status }));
  await pg.evaluate(() => document.getElementById('updateBar').click()); await sleep(3500);
  const after = await pg.evaluate(async () => ({ v: CG.version, caches: await caches.keys(), controlled: !!navigator.serviceWorker.controller }));
  // offline: the server goes away, the app must still start from its cache
  srv.close(); await sleep(300);
  await pg.reload(); await sleep(2500);
  const offline = await pg.evaluate(() => ({ v: window.CG && CG.version, title: !!document.getElementById('title'), scene: !!(window.CG && CG.scene) }));
  ok = before.controlled && mid.bar && after.v === NEW && offline.v === NEW && offline.title && offline.scene && !errs.length;
  console.log(ok ? 'ok' : 'FAIL', JSON.stringify({ before, mid, after, offline }), errs.join('; '));
} finally {
  await b.close(); srv.close(); fs.rmSync(site, { recursive: true, force: true });
}
process.exitCode = ok ? 0 : 1;
setTimeout(() => process.exit(), 100);
