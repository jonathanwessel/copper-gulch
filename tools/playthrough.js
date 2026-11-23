// node tools/playthrough.js <dir> [--seed 1] [--minutes 330] [--size phone|land|desk]: a newcomer's first play, as
// screenshots of the real game (PLAN.md M6a, the progression and first-play clarity pass).
// The newcomer bot of tools/firstplay.js plays a new game on the core, time-compressed. Each moment that matters is
// kept as a save: every tip card (taken while the card is due, then marked seen, as a player taps Got it), every
// unlock (a new tower kind, town, research, orders, an institution, the Capital), every new button on the play screen
// (and the sheet it opens, the first time), the first boss wave in each place, the first lost wave or boss in each
// place, the charter offer, and every stretch of 2 minutes with nothing new (no goal done, no unlock, no card).
// Then each save is loaded in the real game in a headless browser and shot at phone size (a second shot when the
// moment opens a sheet or the map). Writes <dir>/NN-kind-what.png and <dir>/moments.md (time, place, what happened,
// the goal strip's words), the list a fresh-eyes reviewer reads in order. The bot founds the Capital when the strip
// says to (the newcomer of firstplay.js takes that step since clarity fix 3).
import fs from 'node:fs';
import path from 'node:path';
import { newcomer } from './firstplay.js';
import { helper } from '../src/ui/coach.js';
import { EXPLAINERS } from '../src/data/explainers.js';
import { tabs, stripGoods } from '../src/core/reveal.js';

import { capitalOpen } from '../src/core/capital.js';
import { goalNow, goalContext } from '../src/core/goals.js';
import { SAVE_VERSION } from '../src/core/save.js';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const dir = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'playthrough');
const SEED = +arg('seed', 1), MINUTES = +arg('minutes', 330), SIZE = arg('size', 'phone');
const SIZES = { phone: [400, 860], land: [860, 400], desk: [1366, 800] };
export const QUIET = 120; // seconds with nothing new before a "quiet" shot
const AFTER_CAPITAL = 20 * 60; // play on this long after the Capital opens, then stop
const BUTTON_OPENS = { goods: 'goodsBtn', research: 'researchBtn', perks: 'perksBtn', auto: 'autoBtn', arms: 'armsBtn', chip: 'map' };

/* Plays the newcomer and returns the moments: [{ at, town, kinds: [..], what: [..], goal, action, save }]. */
export function record(seed = SEED, minutes = MINUTES) {
  const moments = [], bossSeen = new Set(), lostSeen = new Set();
  let wired = false, lastNew = 0, seenTabs = null, queue = [], capitalAt = null;
  const goalText = g => { try { const x = goalNow(g); if (!x) return ''; const c = goalContext(g, g.town), s = typeof x.text === 'function' ? x.text(c) : x.text; return String(s || x.title || x.id || ''); } catch (e) { return ''; } };
  const keep = (g, at, kind, what, action = null) => {
    const last = moments[moments.length - 1];
    // two moments within 3 seconds in the same place are one shot
    if (last && at - last.at <= 3 && last.town === g.active && !(kind === 'card' && last.kinds.includes('card'))) {
      last.kinds.push(kind); last.what.push(what); if (action && !last.action) last.action = action; last.save = JSON.stringify(g.toJSON()); last.goal = goalText(g);
    } else moments.push({ at, town: g.active, kinds: [kind], what: [what], action, goal: goalText(g), save: JSON.stringify(g.toJSON()) });
    lastNew = at;
  };
  const r = newcomer(seed, minutes, (g, at) => {
    if (!wired) {
      wired = true;
      const ev = (name, label) => g.bus.on(name, e => queue.push([label(e || {}), name]));
      ev('tower:open', e => 'new tower ' + (e.kind || '')); ev('town:open', e => 'town opens ' + (e.town || e.id || ''));
      ev('town:found', e => 'founded ' + e.town); ev('research:open', e => 'research opens' + (e.town ? ' in ' + e.town : ''));
      ev('orders:open', e => 'orders open' + (e.town ? ' in ' + e.town : '')); ev('institution:found', e => 'institution ' + e.id);
      // the Capital's gate passed: its toast says so (clarity fix 3b part 2b)
      ev('capital:found', () => 'Capital founded'); ev('capital:ready', () => 'Capital ready'); ev('outpost:won', e => 'outpost won ' + (e.town || ''));
      ev('research:new', e => 'new research ' + (e.id || '') + (e.town ? ' in ' + e.town : '')); // its toast names it (clarity fix 3b)
      ev('contract:done', e => 'contract done ' + (e.good || '')); // its toast names it (clarity fix 3b part 2)
      ev('charter:offer', () => 'charter offered'); ev('first:sale', () => 'first sale'); ev('route:open', e => 'route ' + (e.from || '') + '-' + (e.to || ''));
      g.bus.on('goal:done', () => { lastNew = Math.max(lastNew, g.stats.steps * .25); });
      g.bus.on('wave:start', e => { if (e.boss && !bossSeen.has(e.town) && e.town === g.active) { bossSeen.add(e.town); queue.push(['boss wave ' + e.wave + ' in ' + e.town, 'boss']); } });
      g.bus.on('breach', e => { if (!lostSeen.has(e.town) && e.town === g.active) { lostSeen.add(e.town); queue.push(['lost wave ' + e.wave + ' in ' + e.town, 'lost']); } });
    }
    if (g.stats.steps % 4) return false; // once a second, as the coach looks
    const t = g.town;
    if (capitalOpen(g)) { capitalAt ??= at; if (at - capitalAt > AFTER_CAPITAL) return true; }
    for (const [what, name] of queue) {
      const action = name === 'town:found' || name === 'capital:found' || name === 'institution:found' || name === 'town:open' ? 'map' : name === 'charter:offer' ? 'perksBtn' : null;
      keep(g, at, name === 'boss' || name === 'lost' ? name : 'unlock', what, action);
    }
    queue = [];
    const tb = tabs(g, t), shown = Object.keys(tb).filter(k => tb[k]);
    if (seenTabs) for (const k of shown) if (!seenTabs.includes(k) && BUTTON_OPENS[k]) keep(g, at, 'button', 'new button ' + k, BUTTON_OPENS[k]);
    if (!seenTabs || shown.join() !== seenTabs.join()) seenTabs = shown;
    const seen = g.shared.seen || (g.shared.seen = {}), h = helper(t, g);
    // a card that reads the page: the boom card wants its good's chip on the strip (the first run showed it five times,
    // since off the page it was never due and so never marked seen)
    if (h.boom) h.boomChip = stripGoods(t).includes(h.boom.good);
    const due = EXPLAINERS.find(e => !seen[e.id] && (!e.town || e.town === h.id) && e.when(h));
    if (due) { keep(g, at, 'card', due.id + ': ' + due.title); seen[due.id] = true; } // the save shows it due, then Got it
    // a quiet stretch is one shot, taken at 2 minutes; its line says how long it lasted in the end
    if (at - lastNew >= QUIET) {
      const q = moments[moments.length - 1];
      if (q && q.quietFrom === lastNew) q.what[0] = Math.round((at - lastNew) / 60) + ' min with nothing new (goal: ' + (goalText(g) || 'none') + ')';
      else { const from = lastNew; keep(g, at, 'quiet', '2 min with nothing new'); moments[moments.length - 1].quietFrom = lastNew = from; }
    }
    return false;
  });
  return { moments, r };
}

const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
// round first, so 106:59.6 reads 107:00, not 106:60
const mm = x => { const s = Math.round(x); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/playthrough.js')) {
  const { start } = await import('./serve.js'), { chromium } = await import('./cdp.js');
  const t0 = Date.now(), { moments, r } = record();
  console.log(`seed ${SEED}: ${moments.length} moments in ${(r.end / 60).toFixed(0)} min of play (${((Date.now() - t0) / 1000).toFixed(0)} s); Dry Creek won ${r.dcWon ? mm(r.dcWon) : 'never'}, Gulch ${r.gulchAt ? mm(r.gulchAt) : 'never'}, Ridge ${r.ridgeAt ? mm(r.ridgeAt) : 'never'}`);
  fs.mkdirSync(dir, { recursive: true });
  const [width, height] = SIZES[SIZE], sleep = ms => new Promise(res => setTimeout(res, ms)), errs = [], lines = [];
  const srv = await start(0), b = await chromium.launch();
  const speechStub = () => {
    const fake = { said: [], current: null, getVoices: () => [{ name: 'Device', lang: 'en-US', localService: true }], speak(u) { this.said.push(u.text); this.current = u; }, cancel() { const u = this.current; this.current = null; if (u && u.onend) u.onend(); }, addEventListener() {} };
    Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true });
    window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
  };
  try {
    const p = await b.newPage({ viewport: { width, height } });
    p.on('pageerror', e => errs.push(String(e.message).split('\n')[0]));
    await p.addInitScript(speechStub);
    await p.goto(srv.url);
    for (let i = 0; i < 100 && !(await p.evaluate(() => !!(window.CG && CG.ready))); i++) await sleep(100);
    let verSeen = null;
    for (let n = 0; n < moments.length; n++) {
      const m = moments[n], name = String(n + 1).padStart(3, '0') + '-' + m.kinds[0] + '-' + slug(m.what[0].replace(/^[a-z-]+: /, ''));
      // the save is written from a page with no game on it: the game page saves itself as it unloads, over anything
      // written while it ran (the first try showed the first moment's game in every shot)
      const ver = await p.evaluate(() => (window.CG && CG.version) || null) || verSeen;
      verSeen = ver;
      await p.goto(srv.url + 'version.json');
      await p.evaluate(([save, v, ver]) => { localStorage.clear(); localStorage.setItem('cg-save', JSON.stringify({ v, at: Date.now(), game: JSON.parse(save) })); localStorage.setItem('cg-news', ver); }, [m.save, SAVE_VERSION, ver]);
      await p.goto(srv.url + '?n=' + n + '#play');
      for (let i = 0; i < 100 && !(await p.evaluate(() => !!(window.CG && CG.game && (CG.town ? CG.town.frames > 2 : CG.play)))); i++) await sleep(100);
      const got = await p.evaluate(() => CG.game ? CG.game.active + ' ' + CG.game.town.towers.length : 'none'), want = JSON.parse(m.save);
      if (got !== want.active + ' ' + (want.towns[want.active].towers || []).length) errs.push(`moment ${n + 1}: the game loaded ${got}, the save has ${want.active} with ${(want.towns[want.active].towers || []).length} towers`);
      // a card due: wait for it (the coach looks about once a second)
      const card = m.kinds.includes('card');
      for (let i = 0; i < (card ? 50 : 15); i++) { if (await p.evaluate(() => !!document.querySelector('.coachcard') && !document.querySelector('.coachcard').closest('[hidden]'))) break; await sleep(100); }
      await sleep(700);
      const f = path.join(dir, name + '.png'); await p.screenshot({ path: f });
      const shots = [path.basename(f)];
      if (m.action) { // the sheet or the map the moment opens, the first time
        await p.evaluate(a => { if (CG.coach) CG.coach.skipAll(); if (a === 'map') CG.openMap(); else { const e = document.getElementById(a); if (e) e.click(); } }, m.action);
        await sleep(m.action === 'map' ? 2500 : 900);
        const f2 = path.join(dir, name + '-open.png'); await p.screenshot({ path: f2 }); shots.push(path.basename(f2));
      }
      lines.push(`| ${n + 1} | ${mm(m.at)} | ${m.town} | ${m.what.join('; ')} | ${m.goal.replace(/\|/g, '/')} | ${shots.join(', ')} |`);
      if ((n + 1) % 10 === 0) console.log(`  ${n + 1} of ${moments.length} shot`);
    }
    await p.close();
  } finally { await b.close(); srv.close(); }
  const head = `# A newcomer's first play, seed ${SEED}\n\nThe newcomer bot (tools/firstplay.js) on the core, each moment loaded in the real game at ${SIZE} size.\n\n| # | play time | place | what happened | goal strip | shots |\n|---|---|---|---|---|---|\n`;
  fs.writeFileSync(path.join(dir, 'moments.md'), head + lines.join('\n') + '\n');
  console.log('wrote ' + path.join(dir, 'moments.md'));
  if (errs.length) { console.log('page errors:\n' + [...new Set(errs)].slice(0, 20).join('\n')); process.exitCode = 1; }
}
