/* Slide-up sheets over the town: one at a time, with a dimmed backdrop that closes it when tapped.
     Goods: what the town has in stock, what each good sells for now, and a Selling or Holding switch per good.
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
    body.append(el('p', 'uses', 'Your town sells what it makes right away. Tap Selling to keep a good in stock instead. Prices drop when you sell a lot of one good and come back after a while.'), list);
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
        const selling = town.sell[g] !== false, txt = fmt(town.goods[g] || 0) + ' in stock · sells for ' + fmt(price(game, town, g)) + ' each';
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
      sec('Graphics', row, el('p', 'uses', 'Low runs smoothest. High looks best. Auto picks for your device and steps down if the game runs slow.'));
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
    sec('Save slots', el('p', 'uses', 'Each slot holds its own game. Your game saves by itself every few seconds.'), slots);

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
