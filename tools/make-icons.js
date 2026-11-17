// node tools/make-icons.js: renders the app icons from the game's own 3D title scene into icons/: the saloon and the
// vault at golden hour, framed in copper. The maskable icon is the same scene full bleed (phones cut their own shape).
import fs from 'node:fs';
import path from 'node:path';
import { start, root } from './serve.js';
import { chromium } from './cdp.js';

const out = path.join(root, 'icons');
const sleep = ms => new Promise(r => setTimeout(r, ms));

fs.mkdirSync(out, { recursive: true });
const srv = await start(0), b = await chromium.launch();
try {
  const p = await b.newPage({ viewport: { width: 512, height: 512 } });
  await p.goto(srv.url);
  for (let i = 0; i < 100 && !(await p.evaluate(() => !!(window.CG && CG.scene && CG.scene.frames > 2))); i++) await sleep(100);
  await p.evaluate(() => {
    document.getElementById('app').hidden = true;
    CG.scene.pose = { yaw: -.3, pitch: .34, dist: 5.6, look: [.35, .45, -.1] };
  });
  await sleep(800);
  const png = (await p.screenshot()).toString('base64');
  const icons = await p.evaluate(async src => {
    const img = new Image(); img.src = 'data:image/png;base64,' + src; await img.decode();
    const make = (n, framed) => {
      const c = document.createElement('canvas'); c.width = c.height = n; const g = c.getContext('2d');
      g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, n, n);
      if (framed) { // a flat copper frame with a dark keyline and a light inner bevel
        const w = Math.max(4, Math.round(n * .05));
        g.fillStyle = '#1d120c'; g.fillRect(0, 0, n, w + 2); g.fillRect(0, n - w - 2, n, w + 2); g.fillRect(0, 0, w + 2, n); g.fillRect(n - w - 2, 0, w + 2, n);
        g.fillStyle = '#e38d4e'; g.fillRect(1, 1, n - 2, w); g.fillRect(1, n - w - 1, n - 2, w); g.fillRect(1, 1, w, n - 2); g.fillRect(n - w - 1, 1, w, n - 2);
        g.fillStyle = '#ffc58f'; const t = Math.max(1, Math.round(w / 4)); g.fillRect(1, 1, n - 2, t); g.fillRect(1, 1, t, n - 2);
      }
      return c.toDataURL('image/png');
    };
    return { 'icon-192.png': make(192, true), 'icon-512.png': make(512, true), 'icon-maskable-512.png': make(512, false), 'apple-touch-icon.png': make(180, false) };
  }, png);
  for (const [name, url] of Object.entries(icons)) fs.writeFileSync(path.join(out, name), Buffer.from(url.split(',')[1], 'base64'));
  console.log('wrote', Object.keys(icons).join(', '));
} finally { await b.close(); srv.close(); }
process.exit(0);
