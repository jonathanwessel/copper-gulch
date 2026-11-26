// node tools/audit.js: checks the owner's rules and the release plumbing, and prints "audit ok" or each problem.
// It covers: the chain rules from GDD.md, an explainer for every feature, a pure core, no requests to other hosts, cg-* storage keys only, American spelling, no personal details,
// matching versions, and a service worker list with no missing files. The full audit (GDD.md, Numbers and names) also
// checks that no two things share a name, that every bonus lands on a stat with a published cap, and that every
// building, tower kind and raider has its own model. It grows with the game.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { root } from './serve.js';
import { shellFiles } from './bump-version.js';
import { GOODS } from '../src/data/goods.js';
import { BUILDINGS } from '../src/data/buildings.js';
import { TOWNS, TOWN_ORDER, isPitSpot } from '../src/data/towns/index.js';
import { FORKS, TOWERS, PATHS, NORMAL_REACH } from '../src/data/towers.js';
import { makePath, pointAt, dist } from '../src/core/path.js';
import { FOES } from '../src/data/foes.js';
import { EXPLAINERS } from '../src/data/explainers.js';
import { SAY_SYMBOLS } from '../src/audio/speech.js';
import { NEWS } from '../src/data/news.js';
import { GOALS } from '../src/data/goals.js';
import { SYSTEMS } from '../src/core/setup.js';
import { RESEARCH } from '../src/data/research.js';
import { PERKS } from '../src/data/perks.js';
import { CAPS } from '../src/core/mods.js';
import { INSTITUTIONS } from '../src/data/institutions.js';

const walk = dir => fs.existsSync(path.join(root, dir))
  ? fs.readdirSync(path.join(root, dir), { recursive: true }).map(f => (dir + '/' + f).replace(/\\/g, '/')).filter(f => fs.statSync(path.join(root, f)).isFile())
  : [];
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/.*$/gm, '$1');

// British spellings that must not appear (American spelling is an owner rule)
const BRITISH = ['colour', 'behaviour', 'armour', 'centre', 'favourite', 'honour', 'defence', 'licence', 'organise', 'realise',
  'travelled', 'cancelled', 'catalogue', 'metre', 'theatre', 'neighbour', 'harbour', 'grey', 'jewellery', 'analyse', 'optimise',
  'recognise', 'cheque', 'plough', 'storey', 'tyre', 'aluminium', 'programme', 'learnt', 'whilst', 'saviour', 'rumour', 'odour',
  'department of transport']; // the American name is Department of Transportation

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
    // LF line endings only: a patch script that wrote CRLF broke source tests in ways that looked like code bugs (2026.11.21-10)
    if (s.includes('\r')) problems.push(f + ': CRLF line endings (write with newline "\\n")');
  }

  // 6. release plumbing: one version everywhere, a cache list with no missing files, icons that exist
  const v1 = (read('src/version.js').match(/GAME_VERSION = '([^']+)'/) || [])[1];
  const v2 = (read('sw.js').match(/const VERSION = '([^']+)'/) || [])[1];
  const v3 = fs.existsSync(path.join(root, 'version.json')) ? JSON.parse(read('version.json')).version : v1;
  if (NEWS[0] && v1 && NEWS[0].v !== v1) problems.push('src/data/news.js has no entry for ' + v1 + ' (What\'s new)');
  if (!(v1 && v1 === v2 && v2 === v3)) problems.push(`versions differ: version.js ${v1}, sw.js ${v2}, version.json ${v3}`);
  const shell = JSON.parse((read('sw.js').match(/const SHELL = (\[[^\]]*\]);/) || [, '[]'])[1]);
  for (const u of shell) if (u !== './' && !fs.existsSync(path.join(root, u))) problems.push('sw.js caches a missing file: ' + u);
  const want = new Set(shellFiles()), have = new Set(shell);
  const unlisted = [...want].filter(u => !have.has(u));
  const manifest = JSON.parse(read('manifest.webmanifest'));
  for (const i of manifest.icons) if (!fs.existsSync(path.join(root, i.src))) problems.push('manifest icon missing: ' + i.src);
  for (const m of read('index.html').matchAll(/(?:href|src)="([^"#:]+)"/g)) if (!fs.existsSync(path.join(root, m[1]))) problems.push('index.html links a missing file: ' + m[1]);
  problems.push(...chainRules(), ...explainerRules(), ...mapRules(), ...textRules(), ...tapRules(), ...nameRules(), ...capRules(), ...modelRules(), ...swallowRules(), ...meterRules());
  return { problems, unlisted };
}

/* One number, one meter (clarity fix 8c): the coins a second on screen come from the income window (windowRates and
   explainWindow in src/core/explain.js). The map's FlowMeter is for goods on the routes; its coins (meter.income,
   meter.total) are a second meter over a few seconds, and the map's top bar read it while the town's read the window,
   so the two showed different numbers for the same purse. No screen code reads them. */
export function meterRules() {
  const out = [];
  for (const f of walk('src/ui').filter(f => f.endsWith('.js'))) read(f).split('\n').forEach((line, i) => { if (/meter\.(income|total)\b/.test(line)) out.push(f + ':' + (i + 1) + ' reads the coins of the map meter, read windowRates (one meter for coins on screen)'); });
  return out;
}
/* Code after a line comment never runs. A trailing comment followed by statements ("// why ; this.x = 1") is a bug
   twice over in this repo: raiders never turned (review of 2026.11.20-10), and the raiders' shadows never joined the
   scene (2026.11.21-4). */
export function swallowRules() {
  const out = [], code = /\/\/[^'"`]*; *(this\.|const |let |if \(|for \(|return\b|[a-zA-Z_]+\.[a-zA-Z_]+ *(=|\())/;
  // also a condition left after the comment ("// why !!a.b && ..."), and in tools and test too (2026.11.23-2: a smoke
  // check's comment swallowed the rest of its condition, and only the parse test saw it; the fifth time this was written)
  const cond = /\/\/ [^`]*(?:&&|\|\|) *(?:!!|!?[a-zA-Z_]+\.[a-zA-Z_]+\b)/;
  for (const dir of ['src', 'tools', 'test']) for (const f of walk(dir).filter(f => f.endsWith('.js'))) read(f).split('\n').forEach((line0, i) => { const line = line0.replace(/\\\//g, ''); /* an escaped slash in a regex is not a comment */ if (!/^\s*(\/\*|\*)/.test(line) && (code.test(line) || cond.test(line)) && !/https?:/.test(line)) out.push(f + ':' + (i + 1) + ' has code after a // comment, so it never runs'); });
  // a patch script that writes "\b" inside a template string puts a raw backspace in the file, and the regex it was
  // meant for never matches (2026-11-22: test/fork.test.js's /\bbest\b/ had checked nothing since it was written)
  for (const dir of ['src', 'tools', 'test']) for (const f of walk(dir).filter(f => /\.(js|mjs)$/.test(f))) read(f).split('\n').forEach((line, i) => { if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(line)) out.push(f + ':' + (i + 1) + ' has a control character (a raw backspace from a patch script?)'); });
  // a no-break space is written as its escape, never typed raw: a patch script turned the escape into the character
  // itself in 2026.11.23-9 (the shell ate the backslash), and a raw one cannot be told from a space when reading
  for (const dir of ['src', 'tools', 'test']) for (const f of walk(dir).filter(f => /[.](js|mjs)$/.test(f))) read(f).split('\n').forEach((line, i) => { if (line.includes(String.fromCharCode(160))) out.push(f + ':' + (i + 1) + ' has a raw no-break space (write it as its escape)'); });
  // and every file parses (2026.11.23-7: a comment swallowed half a line in src/ui/sheets.js, so the page would not load,
  // and no test imports that file; the rules above catch the usual shapes, this catches any syntax error)
  out.push(...parseRules());
  return out;
}
export function parseRules() {
  const out = [];
  for (const dir of ['src', 'tools', 'test']) for (const f of walk(dir).filter(f => /\.(js|mjs)$/.test(f))) {
    const r = spawnSync(process.execPath, ['--check', path.join(root, f)], { encoding: 'utf8' });
    if (r.status !== 0) out.push(f + ' does not parse: ' + ((r.stderr || '').split('\n').find(l => /Error/.test(l)) || 'error'));
  }
  return out;
}

/* Every feature teaches itself (owner rule): the features are worked out from the game, so a new system, tower kind
   or goods tier fails the audit until an explainer covers it. The named mechanics are the ones already in play. */
export const MECHANICS = ['foecard', 'workercard', 'bossbar', 'river', 'power', 'upgrade', 'milestone', 'starved', 'vault', 'breach', 'call', 'pause', 'hold', 'goods', 'menu', 'slots', 'export', 'pit', 'camera', 'reserve', 'perks', 'deeds', 'stockpile', 'back', 'outpost:won', 'outpost:draw', 'dots', 'explain', 'best', 'oldground', 'route', 'found', 'strip', 'map', 'away', 'lost', 'capital:sight', 'contract', 'contract:rush', 'contract:big', 'institution', 'retry', 'stock', 'auto-research', 'crowd', 'boom'];
export function requiredFeatures() {
  const f = new Set(MECHANICS);
  for (const s of SYSTEMS) f.add('system:' + s.id);
  for (const k of Object.keys(TOWERS)) f.add('tower:' + k);
  for (const t of TOWN_ORDER) for (const g of TOWNS[t].goods) f.add('tier:' + GOODS[g].tier);
  for (const t of TOWN_ORDER) f.add('welcome:' + t);                                  // every town says hello
  for (const x of Object.values(FOES)) if (x.boss) f.add(x === FOES.wagon ? 'boss' : 'boss:' + Object.keys(FOES).find(k => FOES[k] === x));
  if (Object.keys(PATHS).length) f.add('path');
  for (const k of Object.keys(FORKS)) f.add(k === 'still' ? 'fork' : 'fork:' + k); // the second fork at level 20, one card per kind
  if (Object.values(FOES).some(x => x.boss)) f.add('boss');
  return [...f];
}
export function explainerRules() {
  const p = [], covered = new Set(), ids = new Set();
  for (const e of EXPLAINERS) {
    if (ids.has(e.id)) p.push('two explainers named ' + e.id); ids.add(e.id);
    if (!e.title || !e.text || typeof e.when !== 'function') p.push('explainer ' + e.id + ' needs a title, a text and a when()');
    if (e.text && e.text.length > 260) p.push('explainer ' + e.id + ' is too long for a phone card (' + e.text.length + ' characters)');
    for (const x of [e.title, e.text]) if (/[:;]/.test(x || '')) p.push('explainer ' + e.id + ' uses a colon or semicolon (writing rule)');
    // the speaker button reads every card aloud (src/audio/speech.js): no emoji or symbol the voice cannot say, no
    // name left as {boss}, and no "x3" (write "3 times")
    for (const x of [e.title, e.text]) {
      const odd = [...(x || '')].filter(ch => !/[\x20-\x7e]/.test(ch) && SAY_SYMBOLS[ch] === undefined);
      if (odd.length) p.push('explainer ' + e.id + ' has ' + odd.join('') + ', which cannot be read aloud');
      if (/[{}]/.test(x || '')) p.push('explainer ' + e.id + ' has a name left in braces');
      if (/\bx\d|\d+x\b/.test(x || '')) p.push('explainer ' + e.id + ' writes x3 or 3x (write "3 times", it is read aloud)');
    }
    for (const c of e.covers || []) covered.add(c);
  }
  for (const f of requiredFeatures()) if (!covered.has(f)) p.push('feature ' + f + ' has no explainer (src/data/explainers.js)');
  for (const [k, t] of Object.entries(TOWERS)) for (const x of [t.name, t.about, ...Object.values(PATHS[k] || {}).flatMap(q => [q.name, q.about])]) if (/[:;]/.test(x || '')) p.push('tower text for ' + k + ' uses a colon or semicolon (writing rule)');
  for (const [k, r] of Object.entries(RESEARCH)) for (const x of [r.name, r.about, r.worse]) if (/[:;]/.test(x || '')) p.push('research text for ' + k + ' uses a colon or semicolon (writing rule)');
  // every town's research items exist, and each town lists 6 to 8 from the start plus at most 3 that show up at a best
  // wave (GDD.md, Town research; the late ones came with clarity fix 3b part 1)
  for (const id of TOWN_ORDER.filter(id => TOWNS[id].kind !== 'outpost')) {
    const list = TOWNS[id].research || [], late = list.filter(r => RESEARCH[r] && RESEARCH[r].opens), first = list.length - late.length;
    if (first < 6 || first > 8) p.push(id + ' has ' + first + ' research items from the start (want 6 to 8)');
    if (late.length > 3) p.push(id + ' has ' + late.length + ' research items that show up later (want at most 3)');
    for (const r of list) if (!RESEARCH[r]) p.push(id + ' lists unknown research ' + r);
  }
  return p;
}

/* Player text (owner rule): no narrator lines about how the interface works, no internal numbers a player cannot
   read (a bare decimal distance like 1.4), and no card that says the same thing twice. Checks the explainers, the
   tower and path text, and the quoted sentences in the interface code. */
export const NARRATOR = [/makes you/i, /both are shown/i, /you can'?t switch/i, /can not switch/i, /this upgrade/i, /is shown (on|in)/i];
export function textIssues(text) {
  const p = [];
  for (const r of NARRATOR) if (r.test(text)) p.push('reads like a narrator (' + r.source + ')');
  if (/(^|[^\w.])\d+\.\d+(?![\w%]|\.\d)/.test(text)) p.push('a bare decimal number');
  const words = x => new Set((x.toLowerCase().match(/[a-z']{5,}/g) || []));
  const sent = text.split(/(?<=[.!?])\s+/).filter(Boolean).map(words);
  for (let i = 0; i < sent.length; i++) for (let j = i + 1; j < sent.length; j++) {
    const a = sent[i], b = sent[j], same = [...a].filter(w => b.has(w)).length;
    if (same >= 2 && same / Math.min(a.size, b.size) >= .5) p.push('two sentences about the same thing');
  }
  return p;
}
/* One name, one meaning (games/CLAUDE.md): words a clarity fix retired, since one state had several names and the
   fresh-eyes reads flagged each again and again (8e, 8g, 8i). Old news lines keep theirs. */
export const RETIRED = [
  // the heart is the vault's mark on screen and may be named; hearts as a count is retired
  [/\bhearts\b|\d+ heart\b/i, 'the vault counts hits'],
  [/\b(vault|stockpile) (broke|breaks)\b|before it breaks/i, 'a vault fell'],
  [/\bprice is low\b|comes back over time/i, 'a price is up or down'],
  [/\b(Town|Low) power\b/, 'the tile and the cards say Power'],
];
export function textRules(debug) {
  const p = [], seen = [];
  for (const e of EXPLAINERS) seen.push(['explainer ' + e.id, e.title], ['explainer ' + e.id, e.text]);
  for (const n of NEWS) for (const l of n.lines) seen.push(['news ' + n.v, l]);
  for (const x of GOALS) seen.push(['goal ' + x.id, x.text]);
  seen.push(['goal wait', 'Wait for 5 more coins and 3 more timber, then tap a stone pad']); // goalText's other line
  seen.push(['goal resume', 'Tap Resume waves'], ['goal resume lost', 'Build more towers, then tap Resume waves'], ['goal resume away', 'Tap Map, Iron Ridge, then tap Resume waves']); // goalNow's held-waves steps (src/core/goals.js)
  for (const [k, t] of Object.entries(TOWERS)) seen.push(['tower ' + k, t.about], ...Object.values(PATHS[k] || {}).map(q => ['path ' + q.name, q.about]));
  for (const sides of Object.values(FORKS)) seen.push(...Object.values(sides).map(q => ['fork ' + q.name, q.about]));
  for (const [k, r] of Object.entries(RESEARCH)) seen.push(['research ' + k, r.about + (r.worse ? ' ' + r.worse : '')]);
  for (const file of walk('src/ui').filter(x => x.endsWith('.js'))) {
    for (const m of stripComments(read(file)).matchAll(/'((?:[^'\\\n]|\\.)*)'/g)) {
      const t = m[1].replace(/\\'/g, "'");
      if (/[a-z]{3,} [a-z]{3,}/i.test(t) && !/[{}#<>=]|^\./.test(t)) seen.push([file, t]);
    }
  }
  if (debug) return seen;
  for (const [where, t] of seen) for (const issue of textIssues(t || '')) p.push(where + ': ' + issue + ' in "' + t + '"');
  for (const [where, t] of seen) if (!where.startsWith('news ')) for (const [r, say] of RETIRED) if (r.test(t || '')) p.push(where + ': a retired word (' + say + ') in "' + t + '"');
  p.push(...choiceRules());
  return p;
}
/* Every button a card names exists by that name (clarity fix 8a: a map card said "until you tap Resume waves there",
   and older cards said "Sell" and "Off" for buttons that read Sell spare and Always). Reads every "Tap X" in the
   explainers, the goals and the quoted strings of src/ui and the strip's code, with each "then Y" or ", Y" after it,
   and fails a name that is not a word on a button or label in src/ui, or the name of a thing in the world. */
export const TAP_WORLD = ['stone pad', 'pad', 'mortar pit', 'pair of workers', 'raider', 'tower', 'town', 'good', 'goods', 'button', 'boss bar', 'bar', 'it', 'coins', 'Share', 'Add to Home Screen', 'new town', 'Capital', 'Back to', 'building', '◂'];
const worldStart = s => TAP_WORLD.find(w => s.toLowerCase().startsWith(w.toLowerCase()) && w.includes(' ') && !/^[a-z]/i.test(s.slice(w.length, w.length + 1)));
const TAP_STOP = /[.,!?]| (?:to|and|then|when|if|or|so|for|until|on|while|in|at|there|below|here|again|right|with|from)\b/;
export function tapNames(text) {
  const out = [];
  const name = s => {
    const w = worldStart(s.trim().replace(/^(?:the|a|an|its|any|your|this|each)\s+/i, ''));
    if (w) { out.push(w); return; }
    let n = s.split(TAP_STOP)[0].trim().replace(/^(?:the|a|an|its|any|your|this|each)\s+/i, '').replace(/^level \d+ /, '').replace(/ lot$/, '');
    if (n && !/^to\b/.test(n)) out.push(n);
  };
  for (const sent of text.split(/(?<=[.!?])\s+/)) {
    const i = sent.search(/\b[Tt]ap /);
    if (i < 0) continue;
    const rest = sent.slice(i + 4);
    name(rest);
    // what comes after in the same sentence: ", then Y", " then tap Y", " and then Y", ", Y," (a place on the way)
    for (const m of rest.matchAll(/(?:,| and)? then (?:tap )?([A-Z][^.,!?]*)|, ([A-Z][^.,!?]*)(?=,)/g)) name(m[1] || m[2]);
  }
  return out;
}
export function tapRules() {
  const known = new Set(TAP_WORLD.map(s => s.toLowerCase()));
  const add = s => { if (s) known.add(s.trim().toLowerCase()); };
  for (const file of [...walk('src/ui'), 'src/main.js'].filter(x => x.endsWith('.js'))) for (const m of stripComments(read(file)).matchAll(/'((?:[^'\\\n]|\\.)*)'/g)) if (m[1].trim().split(/\s+/).length <= 4) add(m[1]);
  for (const x of [...Object.values(BUILDINGS), ...Object.values(TOWERS), ...Object.values(GOODS), ...Object.values(TOWNS)]) { add(x.name); add(x.short); }
  for (const set of [...Object.values(PATHS), ...Object.values(FORKS)]) for (const q of Object.values(set)) add(q.name);
  for (const e of EXPLAINERS) add(e.button);
  const texts = [];
  for (const e of EXPLAINERS) texts.push(['explainer ' + e.id, e.text]);
  for (const g of GOALS) texts.push(['goal ' + g.id, g.text]);
  for (const file of [...walk('src/ui'), 'src/core/goals.js', 'src/core/stall.js'].filter(x => x.endsWith('.js'))) for (const m of stripComments(read(file)).matchAll(/'((?:[^'\\\n]|\\.)*)'/g)) texts.push([file, m[1]]);
  const p = [];
  for (const [where, t] of texts) for (const n of tapNames(t || '')) if (!known.has(n.toLowerCase())) p.push(where + ': names "' + n + '", which is no button or thing on screen, in "' + t + '"');
  return p;
}

/* Choices say what they do, not how to use them (games/CLAUDE.md; owner, 2026-11-22: "The strategy should be implied, not
   direct ... AI slop wordy"): each side of a level-5 path or a level-20 fork is at most CHOICE_WORDS words, and never
   advice on where or when to use it. */
export const CHOICE_WORDS = 10;
export const ADVICE = /\bbest (at|near|on|for|when)\b|start of the road|end of the road|near the vault|by the vault|by the entrance/i;
export function choiceRules(paths = PATHS, forks = FORKS) {
  const p = [];
  for (const [kind, set] of [...Object.entries(paths), ...Object.entries(forks)]) for (const q of Object.values(set)) {
    const n = q.about.trim().split(/\s+/).length;
    if (n > CHOICE_WORDS) p.push(kind + ' ' + q.name + ': ' + n + ' words, keep a choice to ' + CHOICE_WORDS + ' or fewer');
    if (ADVICE.test(q.about)) p.push(kind + ' ' + q.name + ': says where or when to use it in "' + q.about + '"');
  }
  return p;
}

/* The map rules (GDD.md, Town maps): every town has 3 to 5 mortar pits, each farther than a normal tower's reach from
   the road, with at least PIT_COVER units of road inside the longest-range tower's ring. Outposts have no pits, and
   their road loops round the camp back past the stockpile. Every road has an entrance with a model. */
export const PIT_COVER = 5;
export const LOOP = 12; // an outpost's road passes its stockpile at least this far before it ends there
export function mapRules(towns = TOWNS, order = TOWN_ORDER) {
  const p = [], long = Object.values(TOWERS).filter(t => t.long).sort((a, b) => b.range - a.range)[0];
  for (const id of order) {
    const b = towns[id].board;
    if (!b) continue;
    // every lane has a real entrance, with a builder in the entrance models
    const builders = read('src/assets/models/entrances.js');
    for (const [lane, e] of [['road', b.entrance], ...(b.river ? [['river', b.river.entrance]] : [])]) {
      if (!e || !e.kind) p.push(id + ': the ' + lane + ' has no entrance');
      else if (!new RegExp('^\\s+' + e.kind + ':\\s*\\(?\\w*\\)?\\s*=>', 'm').test(builders)) p.push(id + ': no model for the entrance "' + e.kind + '"');
    }
    const pitIdx = b.spots.map((_, i) => i).filter(i => isPitSpot(b, i)), n = pitIdx.length; // the mortar pits (board.pits)
    if (towns[id].kind === 'outpost') { // outposts: no pits; the road loops round the camp and ends where the loop began
      if (n) p.push(id + ' is an outpost with mortar pits');
      const road = makePath([...b.road, b.vault]); let closes = false;
      for (let s = 0; s < road.length - LOOP; s += .1) if (dist(pointAt(road, s), b.vault) <= 1.6) closes = true;
      if (!closes) p.push(id + ': the outpost road does not loop back to its stockpile');
      continue;
    }
    if (n < 3 || n > 5) { p.push(id + ' has ' + n + ' mortar pits (want 3 to 5)'); continue; }
    const pts = []; // every lane: the road, and the river where there is one
    for (const line of [b.road, ...(b.river ? [b.river.path] : [])]) { const lane = makePath([...line, b.vault]); for (let s = 0; s <= lane.length; s += .1) pts.push(pointAt(lane, s)); }
    for (const i of pitIdx) {
      let min = Infinity, cover = 0;
      for (const q of pts) { const d = dist(b.spots[i], q); min = Math.min(min, d); if (long && d >= (long.minRange || 0) && d <= long.range) cover += .1; }
      if (min <= NORMAL_REACH) p.push(id + ' mortar pit ' + i + ' is within a normal tower\'s reach of the road (' + min.toFixed(2) + ')');
      if (cover < PIT_COVER) p.push(id + ' mortar pit ' + i + ' has only ' + cover.toFixed(1) + ' units of road in the Mortar\'s ring');
    }
  }
  return p;
}

/* The chain rules (GDD.md): step value 1.3-1.6x, balanced at equal levels, one maker per good, imports from earlier
   towns only, and every town's top good needs an import (except the first town, which has nothing to import).
   Outposts are exempt: they make raw goods only, which may be goods a town makes too. */
export function chainRules() {
  const p = [], maker = {}, outpost = id => TOWNS[id] && TOWNS[id].kind === 'outpost';
  for (const [id, b] of Object.entries(BUILDINGS)) {
    if (!GOODS[b.makes]) p.push(id + ' makes an unknown good');
    if (!TOWNS[b.town]) p.push(id + ' belongs to an unknown town');
    if (outpost(b.town)) { if (Object.keys(b.inputs).length) p.push(id + ': outposts make raw goods only'); continue; } // outposts only add raw supply
    if (maker[b.makes]) p.push('two buildings make ' + b.makes); maker[b.makes] = id;
  }
  for (const g of Object.keys(GOODS)) if (!maker[g] && !Object.values(BUILDINGS).some(b => b.makes === g && b.town === GOODS[g].town)) p.push('nothing makes ' + g);
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
  const towns = TOWN_ORDER.filter(id => !outpost(id));
  towns.forEach((id, i) => { // the first town has nothing to import; every later one names its outpost (GDD.md, Outposts)
    const t = TOWNS[id];
    if (i > 0 && !t.imports.length) p.push(id + ': its top good needs no import');
    if (i > 0 && !(t.outpost && outpost(t.outpost))) p.push(id + ': names no outpost (town.outpost)');
  });
  for (const id of TOWN_ORDER) for (const b of TOWNS[id].buildings) if (!BUILDINGS[b] || BUILDINGS[b].town !== id) p.push(id + ' lists building ' + b + ' of another town');
  return p;
}

/* Names (GDD.md): a name a player reads means one thing. No two goods, buildings, towns, tower kinds, paths, raiders,
   research items or perks share a name. */
export function nameRules() {
  const p = [], seen = new Map();
  const add = (what, name) => {
    if (!name) { p.push(what + ' has no name'); return; }
    const key = name.trim().toLowerCase();
    if (seen.has(key) && seen.get(key) !== what) p.push('the name "' + name + '" is used by ' + seen.get(key) + ' and ' + what);
    else seen.set(key, what);
  };
  for (const [k, x] of Object.entries(GOODS)) add('good ' + k, x.name);
  for (const [k, x] of Object.entries(BUILDINGS)) add('building ' + k, x.name);
  for (const [k, x] of Object.entries(TOWNS)) { add('town ' + k, x.name); if (x.short && x.short !== x.name) add('town ' + k, x.short); }
  for (const [k, x] of Object.entries(TOWERS)) add('tower ' + k, x.name);
  for (const [k, ps] of Object.entries(PATHS)) for (const [side, x] of Object.entries(ps)) add('path ' + k + '.' + side, x.name);
  for (const [k, x] of Object.entries(FOES)) add('raider ' + k, x.name);
  for (const [k, x] of Object.entries(RESEARCH)) add('research ' + k, x.name);
  for (const x of PERKS) for (const side of ['a', 'b']) add('perk ' + x.id + '.' + side, x[side].name);
  for (const i of INSTITUTIONS) { add('institution ' + i.id, i.name); for (const n of i.nodes) add('upgrade ' + i.id + '.' + n.id, n.name); }
  return p;
}

/* Caps (GDD.md, Multipliers): every bonus is a named source on a stat with a published cap in src/core/mods.js, so
   nothing stacks out of sight. Checks the perks, the research items and every stat the core names in the code. */
export function capRules() {
  const p = [], fam = st => CAPS[st] || CAPS[st.split(':')[0]];
  const stats = [];
  for (const x of PERKS) for (const side of ['a', 'b']) for (const e of x[side].effects) stats.push(['perk ' + x.id, e.stat]);
  for (const [k, r] of Object.entries(RESEARCH)) for (const e of [...(r.effects || []), ...(r.downside || [])]) stats.push(['research ' + k, e.stat]);
  for (const i of INSTITUTIONS) for (const n of i.nodes) for (const e of n.effects) stats.push(['upgrade ' + i.id + '.' + n.id, e.stat]);
  for (const f of walk('src/core').filter(f => f.endsWith('.js'))) {
    for (const m of stripComments(read(f)).matchAll(/mods\.(?:set|factor|value|explain)\(\s*'([^']+)'/g)) stats.push([f, m[1]]);
  }
  for (const [where, st] of stats) if (!fam(st)) p.push(where + ': the stat "' + st + '" has no published cap (src/core/mods.js)');
  return p;
}

/* Models (GDD.md, Look and sound): every building names a model recipe that exists, and every tower kind and every
   raider has its own model (never the stand-in a missing one falls back to). Read from the model files' text, since
   they need three.js. */
export function modelRules() {
  const p = [], units = read('src/assets/models/units.js');
  const recipes = new Set();
  for (const f of walk('src/assets/models').filter(f => f.endsWith('.js') && !/units|entrances/.test(f))) {
    const s = read(f).replace(/\r\n/g, '\n'), body = (s.match(/\nconst R = \{([\s\S]*?)\n\};/) || [, ''])[1];
    for (const m of body.matchAll(/^ {2}(\w+)\s*\(/gm)) recipes.add(m[1]);
  }
  for (const [k, b] of Object.entries(BUILDINGS)) if (!b.model || !recipes.has(b.model)) p.push('building ' + k + ' has no model recipe' + (b.model ? ' "' + b.model + '"' : ''));
  const u = units.replace(/\r\n/g, '\n'), foeBody = (u.match(/\nconst FOE = \{([\s\S]*?)\n\};/) || [, ''])[1];
  const foes = new Set([...foeBody.matchAll(/^ {2}(\w+):/gm)].map(m => m[1]).concat([...u.matchAll(/\nFOE\.(\w+) = /g)].map(m => m[1])));
  for (const k of Object.keys(FOES)) if (!foes.has(k)) p.push('raider ' + k + ' has no model (src/assets/models/units.js, FOE)');
  for (const k of Object.keys(TOWERS)) if (!new RegExp("type === '" + k + "'").test(units)) p.push('tower ' + k + ' has no model (src/assets/models/units.js, makeTower)');
  return p;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.join(root, 'tools', 'audit.js')) {
  const { problems, unlisted } = audit();
  if (unlisted.length) console.log('note: ' + unlisted.length + ' files not in the offline list yet (tools/bump-version.js adds them)');
  if (problems.length) { for (const p of problems) console.log('FAIL ' + p); process.exitCode = 1; }
  else console.log('audit ok');
}
