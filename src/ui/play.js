/* The play screen over the board: the coin bar, a tag over every plot, and the building card that slides up when a
   plot is tapped (build, upgrade, what it makes and why, and whether its good is sold). The phone shell box grows
   this into the full HUD with tabs and sheets. */
import { BUILDINGS } from '../data/buildings.js';
import { GOODS } from '../data/goods.js';
import { build, cost, output, explainOutput, missing, unlocked } from '../core/economy.js';
import { price } from '../core/market.js';

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const SUFFIX = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi'];
export function fmt(n) {
  if (!isFinite(n)) return '0';
  const a = Math.abs(n);
  if (a < 10) return (Math.round(n * 10) / 10).toString();
  if (a < 1000) return Math.floor(n).toString();
  const i = Math.min(SUFFIX.length - 1, Math.floor(Math.log10(a) / 3)), v = n / 10 ** (i * 3);
  return (v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : Math.floor(v).toString()) + SUFFIX[i];
}
const rate = n => fmt(n) + '/s';

export function mountPlay(root, game, viewApi) {
  const town = game.town, ui = el('section', 'play'); ui.id = 'play-ui';
  // the coin bar
  const hud = el('header', 'hud');
  const coins = el('div', 'coins'); coins.id = 'coins';
  const coinIcon = el('span', 'coin'), coinNum = el('b'), inc = el('span', 'inc');
  coins.append(coinIcon, coinNum, inc);
  const name = el('div', 'townname', town.def.name);
  hud.append(name, coins);
  // tags over the plots
  const tags = el('div', 'tags'), tag = {};
  for (const id of Object.keys(town.def.board.plots)) { const t = el('button', 'tag'); t.dataset.plot = id; t.addEventListener('click', () => open(id)); tags.append(t); tag[id] = t; }
  // the building card
  const card = el('div', 'card'); card.id = 'card'; card.hidden = true;
  ui.append(tags, hud, card);
  root.append(ui);

  let openId = null, why = false;
  function open(id) { openId = id; why = false; card.hidden = false; paintCard(); }
  function close() { openId = null; card.hidden = true; }
  viewApi.onTap = id => { if (id) open(id); else close(); };

  // the card is rebuilt only when something on it changes, so a button is never swapped under a finger
  let sig = '';
  function paintCard(force = true) {
    if (!openId) return;
    const id = openId, b = BUILDINGS[id], L = town.level(id), g = GOODS[b.makes];
    const now = [id, L, why, cost(town, id), town.coins >= cost(town, id), !!town.starved[id], missing(town, id).length, town.sell[b.makes]].join();
    if (!force && now === sig) return;
    sig = now;
    card.replaceChildren();
    const head = el('div', 'cardhead');
    head.append(el('h2', null, b.name), el('span', 'lv', L ? 'Level ' + L : unlocked(town, id) ? 'Not built' : 'Locked'));
    const x = el('button', 'btn small close', 'Close'); x.addEventListener('click', close); head.append(x);
    card.append(head);
    const out = output(town, id) || b.rate;
    const line = el('button', 'stat');
    line.append(el('span', null, 'Makes ' + g.name.toLowerCase()), el('b', null, rate(out) + (L ? '' : ' at level 1')));
    line.addEventListener('click', () => { why = !why; paintCard(); });
    card.append(line);
    if (why && L) {
      const ex = el('div', 'explain');
      for (const p of explainOutput(town, id)) { const r = el('div'); r.append(el('span', null, p.source), el('b', null, '× ' + fmt(p.factor))); ex.append(r); }
      card.append(ex);
    }
    const ins = Object.entries(b.inputs);
    if (ins.length) card.append(el('p', 'uses', 'Uses ' + ins.map(([k, n]) => n + ' ' + GOODS[k].name.toLowerCase()).join(' + ') + ' for each.'));
    if (town.starved[id] && L) card.append(el('p', 'warn', 'Running short: build up its suppliers.'));
    const miss = missing(town, id);
    if (miss.length) card.append(el('p', 'warn', 'Needs ' + miss.map(m => BUILDINGS[m.id].name + ' level ' + m.level).join(' and ') + '.'));
    const row = el('div', 'row');
    const c = cost(town, id), buy = el('button', 'btn primary buy');
    buy.id = 'buy'; buy.textContent = (L ? 'Upgrade' : 'Build') + ' · ' + fmt(c);
    buy.disabled = !!miss.length || town.coins < c;
    buy.addEventListener('click', () => { if (build(game, town, id)) paintCard(); });
    row.append(buy);
    const selling = town.sell[b.makes] !== false, sell = el('button', 'btn small', (selling ? 'Selling ' : 'Holding ') + g.name.toLowerCase());
    sell.id = 'sell'; sell.setAttribute('aria-pressed', String(selling));
    sell.title = 'Price now ' + fmt(price(game, town, b.makes)) + ' each';
    sell.addEventListener('click', () => { if (selling) town.sell[b.makes] = false; else delete town.sell[b.makes]; paintCard(); });
    row.append(sell);
    card.append(row);
  }

  // income: coins earned over the last few seconds
  const hist = []; let acc = 0, cardAcc = 0;
  function frame(dt) {
    acc += dt; cardAcc += dt;
    for (const [id, t] of Object.entries(tag)) {
      const p = viewApi.project(id), L = town.level(id), un = unlocked(town, id);
      const flat = !p && document.documentElement.classList.contains('flat');
      if ((!p && !flat) || (!L && !un)) { t.hidden = true; continue; }
      t.hidden = false; if (p) t.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) translate(-50%, -100%)`;
      const txt = (flat ? BUILDINGS[id].name + ' · ' : '') + (L ? 'Lv ' + L : 'Build');
      if (t.textContent !== txt) t.textContent = txt;
      t.classList.toggle('short', !!(L && town.starved[id]));
      t.classList.toggle('can', town.coins >= cost(town, id));
    }
    if (acc < .2) return;
    acc = 0;
    hist.push([town.t, town.lifetime]); while (hist.length > 25) hist.shift();
    const [t0, l0] = hist[0], per = town.t > t0 ? (town.lifetime - l0) / (town.t - t0) : 0;
    coinNum.textContent = fmt(town.coins); inc.textContent = '+' + rate(per);
    if (cardAcc > .25 && openId) { cardAcc = 0; paintCard(false); }
  }
  return { frame, open, close, el: ui };
}

export function toast(text, ms = 4000) {
  const t = el('div', 'toast', text); t.setAttribute('role', 'status');
  document.body.append(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, ms);
}
