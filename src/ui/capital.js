/* The Capital's card on the empire map (GDD.md, The Capital): Influence, then two tabs. Contracts: the contract running
   with how far along it is, and the board of offers with Take. Institutions (GDD.md, Institutions): each institution
   with Found (coins), then its next upgrade with Buy (Influence), every cost as have / need, red when short. The rows are built once for each set of contracts and only their words and bars
   change after that, so a tap on Take is never lost to a repaint. Words follow the writing rule in PLAN.md. */
import { GOODS } from '../data/goods.js';
import { TOWNS } from '../data/towns/index.js';
import { capitalOf, capitalOpen, canFoundCapital, foundCapital, takeContract, dropContract, spareRate } from '../core/capital.js';
import { CAPITAL_DEF } from '../data/capital.js';
import { INSTITUTIONS, boughtText } from '../data/institutions.js';
import { treeOf, founded, nodesOf, nextNode, nodeCost, foundCost, foundBlock, nodeBlock, foundInstitution, buyNode, influenceFor } from '../core/tree.js';
import { fmt } from './format.js';

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const setText = (n, s) => { if (n.textContent !== s) n.textContent = s; };
const lower = g => GOODS[g].name.toLowerCase();
const townName = id => (TOWNS[id] && (TOWNS[id].short || TOWNS[id].name)) || id;
const pays = (game, o) => 'Pays ' + fmt(o.coins) + ' coins and ' + influenceFor(game, o.influence) + ' Influence';
/* The tab the card shows; kept while the card is rebuilt. */
let tab = 'contracts';
export const capitalTab = t => { if (t) tab = t; return tab; };
/* About how long the rest takes at the town's spare rate now, in words. */
function eta(game, o) {
  const t = game.towns[o.town], r = t ? spareRate(game, t, o.good) : 0, left = Math.max(0, o.need - o.got);
  if (!(r > 1e-6)) return 'Waiting. ' + townName(o.town) + ' has no spare ' + lower(o.good) + '. Make more ' + lower(o.good) + ' there.';
  const m = left / r / 60;
  return m < 1 ? 'Under a minute' : 'About ' + Math.round(m) + ' min';
}

/* The toast when a contract is full. */
export const contractDone = e => GOODS[e.good].name + ' delivered. You got ' + fmt(e.coins) + ' coins and ' + e.influence + ' Influence.';

/* Two taps for something that throws work away: the first changes the label, the second does it. */
function confirmTap(b, ask, go) {
  const label = b.textContent; let armed = 0;
  b.addEventListener('click', () => {
    if (armed && Date.now() - armed < 4000) { armed = 0; b.textContent = label; b.classList.remove('arm'); go(); return; }
    armed = Date.now(); b.textContent = ask; b.classList.add('arm');
    setTimeout(() => { if (armed && Date.now() - armed >= 4000) { armed = 0; b.textContent = label; b.classList.remove('arm'); } }, 4100);
  });
}

/* The card's body. sig() changes when a contract is taken, done or dropped (then the card builds a new one). */
export function capitalPanel(game, { changed = () => {}, toast = () => {} } = {}) {
  const c = capitalOf(game), box = el('div', 'capital');
  const inf = el('div', 'stat static'), infN = el('b');
  inf.append(el('span', '', 'Influence'), infN); box.append(inf);
  const tabs = el('div', 'captabs');
  for (const [id, label] of [['contracts', 'Contracts'], ['institutions', 'Institutions']]) {
    const b = el('button', 'btn small', label); b.id = id === 'contracts' ? 'capTabContracts' : 'capTabInst';
    b.setAttribute('aria-pressed', String(tab === id));
    b.addEventListener('click', () => { if (tab !== id) { tab = id; changed(); } });
    tabs.append(b);
  }
  box.append(tabs);
  const live = [];
  const paint = () => { setText(infN, fmt(c.influence)); for (const f of live) f(); };
  const treeSig = () => treeOf(game).founded.join(',') + ':' + INSTITUTIONS.map(i => nodesOf(game, i.id)).join(',');
  if (tab === 'institutions') {
    box.append(institutions(game, live, changed, toast));
    paint();
    return { el: box, paint, sig: () => 'i|' + treeSig() };
  }
  const a = c.active;
  if (a) {
    box.append(el('h3', '', 'Working on'));
    const row = el('div', 'option running'), txt = el('div'), name = el('b', '', fmt(a.need) + ' ' + lower(a.good) + ' from ' + townName(a.town));
    const got = el('small'), bar = el('i', 'depth'), fill = el('i'), when = el('span');
    bar.append(fill); txt.append(name, el('span', '', pays(game, a)), got, bar, when);
    const drop = el('button', 'btn small', 'Drop'); drop.id = 'contractDrop';
    confirmTap(drop, 'Tap again', () => { if (dropContract(game)) changed(); });
    row.append(txt, drop); box.append(row);
    live.push(() => {
      setText(got, 'Sent ' + fmt(Math.floor(a.got)) + ' of ' + fmt(a.need)); // the map label's words
      const w = Math.round(100 * Math.min(1, a.got / a.need)) + '%'; if (fill.style.width !== w) fill.style.width = w;
      setText(when, eta(game, a));
    });
  } else box.append(el('p', 'uses', 'No contract running.')); // a state, not a how-to in warning red (review of 2026.11.19-10)
  box.append(el('h3', '', 'Contracts'));
  const list = el('div', 'goods research');
  if (!c.offers.length) list.append(el('p', 'uses', 'No contracts right now. Build more workshops in your towns.'));
  for (const o of c.offers) {
    const row = el('div', 'option'), txt = el('div'), when = el('small');
    txt.append(el('b', '', fmt(o.need) + ' ' + lower(o.good) + ' from ' + townName(o.town)), el('span', '', pays(game, o)), when);
    const take = el('button', 'btn small build', a ? 'Switch' : 'Take'); take.dataset.contract = o.id;
    const go = () => { if (takeContract(game, o.id)) changed(); };
    if (a) confirmTap(take, 'Tap again', go); else take.addEventListener('click', go);
    row.append(txt, take); list.append(row);
    live.push(() => setText(when, eta(game, o)));
  }
  box.append(list);
  paint();
  return { el: box, paint, sig: () => 'c|' + (c.active ? c.active.id : 0) + '|' + c.offers.map(o => o.id).join(',') };
}

/* "12 / 35 Influence", red when short. */
function cost(small, have, need, unit) { setText(small, fmt(Math.floor(have)) + ' / ' + fmt(need) + ' ' + unit); small.classList.toggle('short', have + 1e-9 < need); }

/* The Institutions tab: one row per institution. Not founded, what it does and Found. Founded, how many upgrades it has
   and the next one with Buy. */
function institutions(game, live, changed, toast) {
  const list = el('div', 'goods research');
  for (const inst of INSTITUTIONS) {
    const row = el('div', 'option'), txt = el('div'), small = el('small');
    if (!founded(game, inst.id)) {
      txt.append(el('b', '', inst.name), el('span', '', inst.about), small);
      const b = el('button', 'btn small build', 'Build'); b.dataset.found = inst.id;
      b.addEventListener('click', () => { if (foundInstitution(game, inst.id)) { toast(inst.name + ' is built. Buy its upgrades with Influence.', 4000); changed(); } });
      row.append(txt, b);
      live.push(() => { cost(small, game.shared.purse.coins, foundCost(game), 'coins'); b.disabled = foundBlock(game, inst.id) !== null; });
    } else {
      const n = nodesOf(game, inst.id), node = nextNode(game, inst.id);
      txt.append(el('b', '', inst.name + ' · ' + n + ' of ' + inst.nodes.length + ' bought'));
      if (n) txt.append(el('span', '', 'Now · ' + boughtText(inst, n))); // what was bought stays on the card (review of 2026.11.19-11)
      if (!node) { txt.append(el('span', '', 'All upgrades bought.')); row.append(txt); row.classList.add('off'); }
      else {
        txt.append(el('span', '', 'Next · ' + node.about), small);
        const b = el('button', 'btn small build', 'Buy'); b.dataset.node = inst.id;
        b.addEventListener('click', () => { if (buyNode(game, inst.id)) { toast(inst.name + ' upgrade bought. ' + node.about, 4000); changed(); } });
        row.append(txt, b);
        live.push(() => { cost(small, game.shared.capital.influence, nodeCost(game, inst.id), 'Influence'); b.disabled = nodeBlock(game, inst.id) !== null; });
      }
    }
    list.append(row);
  }
  return list;
}

/* The Capital as a sheet, for a device that cannot draw the map (Places): before it is built, what it takes and Build;
   after, the same body as the map card. */
export function capitalSheet(game, toast = () => {}) {
  return body => {
    let panel = null, sig = '';
    const f = CAPITAL_DEF.found, wave = el('p', 'uses'), coins = el('p', 'uses'), b = el('button', 'btn primary buy', 'Build the Capital');
    b.id = 'foundCapital';
    b.addEventListener('click', () => { if (foundCapital(game)) paint(); }); // the sheet itself shows it is built, no toast
    const paint = () => {
      if (!capitalOpen(game)) {
        if (sig !== 'locked') { sig = 'locked'; const row = el('div', 'row'); row.append(b); body.replaceChildren(el('p', 'uses', 'Send goods here for coins and Influence. Spend Influence on upgrades for every town.'), wave, coins, row); }
        const t = game.towns[f.from], w = t ? t.bestWave || 0 : 0, c = t ? t.coins : 0;
        setText(wave, 'Beat wave ' + f.wave + ' in ' + townName(f.from) + (w >= f.wave ? ' · Done' : ' · Best so far ' + w));
        setText(coins, fmt(f.coins) + ' coins' + (c >= f.coins ? ' · Done' : ' · You have ' + fmt(c)));
        b.disabled = !canFoundCapital(game);
        return;
      }
      if (!panel || 'open|' + panel.sig() !== sig) { panel = capitalPanel(game, { changed: () => { panel = null; paint(); }, toast }); sig = 'open|' + panel.sig(); body.replaceChildren(panel.el); }
      panel.paint();
    };
    paint();
    let acc = 0;
    return dt => { if ((acc += dt) < .3) return; acc = 0; paint(); };
  };
}
