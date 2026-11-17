// node tools/serve.js [port]: serves the game folder over http (ES modules and service workers need http, not file://).
// The other tools use it too: `const s = await start(0)` gives { url, close }.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.css': 'text/css',
};

export function start(port = 0, dir = root, headers = { 'Cache-Control': 'no-cache' }) {
  return new Promise(res => {
    const srv = http.createServer((q, r) => {
      const p = path.join(dir, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html'));
      if (!p.startsWith(dir)) { r.writeHead(403); return r.end(); }
      fs.readFile(p, (e, d) => {
        if (e) { r.writeHead(404); return r.end(); }
        r.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream', ...headers });
        r.end(d);
      });
    }).listen(port, '127.0.0.1', () => res({ url: 'http://127.0.0.1:' + srv.address().port + '/', close: () => { srv.closeAllConnections?.(); srv.close(); } }));
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  start(+process.argv[2] || 5190).then(s => console.log('Copper Gulch at', s.url));
}
