// node tools/audit.js: checks the owner's rules and the release plumbing, and prints "audit ok" or each problem.
// It covers: the chain rules from GDD.md, an explainer for every feature, a pure core, no requests to other hosts, cg-* storage keys only, American spelling, no personal details,
// matching versions, and a service worker list with no missing files. The full audit (chain rules, names, caps) grows
// with the game; see GDD.md.
import fs from 'node:fs';
import path from 'node:path';
import { root } from './serve.js';
import { shellFiles } from './bump-version.js';
import { GOODS } from '../src/data/goods.js';
import { BUILDINGS } from '../src/data/buildings.js';
import { TOWNS, TOWN_ORDER } from '../src/data/towns/index.js';
import { TOWERS, PATHS } from '../src/data/towers.js';
import { FOES } from '../src/data/foes.js';
import { EXPLAINERS } from '../src/data/explainers.js';
import { SYSTEMS } from '../src/core/setup.js';

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
  problems.push(...chainRules(), ...explainerRules());
  return { problems, unlisted };
}

/* Every feature teaches itself (owner rule): the features are worked out from the game, so a new system, tower kind
   or goods tier fails the audit until an explainer covers it. The named mechanics are the ones already in play. */
export const MECHANICS = ['upgrade', 'milestone', 'starved', 'vault', 'breach', 'call'];
export function requiredFeatures() {
  const f = new Set(MECHANICS);
  for (const s of SYSTEMS) f.add('system:' + s.id);
  for (const k of Object.keys(TOWERS)) f.add('tower:' + k);
  for (const t of TOWN_ORDER) for (const g of TOWNS[t].goods) f.add('tier:' + GOODS[g].tier);
  if (Object.keys(PATHS).length) f.add('path');
  if (Object.values(FOES).some(x => x.boss)) f.add('boss');
  return [...f];
}
export function explainerRules() {
  const p = [], covered = new Set(), ids = new Set();
  for (const e of EXPLAINERS) {
    if (ids.has(e.id)) p.push('two explainers named ' + e.id); ids.add(e.id);
    if (!e.title || !e.text || typeof e.when !== 'function') p.push('explainer ' + e.id + ' needs a title, a text and a when()');
    if (e.text && e.text.length > 230) p.push('explainer ' + e.id + ' is too long for a phone card (' + e.text.length + ' characters)');
    for (const c of e.covers || []) covered.add(c);
  }
  for (const f of requiredFeatures()) if (!covered.has(f)) p.push('feature ' + f + ' has no explainer (src/data/explainers.js)');
  return p;
}

/* The chain rules (GDD.md): step value 1.3-1.6x, balanced at equal levels, one maker per good, imports from earlier
   towns only, and every town's top good needs an import (except the first town, which has nothing to import). */
export function chainRules() {
  const p = [], maker = {};
  for (const [id, b] of Object.entries(BUILDINGS)) {
    if (maker[b.makes]) p.push('two buildings make ' + b.makes); maker[b.makes] = id;
    if (!GOODS[b.makes]) p.push(id + ' makes an unknown good');
  }
  for (const g of Object.keys(GOODS)) if (!maker[g]) p.push('nothing makes ' + g);
  for (const [id, b] of Object.entries(BUILDINGS)) {
    const ins = Object.entries(b.inputs);
    if (!ins.length) continue;
    const v = ins.reduce((sum, [g, n]) => sum + (GOODS[g] ? GOODS[g].price * n : 0), 0), r = GOODS[b.makes].price / v;
    if (!(r >= 1.3 - 1e-9 && r <= 1.6 + 1e-9)) p.push(id + ': worth ' + r.toFixed(2) + 'x its inputs (want 1.3-1.6)');
    for (const [g, n] of ins) {
      const sup = BUILDINGS[maker[g]];
      if (sup && sup.town === b.town && sup.rate + 1e-9 < b.rate * n) p.push(maker[g] + ' cannot keep up with ' + id + ' at equal levels');
      const from = GOODS[g] && GOODS[g].town;
      if (from && TOWN_ORDER.indexOf(from) > TOWN_ORDER.indexOf(b.town)) p.push(id + ' depends on a later town (' + g + ' from ' + from + ')');
      if (from && from !== b.town && !TOWNS[b.town].imports.includes(g)) p.push(b.town + ' uses ' + g + ' without listing it as an import');
    }
  }
  TOWN_ORDER.forEach((id, i) => {
    const t = TOWNS[id];
    if (i > 0 && !t.imports.length) p.push(id + ': its top good needs no import');
    for (const b of t.buildings) if (!BUILDINGS[b] || BUILDINGS[b].town !== id) p.push(id + ' lists building ' + b + ' of another town');
  });
  return p;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.join(root, 'tools', 'audit.js')) {
  const { problems, unlisted } = audit();
  if (unlisted.length) console.log('note: ' + unlisted.length + ' files not in the offline list yet (tools/bump-version.js adds them)');
  if (problems.length) { for (const p of problems) console.log('FAIL ' + p); process.exitCode = 1; }
  else console.log('audit ok');
}
