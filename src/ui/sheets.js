/* Slide-up sheets over the town: one at a time, with a dimmed backdrop that closes it when tapped.
     Goods: what the town has in stock, what each good sells for now, and a Sell On or Off switch per good.
     Research: the town's research items, their next level's price and wait, and the one running.
     Perks: the town's charter (deeds it would pay now, what earns the next one, Sign), the deeds held, the perk pairs.
     Menu: Graphics, Volume (the Music and Sound sliders), Install, save slots, copying the save out and loading one in, the help cards, the title screen.
   Every word here follows the owner's writing rule (PLAN.md): plain, short, no colons or semicolons. */
import { GOODS } from '../data/goods.js';
import { BUILDINGS } from '../data/buildings.js';
import { saturation, eventFactor, boomNow, sellMode, setSellMode, SELL_MODES } from '../core/market.js';
import { explainPrice } from '../core/explain.js';
import { goodStall, stallWords } from '../core/stall.js';
import { explainBox } from './explain.js';
import { encode } from '../core/save.js';
import { loadGame } from '../core/setup.js';
import { SLOTS, activeSlot, slotSummary, importText, clearSave } from './storage.js';
import { installButton } from './install.js';
import { checkUpdates } from './update.js';
import { GAME_VERSION } from '../version.js';
import { setStock, RESERVE } from '../core/defense.js';
import { setSwitch } from './switch.js';
import { fmt, fmtLive, ago, goodsLine, levelsDone, priceNote, priceLabel, haveWords, priceOver, MODE_WORDS, MODE_LINES, MODE_SELLS, boomClock } from './format.js';
import { RESEARCH } from '../data/research.js';
import { itemsOf, researchLevel, researchCost, researchTime, researchBlock, startResearch, queueResearch, researchOpen, labsRunning } from '../core/research.js';
import { PERKS, DEEDS } from '../data/perks.js';
import { deedParts, nextDeed, signCharter, pickPerk, perkState } from '../core/charter.js';
import { TOWNS } from '../data/towns/index.js';
import { canFound, foundTown, nextTowns, deedsOf } from '../core/empire.js';
import { capitalNext, canFoundCapital } from '../core/capital.js';
import { autoOpen, autoOf, setAuto, retryState, towerBlock, towerEvery, nextTowerUp, nextResearch, foremenOf, foremenWorking, setForemen } from '../core/automation.js';
import { PATH_LEVEL, TOWERS } from '../data/towers.js';
import { INSTITUTION } from '../data/institutions.js';
import { AUTO } from '../data/automation.js';
import { ARMS } from '../data/arms.js';
import { armsBlock, armsLoss, callToArms, militia, armsWait } from '../core/arms.js';
import { bossName } from './lost.js';
const upFirst = s => s[0].toUpperCase() + s.slice(1);
import { ordersOf, takeOrder, giveUpOrder } from '../core/orders.js';
import { ORDERS } from '../data/orders.js';

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
    frame(dt) { if (cur && cur.tick) cur.tick(dt); if (cur) moreBelow(); },
    sync() { if (cur && cur.tick && cur.tick.sync) cur.tick.sync(); },
  };
  /* A sheet with more below its edge darkens its foot, so a row cut there reads as more to scroll to (reviews of
     2026.11.23-9 and -11: the Rail Office's price and the Vault sheet's raider list cut at the edge in landscape, with
     only a thin scrollbar to say there was more). Gone once scrolled to the end. */
  const moreBelow = () => { const m = body.scrollHeight - body.scrollTop - body.clientHeight > 4; if (body.classList.contains('more') !== m) body.classList.toggle('more', m); };
  body.addEventListener('scroll', moreBelow, { passive: true });
  x.addEventListener('click', api.close); back.addEventListener('click', api.close);
  return api;
}

/* Where a good's price stands against its full price, in one word for the end of its bar. */
/* A good's price row on the Goods sheet: [the price, how high it stands]. A price under 1 coin that is down says it
   once, by the price (review of 2026.11.22-12: "Under 1 coin each" beside "Down 99%"). */
/* A Goods row's price and how far it has moved. At its usual price the row says nothing more (review of 2026.11.23-9:
   "Full price" alone at the row's edge read as a label for nothing); the price bar in its breakdown still ends in it. */
export const priceRow = (price, s) => { const pl = priceLabel(price), pw = priceWord(s); return [pl, pw === 'Full price' || (price > 0 && price < .95 && pw.startsWith('Down')) ? '' : pw]; };
export const priceWord = s => (s > 1.05 ? 'Up ' + Math.min(99, Math.round((s - 1) * 100)) + '%' : s >= .95 ? 'Full price' : 'Down ' + Math.min(99, Math.max(5, Math.round((1 - s) * 100))) + '%'); // review of 2026.11.20-10: "1% of best" did not say best of what // review of 2026.11.20-9: "High price" beside "Under 1 coin each" read as an absolute price, a share of the good's own best price does not // review of 2026.11.20-8: "Top" and "High" alone gave no meaning // price: one unit's; almost 0 is said once, by the price at the bar's front (review of 2026.11.20-7: "Almost 0" sat where Top sits)

/* The Save for towers switch's state: how many upgrades of every tower it saves goods for, "2 upgrades" or "4 upgrades". */
export const stockWords = town => RESERVE.levels * (town.stock === 'lots' ? RESERVE.lots : 1) + ' upgrades'; // "Each tower keeps goods for · 2 upgrades", one sentence (review of 2026.11.20-14: "2 levels each" was unclear) // "Keep for towers · 2 levels each": for every tower (review of 2026.11.20-13: "Next 2 levels" did not say of what)
/* Its label: the same words as each building's "Keep 84 timber for towers", so the two read as one idea, how much and
   which goods (review of 2026.11.20-8: "Save for towers" looked like a second control for the same thing). */
/* Review of 2026.11.20-15: "Each tower keeps goods for" read as a time span, its pill did not look tappable, and the
   building cards called the same idea Keep for towers. Now one name, Save for towers, and two plain buttons. */
export const STOCK_LABEL = 'Save for towers';
/* The owner's own words for the two choices (2026-11-19, "Stock for towers: Normal / Lots"): the counts of upgrades
   were read five times and flagged again as "Save for towers · 2 upgrades" (review of 2026.11.23-9), so by the
   twice-flagged rule the numbers leave the buttons; each row's "for towers" count shows what is kept. */
export const STOCK_CHOICES = [['normal', 'Normal'], ['lots', 'Lots']]; // review of 2026.11.20-9: the building cards' switch says which good ("Keep timber for towers"), this one how much

/* Town orders on the Goods sheet (src/core/orders.js): the town's reputation, the order running with how much is sent and
   the time left, and the offers with Take. Taking another while one runs, or Give up, takes two taps, since it costs
   reputation. Rows are built once for each set of orders (sig) and only their words and bars change after that. */
export const orderName = o => fmt(o.need) + ' ' + GOODS[o.good].name.toLowerCase();
export const orderDone = (e, here) => GOODS[e.good].name + ' order filled' + (here ? '' : ' in ' + (TOWN_NAMES[e.town] || e.town)) + '. You got ' + fmt(e.coins) + ' coins.';
export const orderMissed = (e, here) => (e.gaveUp ? 'You gave up the ' : 'The ') + GOODS[e.good].name.toLowerCase() + ' order' + (here ? '' : ' in ' + (TOWN_NAMES[e.town] || e.town)) + (e.gaveUp ? '.' : ' ran out of time.') + ' Reputation is now ' + e.rep + '.';
const repAsk = 'Lose ' + ORDERS.miss + ' reputation?';
export function ordersPanel(game, town) {
  const st = ordersOf(game, town);
  if (!st) return null;
  const box = el('div', 'orders'); box.id = 'orders';
  const live = [];
  box.append(el('h3', '', 'Orders'));
  const rep = el('div', 'option static'), repTxt = el('div'), repN = el('b'), bar = el('i', 'depth'), fill = el('i'), rush = el('small');
  const mark = el('i', 'mark'); mark.style.left = Math.round(100 * ORDERS.rushAt / ORDERS.max) + '%'; bar.append(fill, mark); repTxt.append(repN, bar, rush); rep.append(repTxt); box.append(rep); rep.id = 'orderRep'; // a mark where rush orders start (review of 2026.11.22-4)
  live.push(() => {
    setText(repN, 'Reputation ' + Math.round(st.rep) + ' of ' + ORDERS.max);
    const w = Math.round(100 * st.rep / ORDERS.max) + '%'; if (fill.style.width !== w) fill.style.width = w;
    setText(rush, st.rep >= ORDERS.rushAt ? 'Rush orders pay more' : 'Rush orders come at ' + ORDERS.rushAt); // what a rush order is (review of 2026.11.23-6: "Rush orders are open")
  });
  const a = st.active;
  if (a) {
    const row = el('div', 'option running'), txt = el('div'), head = el('div', 'gnamerow'), name = el('b', '', orderName(a)), left = el('small', 'oleft');
    head.append(name, left); left.id = 'orderLeft';
    const got = el('small'), b2 = el('i', 'depth'), f2 = el('i'); b2.append(f2);
    txt.append(head, el('span', '', 'Pays ' + fmt(a.coins) + ' coins'), got, b2);
    const drop = btn('Give up'); drop.id = 'orderDrop';
    confirmTap(drop, repAsk, () => { giveUpOrder(game, town); });
    row.append(txt, drop); box.append(row); row.id = 'orderRun';
    live.push(() => {
      setText(got, 'Sent ' + fmt(Math.floor(a.got)) + ' so far');
      const w = Math.round(100 * Math.min(1, a.got / a.need)) + '%'; if (f2.style.width !== w) f2.style.width = w;
      setText(left, clock(a.left) + ' left');
    });
  }
  const list = el('div', 'goods research');
  if (!st.offers.length) list.append(el('p', 'uses', 'No new orders right now.'));
  for (const o of st.offers) {
    const row = el('div', 'option'), txt = el('div'), name = el('b');
    if (o.rush) name.append(el('i', 'lbl', 'Rush'));
    name.append(document.createTextNode(orderName(o)));
    txt.append(name, el('span', '', 'Pays ' + fmt(o.coins) + ' coins'), el('small', '', 'Deliver in ' + span(o.time)));
    const take = btn(a ? 'Take instead' : 'Take', 'btn small build'); take.dataset.order = o.id;
    const go = () => { takeOrder(game, town, o.id); };
    if (a) confirmTap(take, repAsk, go); else take.addEventListener('click', go);
    row.append(txt, take); list.append(row);
  }
  box.append(list);
  const paint = () => { for (const fn of live) fn(); };
  paint();
  return { el: box, paint, sig: () => (st.active ? st.active.id : 0) + '|' + st.offers.map(o => o.id).join(',') };
}

/* The Goods sheet. A good shows once its building is built. */
export function goodsSheet(game, town, focus = null) {
  return body => {
    const list = el('div', 'goods'), rows = {}, open = {}, whySig = {}, picking = {};
    if (focus) open[focus] = true; // tapped on the goods strip: that good opens with its price explained
    // one switch for the whole town (owner, 2026-11-19: keep more for towers, with no tuning good by good)
    // no line under it: each good's row says how many it keeps, and Lots doubles them there (review of 2026.11.20-3:
    // "Enough for 2 more levels on every tower and 2 new towers." read as a system explained)
    const stockRow = el('div', 'row stockrow'), seg = el('div', 'seg'); seg.id = 'stockTowers';
    const segBtns = STOCK_CHOICES.map(([k, words]) => { const b = btn(words, 'btn small'); b.dataset.stock = k; b.addEventListener('click', () => { setStock(town, k); paintStock(); paint(); }); return b; });
    const paintStock = () => { const cur = town.stock === 'lots' ? 'lots' : 'normal'; for (const b of segBtns) { const on = b.dataset.stock === cur; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); } };
    seg.append(...segBtns); paintStock(); stockRow.append(el('span', 'seglabel', STOCK_LABEL), seg);
    if (town.towers && town.def && town.def.board) body.append(stockRow);
    // town orders, once they are open here, above the goods (src/core/orders.js)
    const ordersBox = el('div'); let op = null, osig = '';
    const orders = () => { const p = ordersPanel(game, town); op = p; osig = p ? p.sig() : ''; ordersBox.replaceChildren(...(p ? [p.el] : [])); };
    orders();
    body.append(ordersBox, list); // no how-it-works line (review of 2026.11.19-11): the bar under each good shows how far its price fell
    // a tapped good stays whole in view, below the pinned Save for towers row (review of 2026.11.20-6: the tap left
    // Timber's name under it)
    const inView = row => {
      if (!row.isConnected) return;
      const b = body.getBoundingClientRect(), r = row.getBoundingClientRect(), top = (stockRow.isConnected ? stockRow.getBoundingClientRect().bottom : b.top) + 4;
      if (r.top < top) body.scrollTop -= top - r.top;
      else if (r.bottom > b.bottom - 4) body.scrollTop += Math.min(r.bottom - b.bottom + 4, r.top - top);
    };
    const shown = () => Object.entries(BUILDINGS).filter(([id, b]) => b.town === town.id && town.level(id) > 0 && !GOODS[b.makes].grid).map(([, b]) => b.makes);
    // goods shipped in from another town: what is in stock, and where it comes from (never sold here)
    const shipped = () => ((town.def && town.def.imports) || []).filter(g => (town.shipped || {})[g] > 0);
    let sig = '';
    const build = () => {
      const goods = shown(); sig = goods.join() + '|' + shipped().join();
      list.replaceChildren();
      if (!goods.length) list.append(el('p', 'uses', 'Build a Lumber Camp to make your first good.'));
      for (const g of goods) {
        const row = el('div', 'option good'), txt = el('div', 'tapwhy'), name = el('b', null, GOODS[g].name), line = el('span'), line2 = el('span'), why = el('div');
        // the bar says what it is (review of 2026.11.19-12) and where it stands in a word (review of 2026.11.20-2: no scale)
        const level = el('small', 'pword'), plabel = el('small', 'plabel', 'Price'), barRow = el('span', 'depthrow'), ev = el('small', 'evword'); ev.hidden = true; barRow.append(plabel, level); const head = el('div', 'gnamerow'); head.append(name, ev); // ev: a boom or bust and its time left, beside the name so the price row keeps its width on a phone // no bar: it had no label and said what the word says (review of 2026.11.20-15)
        // a stalled workshop's good says what it waits for (clarity fix 6)
        const wait = el('small', 'warn waitline'); wait.hidden = true;
        // a boom or bust's time in words under the price, and only its arrow beside the name (clarity fix 8b: "1:11 left"
        // beside the name was flagged twice, so the control changed)
        const evLine = el('small', 'evline'); evLine.hidden = true;
        txt.append(head, line, line2, wait, barRow, evLine, why); txt.dataset.why = g; txt.setAttribute("role", "button"); txt.tabIndex = 0; // line2: for towers and spare, its own line (review of 2026.11.20-7: "spare" wrapped alone on a phone)
        txt.addEventListener('click', () => { open[g] = !open[g]; whySig[g] = ''; paint(); requestAnimationFrame(() => inView(row)); }); // tap a good: what makes its price
        // Sell spare opens the four modes under the row (GDD.md, Market); a pick closes them
        const sw = btn('', 'btn small'); sw.dataset.good = g;
        const pick = el('div', 'sellpick'); pick.hidden = true; pick.dataset.good = g;
        // each mode with a picture of the price, lit where the mode sells (review of 2026.11.23-6)
        const picks = SELL_MODES.map(k => { const b = btn('', 'btn small'), pic = el('span', 'modepic'); pic.setAttribute('aria-hidden', 'true'); pic.append(...MODE_SELLS[k].map((on, i) => el('i', (on ? 'on ' : '') + ['low', 'mid', 'high'][i]))); b.replaceChildren(pic, el('b', null, MODE_WORDS[k]), el('small', null, MODE_LINES[k])); b.dataset.mode = k; b.addEventListener('click', () => { setSellMode(town, g, k); picking[g] = false; paint(); }); return b; });
        pick.append(...picks);
        sw.addEventListener('click', () => { picking[g] = !picking[g]; paint(); if (picking[g]) requestAnimationFrame(() => inView(pick)); });
        row.append(txt, sw); list.append(row, pick);
        rows[g] = { line, line2, wait, sw, why, txt, level, plabel, ev, evLine, pick, picks };
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
        const mode = sellMode(town, g), selling = mode !== 'off', have = town.goods[g] || 0;
        // every unit kept for towers: nothing is sold now, so no price (review 2026-11-18: "sells for 0 coins each" next to Sell On)
        const txt = goodsLine({ have, kept, selling, price: ex.value, open: !!open[g] });
        const cut = txt.indexOf(' · '), a = cut < 0 ? txt : txt.slice(0, cut), b2 = cut < 0 ? '' : txt.slice(cut + 3);
        if (r.line.textContent !== a) r.line.textContent = a;
        if (r.line2.textContent !== b2) r.line2.textContent = b2;
        if (r.line2.hidden !== !b2) r.line2.hidden = !b2;
        const wt = stallWords(game, town, goodStall(game, town, g));
        if (r.wait.textContent !== wt) r.wait.textContent = wt;
        if (r.wait.hidden !== !wt) r.wait.hidden = !wt;
        r.txt.setAttribute('aria-expanded', String(!!open[g]));
        const bm0 = boomNow(game), note = open[g] ? priceNote({ have, kept, price: ex.value, boom: !!bm0 && bm0.good === g && bm0.f > 1 }) : null; // none to sell, or a price of almost 0: words, not rows
        const ws = open[g] ? (note || JSON.stringify(ex.rows.map(x => [x.label, Math.round((x.mul || x.base) * 100)]))) : '';
        if (ws !== whySig[g]) { whySig[g] = ws; r.why.replaceChildren(...(!open[g] ? [] : note ? [el('p', 'uses', note)] : [explainBox(ex, { total: null, pct: true })])); }
        const sat = saturation(game, g);
        const [pl, pw] = priceRow(ex.value, sat * eventFactor(game, g)); // a boom or bust moves it too (review of 2026.11.22-3: "Boom" beside "Down 99%")
        const pw1 = open[g] && !note ? '' : pw; // open, its rows say each move, so the drop is said once (clarity fix 8a)
        if (r.level.textContent !== pw1) r.level.textContent = pw1;
        if (r.plabel.textContent !== pl) r.plabel.textContent = pl;
        setSwitch(r.sw, 'Sell spare', MODE_WORDS[mode], selling);
        r.sw.setAttribute('aria-expanded', String(!!picking[g])); // its mode shows once, on the picked button, while the four are open (review of 2026.11.22-3)
        if (r.pick.hidden !== !picking[g]) r.pick.hidden = !picking[g];
        for (const b of r.picks) { const on = b.dataset.mode === mode; if (b.classList.contains('on') !== on) { b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); } }
        // an arrow up or down and the time it has left (the stylesheet draws the arrow; review of 2026.11.23-7: a bare time said nothing of what it counts)
        const bm = boomNow(game), on = !!bm && bm.good === g, ew = on ? boomWords(bm.f, boomClock(bm.left)) : '';
        { const al = bm && bm.good === g ? (bm.f > 1 ? 'Price up for ' : 'Price down for ') + boomClock(bm.left) : ''; if ((r.ev.getAttribute('aria-label') || '') !== al) r.ev.setAttribute('aria-label', al); }
        if (r.ev.hidden !== !on) r.ev.hidden = !on;
        if (r.evLine.textContent !== ew) r.evLine.textContent = ew;
        if (r.evLine.hidden !== !ew) r.evLine.hidden = !ew;
        if (r.ev.classList.contains('bust') !== (!!bm && bm.good === g && bm.f < 1)) r.ev.classList.toggle('bust');
        if (r.evLine.classList.contains('bust') !== (on && bm.f < 1)) r.evLine.classList.toggle('bust');
      }
    };
    build();
    if (focus && rows[focus]) { rows[focus].txt.classList.add('focus'); requestAnimationFrame(() => {
      // whole rows only: from the top when the good fits there, else with the good's row at the top (review of
      // 2026.11.20-6: in landscape "nearest" left the Save for towers switch cut in half under the sheet's title)
      const row = rows[focus].txt.closest('.option') || rows[focus].txt, at = row.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop;
      if (at + row.offsetHeight <= body.clientHeight) body.scrollTop = 0; else row.scrollIntoView({ block: 'start' }); // its snap point, so the row above is gone whole
    }); }
    // painted only when the strip is (sync), so its counts always match the strip's
    const tick = () => {}; tick.sync = () => {
      if (shown().join() + '|' + shipped().join() !== sig) build(); else paint();
      const st = ordersOf(game, town), now = st ? (st.active ? st.active.id : 0) + '|' + st.offers.map(o => o.id).join(',') : '';
      if (!!st !== !!op || now !== osig) orders(); else if (op) op.paint();
    };
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
      const b = btn(here ? TOWNS[id].name + ' · Here' : 'Play ' + TOWNS[id].name, here ? 'btn' : 'btn primary', 'place-' + id);
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
export const span = s => s < 90 ? Math.max(1, Math.ceil(s)) + ' sec' : Math.round(s / 60) + ' min';
/* A boom or bust on the Goods sheet in words, with its clock (clarity fix 8b). */
export const boomWords = (f, clock) => (f > 1 ? 'Price up for ' : 'Price down for ') + clock + ' more';
export const leftWord = s => span(s) + ' left'; // research rows and their buttons say time one way, "takes 80 sec" and "13 sec left" (review of 2026.11.20-9)
export const wait = s => s < 90 ? Math.max(1, Math.ceil(s)) + ' seconds' : Math.round(s / 60) + ' minutes';

/* The Research sheet: one row per item, with its next level's price and wait, and a bar on the one running. */
/* Where research is not open in this town, the one thing to do: build its research building, or at an outpost, the
   towns that research (owner, 2026-11-20: Auto-research was on and the Research button was gone). */
const placeName = t => ((t.def && (t.def.short || t.def.name)) || t.id).replace(/ /g, '\u00a0'); // a place's name never breaks across lines
const orList = xs => (xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' or ' + xs[xs.length - 1]);
export function researchClosedLine(game, town) {
  if (researchOpen(town)) return '';
  const b = town.def && town.def.researchOpens;
  if (b && BUILDINGS[b]) return 'Build the ' + BUILDINGS[b].name + ' to start research here.';
  // an outpost: no research of its own, and each town researches on its own (owner, 2026-11-22: "is research empire
  // wide or town specific? ... I was in Dry Creek and it shows what was being researched in another town")
  return placeName(town) + ' has no research. Each town researches on its own.';
}
/* Every other town that can research: { id, name, what } with what it runs and the time left, or Not researching. */
export const otherLabs = (game, town) => Object.values(game.towns).filter(t => t !== town && researchOpen(t)).map(t => ({ id: t.id, name: placeName(t), what: t.lab && RESEARCH[t.lab.id] ? RESEARCH[t.lab.id].name + ' · ' + leftWord(t.lab.left) : 'Not researching' }));
/* Research running in the other towns, one line each, "Copper Gulch · Sharp Saws · 13 sec left". This town's own
   running item is on its row below, so it is not said twice. */
/* Every other town that can research, idle ones too, so a wasted slot shows (review of 2026.11.20-16). */
/* What a town with nothing researching would start from another place's Research sheet: the item Auto-research
   would raise (one already researched by hand), else the cheapest item it can pay for now. null when none (review of
   2026.11.23-9: the outpost's sheet only said a rule, so its rows got something to do). */
export function idlePick(town) {
  if (!researchOpen(town) || town.lab) return null;
  const auto = nextResearch(town);
  if (auto) return auto.id;
  let best = null;
  for (const id of itemsOf(town)) {
    if (researchBlock(town, id)) continue;
    const c = researchCost(town, id);
    if (town.coins + 1e-9 >= c && (!best || c < best.c)) best = { id, c };
  }
  return best ? best.id : null;
}
export const elsewhereLines = (game, town) => otherLabs(game, town).map(x => x.name + ' · ' + x.what);
/* The Research sheet. goTo(id) puts another town in play with its Research open (a row under Your towns). */
export function researchSheet(game, town, goTo = null) {
  return body => {
    const list = el('div', 'goods research'), rows = {}, one = el('p', 'note'); one.id = 'labOne';
    // the other towns' research, each row one tap from that town's own list (owner, 2026-11-20 and 2026-11-22). In a
    // town it comes after its own list, folded; in an outpost, which has none, it is the list, open.
    const outpost = !(town.def && town.def.researchOpens) && !researchOpen(town);
    const away = el('div', 'labaway'); away.id = 'labAway';
    const awayHead = btn('', 'btn small labfold'); awayHead.id = 'labAwayFold';
    const awayList = el('div', 'goods research'); awayList.id = 'labAwayList';
    let folded = !outpost;
    awayHead.addEventListener('click', () => { folded = !folded; paintAway(true); });
    if (outpost) away.append(el('h3', '', 'Your towns'), awayList); else away.append(awayHead, awayList);
    const closed = el('p', 'note'); closed.id = 'labClosed';
    if (outpost) body.append(closed, away); else body.append(closed, one, list, away);
    let awaySig = '';
    const paintAway = (force = false) => {
      const labs = otherLabs(game, town), sig = labs.map(x => x.id + x.what).join('|');
      if (force || sig !== awaySig) {
        awaySig = sig;
        awayList.replaceChildren(...labs.map(x => {
          const r = el('button', 'option labrow' + (x.what === 'Not researching' ? ' idle' : '')); r.dataset.town = x.id;
          r.append(el('b', null, x.name), el('small', null, x.what));
          r.addEventListener('click', () => { if (goTo) goTo(x.id); });
          // a town with nothing running gets a button that starts its next item from here
          const t = game.towns[x.id], pick = t && idlePick(t);
          if (!pick) return r;
          const line = el('div', 'labline'), go = btn('', 'btn small labstart'); go.dataset.start = x.id;
          go.append(el('span', null, 'Start'), el('small', null, RESEARCH[pick].name));
          go.setAttribute('aria-label', 'Start ' + RESEARCH[pick].name + ' in ' + ((t.def && (t.def.short || t.def.name)) || t.id));
          go.addEventListener('click', () => { const p = idlePick(t); if (p) startResearch(game, t, p); paintAway(true); });
          line.append(r, go);
          return line;
        }));
      }
      const fl = (folded ? 'Show' : 'Hide') + ' your other towns'; if (awayHead.textContent !== fl) awayHead.textContent = fl;
      awayHead.setAttribute('aria-expanded', String(!folded));
      awayList.hidden = folded;
      away.hidden = !labs.length;
      const c = researchClosedLine(game, town); if (closed.textContent !== c) closed.textContent = c; closed.hidden = !c;
      list.hidden = !researchOpen(town);
    }; // while one runs, the others say why they wait (the 2026.11.20-2 screenshots: "after Thick Walls" read as a need)
    for (const id of itemsOf(town)) {
      const r = RESEARCH[id], row = el('div', 'option'), txt = el('div');
      const name = el('b'), info = el('small'), price = el('span', 'need coinneed'), bar = el('i', 'depth'), fill = el('i');
      bar.append(fill); txt.append(name, el('span', null, r.about));
      if (r.worse) txt.append(el('span', 'worse', r.worse));
      const costs = el('span', 'costrow'); costs.append(price); txt.append(info, costs, bar);
      const go = btn('Research', 'btn small build timer'); go.dataset.research = id;
      go.addEventListener('click', () => { if (!startResearch(game, town, id) && town.lab) queueResearch(town, id); paint(); }); // while one runs: line it up next
      row.append(txt, go); list.append(row);
      rows[id] = { row, name, info, price, costs, bar, fill, go };
    }
    const paint = () => {
      paintAway();
      const o = ''; // no line: the running item's button counts down and the others read Busy (reviews of 2026.11.20-4 and -5: "One at a time." read as a rule, then the time said three times)
      if (one.textContent !== o) one.textContent = o; one.hidden = !o;
      for (const [id, x] of Object.entries(rows)) {
        const r = RESEARCH[id], L = researchLevel(town, id), lab = town.lab && town.lab.id === id ? town.lab : null, block = researchBlock(town, id);
        const n = r.name; if (x.name.textContent !== n) x.name.textContent = n;
        // the price as have / need, red when short, like every other cost (review of 2026.11.19-13), and while another
        // item runs it says so in place of a grayed button with no reason
        const info = lab ? 'Researching level ' + (L + 1) + ' of ' + r.max
          : block === 'max' ? 'All ' + r.max + ' levels done'
          : [levelsDone(L, r.max), 'takes ' + span(researchTime(town, id))].map(keep).join(' · ');
        if (x.info.textContent !== info) x.info.textContent = info;
        const need = researchCost(town, id); // the price over what you have, as on every card (review of 2026.11.20-15)
        x.costs.hidden = !!lab || block === 'max';
        priceOver(x.price, need, 'coins', town.coins);
        x.price.classList.toggle('low', town.coins + 1e-9 < need);
        x.bar.hidden = !lab;
        if (lab) { const w = Math.round(100 * (1 - lab.left / lab.total)) + '%'; if (x.fill.style.width !== w) x.fill.style.width = w; }
        // while another runs, the others line up one next (review of 2026.11.20-6: "Busy" on a grayed button)
        const next = town.labNext === id, lineUp = !lab && !!town.lab && block !== 'max';
        const label = lab ? leftWord(lab.left) : block === 'max' ? 'Done' : next ? 'Up next' : 'Research'; // while one runs it lines this up and then says Up next (review of 2026.11.23-7: "Line up" was flagged, and "Do next" before it, so the button keeps its one word) // review of 2026.11.20-18: "Research next" was unclear, Line up then Up next // the same verb as the free button (review of 2026.11.20-14: "Do next" beside Research) // "Next" read as a next page (review of this release)
        if (x.go.textContent !== label) x.go.textContent = label;
        x.go.disabled = !!block && !lineUp; x.row.classList.toggle('running', !!lab); x.go.classList.toggle('on', next);
      }
    };
    paint();
    let acc = 0;
    return dt => { if ((acc += dt) < .25) return; acc = 0; paint(); };
  };
}

/* Automation: three rows for this town, each with an On / Off switch once it is open. Foremen switch every hired
   foreman of the town at once; Auto-towers and Auto-research open with the War Office and the University. */
/* What Auto-towers waits for: the first good the next upgrade is short of, else the coins (it spends at most half). */
export function autoWait(town, cost) {
  const g = Object.entries(cost.goods || {}).find(([k, n]) => !town.has(k, n));
  return g ? 'Waiting for ' + fmt(g[1]) + ' ' + GOODS[g[0]].name.toLowerCase() : 'Waiting for ' + fmt(cost.coins * 2) + ' coins';
}
export function autoSheet(game, town, openResearch = null) {
  return body => {
    const list = el('div', 'goods research auto'), rows = {};
    body.append(el('p', 'note', 'Auto never spends more than half your coins.'), list);
    const add = (id, name, about) => {
      const row = el('div', 'option'), txt = el('div'), info = el('small'), sw = btn('Turn on', 'btn small'); sw.dataset.auto = id;
      txt.append(el('b', null, name), el('span', null, about), info); row.append(txt, sw); list.append(row);
      rows[id] = { row, info, sw };
      return rows[id];
    };
    add('foremen', 'Foremen', 'Upgrades buildings in this town that have a foreman.').sw.addEventListener('click', () => { setForemen(town, !foremenWorking(town)); paint(); });
    add('towers', 'Auto-towers', 'Upgrades one tower in this town every few minutes.').sw.addEventListener('click', () => { setAuto(game, town, 'towers', !autoOf(game, town).towers); paint(); });
    add('retry', 'Fight the ' + bossName(town) + ' again', 'After a loss, this town keeps playing and tries again by itself.').sw.addEventListener('click', () => { setAuto(game, town, 'retry', !autoOf(game, town).retry); paint(); });
    add('research', 'Auto-research', 'Starts the next research in this town by itself.').sw.addEventListener('click', () => { setAuto(game, town, 'research', !autoOf(game, town).research); paint(); });
    // Call to arms by Auto: only at a boss or a low vault, with its own switch (owner idea, 2026-11-20)
    add('arms', 'Call to arms', "Calls this town's workers out when the boss is on the road or the vault is low.").sw.addEventListener('click', () => { setAuto(game, town, 'arms', !autoOf(game, town).arms); paint(); });
    // its line opens Research, so what it runs is one tap away (owner, 2026-11-20)
    if (openResearch) { const see = btn('See research', 'btn small'); see.id = 'autoSeeResearch'; see.addEventListener('click', () => openResearch()); rows.research.row.querySelector('div').append(see); rows.research.see = see; }
    const set = (x, open, on, line) => {
      x.sw.disabled = !open; const label = on ? 'Turn off' : 'Turn on';
      if (x.sw.textContent !== label) x.sw.textContent = label;
      x.sw.classList.toggle('on', on); x.sw.setAttribute('aria-pressed', String(on));
      if (x.info.textContent !== line) x.info.textContent = line;
      x.row.classList.toggle('running', on);
    };
    const paint = () => {
      const a = autoOf(game, town), hired = foremenOf(town).length, working = foremenWorking(town);
      set(rows.foremen, hired > 0, working > 0, !hired ? 'Upgrade a building to level 10, then tap it and hire a foreman.' : working + ' of ' + hired + ' working');
      const tb = towerBlock(game, town), n = nextTowerUp(town);
      const tLine = !autoOpen(game, 'towers') ? 'Build the ' + INSTITUTION[AUTO.opens.towers].name + ' at the Capital first.'
        : !a.towers ? 'Every ' + wait(towerEvery(game)) + (a.last ? ' · last ' + TOWERS[a.last.kind].name + ' to level ' + a.last.level : '')
        : tb === 'won' ? 'Upgrades a tower when a raid gets through.'
        : tb === 'none' ? 'Nothing to upgrade yet. Build a tower first.'
        : tb === 'path' ? (town.towers.some(t => t.level + 1 === PATH_LEVEL && !t.path) ? 'Tap a level 4 tower and pick its path.' : 'Tap a level 19 tower and pick its upgrade.')
        : tb === 'coins' ? autoWait(town, n.cost) // the good it waits for, by name (review of 2026.11.20-11: "150 coins or its goods" beside 9.25M coins)
        : tb === 'wait' ? 'Next upgrade in ' + wait(a.wait)
        : 'Upgrading a tower now';
      set(rows.towers, autoOpen(game, 'towers'), !!a.towers && autoOpen(game, 'towers'), tLine);
      const rs = retryState(game, town), bw = a.boss ? a.boss.wave : 0;
      const yLine = !autoOpen(game, 'retry') ? 'Build the ' + INSTITUTION[AUTO.opens.retry].name + ' at the Capital first.'
        : !a.retry ? ''
        : rs === 'again' ? 'Tries again after a tower goes up a level' // the reason (review of 2026.11.20-13: "On hold for now" gave none)
        : rs === 'stuck' ? (a.towers ? 'Tries again once Auto-towers can upgrade' : 'Turn on Auto-towers, or upgrade a tower yourself')
        : rs === 'climb' ? 'Trying wave ' + bw + ' again' + (a.boss.tries > 1 ? ' · try ' + a.boss.tries : '')
        : 'Ready if a boss gets through';
      set(rows.retry, autoOpen(game, 'retry'), !!a.retry && autoOpen(game, 'retry'), yLine);
      const r = nextResearch(town);
      const rLine = !autoOpen(game, 'research') ? 'Build the ' + INSTITUTION[AUTO.opens.research].name + ' at the Capital first.'
        : !a.research ? 'Off'
        : town.lab ? RESEARCH[town.lab.id].name + ' · ' + leftWord(town.lab.left) // the item and its time, as Research says it (owner, 2026-11-20)
        : r ? 'Starting ' + RESEARCH[r.id].name
        : 'Waiting for coins, or research something by hand first';
      set(rows.research, autoOpen(game, 'research'), !!a.research && autoOpen(game, 'research'), rLine === 'Off' ? '' : rLine);
      { const open = autoOpen(game, 'arms'), line = armsLine(game, town); set(rows.arms, open, !!a.arms && open, !open || a.arms || line !== 'Ready' ? line : ''); }
      if (rows.research.see) { const h = !autoOpen(game, 'research'); if (rows.research.see.hidden !== h) rows.research.see.hidden = h; }
    };
    paint();
    let acc = 0;
    return dt => { if ((acc += dt) < .25) return; acc = 0; paint(); };
  };
}

/* A fixed-width clock for a short wait: "0:32", "4:59" (never more than 4 characters under 10 minutes). */
export const clock = s => { const n = Math.max(0, Math.ceil(s - 1e-9)); return Math.floor(n / 60) + ':' + String(n % 60).padStart(2, '0'); };
/* Where Call to arms stands, in words for its sheet and the Auto sheet. */
export function armsLine(game, town) {
  const b = armsBlock(game, town), a = town.arms || { t: 0 };
  return b === 'closed' ? 'Buy the Armory at the War Office first.'
    : b === 'none' ? 'Build a building first. Its workers are the ones who fight.'
    : b === 'fighting' ? 'Your workers are fighting. ' + span(a.t) + ' left.'
    : b === 'wait' ? 'Ready again in ' + span(armsWait(town)) + '.'
    : 'Ready';
}
/* Call to arms (owner idea, 2026-11-20): what a call does and what it costs, before the tap, then its time. */
export function armsSheet(game, town) {
  return body => {
    const what = el('div', 'explain'), row = (a, b) => { const r = el('div'), v = el('b', null, b); r.append(el('span', null, a), v); what.append(r); return v; };
    body.append(el('p', 'note', 'Your workers leave the buildings and fight raiders on the road. The buildings make nothing until they come back.'), what);
    const workers = row('Workers from', ''), lost = row('Goods lost', '');
    row('They fight for', span(ARMS.seconds));
    // the rest after a call, which counts down in its own row while it runs, so the sheet never shows two times for one wait
    // (review of 2026.11.23-6: "Call again after 5 min" beside "Ready again in 4 min")
    const restName = row('Rest after a call', '').previousSibling, rest = restName.nextSibling;
    const go = btn('Call to arms', 'btn primary buy', 'callArms'), state = el('p', 'uses');
    go.addEventListener('click', () => { callToArms(game, town); paint(); });
    body.append(state, go);
    const paint = () => {
      const n = militia(town).length, l = armsLoss(game, town), b = armsBlock(game, town);
      setText(workers, n === 1 ? '1 building' : n + ' buildings');
      setText(lost, 'About ' + fmt(l.coins) + ' coins');
      go.disabled = !!b;
      const waiting = b === 'wait';
      setText(restName, waiting ? 'Ready again in' : 'Rest after a call'); setText(rest, waiting ? clock(armsWait(town)) : span(ARMS.cooldown)); // the same clock as the To arms button (review of 2026.11.23-7)
      setText(state, b && !waiting ? armsLine(game, town) : ''); state.hidden = !b || waiting;
    };
    paint();
    let acc = 0;
    return dt => { if ((acc += dt) < .25) return; acc = 0; paint(); };
  };
}
const setText = (n, s) => { if (n.textContent !== s) n.textContent = s; };

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
      const row = el('div', 'seg'), opts = [['auto', 'Auto'], ['low', 'Low'], ['med', 'Medium'], ['high', 'High']];
      const paint = () => { for (const b of row.children) b.setAttribute('aria-pressed', String(b.dataset.q === view.quality)); };
      for (const [k, name] of opts) {
        const b = btn(name, 'btn small'); b.dataset.q = k;
        b.addEventListener('click', () => { view.setQuality(k); paint(); });
        row.append(b);
      }
      paint();
      sec('Graphics', row, el('p', 'uses', 'Low runs smoothest. High looks best.'));
    }

    // Sound: the Music and Sound sliders, and Voice where the device has its own voice to read the explainer cards
    // aloud (src/audio/speech.js), all kept on this device (src/audio/audio.js); Voice sits with the other volumes so
    // it reads as how loud (review of 2026.11.22-13: under Read aloud it could mean which voice)
    const audio = ctx.audio || (globalThis.CG && globalThis.CG.audio);
    if (audio) {
      const speech = ctx.speech || (globalThis.CG && globalThis.CG.speech), talk = !!speech && speech.available();
      const box = el('div', 'sliders');
      for (const [k, name] of [['music', 'Music'], ['sound', 'Sound'], ...(talk ? [['voice', 'Voice']] : [])]) {
        const row = el('label', 'slider'), inp = el('input'), val = el('span', 'val');
        inp.type = 'range'; inp.min = '0'; inp.max = '100'; inp.step = '5'; inp.id = k + 'Vol';
        inp.value = String(Math.round(audio.get(k) * 100));
        const show = () => { val.textContent = +inp.value ? inp.value + '%' : 'Off'; };
        inp.addEventListener('input', () => { if (k !== 'voice') audio.start(); audio.set(k, +inp.value / 100); show(); });
        if (k === 'sound') inp.addEventListener('change', () => audio.play('coin'));
        show(); row.append(el('span', 'name', name), inp, val); box.append(row);
      }
      sec('Volume', box);
      if (talk) {
        const read = btn('', 'btn small', 'readAloud');
        const paint = () => setSwitch(read, 'Read cards aloud', audio.get('read') ? 'On' : 'Off', !!audio.get('read'));
        read.addEventListener('click', () => { audio.set('read', !audio.get('read')); paint(); });
        paint();
        sec('Read aloud', read);
      }
    }

    // Save slots
    const slots = el('div', 'slots'), mine = activeSlot();
    let liveLine = null, liveText = null; // the playing slot's line follows the purse while the Menu is open (review of 2026.11.23-1)
    for (let n = 1; n <= SLOTS; n++) {
      // the slot in play shows the game as it is now, not its last save (review of 2026.11.19-8: 999K beside the top bar's 9.99M)
      const live = n === mine && game && game.town, s = live ? { n, town: game.active, wave: game.town.wave, coins: game.town.coins } : slotSummary(n), row = el('div', 'option slot'), txt = el('div');
      txt.append(el('b', null, 'Slot ' + n + (n === mine ? ' · playing' : '')),
        el('span', null, s.empty ? 'Empty' : s.damaged ? 'This save is damaged' : slotWords(s, live)));
      if (live) { liveLine = txt.lastChild; liveText = () => slotWords({ n, town: game.active, wave: game.town.wave, coins: game.town.coins }, true); }
      row.append(txt);
      if (n !== mine) {
        const go = btn(s.empty ? 'New game' : 'Play'); go.dataset.slot = n; go.classList.add('slotgo');
        go.addEventListener('click', () => leave('slot', n));
        row.append(go);
        if (!s.empty) { const del = btn('Delete'); del.dataset.del = n; confirmTap(del, 'Sure?', () => { clearSave(n); ctx.reopen(); }); row.append(del); }
      }
      slots.append(row);
    }
    sec('Save slots', slots);

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
    sec('More', r3, el('p', 'ver', 'Version ' + GAME_VERSION + ' · Free,\u00a0no\u00a0ads'));
    // repainted with the top bar (sync), so the two coin counts always match
    const tick = () => {}; tick.sync = () => { if (!liveLine) return; const t = liveText(); if (liveLine.textContent !== t) liveLine.textContent = t; };
    return tick;
  };
}
/* A save slot's line on the Menu: its place, wave and coins, and how long ago it was saved (not for the slot in play). */
export const slotWords = (s, live) => (TOWN_NAMES[s.town] || 'Town') + ' · Wave ' + s.wave + ' · ' + fmtLive(s.coins) + ' coins' + (live ? '' : ' · ' + ago(Date.now() - s.at));

/* The Charter's two plain lines on the Perks sheet (clarity fix 9): what signing takes and keeps, then what a deed does. */
export const charterWords = name => ({
  keep: name + ' starts over at wave 1 with no buildings, goods or research. You keep your coins, your deeds and your other towns.',
  deed: 'Each deed gives you ' + Math.round(DEEDS.income * 100) + '% more coins in every town, forever.',
});
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
    // what a charter is comes first, then what signing pays under its own small heading (review of 2026.11.20-8:
    // "Charter" and "deed" were not explained and the deed rows were hard to read)
    // two plain lines first (clarity fix 9, review 9: the rows alone were unreadable): what you lose and keep, then what a
    // deed does. Only a source that pays has a row, so no row reads "0 deeds" beside the one that pays.
    const cw = charterWords(town.def.name);
    const keepLine = el('p', 'uses', cw.keep); keepLine.id = 'charterKeep';
    const deedLine = el('p', 'uses', cw.deed); deedLine.id = 'charterDeed';
    const getHead = el('small', 'pairhead', 'Sign now and get');
    // the button beside Sign now and get, above what it pays (clarity fix 8b: pinned to the sheet's foot it covered the
    // rows in landscape, fresh-eyes read)
    const r = el('div', 'row signrow'); r.append(getHead, sign);
    sec('Charter', keepLine, deedLine, now, r, prog, next);
    // the deeds held, and after signing
    const held = el('div', 'explain why'); held.id = 'deedsHeld';
    const have = rowOf(held), after = rowOf(held); after.r.id = 'deedsAfter';
    sec('Deeds', held);
    // the perk pairs
    const pairs = el('div', 'goods perks'); body.append(pairs);
    let sig = '';
    const paint = () => {
      const p = deedParts(town), n = nextDeed(town), c = game.shared.charter;
      // what signing pays is in Deeds, as the deeds now and after (review of 2026.11.19-12); this line only says when it opens
      // one line says when the next deed comes: the first one opens the button, a later one is worth waiting for (fresh-eyes read of clarity fix 9)
      now.hidden = true;
      // "Best wave", so it never reads as the wave on the top bar after a lost boss (review of 2026.11.19-12)
      set(wave.l, 'Best wave ' + town.bestWave); /* "For": how deeds are earned (review of 2026.11.20-7) */ set(wave.v, plural(p.wave, 'deed'));
      set(coins.l, fmt(town.ownEarned) + ' coins earned here'); set(coins.v, plural(p.coins, 'deed'));
      wave.r.hidden = !p.wave; coins.r.hidden = !p.coins; getHead.hidden = prog.hidden = !p.total;
      set(next, (p.total ? 'Wait for wave ' + n.wave + ' or ' + fmt(n.coins) + ' coins earned here to get 1 more deed.' : 'You can sign at wave ' + n.wave + ' or at ' + fmt(n.coins) + ' coins earned here.'));
      sign.disabled = !p.total;
      const more = d => plural(d, 'deed') + ' · ' + Math.round(DEEDS.income * 100 * d) + '% more coins'; // review of 2026.11.20-13: "2 deeds, 50% more coins" ran on
      set(have.l, 'You have'); set(have.v, c.deeds ? more(c.deeds) : 'No deeds yet');
      const t = c.deeds + p.total;
      set(after.l, 'After signing'); set(after.v, p.total ? Math.round(DEEDS.income * 100 * t) + '% more coins' : ''); // the coins only: the deeds signing pays are listed just above (review of 2026.11.20-15: the deed count said twice)
      after.r.hidden = !p.total || !c.deeds; // with no deeds yet it only says the deed line times the deeds above (clarity fix 9)
      // what a deed gives is said once, in the Charter's second line (review of 2026.11.20-12, clarity fix 9)
      const s = c.deeds + JSON.stringify(c.perks);
      if (s === sig) return;
      sig = s; pairs.replaceChildren();
      // only the next locked pair, so a new player meets one perk at a time (review of 2026.11.20-10: Charter, Deeds and
      // perks all arrived on one card)
      let shownLocked = 0;
      for (const pair of PERKS) {
        const st = perkState(game, pair.id), box = el('div', 'pair'); box.dataset.pair = pair.id;
        if (st === 'locked' && shownLocked++) continue;
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
