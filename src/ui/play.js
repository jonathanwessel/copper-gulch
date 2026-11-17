/* The play screen over the board: the coin bar, a tag over every plot, and the building card that slides up when a
   plot is tapped (build, upgrade, what it makes and why, and whether its good is sold). The phone shell box grows
   this into the full HUD with tabs and sheets. */
import { BUILDINGS } from '../data/buildings.js';
import { GOODS } from '../data/goods.js';
import { build, cost, output, explainOutput, missing, unlocked } from '../core/economy.js';
import { price } from '../core/market.js';
import { TOWERS, PATHS, PATH_LEVEL, SELL_BACK } from '../data/towers.js';
import { buildTower, upgradeTower, sellTower, towerCost, towerStats, towerAt, canPay, callEarly, setHold } from '../core/defense.js';
import { WAVE_TYPES } from '../data/foes.js';
import { createSheets, goodsSheet, menuSheet } from './sheets.js';

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
import { fmt } from './format.js';
export { fmt };
const rate = n => fmt(n) + '/s';

export function mountPlay(root, game, viewApi, shell = {}) {
  const town = game.town, ui = el('section', 'play'); ui.id = 'play-ui';
  // the coin bar
  const hud = el('header', 'hud');
  const coins = el('div', 'coins'); coins.id = 'coins';
  const coinIcon = el('span', 'coin'), coinNum = el('b'), inc = el('span', 'inc');
  coins.append(coinIcon, coinNum, inc);
  const name = el('div', 'townname', town.def.name);
  // the wave: its number, the vault's strength, and the countdown with a button to call it early
  const wave = el('div', 'wave'); wave.id = 'wave';
  const waveNum = el('b'), vault = el('span', 'vault'), vaultFill = el('i'), waveInfo = el('span', 'winfo');
  vault.append(vaultFill); vault.title = 'Vault strength';
  const call = el('button', 'btn small call', 'Call now'); call.id = 'callWave';
  call.addEventListener('click', () => { const b = callEarly(game, town); if (b > 0) toast('Wave called early. You got ' + fmt(b) + ' bonus coins.', 2500); });
  wave.append(waveNum, vault, waveInfo, call);
  // Pause stops the whole game; Hold waves keeps the town working but the next wave waits
  const ctl = el('div', 'hudrow');
  const pause = el('button', 'btn small', 'Pause'); pause.id = 'pauseBtn';
  const hold = el('button', 'btn small', 'Hold waves'); hold.id = 'holdWaves';
  // only touch the page when something changed (rewriting the same text still costs a layout)
  const setText = (n, s) => { if (n.textContent !== s) n.textContent = s; };
  let ctlSig = '';
  const paintCtl = () => {
    const p = viewApi.paused(), h = !!town.waves.hold, sig = p + ',' + h;
    if (sig === ctlSig) return; ctlSig = sig;
    setText(pause, p ? 'Resume' : 'Pause'); pause.setAttribute('aria-pressed', String(p)); banner.hidden = !p;
    setText(hold, h ? 'Waves held' : 'Hold waves'); hold.setAttribute('aria-pressed', String(h)); hold.classList.toggle('on', h);
  };
  pause.addEventListener('click', () => { viewApi.pause(!viewApi.paused()); paintCtl(); });
  hold.addEventListener('click', () => { setHold(game, town, !town.waves.hold); paintCtl(); });
  ctl.append(pause, hold);
  const banner = el('div', 'pausedbanner', 'Paused'); banner.id = 'pausedBanner'; banner.hidden = true;
  const left = el('div', 'hudleft'); left.append(name, wave, ctl);
  // side buttons under the coins: Goods and Menu open slide-up sheets
  const side = el('div', 'side');
  const goodsBtn = el('button', 'btn small', 'Goods'); goodsBtn.id = 'goodsBtn';
  const menuBtn = el('button', 'btn small', 'Menu'); menuBtn.id = 'menuBtn';
  side.append(goodsBtn, menuBtn);
  const right = el('div', 'hudright'); right.append(coins, side);
  hud.append(left, right);
  // tags over the plots
  const tags = el('div', 'tags'), tag = {};
  for (const id of Object.keys(town.def.board.plots)) { const t = el('button', 'tag'); t.dataset.plot = id; t.addEventListener('click', () => open(id)); tags.append(t); tag[id] = t; }
  // tower spots get tags only in the list view (no 3D); on the board their stone pads are tapped
  const spotTags = town.def.board.spots.map((_, i) => { const t = el('button', 'tag spot'); t.hidden = true; t.addEventListener('click', () => openSpot(i)); tags.append(t); return t; });
  // the building card
  const card = el('div', 'card'); card.id = 'card'; card.hidden = true;
  ui.append(tags, hud, card, banner);
  root.append(ui);
  const sheets = createSheets(ui, { onOpen: () => close() });
  const openGoods = () => sheets.open('goods', 'Goods', goodsSheet(game, town));
  const menuCtx = { game, view: shell.view || null, toast, leave: shell.leave || (() => {}), onHelp: shell.onHelp || (() => {}), reopen: () => openMenu() };
  const openMenu = () => sheets.open('menu', 'Menu', menuSheet(menuCtx));
  goodsBtn.addEventListener('click', openGoods); menuBtn.addEventListener('click', openMenu);

  let openId = null, why = false;
  function open(id) {
    if (sheets.current) sheets.close();
    openId = id; why = false; card.hidden = false; paintCard();
    viewApi.select(id.startsWith('spot:') ? { spot: +id.slice(5) } : { plot: id }); // highlight it on the board while the card is open
  }
  function openSpot(i) { open('spot:' + i); }
  function close() { openId = null; card.hidden = true; viewApi.select(null); }
  viewApi.onTap = hit => { if (hit && hit.plot) open(hit.plot); else if (hit && hit.spot !== undefined) openSpot(hit.spot); else close(); };

  // the card is rebuilt only when something on it changes, so a button is never swapped under a finger
  let sig = '';
  function paintCard(force = true) {
    if (!openId) return;
    if (openId.startsWith('spot:')) return paintSpot(+openId.slice(5), force);
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
    if (ins.length) card.append(el('p', 'uses', 'Each one uses ' + ins.map(([k, n]) => n + ' ' + GOODS[k].name.toLowerCase()).join(' and ') + '.'));
    if (town.starved[id] && L) card.append(el('p', 'warn', 'It ran out of materials. Upgrade the building that supplies it.'));
    const miss = missing(town, id);
    if (miss.length) card.append(el('p', 'warn', 'Unlocks when ' + miss.map(m => 'the ' + BUILDINGS[m.id].name + ' reaches level ' + m.level).join(' and ') + '.'));
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

  const costText = c => [fmt(c.coins) + ' coins', ...Object.entries(c.goods).map(([g, n]) => n + ' ' + GOODS[g].name.toLowerCase())].join(' + ');
  function paintSpot(i, force) {
    const t = towerAt(town, i), kinds = Object.keys(TOWERS);
    const now = ['spot', i, t ? [t.kind, t.level, t.path] : '', ...(t ? [canPay(town, towerCost(town, t.kind, t.level))] : kinds.map(k => canPay(town, towerCost(town, k, 0))))].join();
    if (!force && now === sig) return;
    sig = now;
    card.replaceChildren();
    const head = el('div', 'cardhead');
    const x = el('button', 'btn small close', 'Close'); x.addEventListener('click', close);
    if (!t) {
      head.append(el('h2', null, 'Stone pad'), x); card.append(head);
      for (const k of kinds) {
        const d = TOWERS[k], c = towerCost(town, k, 0), row = el('div', 'option');
        const txt = el('div'); txt.append(el('b', null, d.name), el('span', null, d.about), el('small', null, costText(c)));
        const go = el('button', 'btn small build', 'Build'); go.dataset.kind = k; go.disabled = !canPay(town, c);
        go.addEventListener('click', () => { if (buildTower(game, town, i, k)) paintCard(); });
        row.append(txt, go); card.append(row);
      }
      return;
    }
    const d = TOWERS[t.kind], st = towerStats(town, t), p = t.path ? PATHS[t.kind][t.path] : null;
    head.append(el('h2', null, p ? p.name : d.name), el('span', 'lv', 'Level ' + t.level), x); card.append(head);
    const stats = el('div', 'explain');
    const line = (a, b) => { const r = el('div'); r.append(el('span', null, a), el('b', null, b)); stats.append(r); };
    line('Damage', fmt(st.dmg) + (st.poison ? ' + ' + fmt(st.poison) + '/s poison' : ''));
    line('Shots', fmt(st.rate) + ' a second'); line('Range', fmt(st.range));
    if (st.splash) line('Blast', fmt(st.splash));
    if (st.slow) line('Slows raiders', Math.round(st.slow * 100) + '%');
    card.append(stats);
    const c = towerCost(town, t.kind, t.level), row = el('div', 'row');
    if (t.level + 1 === PATH_LEVEL) {
      card.append(el('p', 'uses', 'This upgrade makes you pick one of two paths. You can\'t switch later. It costs ' + costText(c) + '.'));
      for (const [key, P] of Object.entries(PATHS[t.kind])) {
        const opt = el('div', 'option'), txt = el('div'); txt.append(el('b', null, P.name), el('span', null, P.about));
        const go = el('button', 'btn small build', 'Choose'); go.dataset.path = key; go.disabled = !canPay(town, c);
        go.addEventListener('click', () => { if (upgradeTower(game, town, i, key)) paintCard(); });
        opt.append(txt, go); card.append(opt);
      }
    } else {
      const up = el('button', 'btn primary buy', 'Upgrade · ' + costText(c)); up.id = 'buy'; up.disabled = !canPay(town, c);
      up.addEventListener('click', () => { if (upgradeTower(game, town, i)) paintCard(); });
      row.append(up);
    }
    const sell = el('button', 'btn small', 'Sell · ' + fmt(Math.floor(t.spent * SELL_BACK))); sell.id = 'sellTower';
    sell.addEventListener('click', () => { sellTower(game, town, i); paintCard(); });
    row.append(sell); card.append(row);
  }

  // news from the road
  game.bus.on('wave:start', e => { if (e.town === town.id && e.boss) toast('Wave ' + e.wave + '. The war wagon is coming. Stop it before it reaches the vault.', 4000); });
  game.bus.on('breach', e => { if (e.town === town.id) toast('Your vault broke. Raiders took ' + fmt(e.lost) + ' coins and you went back two waves.', 5000); });

  // income: coins earned over the last few seconds
  const hist = []; let acc = 0, cardAcc = 0;
  function frame(dt) {
    acc += dt; cardAcc += dt;
    sheets.frame(dt);
    for (const [id, t] of Object.entries(tag)) {
      const p = viewApi.project(id), L = town.level(id), un = unlocked(town, id);
      const flat = !p && document.documentElement.classList.contains('flat');
      if ((!p && !flat) || (!L && !un)) { t.hidden = true; continue; }
      t.hidden = false; if (p) t.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) translate(-50%, -100%)`; // sub-pixel: whole pixels make tags step as the camera glides
      const txt = (flat ? BUILDINGS[id].name + ' · ' : '') + (L ? 'Lv ' + L : 'Build');
      if (t.textContent !== txt) t.textContent = txt;
      t.classList.toggle('short', !!(L && town.starved[id]));
      t.classList.toggle('can', town.coins >= cost(town, id));
    }
    if (document.documentElement.classList.contains('flat')) spotTags.forEach((t, i) => {
      const tw = towerAt(town, i), txt = 'Spot ' + (i + 1) + ' · ' + (tw ? TOWERS[tw.kind].name + ' ' + tw.level : 'empty');
      t.hidden = false; if (t.textContent !== txt) t.textContent = txt;
    });
    if (acc < .2) return;
    acc = 0;
    hist.push([town.t, town.lifetime]); while (hist.length > 25) hist.shift();
    const [t0, l0] = hist[0], per = town.t > t0 ? (town.lifetime - l0) / (town.t - t0) : 0;
    setText(coinNum, fmt(town.coins)); setText(inc, '+' + rate(per));
    const ws = town.waves;
    setText(waveNum, 'Wave ' + town.wave);
    const vw = Math.max(0, Math.round(100 * town.vault.hp / town.vault.max)) + '%'; if (vaultFill.style.width !== vw) vaultFill.style.width = vw;
    paintCtl();
    setText(waveInfo, ws.phase === 'break' ? (ws.hold && ws.timer <= 0 ? 'held' : 'in ' + Math.ceil(ws.timer) + 's') : (WAVE_TYPES[ws.type] || WAVE_TYPES.mixed).name + ' · ' + (ws.queue.length + ws.foes.length) + ' left');
    call.hidden = ws.phase !== 'break';
    if (cardAcc > .25 && openId) { cardAcc = 0; paintCard(false); }
  }
  return { frame, open, openSpot, close, el: ui, sheets, openGoods, openMenu };
}

export function toast(text, ms = 4000) {
  const t = el('div', 'toast', text); t.setAttribute('role', 'status');
  document.body.append(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, ms);
}
