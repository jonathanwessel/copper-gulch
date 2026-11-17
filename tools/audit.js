// node tools/audit.js: checks the owner's rules and the release plumbing, and prints "audit ok" or each problem.
// v0 covers: a pure core, no requests to other hosts, cg-* storage keys only, American spelling, no personal details,
// matching versions, and a service worker list with no missing files. The full audit (chain rules, names, caps) grows
// with the game; see GDD.md.
import fs from 'node:fs';
import path from 'node:path';
import { root } from './serve.js';
import { shellFiles } from './bump-version.js';

const walk = dir => fs.existsSync(path.join(root, dir))
  ? fs.readdirSync(path.join(root, dir), { recursive: true }).map(f => (dir + '/' + f).replace(/\\/g, '/')).filter(f => fs.statSync(path.join(root, f)).isFile())
  : [];
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/.*$/gm, '$1');

// British spellings that must not appear (American spelling is an owner rule)
const BRITISH = ['colour', 'behaviour', 'armour', 'centre', 'favourite', 'honour', 'defence', 'licence', 'organise', 'realise',
  'travelled', 'cancelled', 'catalogue', 'metre', 'theatre', 'neighbour', 'harbour', 'grey', 'jewellery', 'analyse', 'optimise',
  'recognise', 'cheque', 'plough', 'storey', 'tyre', 'aluminium', 'programme', 'learnt', 'whilst', 'saviour', 'rumour', 'odour'];

export function audit() {
  const problems = [];
  const code = [...walk('src'), 'sw.js'].filter(f => f.endsWith('.js'));
  const runtime = [...code, 'index.html', 'manifest.webmanifest'];
  const docs = ['README.md', 'GDD.md', 'PLAN.md'].filter(f => fs.existsSync(path.join(root, f)));

  // 1. the core is pure: deterministic, no DOM, no three.js
  for (const f of walk('src/core').filter(f => f.endsWith('.js'))) {
    const s = stripComments(read(f));
    if (/Math\.random/.test(s)) problems.push(f + ': uses Math.random (use the town rng)');
    if (/\b(document|window|localStorage|navigator|requestAnimationFrame)\b/.test(s)) problems.push(f + ': touches the DOM');
    if (/from\s+['"](three|three\/addons\/[^'"]*|\.\.\/(render|ui|art|audio)\/[^'"]*)['"]/.test(s)) problems.push(f + ': imports rendering or interface code');
    if (/\bDate\.now\(|new Date\(|performance\.now\(/.test(s)) problems.push(f + ': reads the wall clock (pass time in)');
  }

  // 2. no requests to other hosts: no URLs in anything the game loads
  for (const f of runtime) {
    const s = stripComments(read(f));
    const m = s.match(/(https?:)?\/\/[a-z0-9-]+\.[a-z0-9.-]+[/'"]/i);
    if (m && !/^\/\/\s/.test(m[0])) problems.push(f + ': refers to another host (' + m[0] + ')');
    if (/gtag|googletagmanager|google-analytics|adsbygoogle|doubleclick|facebook\.net/i.test(s)) problems.push(f + ': ads or tracking');
  }

  // 3. storage keys: only cg-*; the old game's key may be read, never written
  for (const f of code) {
    const s = read(f);
    for (const m of s.matchAll(/(localStorage|sessionStorage)\.(setItem|getItem|removeItem)\(\s*(['"`])([^'"`]*)\3/g)) {
      const [, , op, , key] = m;
      if (key === 'copper-gulch-save-v1') { if (op !== 'getItem') problems.push(f + ': writes the old game\'s save key'); }
      else if (!key.startsWith('cg-')) problems.push(f + ': storage key "' + key + '" is not cg-*');
    }
    if (/localStorage\[|localStorage\.[a-z]+\s*=/.test(s)) problems.push(f + ': storage used without setItem/getItem');
  }

  // 4. American spelling, in the game and the docs
  for (const f of [...runtime, ...docs]) {
    const s = read(f).toLowerCase();
    for (const w of BRITISH) if (new RegExp('\\b' + w + '(s|ed|ing)?\\b').test(s)) problems.push(f + ': British spelling "' + w + '"');
  }

  // 5. no personal details in the public repo
  for (const f of [...runtime, ...docs, ...walk('tools'), ...walk('test')]) {
    const s = read(f);
    const mail = s.match(/[a-z0-9._%+-]+@[a-z0-9-]+\.[a-z.]{2,}/i);
    if (mail) problems.push(f + ': an email address');
    if (/\b(192\.168|10\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01]))\.\d{1,3}\b/.test(s)) problems.push(f + ': a LAN address');
  }

  // 6. release plumbing: one version everywhere, a cache list with no missing files, icons that exist
  const v1 = (read('src/version.js').match(/GAME_VERSION = '([^']+)'/) || [])[1];
  const v2 = (read('sw.js').match(/const VERSION = '([^']+)'/) || [])[1];
  const v3 = fs.existsSync(path.join(root, 'version.json')) ? JSON.parse(read('version.json')).version : v1;
  if (!(v1 && v1 === v2 && v2 === v3)) problems.push(`versions differ: version.js ${v1}, sw.js ${v2}, version.json ${v3}`);
  const shell = JSON.parse((read('sw.js').match(/const SHELL = (\[[^\]]*\]);/) || [, '[]'])[1]);
  for (const u of shell) if (u !== './' && !fs.existsSync(path.join(root, u))) problems.push('sw.js caches a missing file: ' + u);
  const want = new Set(shellFiles()), have = new Set(shell);
  const unlisted = [...want].filter(u => !have.has(u));
  const manifest = JSON.parse(read('manifest.webmanifest'));
  for (const i of manifest.icons) if (!fs.existsSync(path.join(root, i.src))) problems.push('manifest icon missing: ' + i.src);
  for (const m of read('index.html').matchAll(/(?:href|src)="([^"#:]+)"/g)) if (!fs.existsSync(path.join(root, m[1]))) problems.push('index.html links a missing file: ' + m[1]);
  return { problems, unlisted };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.join(root, 'tools', 'audit.js')) {
  const { problems, unlisted } = audit();
  if (unlisted.length) console.log('note: ' + unlisted.length + ' files not in the offline list yet (tools/bump-version.js adds them)');
  if (problems.length) { for (const p of problems) console.log('FAIL ' + p); process.exitCode = 1; }
  else console.log('audit ok');
}
