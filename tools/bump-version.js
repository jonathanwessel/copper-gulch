// node tools/bump-version.js "What changed, one short sentence"
// Stamps a new version (YYYY.MM.DD-N) into src/version.js, sw.js and version.json together, with the release note, and
// rewrites the service worker's list of files to cache (the page, manifest, icons, everything in src/ and vendor/).
// Run it before every push so installed copies see the update and have every file offline.
import fs from 'node:fs';
import path from 'node:path';
import { root } from './serve.js';

const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const write = (f, s) => fs.writeFileSync(path.join(root, f), s);
export const shellFiles = () => {
  const list = dir => fs.existsSync(path.join(root, dir))
    ? fs.readdirSync(path.join(root, dir), { recursive: true }).map(f => f.replace(/\\/g, '/')).filter(f => /\.(js|png|json)$/.test(f)).map(f => './' + dir + '/' + f).sort()
    : [];
  return ['./', './index.html', './manifest.webmanifest', ...list('icons'), ...list('src'), ...list('vendor')];
};

if (process.argv[1] && path.resolve(process.argv[1]) === path.join(root, 'tools', 'bump-version.js')) {
  const ver = read('src/version.js');
  const cur = (ver.match(/GAME_VERSION = '([^']+)'/) || [])[1] || '';
  const d = new Date(), today = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  const [cd, cn] = cur.split('-');
  const next = today + '-' + (cd === today ? (+cn || 0) + 1 : 1);
  const notes = (process.argv[2] || '').replace(/['\\\n]/g, ' ').trim();
  write('src/version.js', ver.replace(/GAME_VERSION = '[^']+'/, `GAME_VERSION = '${next}'`).replace(/GAME_NEWS = '[^']*'/, `GAME_NEWS = '${notes}'`));
  const shell = shellFiles();
  write('sw.js', read('sw.js').replace(/const VERSION = '[^']+'/, `const VERSION = '${next}'`).replace(/const SHELL = \[[^\]]*\];/, 'const SHELL = ' + JSON.stringify(shell) + ';'));
  write('version.json', JSON.stringify({ version: next, notes }, null, 2) + '\n');
  console.log(cur, '->', next, notes ? '(' + notes + ')' : '', '|', shell.length, 'files cached');
}
