/* The empire map's screen (GDD.md, Empire map), over the 3D map (src/render/empire-view.js): the coins, Pause and a
   button back to the town in play; a badge under every site (its wave, its vault, what it earns, a pulsing dot when it
   needs you); and the card a tapped site opens, with Play to fly in. Words follow the writing rule in PLAN.md. */
import { TOWNS } from '../data/towns/index.js';
import { GOODS } from '../data/goods.js';
import { BUILDINGS } from '../data/buildings.js';
import { siteInfo, lockedRules, mapRoutes, makesOf } from '../core/map.js';
import { foundTown } from '../core/empire.js';
import { fmt, fmtLive } from './format.js';
import { lostLine, lostToast } from './lost.js';

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const setText = (n, s) => { if (n.textContent !== s) n.textContent = s; };
const nameOf = id => id === 'capital' ? 'The Capital' : TOWNS[id].name;
const shortOf = id => id === 'capital' ? 'Capital' : TOWNS[id].short || TOWNS[id].name;
const rate = n => '+' + fmt(n) + '/s';
/* "a, b and c" */
const list = xs => xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1];
const goodsLower = gs => list(gs.map(g => GOODS[g].name.toLowerCase()));

/* A rule a town not open yet has, in words; the badge gets the short form. */
function ruleText(game, r, short = false) {
  if (r.kind === 'wave') return (short ? 'Wave ' : 'Beat wave ') + r.wave + ' in ' + shortOf(r.town);
  if (r.kind === 'coins') return fmt(r.coins) + ' coins';
  if (r.kind === 'with') return short ? 'Opens with ' + shortOf(r.town) : 'It opens when you start ' + nameOf(r.town) + '.';
  if (r.kind === 'win') return short ? 'Win ' + shortOf(r.town) : 'It opens when you win ' + nameOf(r.town) + '.';
  return short ? 'Coming later' : 'The Capital will be built here.';
}

/* shell: { meter, play(id) (fly into a town), back() (fly into the town in play), toast(text) } */
export function mountMap(root, game, view, shell) {
  // a town that loses while the player is on the map holds its waves: say so here too (owner rule, 2026-11-17)
  const offLost = game.bus.on('breach', e => { if (e.held && !game.catching && game.towns[e.town] && shell.toast) shell.toast(lostToast(game.towns[e.town], false), 6000); });
  const ui = el('section', 'play mapui'); ui.id = 'map-ui';
  const hud = el('header', 'hud');
  const title = el('div', 'townname', 'Map');
  const ctl = el('div', 'hudrow');
  const back = el('button', 'btn small', ''); back.id = 'mapBack';
  const pause = el('button', 'btn small', 'Pause'); pause.id = 'pauseBtn';
  ctl.append(back, pause);
  const left = el('div', 'hudleft'); left.append(title, ctl);
  const coins = el('div', 'coins'); coins.id = 'coins'; coins.setAttribute('role', 'button'); coins.tabIndex = 0;
  const coinNum = el('b'), inc = el('span', 'inc'); coins.append(el('span', 'coin'), coinNum, inc);
  const right = el('div', 'hudright'); right.append(coins);
  hud.append(left, right);
  const banner = el('div', 'pausedbanner', 'Paused'); banner.id = 'pausedBanner'; banner.hidden = true;
  const badges = el('div', 'tags'); badges.id = 'mapBadges';
  const card = el('div', 'card'); card.id = 'mapCard'; card.hidden = true;
  ui.append(badges, hud, card, banner);
  root.append(ui);

  back.addEventListener('click', () => shell.back());
  const paintPause = () => { const p = view.holds.has('player'); setText(pause, p ? 'Resume' : 'Pause'); pause.setAttribute('aria-pressed', String(p)); banner.hidden = !p; };
  pause.addEventListener('click', () => { view.pause('player', !view.holds.has('player')); paintPause(); });

  // a badge per site
  const badge = {};
  for (const s of view.sites) {
    const b = el('button', 'mapbadge'); b.dataset.site = s.id;
    const nm = el('b', '', shortOf(s.id)), line = el('span', 'mline'), vault = el('span', 'vault'), fill = el('i'), extra = el('span', 'minc');
    vault.append(fill);
    b.append(nm, line, extra);
    b.addEventListener('click', () => openSite(s.id));
    badges.append(b);
    badge[s.id] = { b, line, vault, fill, extra, wave: el('span') };
    badge[s.id].line.append(badge[s.id].wave, vault);
  }

  let openId = null, cardAcc = 0, acc = 1, lastTap = { id: null, t: 0 };
  function openSite(id) {
    if (!id) { close(); return; }
    const now = performance.now();
    // a second tap on the same open town flies in
    if (lastTap.id === id && now - lastTap.t < 450 && game.towns[id]) { lastTap.id = null; shell.play(id); return; }
    lastTap = { id, t: now };
    openId = id; card.hidden = false; card.dataset.site = id; paintCard();
    view.select(id === 'income' ? null : id); acc = 1;
  }
  function close() { view.select(null); openId = null; card.hidden = true; card.replaceChildren(); delete card.dataset.site; delete card.dataset.sig; }
  const head = (text, sub) => { const h = el('div', 'cardhead'), x = el('button', 'btn small', 'Close'); x.id = 'mapClose'; x.addEventListener('click', close); h.append(el('h2', '', text)); if (sub) h.append(el('span', 'lv', sub)); h.append(x); return h; };
  const stat = (label, value, cls = '') => { const r = el('div', 'stat static ' + cls); r.append(el('span', '', label), el('b', '', value)); return r; };
  function paintCard() {
    const id = openId;
    if (!id) return;
    const kids = [];
    if (id === 'income') {
      kids.push(head('Income'));
      const rows = Object.keys(game.towns).map(t => [t, shell.meter ? shell.meter.income[t] || 0 : 0]).sort((a, b) => b[1] - a[1]);
      const box = el('div', 'explain why');
      for (const [t, n] of rows) { const r = el('div'); r.append(el('span', '', nameOf(t)), el('b', '', rate(n))); box.append(r); }
      const tot = el('div', 'total'); tot.append(el('span', '', 'All your towns'), el('b', '', rate(shell.meter ? shell.meter.total : 0))); box.append(tot);
      kids.push(box);
    } else if (game.towns[id]) {
      const t = game.towns[id], info = siteInfo(game, id, shell.meter), d = TOWNS[id];
      kids.push(head(d.name, info.inPlay ? 'Playing now' : ''));
      const store = d.store === 'stockpile' ? 'Stockpile' : 'Vault';
      const grid = el('div', 'statgrid');
      grid.append(stat(info.won ? 'Won' : 'Wave', info.won ? 'Wave ' + info.wave : String(info.wave)), stat(store, Math.round(info.vault * 100) + '%', info.alert === 'vault' ? 'low' : ''), stat('Earns', rate(info.income)));
      kids.push(grid);
      const makes = makesOf(id).filter(g => (t.made && t.made[g] > 0) || t.goods[g] > 0);
      if (makes.length) kids.push(el('p', 'uses', 'Makes ' + goodsLower(makes) + '.'));
      for (const l of mapRoutes(game)) {
        if (l.from === id) kids.push(el('p', 'uses', 'Sends ' + goodsLower(l.goods) + ' to ' + shortOf(l.to) + '.'));
        if (l.to === id) kids.push(el('p', 'uses', 'Gets ' + goodsLower(l.goods) + ' from ' + shortOf(l.from) + '.'));
      }
      if (info.alert === 'lost') kids.push(el('p', 'warn', lostLine(t)));
      else if (info.alert === 'raided') kids.push(el('p', 'warn', 'Raiders broke into the ' + store.toLowerCase() + ' here while you were away.'));
      else if (info.alert === 'vault') kids.push(el('p', 'warn', 'The ' + store.toLowerCase() + ' is under half strength.'));
      else if (info.alert === 'short') {
        // a good shipped in from another town: say which building there to build or upgrade
        const g = info.needs, home = g && GOODS[g].town !== id && game.towns[GOODS[g].town], mk = home && home.def.buildings.find(b => BUILDINGS[b].makes === g);
        const fix = mk ? ' ' + (home.level(mk) ? 'Upgrade the ' : 'Build a ') + BUILDINGS[mk].name + ' in ' + shortOf(home.id) + '.' : '';
        kids.push(el('p', 'warn', 'The ' + BUILDINGS[info.short].name + (g ? ' needs more ' + GOODS[g].name.toLowerCase() + '.' + fix : ' is short of goods.')));
      }
      const row = el('div', 'row'), go = el('button', 'btn primary buy', (info.inPlay ? 'Back to ' : 'Play ') + shortOf(id)); go.id = 'mapPlay';
      go.addEventListener('click', () => shell.play(id));
      row.append(go); kids.push(row);
    } else {
      const lr = lockedRules(game, id);
      kids.push(head(nameOf(id), lr.ready ? 'Ready to start' : 'Not open yet'));
      if (id !== 'capital' && TOWNS[id].found) kids.push(el('p', 'uses', 'A town that makes ' + (TOWNS[id].makesText || goodsLower(makesOf(id))) + '.'));
      else if (id !== 'capital') kids.push(el('p', 'uses', 'An outpost that makes ' + goodsLower(makesOf(id)) + '.'));
      for (const r of lr.rules) {
        if (r.kind === 'wave' || r.kind === 'coins') {
          const from = game.towns[(TOWNS[id].found || {}).from];
          const have = r.kind === 'coins' ? fmt(from ? from.coins : 0) + ' / ' + fmt(r.coins) : 'Best ' + (from ? from.bestWave || 0 : 0);
          kids.push(stat(ruleText(game, r), r.done ? 'Done' : have, r.done ? 'done' : 'short'));
        } else kids.push(el('p', 'uses', ruleText(game, r)));
      }
      if (lr.ready) {
        const row = el('div', 'row'), go = el('button', 'btn primary buy', 'Start ' + TOWNS[id].name); go.id = 'mapFound';
        go.addEventListener('click', () => { if (foundTown(game, id)) { shell.toast(TOWNS[id].name + ' is open.'); shell.play(id); } });
        row.append(go); kids.push(row);
      }
    }
    // only rebuild when something on it changed, so a tap on its button is never lost to a repaint
    const sig = kids.map(k => k.textContent).join('|');
    if (sig !== card.dataset.sig) { card.dataset.sig = sig; card.replaceChildren(...kids); }
  }
  coins.addEventListener('click', () => openSite('income'));
  coins.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openSite('income'); });

  function paintBadges() {
    for (const s of view.sites) {
      const B = badge[s.id], info = siteInfo(game, s.id, shell.meter);
      B.b.classList.toggle('on', !!(info && info.inPlay));
      B.b.classList.toggle('locked', !info);
      if (info) {
        setText(B.wave, info.won ? 'Won' : 'Wave ' + info.wave);
        B.vault.hidden = false;
        const w = Math.round(info.vault * 100) + '%'; if (B.fill.style.width !== w) B.fill.style.width = w;
        B.fill.classList.toggle('low', info.alert === 'vault');
        setText(B.extra, info.alert === 'lost' ? 'On hold' : rate(info.income));
        B.b.classList.toggle('dot', !!info.alert);
      } else {
        const lr = lockedRules(game, s.id), next = lr.rules.find(r => !r.done) || lr.rules[0];
        setText(B.wave, lr.ready ? 'Ready to start' : next ? ruleText(game, next, true) : 'Not open yet');
        B.vault.hidden = true; setText(B.extra, '');
        B.b.classList.toggle('dot', lr.ready);
      }
    }
  }
  // badges sit above their towns, kept inside the screen (their widths are measured with the 4-a-second paint)
  const widths = {};
  function placeBadges() {
    const W = innerWidth, H = innerHeight;
    for (const s of view.sites) {
      const B = badge[s.id], p = view.badgePoint(s.id), w = widths[s.id] || 80;
      if (!p || p.x < -w || p.x > W + w || p.y < -40 || p.y > H + 40) { B.b.hidden = true; continue; }
      B.b.hidden = false;
      const x = Math.min(Math.max(p.x, w / 2 + 4), W - w / 2 - 4);
      const tr = `translate(${x.toFixed(1)}px, ${p.y.toFixed(1)}px) translate(-50%, -100%)`;
      if (B.b.style.transform !== tr) B.b.style.transform = tr;
    }
  }
  paintBadges(); paintPause(); setText(back, 'Back to ' + shortOf(game.active));
  return {
    el: ui, openSite, close,
    get current() { return openId; },
    frame(dt) {
      placeBadges();
      if ((acc += dt) >= .25) {
        acc = 0; paintBadges(); paintPause();
        for (const s of view.sites) if (!badge[s.id].b.hidden) widths[s.id] = badge[s.id].b.offsetWidth;
        const c = card.hidden ? null : card.getBoundingClientRect();
        view.setView(hud.getBoundingClientRect().bottom, c && { l: c.left, t: c.top, r: c.right, b: c.bottom });
        setText(coinNum, fmtLive(game.town.coins)); setText(inc, '+' + fmtLive(shell.meter ? shell.meter.total : 0) + '/s');
      }
      if (openId && (cardAcc += dt) > .5) { cardAcc = 0; paintCard(); }
    },
    destroy() { offLost(); ui.remove(); },
  };
}
