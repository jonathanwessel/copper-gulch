/* Slide-up sheets over the town: one at a time, with a dimmed backdrop that closes it when tapped.
     Goods: what the town has in stock, what each good sells for now, and a Sell On or Off switch per good.
     Research: the town's research items, their next level's price and wait, and the one running.
     Perks: the town's charter (deeds it would pay now, what earns the next one, Sign), the deeds held, the perk pairs.
     Menu: Graphics, Volume (the Music and Sound sliders), Install, save slots, copying the save out and loading one in, the help cards, the title screen.
   Every word here follows the owner's writing rule (PLAN.md): plain, short, no colons or semicolons. */
import { GOODS } from '../data/goods.js';
import { BUILDINGS } from '../data/buildings.js';
import { saturation } from '../core/market.js';
import { explainPrice } from '../core/explain.js';
import { explainBox } from './explain.js';
import { encode } from '../core/save.js';
import { loadGame } from '../core/setup.js';
import { SLOTS, activeSlot, slotSummary, importText, clearSave } from './storage.js';
import { installButton } from './install.js';
import { checkUpdates } from './update.js';
import { GAME_VERSION } from '../version.js';
import { setStock } from '../core/defense.js';
import { setSwitch } from './switch.js';
import { fmt, fmtLive, ago, goodsLine, levelsDone, priceNote } from './format.js';
import { RESEARCH } from '../data/research.js';
import { itemsOf, researchLevel, researchCost, researchTime, researchBlock, startResearch } from '../core/research.js';
import { PERKS, DEEDS } from '../data/perks.js';
import { deedParts, nextDeed, signCharter, pickPerk, perkState } from '../core/charter.js';
import { TOWNS } from '../data/towns/index.js';
import { canFound, foundTown, nextTowns, deedsOf } from '../core/empire.js';
import { capitalNext, canFoundCapital } from '../core/capital.js';
import { autoOpen, autoOf, setAuto, retryState, towerBlock, towerEvery, nextTowerUp, nextResearch, foremenOf, foremenWorking, setForemen } from '../core/automation.js';
import { TOWERS } from '../data/towers.js';
import { INSTITUTION } from '../data/institutions.js';
import { AUTO } from '../data/automation.js';

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const btn = (text, cls = 'btn small', id) => { const b = el('button', cls, text); if (id) b.id = id; return b; };
const TOWN_NAMES = Object.fromEntries(Object.entries(TOWNS).map(([id, t]) => [id, t.short || t.name]));

/* A sheet: build(body) fills it; frame(dt) (optional, returned by build) runs while it is open. A frame function may
   carry .sync, called by sync() right after the play screen repaints its top bar and goods strip, so a sheet that
   shows the same numbers repaints in that frame (review of 2026.11.19-7: Goods read 46 copper ore beside the strip's 45). */
export function createSheets(root, { onOpen = () => {} } = {}) {
  const back = el('div', 'scrim'); back.hidden = true;
  const sheet = el('section', 'sheet'); sheet.id = 'sheet'; sheet.hidden = true; sheet.setAttribute('role', 'dialog');
  const head = el('div', 'sheethead'), title = el('h2'), x = btn('Close', 'btn small', 'sheetClose');
  head.append(title, x);
  const body = el('div', 'sheetbody');
  sheet.append(head, body);
  root.append(back, sheet);
  let cur = null;
  const api = {
    get current() { return cur ? cur.id : null; },
    open(id, name, build) {
      onOpen();
      cur = { id, tick: null }; sheet.dataset.id = id; title.textContent = name; body.replaceChildren(); body.scrollTop = 0;
      cur.tick = build(body) || null;
      back.hidden = false; sheet.hidden = false;
    },
    close() { cur = null; sheet.hidden = true; back.hidden = true; body.replaceChildren(); },
    frame(dt) { if (cur && cur.tick) cur.tick(dt); },
    sync() { if (cur && cur.tick && cur.tick.sync) cur.tick.sync(); },
  };
  x.addEventListener('click', api.close); back.addEventListener('click', api.close);
  return api;
}

/* Where a good's price stands against its full price, in one word for the end of its bar. */
export const priceWord = (s, price = 1) => (price < .0095 ? 'Almost 0' : s >= .9 ? 'Top' : s >= .6 ? 'High' : s >= .35 ? 'Half' : s >= .1 ? 'Low' : 'Very low'); // price: one unit's, so the row says almost 0 once

/* The Goods sheet. A good shows once its building is built. */
export function goodsSheet(game, town, focus = null) {
  return body => {
    const list = el('div', 'goods'), rows = {}, open = {}, whySig = {};
    if (focus) open[focus] = true; // tapped on the goods strip: that good opens with its price explained
    // one switch for the whole town (owner, 2026-11-19: keep more for towers, with no tuning good by good)
    // no line under it: each good's row says how many it keeps, and Lots doubles them there (review of 2026.11.20-3:
    // "Enough for 2 more levels on every tower and 2 new towers." read as a system explained)
    const stockRow = el('div', 'row stockrow'), stockBtn = btn('', 'btn small', 'stockTowers');
    const paintStock = () => setSwitch(stockBtn, 'Tower stock', town.stock === 'lots' ? 'Lots' : 'Normal', null);
    stockBtn.addEventListener('click', () => { setStock(town, town.stock === 'lots' ? 'normal' : 'lots'); paintStock(); paint(); });
    paintStock(); stockRow.append(stockBtn);
    if (town.towers && town.def && town.def.board) body.append(stockRow);
    body.append(list); // no how-it-works line (review of 2026.11.19-11): the bar under each good shows how far its price fell
    const shown = () => Object.entries(BUILDINGS).filter(([id, b]) => b.town === town.id && town.level(id) > 0 && !GOODS[b.makes].grid).map(([, b]) => b.makes);
    // goods shipped in from another town: what is in stock, and where it comes from (never sold here)
    const shipped = () => ((town.def && town.def.imports) || []).filter(g => (town.shipped || {})[g] > 0);
    let sig = '';
    const build = () => {
      const goods = shown(); sig = goods.join() + '|' + shipped().join();
      list.replaceChildren();
      if (!goods.length) list.append(el('p', 'uses', 'Build a Lumber Camp to make your first good.'));
      for (const g of goods) {
        const row = el('div', 'option good'), txt = el('div', 'tapwhy'), name = el('b', null, GOODS[g].name), line = el('span'), bar = el('i', 'depth'), fill = el('i'), why = el('div');
        bar.append(fill); bar.title = 'Price now, against its full price';
        // the bar says what it is (review of 2026.11.19-12) and where it stands in a word (review of 2026.11.20-2: no scale)
        const level = el('small', 'pword'), barRow = el('span', 'depthrow'); barRow.append(el('small', null, 'Price'), bar, level);
        txt.append(name, line, barRow, why); txt.dataset.why = g; txt.setAttribute('role', 'button'); txt.tabIndex = 0;
        txt.addEventListener('click', () => { open[g] = !open[g]; whySig[g] = ''; paint(); }); // tap a good: what makes its price
        const sw = btn('', 'btn small'); sw.dataset.good = g;
        sw.addEventListener('click', () => { if (town.sell[g] !== false) town.sell[g] = false; else delete town.sell[g]; paint(); });
        row.append(txt, sw); list.append(row);
        rows[g] = { line, fill, sw, why, txt, level };
      }
      for (const g of shipped()) {
        const row = el('div', 'option good'), txt = el('div'), line = el('span');
        txt.append(el('b', null, GOODS[g].name), line); row.append(txt); list.append(row);
        rows['in:' + g] = { line, good: g };
      }
      paint();
    };
    const paint = () => {
      for (const [g, r] of Object.entries(rows)) {
        if (r.good) { const t = fmtLive(Math.floor(town.goods[r.good] || 0)) + ' in stock · sent by ' + (TOWN_NAMES[GOODS[r.good].town] || 'another town'); if (r.line.textContent !== t) r.line.textContent = t; continue; }
        const kept = Math.ceil((town.keep || {})[g] || 0);
        const ex = explainPrice(game, town, g);
        const selling = town.sell[g] !== false, have = town.goods[g] || 0;
        // every unit kept for towers: nothing is sold now, so no price (review 2026-11-18: "sells for 0 coins each" next to Sell On)
        const txt = goodsLine({ have, kept, selling, price: ex.value, open: !!open[g] });
        if (r.line.textContent !== txt) r.line.textContent = txt;
        r.txt.setAttribute('aria-expanded', String(!!open[g]));
        const note = open[g] ? priceNote({ have, kept, price: ex.value }) : null; // none to sell, or a price of almost 0: words, not rows
        const ws = open[g] ? (note || JSON.stringify(ex.rows.map(x => [x.label, Math.round((x.mul || x.base) * 100)]))) : '';
        if (ws !== whySig[g]) { whySig[g] = ws; r.why.replaceChildren(...(!open[g] ? [] : note ? [el('p', 'uses', note)] : [explainBox(ex, { total: 'You get' })])); }
        const sat = saturation(game, g), w = Math.round(100 * sat) + '%'; if (r.fill.style.width !== w) r.fill.style.width = w;
        const pw = priceWord(sat, ex.value); if (r.level.textContent !== pw) r.level.textContent = pw;
        setSwitch(r.sw, 'Sell', selling ? 'On' : 'Off', selling);
      }
    };
    build();
    if (focus && rows[focus]) { rows[focus].txt.classList.add('focus'); requestAnimationFrame(() => rows[focus].txt.scrollIntoView({ block: 'nearest' })); }
    // painted only when the strip is (sync), so its counts always match the strip's
    const tick = () => {}; tick.sync = () => { if (shown().join() + '|' + shipped().join() !== sig) build(); else paint(); };
    return tick;
  };
}

/* The sheet for a town not yet founded (src/core/empire.js): what it takes, and Start. go(id) is called after it is
   founded, to take the player there. */
export function foundSheet(game, id, go) {
  return body => {
    const d = TOWNS[id], f = d.found, from = TOWNS[f.from].short || TOWNS[f.from].name;
    const out = d.outpost && TOWNS[d.outpost];
    const wave = el('p', 'uses'), coins = el('p', 'uses'), deeds = el('p', 'uses');
    body.append(el('p', 'uses', 'Start a new town that makes ' + (d.makesText || d.era.toLowerCase()) + '.' + (out ? ' ' + out.name + ', a new outpost, opens too.' : '')), wave, ...(f.deeds ? [deeds] : []), coins);
    const row = el('div', 'row'), b = btn('Start ' + d.name, 'btn primary buy', 'foundTown');
    b.addEventListener('click', () => { if (foundTown(game, id)) go(id); });
    row.append(b); body.append(row);
    const paint = () => {
      const t = game.towns[f.from], w = t ? t.bestWave || 0 : 0, c = t ? t.coins : 0;
      const a = 'Beat wave ' + f.wave + ' in ' + from + (w >= f.wave ? ' · Done' : ' · Best so far ' + w);
      const m = fmt(f.coins) + ' coins' + (c >= f.coins ? ' · Done' : ' · You have ' + fmt(c));
      if (wave.textContent !== a) wave.textContent = a;
      if (coins.textContent !== m) coins.textContent = m;
      if (f.deeds) { const h = deedsOf(game), x = 'Hold ' + f.deeds + ' deeds' + (h >= f.deeds ? ' · Done' : ' · You have ' + h + '. Sign a charter to get more.'); if (deeds.textContent !== x) deeds.textContent = x; }
      b.disabled = !canFound(game, id);
    };
    paint();
    let acc = 0;
    return dt => { if ((acc += dt) < .3) return; acc = 0; paint(); };
  };
}

/* Places, for a device that cannot draw the map: a button for every open town, and for each town in sight its sheet.
   go(id) puts a town in play, found(id) opens a town's Start sheet. */
export function placesSheet(game, { go, found, capital = () => {} }) {
  return body => {
    for (const id of Object.keys(TOWNS).filter(t => game.towns[t])) {
      const here = id === game.active, row = el('div', 'row');
      const b = btn(here ? TOWNS[id].name + ' · Here' : 'Go to ' + TOWNS[id].name, here ? 'btn' : 'btn primary', 'place-' + id);
      b.dataset.town = id; b.disabled = here;
      b.addEventListener('click', () => go(id));
      row.append(b); body.append(row);
    }
    for (const n of nextTowns(game)) {
      const row = el('div', 'row'), b = btn(TOWNS[n.id].name + (n.ready ? ' · Ready to start' : ' · Not open yet'), 'btn', 'place-' + n.id);
      b.dataset.town = n.id; b.classList.toggle('dot', !!n.ready);
      b.addEventListener('click', () => found(n.id));
      row.append(b); body.append(row);
    }
    // the Capital, once it is in sight
    const cap = game.shared.capital, ready = canFoundCapital(game);
    if ((cap && cap.open) || capitalNext(game)) {
      const row = el('div', 'row'), b = btn('The Capital' + (cap.open ? '' : ready ? ' · Ready to build' : ' · Not built yet'), 'btn', 'place-capital');
      b.classList.toggle('dot', ready || (cap.open && !cap.active));
      b.addEventListener('click', () => capital());
      row.append(b); body.append(row);
    }
  };
}

/* A short phrase that never breaks across lines (a line wraps only between phrases). */
const keep = s => s.replace(/ /g, '\u00a0');
/* Seconds in words: "40 seconds", "3 minutes". */
/* The research button while it runs (review of 2026.11.19-3: it read "Working"): the time left, short. */
export const leftWord = s => s < 90 ? Math.max(1, Math.ceil(s)) + ' sec left' : Math.round(s / 60) + ' min left';
export const wait = s => s < 90 ? Math.max(1, Math.ceil(s)) + ' seconds' : Math.round(s / 60) + ' minutes';

/* The Research sheet: one row per item, with its next level's price and wait, and a bar on the one running. */
export function researchSheet(game, town) {
  return body => {
    const list = el('div', 'goods research'), rows = {}, one = el('p', 'note'); one.id = 'labOne';
    body.append(one, list); // while one runs, the others say why they wait (the 2026.11.20-2 screenshots: "after Thick Walls" read as a need)
    for (const id of itemsOf(town)) {
      const r = RESEARCH[id], row = el('div', 'option'), txt = el('div');
      const name = el('b'), info = el('small'), price = el('span', 'need coinneed'), bar = el('i', 'depth'), fill = el('i');
      bar.append(fill); txt.append(name, el('span', null, r.about));
      if (r.worse) txt.append(el('span', 'worse', r.worse));
      const costs = el('span', 'costrow'); costs.append(price); txt.append(info, costs, bar);
      const go = btn('Research', 'btn small build timer'); go.dataset.research = id;
      go.addEventListener('click', () => { if (startResearch(game, town, id)) paint(); });
      row.append(txt, go); list.append(row);
      rows[id] = { row, name, info, price, costs, bar, fill, go };
    }
    const paint = () => {
      const o = ''; // no line: the running item's button counts down and the others read Busy (reviews of 2026.11.20-4 and -5: "One at a time." read as a rule, then the time said three times)
      if (one.textContent !== o) one.textContent = o; one.hidden = !o;
      for (const [id, x] of Object.entries(rows)) {
        const r = RESEARCH[id], L = researchLevel(town, id), lab = town.lab && town.lab.id === id ? town.lab : null, block = researchBlock(town, id);
        const n = r.name; if (x.name.textContent !== n) x.name.textContent = n;
        // the price as have / need, red when short, like every other cost (review of 2026.11.19-13), and while another
        // item runs it says so in place of a grayed button with no reason
        const info = lab ? 'Researching level ' + (L + 1) + ' of ' + r.max
          : block === 'max' ? 'All ' + r.max + ' levels done'
          : [levelsDone(L, r.max), 'takes ' + wait(researchTime(town, id))].map(keep).join(' · ');
        if (x.info.textContent !== info) x.info.textContent = info;
        const need = researchCost(town, id), pt = fmtLive(town.coins) + ' / ' + fmt(need) + ' coins';
        x.costs.hidden = !!lab || block === 'max';
        if (x.price.textContent !== pt) x.price.textContent = pt;
        x.price.classList.toggle('low', town.coins + 1e-9 < need);
        x.bar.hidden = !lab;
        if (lab) { const w = Math.round(100 * (1 - lab.left / lab.total)) + '%'; if (x.fill.style.width !== w) x.fill.style.width = w; }
        const label = lab ? leftWord(lab.left) : block === 'max' ? 'Done' : block === 'busy' ? 'Busy' : 'Research';
        if (x.go.textContent !== label) x.go.textContent = label;
        x.go.disabled = !!block; x.row.classList.toggle('running', !!lab);
      }
    };
    paint();
    let acc = 0;
    return dt => { if ((acc += dt) < .25) return; acc = 0; paint(); };
  };
}

/* Automation: three rows for this town, each with an On / Off switch once it is open. Foremen switch every hired
   foreman of the town at once; Auto-towers and Auto-research open with the War Office and the University. */
export function autoSheet(game, town) {
  return body => {
    const list = el('div', 'goods research auto'), rows = {};
    body.append(el('p', 'note', 'Automation never spends more than half your coins.'), list);
    const add = (id, name, about) => {
      const row = el('div', 'option'), txt = el('div'), info = el('small'), sw = btn('Turn on', 'btn small'); sw.dataset.auto = id;
      txt.append(el('b', null, name), el('span', null, about), info); row.append(txt, sw); list.append(row);
      rows[id] = { row, info, sw };
      return rows[id];
    };
    add('foremen', 'Foremen', 'Buys building levels.').sw.addEventListener('click', () => { setForemen(town, !foremenWorking(town)); paint(); });
    add('towers', 'Auto-towers', 'Raises one tower a level every few minutes.').sw.addEventListener('click', () => { setAuto(game, town, 'towers', !autoOf(game, town).towers); paint(); });
    add('retry', 'Keep trying the boss', 'Starts the waves again after a loss.').sw.addEventListener('click', () => { setAuto(game, town, 'retry', !autoOf(game, town).retry); paint(); });
    add('research', 'Auto-research', 'Runs research you did before, one level higher.').sw.addEventListener('click', () => { setAuto(game, town, 'research', !autoOf(game, town).research); paint(); });
    const set = (x, open, on, line) => {
      x.sw.disabled = !open; const label = on ? 'Turn off' : 'Turn on';
      if (x.sw.textContent !== label) x.sw.textContent = label;
      x.sw.classList.toggle('on', on); x.sw.setAttribute('aria-pressed', String(on));
      if (x.info.textContent !== line) x.info.textContent = line;
      x.row.classList.toggle('running', on);
    };
    const paint = () => {
      const a = autoOf(game, town), hired = foremenOf(town).length, working = foremenWorking(town);
      set(rows.foremen, hired > 0, working > 0, !hired ? 'Raise a building to level 10, then tap it and hire a foreman.' : working + ' of ' + hired + ' working');
      const tb = towerBlock(game, town), n = nextTowerUp(town);
      const tLine = !autoOpen(game, 'towers') ? 'Build the ' + INSTITUTION[AUTO.opens.towers].name + ' at the Capital first.'
        : !a.towers ? 'Every ' + wait(towerEvery(game)) + (a.last ? ' · last ' + TOWERS[a.last.kind].name + ' to level ' + a.last.level : '')
        : tb === 'won' ? 'Raises a tower when a raid gets through.'
        : tb === 'none' ? 'Nothing to raise yet. Build a tower first.'
        : tb === 'path' ? 'Tap a level 4 tower and pick its path.'
        : tb === 'coins' ? 'Waiting for ' + fmt(n.cost.coins * 2) + ' coins or its goods'
        : tb === 'wait' ? 'Next raise in ' + wait(a.wait)
        : 'Raising a tower now';
      set(rows.towers, autoOpen(game, 'towers'), !!a.towers && autoOpen(game, 'towers'), tLine);
      const rs = retryState(game, town), bw = a.boss ? a.boss.wave : 0;
      const yLine = !autoOpen(game, 'retry') ? 'Build the ' + INSTITUTION[AUTO.opens.retry].name + ' at the Capital first.'
        : !a.retry ? ''
        : rs === 'wait' ? 'Waiting for a tower to go up a level'
        : rs === 'stuck' ? (a.towers ? 'Waiting for a tower to go up a level' : 'Turn on Auto-towers, or raise a tower yourself')
        : rs === 'climb' ? 'Trying wave ' + bw + ' again' + (a.boss.tries > 1 ? ' · try ' + a.boss.tries : '')
        : 'Ready if a boss gets through';
      set(rows.retry, autoOpen(game, 'retry'), !!a.retry && autoOpen(game, 'retry'), yLine);
      const r = nextResearch(town);
      const rLine = !autoOpen(game, 'research') ? 'Build the ' + INSTITUTION[AUTO.opens.research].name + ' at the Capital first.'
        : !a.research ? 'Off'
        : town.lab ? RESEARCH[town.lab.id].name + ' ready in ' + wait(town.lab.left)
        : r ? 'Starting ' + RESEARCH[r.id].name
        : 'Waiting for coins, or research something by hand first';
      set(rows.research, autoOpen(game, 'research'), !!a.research && autoOpen(game, 'research'), rLine === 'Off' ? '' : rLine);
    };
    paint();
    let acc = 0;
    return dt => { if ((acc += dt) < .25) return; acc = 0; paint(); };
  };
}

/* Two taps to do something that cannot be undone: the first changes the label, the second does it. */
function confirmTap(b, ask, go) {
  const label = b.textContent; let armed = 0;
  b.addEventListener('click', () => {
    if (armed && Date.now() - armed < 4000) { armed = 0; b.textContent = label; b.classList.remove('arm'); go(); return; }
    armed = Date.now(); b.textContent = ask; b.classList.add('arm');
    setTimeout(() => { if (armed && Date.now() - armed >= 4000) { armed = 0; b.textContent = label; b.classList.remove('arm'); } }, 4100);
  });
}

/* The Menu sheet. ctx: { game, view (town view or null), toast, leave(kind, arg) } where leave saves or switches and
   reloads: leave('slot', n), leave('import', text), leave('title'). */
export function menuSheet(ctx) {
  const { game, view, toast, leave } = ctx;
  return body => {
    const sec = (name, ...kids) => { const s = el('div', 'sec'); s.append(el('h3', null, name), ...kids); body.append(s); return s; };

    // Graphics
    if (view && view.setQuality) {
      const row = el('div', 'seg'), opts = [['auto', 'Auto'], ['low', 'Low'], ['med', 'Med'], ['high', 'High']];
      const paint = () => { for (const b of row.children) b.setAttribute('aria-pressed', String(b.dataset.q === view.quality)); };
      for (const [k, name] of opts) {
        const b = btn(name, 'btn small'); b.dataset.q = k;
        b.addEventListener('click', () => { view.setQuality(k); paint(); });
        row.append(b);
      }
      paint();
      sec('Graphics', row, el('p', 'uses', 'Low runs smoothest. High looks best.'));
    }

    // Sound: two sliders, kept on this device (src/audio/audio.js)
    const audio = ctx.audio || (globalThis.CG && globalThis.CG.audio);
    if (audio) {
      const box = el('div', 'sliders');
      for (const [k, name] of [['music', 'Music'], ['sound', 'Sound']]) {
        const row = el('label', 'slider'), inp = el('input'), val = el('span', 'val');
        inp.type = 'range'; inp.min = '0'; inp.max = '100'; inp.step = '5'; inp.id = k + 'Vol';
        inp.value = String(Math.round(audio.get(k) * 100));
        const show = () => { val.textContent = +inp.value ? inp.value + '%' : 'Off'; };
        inp.addEventListener('input', () => { audio.start(); audio.set(k, +inp.value / 100); show(); });
        if (k === 'sound') inp.addEventListener('change', () => audio.play('coin'));
        show(); row.append(el('span', 'name', name), inp, val); box.append(row);
      }
      sec('Volume', box);
    }

    // Save slots
    const slots = el('div', 'slots'), mine = activeSlot();
    for (let n = 1; n <= SLOTS; n++) {
      // the slot in play shows the game as it is now, not its last save (review of 2026.11.19-8: 999K beside the top bar's 9.99M)
      const live = n === mine && game && game.town, s = live ? { n, town: game.active, wave: game.town.wave, coins: game.town.coins } : slotSummary(n), row = el('div', 'option slot'), txt = el('div');
      txt.append(el('b', null, 'Slot ' + n + (n === mine ? ' · playing' : '')),
        el('span', null, s.empty ? 'Empty' : s.damaged ? 'This save is damaged' : (TOWN_NAMES[s.town] || 'Town') + ' · Wave ' + s.wave + ' · ' + fmtLive(s.coins) + ' coins' + (live ? '' : ' · ' + ago(Date.now() - s.at))));
      row.append(txt);
      if (n !== mine) {
        const go = btn(s.empty ? 'New game' : 'Play'); go.dataset.slot = n; go.classList.add('slotgo');
        go.addEventListener('click', () => leave('slot', n));
        row.append(go);
        if (!s.empty) { const del = btn('Delete'); del.dataset.del = n; confirmTap(del, 'Sure?', () => { clearSave(n); ctx.reopen(); }); row.append(del); }
      }
      slots.append(row);
    }
    sec('Save slots', el('p', 'uses', 'Your game saves by itself every few seconds.'), slots);

    // Copy the save out
    const out = el('textarea', 'savetext'); out.readOnly = true; out.hidden = true; out.id = 'saveOut'; out.rows = 3;
    const copy = btn('Copy save', 'btn small', 'copySave'), file = btn('Save as file', 'btn small', 'fileSave');
    const text = () => encode(game, Date.now());
    copy.addEventListener('click', async () => {
      const t = text();
      try { await navigator.clipboard.writeText(t); toast('Save copied. Paste it somewhere safe, like a note.', 3000); }
      catch (e) { out.value = t; out.hidden = false; out.focus(); out.select(); toast('Copy the text in the box.', 3000); }
    });
    file.addEventListener('click', () => {
      const a = document.createElement('a'), url = URL.createObjectURL(new Blob([text()], { type: 'text/plain' }));
      a.href = url; a.download = 'copper-gulch-save.txt'; document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    const r1 = el('div', 'row'); r1.append(copy, file);
    sec('Copy your save', el('p', 'uses', 'Keep a copy of your game, or move it to another phone or computer.'), r1, out);

    // Load a save in
    const inp = el('textarea', 'savetext'); inp.id = 'saveIn'; inp.rows = 3; inp.placeholder = 'Paste a save here';
    const load = btn('Load save', 'btn small', 'loadSave'), pick = btn('Open file', 'btn small', 'openSave'), msg = el('p', 'warn'); msg.hidden = true;
    const fileIn = el('input'); fileIn.type = 'file'; fileIn.accept = '.txt,.json,text/plain'; fileIn.hidden = true;
    pick.addEventListener('click', () => fileIn.click());
    fileIn.addEventListener('change', async () => { const f = fileIn.files && fileIn.files[0]; if (f) { inp.value = await f.text(); msg.hidden = true; } });
    let ready = null, armed = 0;
    load.addEventListener('click', () => {
      try { ready = importText(inp.value, loadGame).text; }
      catch (e) { msg.textContent = e.message; msg.hidden = false; return; }
      if (armed && Date.now() - armed < 5000) { leave('import', ready); return; }
      armed = Date.now(); msg.textContent = 'This replaces the game in slot ' + mine + '. Tap Load save again to go ahead.'; msg.hidden = false;
    });
    inp.addEventListener('input', () => { armed = 0; msg.hidden = true; });
    const r2 = el('div', 'row'); r2.append(load, pick);
    sec('Load a save', inp, r2, msg, fileIn);

    // The rest
    const help = btn('Show help cards again', 'btn small', 'helpAgain');
    help.addEventListener('click', () => { const seen = game.shared.seen || (game.shared.seen = {}); for (const k of Object.keys(seen)) delete seen[k]; ctx.onHelp(); toast('The help cards will show again as you play.', 3000); });
    const upd = btn('Check for updates', 'btn small'); upd.addEventListener('click', () => checkUpdates(true));
    const home = btn('Title screen', 'btn small', 'toTitle'); home.addEventListener('click', () => leave('title'));
    const r3 = el('div', 'row'); r3.append(installButton(), upd, help, home);
    sec('More', r3, el('p', 'ver', 'Version ' + GAME_VERSION + ' · Free, no ads'));
  };
}

/* The Perks sheet. ctx: { game, town, leave } where leave('charter') saves and reloads into the new charter. */
export function perksSheet(ctx) {
  const { game, town, leave } = ctx;
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
  return body => {
    const sec = (name, ...kids) => { const s = el('div', 'sec'); s.append(el('h3', null, name), ...kids); body.append(s); return s; };
    // the charter (the perk pairs follow the deeds without a heading of their own: the sheet is called Perks)
    // short rows, not sentences (review of 2026.11.20-5: the deed lines were dense prose), and a button the size of the others
    const now = el('p', 'uses'), sign = btn('Sign the charter', 'btn small primary', 'signCharter');
    const rowOf = box => { const r = el('div'), l = el('span'), v = el('b'); r.append(l, v); box.append(r); return { r, l, v }; };
    const set = (e, t) => { if (e.textContent !== t) e.textContent = t; };
    const prog = el('div', 'explain why charterline'), wave = rowOf(prog), coins = rowOf(prog), next = el('p', 'uses');
    confirmTap(sign, 'Tap again to sign', () => { if (signCharter(game, town) > 0) leave('charter'); });
    const r = el('div', 'row'); r.append(sign);
    sec('Charter', now, prog, next, el('p', 'warn', town.def.name + ' starts over at wave 1. Its buildings, towers, research and foremen go. You keep your coins and deeds, and pick perks again.'), r);
    // the deeds held, and after signing
    const held = el('div', 'explain why'); held.id = 'deedsHeld';
    const have = rowOf(held), after = rowOf(held); after.r.id = 'deedsAfter';
    const each = el('p', 'uses');
    sec('Deeds', held, each);
    // the perk pairs
    const pairs = el('div', 'goods perks'); body.append(pairs);
    let sig = '';
    const paint = () => {
      const p = deedParts(town), n = nextDeed(town), c = game.shared.charter;
      // what signing pays is in Deeds, as the deeds now and after (review of 2026.11.19-12); this line only says when it opens
      const t1 = p.total ? '' : 'You can sign once you earn a deed here.';
      set(now, t1); now.hidden = !t1;
      // "Best wave", so it never reads as the wave on the top bar after a lost boss (review of 2026.11.19-12)
      set(wave.l, 'Best wave ' + town.bestWave); set(wave.v, plural(p.wave, 'deed'));
      set(coins.l, fmt(town.ownEarned) + ' coins earned here'); set(coins.v, plural(p.coins, 'deed'));
      set(next, 'Next deed at wave ' + n.wave + ' or at ' + fmt(n.coins) + ' coins.');
      sign.disabled = !p.total;
      const more = d => plural(d, 'deed') + ', ' + Math.round(DEEDS.income * 100 * d) + '% more coins';
      set(have.l, 'You have'); set(have.v, c.deeds ? more(c.deeds) : 'No deeds yet');
      const t = c.deeds + p.total;
      set(after.l, 'Sign now and you have'); set(after.v, p.total ? more(t) : '');
      after.r.hidden = !p.total;
      set(each, 'Each deed adds ' + Math.round(DEEDS.income * 100) + '% to all the coins you earn, for good.');
      each.hidden = c.deeds > 0;
      const s = c.deeds + JSON.stringify(c.perks);
      if (s === sig) return;
      sig = s; pairs.replaceChildren();
      for (const pair of PERKS) {
        const st = perkState(game, pair.id), box = el('div', 'pair'); box.dataset.pair = pair.id;
        box.append(el('small', 'pairhead', st === 'locked' ? 'Needs ' + plural(pair.need, 'deed') : st === 'open' ? 'Pick one' : 'Your perk'));
        for (const side of ['a', 'b']) {
          const x = pair[side], row = el('div', 'option'), txt = el('div');
          txt.append(el('b', null, x.name), el('span', null, x.about)); row.append(txt);
          if (st === 'open') {
            const go = btn('Pick', 'btn small build'); go.dataset.perk = pair.id + ':' + side;
            confirmTap(go, 'Tap again', () => { if (pickPerk(game, pair.id, side)) paint(); });
            row.append(go);
          } else if (st === side) row.classList.add('running'); // the heading says Your perk
          else if (st !== 'locked') continue; // the side not picked is left out (review of 2026.11.20-5: Fort Town half faded with no reason)
          else row.classList.add('off'); // a pair still locked is dimmed under Needs 2 deeds
          box.append(row);
        }
        pairs.append(box);
      }
    };
    paint();
    let acc = 0;
    return dt => { if ((acc += dt) < .3) return; acc = 0; paint(); };
  };
}
