// node tools/install-test.js [url]: proves the game is installable as an app, the way Chrome on Android decides it.
// Serves the repo (or opens the given URL, e.g. the live Pages site), lets the service worker take control, then asks
// Chrome itself over the DevTools protocol:
//   Page.getAppManifest: the manifest parses with no errors;
//   Page.getInstallabilityErrors: must be an empty list.
// It also fetches every manifest icon and the apple-touch-icon (each a PNG of its stated size), and reports whether
// Chrome offered the install prompt and the Install button showed. Prints "ok" or each problem.
import { start } from './serve.js';
import { chromium } from './cdp.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const REQUIRED = { name: 'Copper Gulch', id: './', start_url: './', scope: './', display: 'standalone' };

function pngSize(buf) {
  const b = Buffer.from(buf);
  if (b.length < 24 || b.toString('ascii', 1, 4) !== 'PNG') return null;
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

const url = process.argv[2];
const srv = url ? null : await start(0);
const base = url || srv.url;
const b = await chromium.launch();
const bad = [], report = {};
try {
  const p = await b.newPage({ viewport: { width: 400, height: 860 } });
  await p.goto(base);
  for (let i = 0; i < 100 && !(await p.evaluate(() => !!navigator.serviceWorker.controller).catch(() => false)); i++) {
    if (i === 30) await p.reload();
    await sleep(200);
  }
  report.controlled = await p.evaluate(() => !!navigator.serviceWorker.controller);
  if (!report.controlled) bad.push('the service worker did not take control of the page');

  const man = await p.cdp('Page.getAppManifest');
  if (!man.url) bad.push('no manifest linked');
  if (man.errors && man.errors.length) bad.push('manifest errors: ' + man.errors.map(e => e.message).join('; '));
  let data = {};
  try { data = JSON.parse(man.data || '{}'); } catch (e) { bad.push('manifest is not JSON'); }
  for (const [k, v] of Object.entries(REQUIRED)) if (data[k] !== v) bad.push(`manifest ${k} is ${JSON.stringify(data[k])}, want ${JSON.stringify(v)}`);
  if (!data.short_name) bad.push('manifest has no short_name');
  for (const k of ['theme_color', 'background_color', 'description']) if (!data[k]) bad.push('manifest has no ' + k);
  const icons = data.icons || [], want = ['192x192 any', '512x512 any', '192x192 maskable', '512x512 maskable'];
  for (const w of want) if (!icons.some(i => i.sizes + ' ' + (i.purpose || 'any') === w)) bad.push('manifest lacks a ' + w + ' icon');
  const touch = await p.evaluate(() => { const l = document.querySelector('link[rel="apple-touch-icon"]'); return l && l.href; });
  const checks = [...icons.map(i => [new URL(i.src, man.url).href, i.sizes]), [touch, '180x180']];
  if (!touch) bad.push('no apple-touch-icon link');
  report.icons = [];
  for (const [href, sizes] of checks) {
    if (!href) continue;
    const r = await fetch(href).catch(() => null);
    const dims = r && r.ok ? pngSize(await r.arrayBuffer()) : null;
    const got = dims ? dims.join('x') : 'missing';
    report.icons.push(href.split('/').pop() + ' ' + got);
    if (got !== sizes) bad.push(`icon ${href} is ${got}, want ${sizes}`);
  }

  let errs = null;
  for (let i = 0; i < 25; i++) { // Chrome needs a moment after the worker activates
    errs = (await p.cdp('Page.getInstallabilityErrors')).installabilityErrors || [];
    if (!errs.length) break;
    await sleep(400);
  }
  report.installabilityErrors = errs.map(e => e.errorId);
  if (errs.length) bad.push('Chrome says not installable: ' + report.installabilityErrors.join(', '));
  await sleep(500);
  report.prompt = await p.evaluate(() => ({ offered: !!window.cgInstallPrompt || !!(window.CG && CG.INSTALL && CG.INSTALL.prompt), button: !!document.getElementById('install') && !document.getElementById('install').hidden && !document.querySelector('.install').hidden }));
} finally { await b.close(); if (srv) srv.close(); }
console.log(JSON.stringify(report));
console.log(bad.length ? bad.map(x => 'FAIL ' + x).join('\n') : 'ok');
process.exitCode = bad.length ? 1 : 0;
setTimeout(() => process.exit(), 100);
