/* Slide-up sheets over the town: one at a time, with a dimmed backdrop that closes it when tapped.
     Goods: what the town has in stock, what each good sells for now, and a Selling or Holding switch per good.
     Research: the town's research items, their next level's price and wait, and the one running.
     Perks: the town's charter (deeds it would pay now, what earns the next one, Sign), the deeds held, the perk pairs.
     Menu: Graphics, Install, save slots, copying the save out and loading one in, the help cards, the title screen.
   Every word here follows the owner's writing rule (PLAN.md): plain, short, no colons or semicolons. */
import { GOODS } from '../data/goods.js';
import { BUILDINGS } from '../data/buildings.js';
import { price, saturation } from '../core/market.js';
import { encode } from '../core/save.js';
import { loadGame } from '../core/setup.js';
import { SLOTS, activeSlot, slotSummary, importText, clearSave } from './storage.js';
import { installButton } from './install.js';
import { checkUpdates } from './update.js';
import { GAME_VERSION } from '../version.js';
import { fmt, ago } from './format.js';
import { RESEARCH } from '../data/research.js';
import { itemsOf, researchLevel, researchCost, researchTime, researchBlock, startResearch } from '../core/research.js';
import { PERKS, DEEDS } from '../data/perks.js';
import { deedParts, nextDeed, signCharter, pickPerk, perkState } from '../core/charter.js';

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const btn = (text, cls = 'btn small', id) => { const b = el('button', cls, text); if (id) b.id = id; return b; };
const TOWN_NAMES = { gulch: 'Copper Gulch' };

/* A sheet: build(body) fills it; frame(dt) (optional, returned by build) runs while it is open. */
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
  };
  x.addEventListener('click', api.close); back.addEventListener('click', api.close);
  return api;
}

/* The Goods sheet. A good shows once its building is built. */
export function goodsSheet(game, town) {
  return body => {
    const list = el('div', 'goods'), rows = {};
    body.append(el('p', 'uses', 'Sell lots of one thing and its price drops. The price comes back over time.'), list);
    const shown = () => Object.entries(BUILDINGS).filter(([id, b]) => b.town === town.id && town.level(id) > 0).map(([, b]) => b.makes);
    let sig = '';
    const build = () => {
      const goods = shown(); sig = goods.join();
      list.replaceChildren();
      if (!goods.length) list.append(el('p', 'uses', 'Build a Lumber Camp to make your first good.'));
      for (const g of goods) {
        const row = el('div', 'option good'), txt = el('div'), name = el('b', null, GOODS[g].name), line = el('span'), bar = el('i', 'depth'), fill = el('i');
        bar.append(fill); bar.title = 'How much the price has dropped';
        txt.append(name, line, bar);
        const sw = btn('', 'btn small'); sw.dataset.good = g;
        sw.addEventListener('click', () => { if (town.sell[g] !== false) town.sell[g] = false; else delete town.sell[g]; paint(); });
        row.append(txt, sw); list.append(row);
        rows[g] = { line, fill, sw };
      }
      paint();
    };
    const paint = () => {
      for (const [g, r] of Object.entries(rows)) {
        const kept = Math.ceil((town.keep || {})[g] || 0);
        const selling = town.sell[g] !== false, txt = fmt(town.goods[g] || 0) + ' in stock' + (kept && selling ? ' · ' + kept + ' saved for towers' : '') + ' · sells for ' + fmt(price(game, town, g)) + ' coins each';
        if (r.line.textContent !== txt) r.line.textContent = txt;
        const w = Math.round(100 * saturation(game, g)) + '%'; if (r.fill.style.width !== w) r.fill.style.width = w;
        const s = selling ? 'Selling' : 'Holding'; if (r.sw.textContent !== s) r.sw.textContent = s;
        r.sw.setAttribute('aria-pressed', String(selling)); r.sw.classList.toggle('on', !selling);
      }
    };
    build();
    let acc = 0;
    return dt => { if ((acc += dt) < .3) return; acc = 0; if (shown().join() !== sig) build(); else paint(); };
  };
}

/* Seconds in words: "40 seconds", "3 minutes". */
export const wait = s => s < 90 ? Math.max(1, Math.ceil(s)) + ' seconds' : Math.round(s / 60) + ' minutes';

/* The Research sheet: one row per item, with its next level's price and wait, and a bar on the one running. */
export function researchSheet(game, town) {
  return body => {
    const list = el('div', 'goods research'), rows = {};
    body.append(list);
    for (const id of itemsOf(town)) {
      const r = RESEARCH[id], row = el('div', 'option'), txt = el('div');
      const name = el('b'), info = el('small'), bar = el('i', 'depth'), fill = el('i');
      bar.append(fill); txt.append(name, el('span', null, r.about));
      if (r.worse) txt.append(el('span', 'worse', r.worse));
      txt.append(info, bar);
      const go = btn('Research', 'btn small build'); go.dataset.research = id;
      go.addEventListener('click', () => { if (startResearch(game, town, id)) paint(); });
      row.append(txt, go); list.append(row);
      rows[id] = { row, name, info, bar, fill, go };
    }
    const paint = () => {
      for (const [id, x] of Object.entries(rows)) {
        const r = RESEARCH[id], L = researchLevel(town, id), lab = town.lab && town.lab.id === id ? town.lab : null, block = researchBlock(town, id);
        const n = r.name; if (x.name.textContent !== n) x.name.textContent = n;
        const info = lab ? 'Level ' + (L + 1) + ' ready in ' + wait(lab.left)
          : block === 'max' ? 'All ' + r.max + ' levels done'
          : 'Next level ' + (L + 1) + ' of ' + r.max + ' · ' + fmt(researchCost(town, id)) + ' coins · ' + wait(researchTime(town, id));
        if (x.info.textContent !== info) x.info.textContent = info;
        x.bar.hidden = !lab;
        if (lab) { const w = Math.round(100 * (1 - lab.left / lab.total)) + '%'; if (x.fill.style.width !== w) x.fill.style.width = w; }
        const label = lab ? 'Working' : block === 'max' ? 'Done' : block === 'busy' ? 'Busy' : 'Research';
        if (x.go.textContent !== label) x.go.textContent = label;
        x.go.disabled = !!block; x.row.classList.toggle('running', !!lab);
      }
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
      sec('Graphics', row, el('p', 'uses', 'Low runs smoothest. High looks best. Auto picks the best one for your phone.'));
    }

    // Save slots
    const slots = el('div', 'slots'), mine = activeSlot();
    for (let n = 1; n <= SLOTS; n++) {
      const s = slotSummary(n), row = el('div', 'option slot'), txt = el('div');
      txt.append(el('b', null, 'Slot ' + n + (n === mine ? ' · playing' : '')),
        el('span', null, s.empty ? 'Empty' : s.damaged ? 'This save is damaged' : (TOWN_NAMES[s.town] || 'Town') + ' · wave ' + s.wave + ' · ' + fmt(s.coins) + ' coins · ' + ago(Date.now() - s.at)));
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
    const now = el('p', 'uses'), wave = el('span'), coins = el('span'), sign = btn('Sign the charter', 'btn primary', 'signCharter');
    const prog = el('div', 'option charterline'), pt = el('div'); pt.append(wave, coins); prog.append(pt);
    confirmTap(sign, 'Tap again to sign', () => { if (signCharter(game, town) > 0) leave('charter'); });
    const r = el('div', 'row'); r.append(sign);
    sec('Charter', now, prog, el('p', 'warn', 'Signing starts this town over from wave 1. You lose its buildings, towers, research and foremen, and you pick your perks again.'), r);
    // the deeds held
    const held = el('p', 'uses'); held.id = 'deedsHeld';
    sec('Deeds', held);
    // the perk pairs
    const pairs = el('div', 'goods perks'); body.append(pairs);
    let sig = '';
    const paint = () => {
      const p = deedParts(town), n = nextDeed(town), c = game.shared.charter;
      const t1 = p.total ? 'Sign now to get ' + plural(p.total, (c.deeds ? 'more ' : '') + 'deed') + '.' : 'Earn a deed to sign the charter.';
      if (now.textContent !== t1) now.textContent = t1;
      const w = 'Best wave ' + town.bestWave + ' · next deed at wave ' + n.wave, k = 'Coins earned ' + fmt(town.lifetime) + ' · next deed at ' + fmt(n.coins) + ' coins';
      if (wave.textContent !== w) wave.textContent = w;
      if (coins.textContent !== k) coins.textContent = k;
      sign.disabled = !p.total;
      const h = c.deeds ? 'You hold ' + plural(c.deeds, 'deed') + '. They add ' + Math.round(c.deeds * DEEDS.income * 100) + '% to all the coins you earn.'
        : 'Deeds stay with you for good. Each one adds ' + Math.round(DEEDS.income * 100) + '% to all the coins you earn.';
      if (held.textContent !== h) held.textContent = h;
      const s = c.deeds + JSON.stringify(c.perks);
      if (s === sig) return;
      sig = s; pairs.replaceChildren();
      for (const pair of PERKS) {
        const st = perkState(game, pair.id), box = el('div', 'pair'); box.dataset.pair = pair.id;
        if (st === 'locked' || st === 'open') box.append(el('small', 'pairhead', st === 'locked' ? 'Needs ' + plural(pair.need, 'deed') : 'Pick one'));
        for (const side of ['a', 'b']) {
          const x = pair[side], row = el('div', 'option'), txt = el('div');
          txt.append(el('b', null, x.name), el('span', null, x.about)); row.append(txt);
          if (st === 'open') {
            const go = btn('Pick', 'btn small build'); go.dataset.perk = pair.id + ':' + side;
            confirmTap(go, 'Tap again', () => { if (pickPerk(game, pair.id, side)) paint(); });
            row.append(go);
          } else if (st === side) { row.classList.add('running'); row.append(el('small', 'picked', 'Picked')); }
          else if (st !== 'locked') { row.classList.add('off'); row.append(el('small', 'picked', 'Not picked')); }
          else row.classList.add('off');
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
