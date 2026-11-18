/* The play screen over the board: the coin bar, a tag over every plot, and the building card that slides up when a
   plot is tapped (build, upgrade, what it makes and why, and whether its good is sold). The phone shell box grows
   this into the full HUD with tabs and sheets. */
import { BUILDINGS } from '../data/buildings.js';
import { GOODS } from '../data/goods.js';
import { build, cost, output, missing, unlocked, uses } from '../core/economy.js';
import { explainOutput, explainTower, explainEmpireIncome, incomeSnap, paysEach } from '../core/explain.js';
import { explainBox, incomeSheet, vaultSheet, reachWord, shotsWord } from './explain.js';
import { TOWERS, PATHS, PATH_LEVEL, SELL_BACK } from '../data/towers.js';
import { buildTower, upgradeTower, sellTower, towerCost, towerStats, towerAt, canPay, callEarly, canCall, setHold, isPit, fitsSpot, towerOpen, towerIn, setReserve, shortfall } from '../core/defense.js';
import { WAVE_TYPES, FOES } from '../data/foes.js';
import { TOWNS } from '../data/towns/index.js';
import { nextTowns } from '../core/empire.js';
import { mapOpen, mapCalls } from '../core/map.js';
import { isOutpost } from '../core/economy.js';
import { createSheets, goodsSheet, menuSheet, researchSheet, perksSheet, foundSheet, placesSheet, autoSheet } from './sheets.js';
import { charterOffered, perksToPick, deedsFor } from '../core/charter.js';
import { researchOpen } from '../core/research.js';
import { FOREMAN_LEVEL, canHire, hasForeman, foremanOn, hireCost, hireForeman, setForeman } from '../core/foremen.js';
import { autoOn, retryState } from '../core/automation.js';
import { RESEARCH } from '../data/research.js';
import { tabs, dots, look, lookGoods, lookPerks, stripGoods } from '../core/reveal.js';
import { goalNow, goalContext, goalsOf, goalText } from '../core/goals.js';
import { lostToast, lostCard } from './lost.js';
import { contractDone, capitalSheet } from './capital.js';

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
import { fmt, fmtLive } from './format.js';
export { fmt };
export { fmtLive };
const rate = n => fmtLive(n) + '/s';
/* A good's square, in its color (GOODS[g].color). */
const goodIcon = g => { const i = el('i', 'gicon'); i.style.background = GOODS[g].color || '#888'; return i; };

export function mountPlay(root, game, viewApi, shell = {}) {
  const town = game.town, ui = el('section', 'play'); ui.id = 'play-ui';
  // the coin bar
  const hud = el('header', 'hud');
  const coins = el('div', 'coins'); coins.id = 'coins';
  const coinIcon = el('span', 'coin'), coinNum = el('b'), inc = el('span', 'inc');
  coins.append(coinIcon, coinNum, inc);
  coins.setAttribute('role', 'button'); coins.tabIndex = 0; // tap the coins: where they come from
  // the place bar (owner rule: the top bar never grows with the towns): the town's name, Map (every town, alerts, towns
  // to start) and one back button to the last place in play, so two places are one tap apart
  const place = el('div', 'place'); place.id = 'placeBar';
  const name = el('div', 'townname', town.def.name);
  const mapBtn = el('button', 'btn small', 'Map'); mapBtn.id = 'mapBtn'; mapBtn.hidden = true;
  // no 3D view: no map to fly over, so Map lists the places instead
  mapBtn.addEventListener('click', () => { if (shell.map && shell.view) shell.map(); else openPlaces(); });
  const backBtn = el('button', 'btn small backbtn'); backBtn.id = 'backBtn'; backBtn.hidden = true;
  backBtn.addEventListener('click', () => { const b = game.back; if (b && shell.go) shell.go(b); });
  place.append(name, mapBtn, backBtn);
  const needsYou = id => { const o = game.towns[id]; return !!o && ((o.waves && o.waves.autoHold && retryState(game, o) !== 'wait') || (o.breaches || 0) > ((o.flags && o.flags.breachSeen) || 0)); };
  const paintPlace = () => {
    const b = game.back, next = nextTowns(game);
    if (backBtn.hidden !== !b) backBtn.hidden = !b;
    setText(name, b ? town.def.short || town.def.name : town.def.name); // with a back button beside it, the short name, so all three fit on a phone
    if (b) { const s = TOWNS[b].short || TOWNS[b].name; setText(backBtn, s); if (backBtn.dataset.town !== b) { backBtn.dataset.town = b; backBtn.setAttribute('aria-label', 'Back to ' + s); } backBtn.classList.toggle('dot', needsYou(b)); }
    const show = mapOpen(game); if (mapBtn.hidden !== !show) mapBtn.hidden = !show;
    mapBtn.classList.toggle('dot', Object.keys(game.towns).some(id => id !== town.id && needsYou(id)) || mapCalls(game));
  };
  const store = town.def.store || 'vault'; // what raiders ride for here: the vault, or an outpost's stockpile
  // the wave: its number, the vault's strength, and the countdown with a button to call it early
  const wave = el('div', 'wave'); wave.id = 'wave';
  const waveNum = el('b'), vault = el('span', 'vault'), vaultFill = el('i'), waveInfo = el('span', 'winfo');
  vault.append(vaultFill); vault.title = store[0].toUpperCase() + store.slice(1) + ' strength';
  const vaultBtn = el('button', 'vaultbtn'); vaultBtn.id = 'vaultBtn'; vaultBtn.append(waveNum, vault); // tap it: the vault's strength explained
  const call = el('button', 'btn small call', 'Call now'); call.id = 'callWave';
  call.addEventListener('click', () => { const b = callEarly(game, town); if (b > 0) toast('Wave called early. You got ' + fmt(b) + ' bonus coins.', 2500); });
  wave.append(vaultBtn, waveInfo, call);
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
    setText(hold, h ? 'Resume waves' : 'Hold waves'); hold.setAttribute('aria-pressed', String(h)); hold.classList.toggle('on', h);
  };
  pause.addEventListener('click', () => { viewApi.pause(!viewApi.paused()); paintCtl(); });
  hold.addEventListener('click', () => { setHold(game, town, !town.waves.hold); paintCtl(); });
  ctl.append(pause, hold);
  const banner = el('div', 'pausedbanner', 'Paused'); banner.id = 'pausedBanner'; banner.hidden = true;
  // the goal strip (src/core/goals.js): one short goal at a time through the first half hour; tap it to point again
  const goal = el('button', 'goal'); goal.id = 'goal'; goal.hidden = true;
  const goalTag = el('span', 'glabel', 'Goal'), goalWords = el('span', 'gtext');
  goal.append(goalTag, goalWords);
  const mark = el('div', 'goalmark'); mark.id = 'goalMark'; mark.hidden = true;
  goal.addEventListener('click', () => { mark.classList.remove('ping'); void mark.offsetWidth; mark.classList.add('ping'); });
  const left = el('div', 'hudleft'); left.append(place, wave, ctl, goal); paintPlace();
  // side buttons under the coins: Goods and Menu open slide-up sheets
  const side = el('div', 'side');
  const goodsBtn = el('button', 'btn small', 'Goods'); goodsBtn.id = 'goodsBtn'; goodsBtn.hidden = true;
  const menuBtn = el('button', 'btn small', 'Menu'); menuBtn.id = 'menuBtn';
  const labBtn = el('button', 'btn small', 'Research'); labBtn.id = 'researchBtn'; labBtn.hidden = true;
  const perksBtn = el('button', 'btn small', 'Perks'); perksBtn.id = 'perksBtn'; perksBtn.hidden = true;
  const autoBtn = el('button', 'btn small', 'Auto'); autoBtn.id = 'autoBtn'; autoBtn.hidden = true;
  side.append(goodsBtn, labBtn, perksBtn, autoBtn, menuBtn);
  const right = el('div', 'hudright'); right.append(coins, side);
  hud.append(left, right);
  // the goods strip along the bottom (owner rule: you can always see how much of each good you have); tap one for Goods
  const strip = el('div', 'goodstrip'); strip.id = 'goodsStrip'; strip.hidden = true;
  let stripSig = '', stripNums = {};
  const paintStrip = () => {
    const list = stripGoods(town), s = list.join();
    if (s !== stripSig) {
      stripSig = s; stripNums = {}; strip.hidden = !list.length;
      strip.replaceChildren(...list.map(g => {
        const b = el('button', 'goodchip'); b.dataset.good = g; b.title = GOODS[g].name;
        const n = el('b'); b.append(goodIcon(g), el('span', 'gname', GOODS[g].name), n); stripNums[g] = n;
        b.addEventListener('click', () => openGoods(g));
        return b;
      }));
    }
    for (const [g, n] of Object.entries(stripNums)) setText(n, fmtLive(Math.floor((town.goods[g] || 0) + 1e-9)));
  };
  // tags over the plots
  const tags = el('div', 'tags'), tag = {};
  for (const id of Object.keys(town.def.board.plots)) { const t = el('button', 'tag'); t.dataset.plot = id; t.addEventListener('click', () => open(id)); tags.append(t); tag[id] = t; }
  // tower spots get tags only in the list view (no 3D); on the board their stone pads are tapped
  const spotTags = town.def.board.spots.map((_, i) => { const t = el('button', 'tag spot'); t.hidden = true; t.addEventListener('click', () => openSpot(i)); tags.append(t); return t; });
  // the building card
  const card = el('div', 'card'); card.id = 'card'; card.hidden = true;
  ui.append(tags, hud, strip, card, mark, banner);
  root.append(ui);
  const sheets = createSheets(ui, { onOpen: () => close() });
  const openGoods = (focus = null) => { lookGoods(town); goodsBtn.classList.remove('dot'); sheets.open('goods', 'Goods', goodsSheet(game, town, typeof focus === 'string' ? focus : null)); };
  const menuCtx = { game, audio: shell.audio || null, view: shell.view || null, toast, leave: shell.leave || (() => {}), onHelp: shell.onHelp || (() => {}), reopen: () => openMenu() };
  const openMenu = () => sheets.open('menu', 'Menu', menuSheet(menuCtx));
  const openResearch = () => sheets.open('research', 'Research', researchSheet(game, town));
  const openAuto = () => { (game.shared.seen ||= {})['auto:sheet'] = true; autoBtn.classList.remove('dot'); sheets.open('auto', 'Automation', autoSheet(game, town)); };
  const openPerks = () => { lookPerks(town); perksBtn.classList.remove('dot'); sheets.open('perks', 'Perks', perksSheet({ game, town, leave: shell.leave || (() => {}) })); };
  const openIncome = () => sheets.open('income', 'Income', incomeSheet(income));
  const openFound = id => sheets.open('found', TOWNS[id].name, foundSheet(game, id, to => { sheets.close(); toast(TOWNS[to].name + ' is open.', 3000); if (shell.go) shell.go(to); }));
  const openCapital = () => sheets.open('capital', 'The Capital', capitalSheet(game, toast));
  const openPlaces = () => sheets.open('places', 'Map', placesSheet(game, { go: id => { sheets.close(); if (shell.go) shell.go(id); }, found: id => openFound(id), capital: openCapital }));
  const openVault = () => sheets.open('vault', store === 'vault' ? 'Vault' : 'Stockpile', vaultSheet(town));
  coins.addEventListener('click', openIncome); coins.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openIncome(); });
  vaultBtn.addEventListener('click', openVault);
  goodsBtn.addEventListener('click', () => openGoods()); menuBtn.addEventListener('click', openMenu); labBtn.addEventListener('click', openResearch); autoBtn.addEventListener('click', openAuto); perksBtn.addEventListener('click', openPerks);

  let openId = null, why = false, whyStat = null; // the number tapped on the open card, explained under it
  function open(id) {
    if (sheets.current) sheets.close();
    openId = id; why = false; whyStat = null; card.hidden = false; paintCard();
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
    const kept = Math.ceil((town.keep || {})[b.makes] || 0), keepOn = !(town.reserveOff || {})[b.makes];
    const now = [id, L, why, cost(town, id), town.coins >= cost(town, id), !!town.starved[id], missing(town, id).length, town.sell[b.makes], kept, keepOn, hasForeman(town, id), foremanOn(town, id), canHire(town, id) && town.coins >= hireCost(town, id)].join();
    if (!force && now === sig) return;
    sig = now;
    card.replaceChildren();
    const head = el('div', 'cardhead');
    head.append(el('h2', null, b.name), el('span', 'lv', L ? 'Level ' + L : unlocked(town, id) ? 'Not built' : 'Locked'));
    const x = el('button', 'btn small close', 'Close'); x.addEventListener('click', close); head.append(x);
    card.append(head);
    const out = output(town, id) || b.rate;
    const line = el('button', 'stat');
    line.append(el('span', null, 'Makes ' + g.name.toLowerCase()), el('b', null, fmt(out) + ' a second' + (L ? '' : ' at level 1')));
    line.addEventListener('click', () => { why = !why; paintCard(); });
    card.append(line);
    line.setAttribute('aria-expanded', String(why && !!L));
    if (why && L) card.append(explainBox(explainOutput(town, id)));
    const ins = Object.entries(b.inputs);
    if (ins.length) card.append(el('p', 'uses', 'Each one uses ' + ins.map(([k]) => fmt(uses(town, id, k)) + ' ' + GOODS[k].name.toLowerCase()).join(' and ') + '.'));
    // goods shipped in from another town (src/core/economy.js, ship): where they come from, and what to do when short
    const imp = ins.map(([k]) => k).filter(k => ((town.def && town.def.imports) || []).includes(k));
    const fromName = g => { const t = TOWNS[GOODS[g].town]; return t ? t.short || t.name : 'another town'; };
    const makerOf = g => Object.values(BUILDINGS).find(x => x.makes === g && x.town === GOODS[g].town);
    if (imp.length) card.append(el('p', 'uses', imp.map(g => GOODS[g].name).join(' and ') + ' come by wagon from ' + fromName(imp[0]) + '.'));
    const shortImp = imp.filter(g => (town.goods[g] || 0) < uses(town, id, g));
    if (town.starved[id] && L && shortImp.length) {
      // the town that makes it may not have built its maker yet: then the line says to build it
      const g0 = shortImp[0], mk = makerOf(g0), src = game.towns[GOODS[g0].town], mid = mk && Object.keys(BUILDINGS).find(k => BUILDINGS[k] === mk);
      const verb = src && mid && !src.level(mid) ? 'Build a ' : 'Upgrade the ';
      card.append(el('p', 'warn', 'Not enough ' + GOODS[g0].name.toLowerCase() + '. ' + verb + (mk || { name: 'workshop' }).name + ' in ' + fromName(g0) + '.'));
    }
    else if (town.starved[id] && L) card.append(el('p', 'warn', 'It ran out of materials. Upgrade the building that supplies it.'));
    const miss = missing(town, id);
    if (miss.length) card.append(el('p', 'warn', 'Unlocks when ' + miss.map(m => 'the ' + BUILDINGS[m.id].name + ' reaches level ' + m.level).join(' and ') + '.'));
    const row = el('div', 'row');
    const c = cost(town, id), buy = el('button', 'btn primary buy');
    buy.id = 'buy'; buy.textContent = (L ? 'Upgrade' : 'Build') + ' · ' + fmt(c) + ' coins';
    buy.disabled = !!miss.length || town.coins < c;
    buy.addEventListener('click', () => { if (build(game, town, id)) paintCard(); });
    row.append(buy);
    const selling = town.sell[b.makes] !== false, sell = el('button', 'btn small', 'Sell ' + g.name.toLowerCase() + (selling ? ' · On' : ' · Off'));
    sell.id = 'sell'; sell.setAttribute('aria-pressed', String(selling)); sell.classList.toggle('on', selling);
    sell.title = 'Sells for ' + fmt(paysEach(game, town, b.makes)) + ' coins each';
    sell.addEventListener('click', () => { if (selling) town.sell[b.makes] = false; else delete town.sell[b.makes]; paintCard(); });
    row.append(sell);
    card.append(row);
    // the tower reserve: what auto-sell keeps back for the towers, and the switch to sell it anyway
    if (L && selling && Object.entries(TOWERS).some(([k, t]) => towerIn(town, k) && (t.goods[town.id] || {})[b.makes])) {
      const kr = el('div', 'row keeprow');
      const ks = el('button', 'btn small', 'Keep ' + (keepOn && kept ? kept + ' ' : '') + 'for towers' + (keepOn ? ' · On' : ' · Off'));
      ks.id = 'keepTowers'; ks.setAttribute('aria-pressed', String(keepOn)); ks.classList.toggle('on', keepOn);
      ks.addEventListener('click', () => { setReserve(town, b.makes, !keepOn); paintCard(); });
      kr.append(ks); card.append(kr);
    }
    // a foreman: hired once the building reaches level 10, then it buys levels by itself until switched off
    if (L >= FOREMAN_LEVEL || hasForeman(town, id)) {
      const fr = el('div', 'row keeprow');
      if (!hasForeman(town, id)) {
        fr.append(el('span', 'uses', 'Buys the next level when you have twice what it costs'));
        const h = el('button', 'btn small', 'Hire foreman · ' + fmt(hireCost(town, id)) + ' coins'); h.id = 'hireForeman';
        h.disabled = town.coins < hireCost(town, id);
        h.addEventListener('click', () => { if (hireForeman(game, town, id)) paintCard(); });
        fr.append(h);
      } else {
        const on = foremanOn(town, id);
        fr.append(el('span', 'uses', on ? 'Buys the next level when you have twice what it costs' : ''));
        const sw = el('button', 'btn small', on ? 'Foreman · On' : 'Foreman · Off'); sw.id = 'foremanSwitch';
        sw.setAttribute('aria-pressed', String(on)); sw.classList.toggle('on', on);
        sw.addEventListener('click', () => { setForeman(town, id, !on); paintCard(); });
        fr.append(sw);
      }
      card.append(fr);
    }
  }

  let armed = null; // a path tapped once, waiting for the second tap
  /* A cost as a row: the coins, then each good with its square and "have / need", red when short. */
  const costRow = c => {
    const r = el('span', 'costrow');
    r.append(el('span', 'need' + (town.coins + 1e-9 < c.coins ? ' low' : ''), fmt(c.coins) + ' coins'));
    for (const [g, n] of Object.entries(c.goods)) {
      const have = Math.floor((town.goods[g] || 0) + 1e-9), p = el('span', 'need' + (have < n ? ' low' : ''));
      p.title = GOODS[g].name; p.append(goodIcon(g), el('span', 'gname', GOODS[g].name), document.createTextNode(fmt(have) + ' / ' + n));
      r.append(p);
    }
    return r;
  };
  const haveSig = c => Object.keys(c.goods).map(g => Math.floor(town.goods[g] || 0)).join('/') + ',' + (town.coins >= c.coins);
  /* What a tower buy is short of, in words: "Copper 6 of 10, about 40 s. Upgrade the Smelter to speed it up." */
  const time = s => { const n = s < 90 ? Math.max(1, Math.round(s)) : Math.round(s / 60); return n + (s < 90 ? ' second' : ' minute') + (n === 1 ? '' : 's'); };
  const shortText = c => shortfall(town, c).map(s => {
    const name = GOODS[s.good].name, b = s.maker && BUILDINGS[s.maker];
    if (!b || !town.level(s.maker)) return 'Build ' + (b ? 'a ' + b.name : 'more') + ' to make ' + name.toLowerCase() + '.';
    if (s.seconds === null) return 'Upgrade the ' + b.name + ' to make more ' + name.toLowerCase() + '.';
    return 'You will have enough ' + name.toLowerCase() + ' in about ' + time(s.seconds) + '. Upgrade the ' + b.name + ' to make it faster.';
  });
  const keepText = c => { const g = Object.keys(c.goods).filter(k => ((town.keep || {})[k] || 0) > 0); if (!g.length) return ''; const n = g.map(k => GOODS[k].name).join(' and '); return n[0] + n.slice(1).toLowerCase() + (g.length > 1 ? ' are' : ' is') + ' kept for this ' + (pathNext ? 'path' : 'upgrade') + ', not sold.'; };
  let pathNext = false;
  function paintSpot(i, force) {
    const t = towerAt(town, i), pit = isPit(town, i), kinds = Object.keys(TOWERS).filter(k => towerIn(town, k) && fitsSpot(town, i, k));
    const shorts = t ? shortText(towerCost(town, t.kind, t.level)) : kinds.map(k => shortText(towerCost(town, k, 0)));
    const now = ['spot', i, t ? [t.kind, t.level, t.path, whyStat, fmt(towerStats(town, t).dmg)] : '', ...(t ? [canPay(town, towerCost(town, t.kind, t.level)), haveSig(towerCost(town, t.kind, t.level))] : kinds.map(k => canPay(town, towerCost(town, k, 0)) + towerOpen(town, k) + haveSig(towerCost(town, k, 0)))), JSON.stringify(shorts)].join();
    if (!force && now === sig) return;
    sig = now;
    card.replaceChildren();
    const head = el('div', 'cardhead');
    const x = el('button', 'btn small close', 'Close'); x.addEventListener('click', close);
    if (!t) {
      head.append(el('h2', null, pit ? 'Mortar pit' : 'Stone pad'), x); card.append(head);
      if (pit && !kinds.some(k => towerOpen(town, k))) {
        card.append(el('p', 'uses', 'You can build a Mortar here at wave ' + TOWERS.mortar.opens + '.'));
        return;
      }
      for (const k of kinds) {
        const d = TOWERS[k], c = towerCost(town, k, 0), row = el('div', 'option'), shut = !towerOpen(town, k);
        const txt = el('div'); txt.append(el('b', null, d.name), el('span', null, d.about), shut ? el('small', null, 'You can build it at wave ' + d.opens) : costRow(c));
        if (!shut) for (const s of shortText(c)) txt.append(el('small', 'short', s));
        const go = el('button', 'btn small build', 'Build'); go.dataset.kind = k; go.disabled = shut || !canPay(town, c);
        go.addEventListener('click', () => { if (buildTower(game, town, i, k)) paintCard(); });
        row.append(txt, go); card.append(row);
      }
      return;
    }
    const d = TOWERS[t.kind], st = towerStats(town, t), p = t.path ? PATHS[t.kind][t.path] : null;
    head.append(el('h2', null, p ? p.name : d.name), el('span', 'lv', 'Level ' + t.level), x); card.append(head);
    const stats = el('div', 'explain'), ex = explainTower(town, t), whyBox = [];
    // Damage, Shots and Range can be tapped: what makes the number shows under the list
    const line = (a, b, key) => {
      const r = el(key ? 'button' : 'div', key ? 'statrow' : null); r.append(el('span', null, a), el('b', null, b)); stats.append(r);
      if (!key) return;
      r.dataset.why = key; r.setAttribute('aria-expanded', String(whyStat === key)); r.classList.toggle('on', whyStat === key);
      r.addEventListener('click', () => { whyStat = whyStat === key ? null : key; paintCard(); });
    };
    line('Damage', fmt(st.dmg) + (st.poison ? ' + ' + fmt(st.poison) + '/s poison' : ''), 'dmg');
    line('Shots', shotsWord(st.rate), 'rate'); line('Range', reachWord(st.range, st.minRange), 'range');
    if (st.splash) line('Blast', st.splash < 1.2 ? 'Small' : 'Wide');
    if (st.slow) line('Slows raiders', Math.round(st.slow * 100) + '%');
    if (st.fire) line('Burning ground', 'slows and hurts');
    if (d.bestText) line('Best against', d.bestText);
    card.append(stats);
    if (whyStat === 'dmg') { whyBox.push(explainBox(ex.dmg)); if (ex.poison) whyBox.push(explainBox(ex.poison, { total: 'Poison a second' })); }
    else if (whyStat) whyBox.push(explainBox(ex[whyStat], { extra: { minRange: st.minRange } }));
    card.append(...whyBox);
    const c = towerCost(town, t.kind, t.level), row = el('div', 'row');
    if (t.level + 1 === PATH_LEVEL) {
      const ph = el('div', 'pathhead'), pt = el('div');
      pt.append(el('b', null, 'Pick a path'), el('small', null, 'Can\'t be undone'));
      ph.append(pt, costRow(c)); card.append(ph);
      for (const [key, P] of Object.entries(PATHS[t.kind])) {
        const opt = el('div', 'option'), txt = el('div'); txt.append(el('b', null, P.name), el('span', null, P.about));
        const sure = armed && armed.spot === i && armed.path === key && Date.now() - armed.at < 4000;
        const go = el('button', 'btn small build', sure ? 'Tap again to choose' : 'Choose'); go.dataset.path = key; go.disabled = !canPay(town, c);
        go.addEventListener('click', () => {
          if (armed && armed.spot === i && armed.path === key && Date.now() - armed.at < 4000) { armed = null; if (upgradeTower(game, town, i, key)) paintCard(); return; }
          armed = { spot: i, path: key, at: Date.now() }; paintCard();
          setTimeout(() => { if (armed && Date.now() - armed.at >= 4000) { armed = null; paintCard(); } }, 4100);
        });
        opt.append(txt, go); card.append(opt);
      }
    } else {
      const up = el('button', 'btn primary buy', 'Upgrade'); up.id = 'buy'; up.disabled = !canPay(town, c);
      up.addEventListener('click', () => { if (upgradeTower(game, town, i)) paintCard(); });
      card.append(costRow(c));
      row.append(up);
    }
    const sh = shortText(c); pathNext = t.level + 1 === PATH_LEVEL;
    if (sh.length) for (const s of sh) card.append(el('p', 'warn short', s));
    else if (keepText(c)) card.append(el('p', 'uses', keepText(c)));
    const sell = el('button', 'btn small', 'Sell · ' + fmt(Math.floor(t.spent * SELL_BACK)) + ' coins'); sell.id = 'sellTower';
    sell.addEventListener('click', () => { sellTower(game, town, i); paintCard(); });
    row.append(sell); card.append(row);
  }

  // news from the road
  const offs = [
    game.bus.on('wave:start', e => { if (e.town === town.id && e.boss) toast('Wave ' + e.wave + '. The ' + (FOES[town.def.boss || 'wagon'] || FOES.wagon).name.toLowerCase() + ' is coming. Stop it before it reaches the ' + store + '.', 4000); }),
    game.bus.on('charter:offer', e => { if (e.town === town.id) toast('You can sign the charter for ' + e.deeds + (e.deeds === 1 ? ' deed' : ' deeds') + '. Tap Perks.', 4000); }),
    game.bus.on('contract:done', e => { if (!game.catching) toast(contractDone(e) + ' Tap Map, then Capital, to take another contract.', 5000); }),
    game.bus.on('research:done', e => { if (e.town === town.id) toast(RESEARCH[e.id].name + ' level ' + e.level + ' is done.', 3000); }),
    game.bus.on('research:new', e => { if (e.town === town.id) toast('New research. Tap Research to see ' + RESEARCH[e.id].name + '.', 4000); }),
    game.bus.on('breach', e => {
      // a town away that lost holds its own waves: say so wherever the player is (owner rule, 2026-11-17)
      if (e.held && game.catching) return; // time away: the Welcome back line lists it (src/main.js)
      if (e.held && !e.away && e.town === town.id) { showLost(); return; } // the boss got through here: a card, waves on hold
      if (e.held && game.towns[e.town]) { toast(lostToast(game.towns[e.town], e.town === town.id, game), 6000); return; }
      if (e.town !== town.id) return;
      if (e.goods) toast('Raiders broke into the ' + store + ' and took a quarter of its goods.', 5000);
      else toast('Your ' + store + ' broke. Raiders took ' + fmt(e.lost) + ' coins and you went back two waves.', 5000);
    }),
  ];

  // the boss got through in the town in play: a plain card says what happened and what to do; one tap closes it
  function showLost() {
    const old = document.getElementById('lostCard'); if (old) old.remove();
    const c = lostCard(town, game), layer = el('div', 'newslayer'), card = el('div', 'newscard lostcard'), body = el('div', 'newsbody');
    layer.id = 'lostCard';
    for (const l of c.lines) body.append(el('p', null, l));
    const ok = el('button', 'btn primary', 'Got it'); ok.id = 'lostOk';
    ok.addEventListener('click', () => layer.remove());
    card.append(el('b', 'newstitle', c.title), body, ok); layer.append(card); root.append(layer);
    paintCtl();
  }

  // the goal strip: a finished goal shows Done for a moment, then the next one comes in
  let goalId = null, goalCur = null, doneFor = 0;
  function paintGoal(dt) {
    const now = goalNow(game), sh = game.shared.goals || { done: {} };
    if (doneFor > 0) { doneFor -= dt; if (doneFor > 0) return; goal.classList.remove('done'); setText(goalTag, 'Goal'); }
    if ((now && now.id) === goalId) return;
    if (goalId && sh.done[goalId]) {
      doneFor = 1.4; goal.classList.add('done'); setText(goalTag, 'Done'); if (goalCur) setText(goalWords, goalCur.text); goalId = null; goalCur = null;
      if (!now && goalsOf(town.id).every(g => sh.done[g.id])) toast('You finished every goal in this town.', 4000);
      return;
    }
    goalId = now ? now.id : null; goalCur = now;
    goal.hidden = !now;
    if (!now) return;
    setText(goalWords, goalText(game, town, now));
    goal.classList.remove('new'); void goal.offsetWidth; goal.classList.add('new');
  }
  // the spotlight on what the goal says to tap: a pulsing frame over it, under the cards and sheets. Things on the board
  // follow the camera every frame from their projected point (no reads of the page, which would force a layout);
  // what it points at, and the size of a button or tag, are looked up five times a second (measure).
  let markTg = null, markBox = null, markW = 0, markH = 0, markSig = '', stripBox = null;
  function measure() {
    // a frame on the board never covers the goal strip it belongs to (it would hide the words): kept here, read 5 times a second
    if (goalCur && goalCur.wait && doneFor <= 0) setText(goalWords, goalText(game, town, goalCur)); // "Wait for..." until it can be paid
    // what covers the board: the camera fits its home view under the top bar and keeps the selection clear of the card
    if (viewApi.setView) {
      let top = 0;
      for (const n of hud.querySelectorAll('.hudleft, .hudright')) { const b = n.getBoundingClientRect(); if (b.height) top = Math.max(top, b.bottom); }
      const cb = openId && !card.hidden ? card.getBoundingClientRect() : null;
      viewApi.setView(top, cb && cb.height ? { l: cb.left, t: cb.top, r: cb.right, b: cb.bottom } : null);
    }
    if (goal.hidden) stripBox = null; else { const b = goal.getBoundingClientRect(); stripBox = { x: b.left, y: b.top, w: b.width, h: b.height }; }
    const coachUp = document.getElementById('coach'), busy = sheets.current || (coachUp && !coachUp.hidden) || doneFor > 0;
    markTg = !busy && goalCur && goalCur.at ? goalCur.at(goalContext(game, town)) : null;
    markBox = null;
    // the card of the spotlit pad or building is open: point at its Build, Upgrade or path button instead
    const s = markTg && (markTg.spot ?? markTg.tower);
    if (markTg && openId && (openId === markTg.plot || (s !== null && s !== undefined && openId === 'spot:' + s))) {
      const k = goalCur.kind, b = (k && card.querySelector('.build[data-kind="' + k + '"]')) || (!k && (card.querySelector('#buy') || card.querySelector('.build[data-path]')));
      markTg = b ? { el: b } : null;
    } else if (openId) markTg = null; // a card for something else is open: it has the player's attention
    if (markTg && markTg.el) { const n = typeof markTg.el === 'string' ? document.querySelector(markTg.el) : markTg.el; if (n && n.offsetParent !== null) { const b = n.getBoundingClientRect(); markBox = { x: b.left - 5, y: b.top - 5, w: b.width + 10, h: b.height + 10 }; } }
    else if (markTg && markTg.plot && tag[markTg.plot] && !tag[markTg.plot].hidden) { markW = tag[markTg.plot].offsetWidth + 10; markH = tag[markTg.plot].offsetHeight + 10; }
  }
  function placeMark() {
    const tg = markTg;
    let r = null;
    if (!tg || (tg.plot && openId === tg.plot)) r = null; // its card is open: the selection shows it
    else if (tg.el) r = markBox;
    else if (tg.plot) { const p = markW && viewApi.project(tg.plot); if (p) { const x = Math.min(Math.max(p.x, markW / 2), innerWidth - markW / 2); r = { x: x - markW / 2, y: p.y - markH + 5, w: markW, h: markH }; } } // the tag sits above its point, kept on screen
    else if (openId !== 'spot:' + (tg.spot ?? tg.tower)) {
      const sp = tg.spot ?? tg.tower, p = sp !== null && sp !== undefined && shell.locate ? shell.locate({ spot: sp }) : null;
      if (p) r = { x: p.x - 26, y: p.y - 26, w: 52, h: 52 };
    }
    const over = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    if (r && !tg.el && stripBox && over(r, stripBox)) r = null; // the thing is under the strip: show the words, not the frame
    if (mark.hidden !== !r) mark.hidden = !r;
    if (!r) return;
    mark.style.transform = `translate(${r.x.toFixed(1)}px, ${r.y.toFixed(1)}px)`;
    const sig = Math.round(r.w) + ',' + Math.round(r.h);
    if (sig !== markSig) { markSig = sig; mark.style.width = Math.round(r.w) + 'px'; mark.style.height = Math.round(r.h) + 'px'; }
  }

  // income: coins earned over the last few seconds
  const hist = []; let acc = 0, cardAcc = 0;
  // the Income sheet explains the same few seconds as the number at the top
  const income = () => { const h = hist[0], now = incomeSnap(game); return explainEmpireIncome(game, h ? h[1] : now, now, h ? town.t - h[0] : 0); };
  function frame(dt) {
    acc += dt; cardAcc += dt;
    sheets.frame(dt);
    paintGoal(dt); placeMark();
    for (const [id, t] of Object.entries(tag)) {
      const p = viewApi.project(id), L = town.level(id), un = unlocked(town, id);
      const flat = !p && document.documentElement.classList.contains('flat');
      if ((!p && !flat) || (!L && !un)) { t.hidden = true; continue; }
      const px = p && markTg && markTg.plot === id && markW ? Math.min(Math.max(p.x, markW / 2), innerWidth - markW / 2) : p && p.x;
      t.hidden = false; if (p) t.style.transform = `translate(${px.toFixed(1)}px, ${p.y.toFixed(1)}px) translate(-50%, -100%)`; // sub-pixel: whole pixels make tags step as the camera glides
      const txt = (flat || (markTg && markTg.plot === id) ? BUILDINGS[id].name + ' · ' : '') + (L ? 'Lv ' + L : 'Build');
      if (t.textContent !== txt) t.textContent = txt;
      t.classList.toggle('short', !!(L && town.starved[id]));
      t.classList.toggle('can', town.coins >= cost(town, id));
      t.classList.toggle('boss', foremanOn(town, id));
    }
    if (document.documentElement.classList.contains('flat')) spotTags.forEach((t, i) => {
      const tw = towerAt(town, i), txt = (isPit(town, i) ? 'Mortar pit ' : 'Spot ') + (i + 1) + ' · ' + (tw ? TOWERS[tw.kind].name + ' ' + tw.level : 'empty');
      t.hidden = false; if (t.textContent !== txt) t.textContent = txt;
    });
    if (acc < .2) return;
    acc = 0;
    hist.push([town.t, incomeSnap(game)]); while (hist.length > 25) hist.shift();
    const per = income().value; // every town and outpost pays into the one purse
    setText(coinNum, fmtLive(town.coins)); setText(inc, '+' + rate(per));
    paintStrip();
    const ws = town.waves;
    setText(waveNum, 'Wave ' + town.wave);
    const vw = Math.max(0, Math.round(100 * town.vault.hp / town.vault.max)) + '%'; if (vaultFill.style.width !== vw) vaultFill.style.width = vw;
    paintCtl();
    measure();
    setText(waveInfo, ws.phase === 'break' ? (ws.hold ? 'on hold' : 'in ' + Math.ceil(ws.timer) + 's') : (ws.queue.length + ws.foes.length) + ' left · ' + (WAVE_TYPES[ws.type] || WAVE_TYPES.mixed).name); // the count first, so a narrow screen keeps it
    call.hidden = ws.phase !== 'break';
    const callable = canCall(town); if (call.disabled === callable) call.disabled = !callable; // never locked in a break (owner rule); hidden while a wave is on the road
    // the side buttons come out as they become useful (src/core/reveal.js), with a dot when something there wants you
    look(town);
    const T = tabs(game, town), D = dots(game, town);
    goodsBtn.hidden = !T.goods; goodsBtn.classList.toggle('dot', D.goods);
    labBtn.hidden = !T.research; labBtn.classList.toggle('dot', D.research);
    menuBtn.classList.toggle('dot', !!document.getElementById('updateBar'));
    setText(labBtn, town.lab ? 'Research · ' + Math.ceil(town.lab.left) + 's' : 'Research');
    labBtn.classList.toggle('on', !!town.lab);
    // the Perks button shows from the first charter offer, gold while a perk waits to be picked or the charter pays
    perksBtn.hidden = !T.perks; perksBtn.classList.toggle('dot', D.perks); // an outpost has no charter
    autoBtn.hidden = !T.auto; autoBtn.classList.toggle('dot', D.auto);
    autoBtn.classList.toggle('on', autoOn(game, town, 'towers') || autoOn(game, town, 'research'));
    paintPlace();
    perksBtn.classList.toggle('on', perksToPick(game) > 0 || deedsFor(town) > 0);
    if (cardAcc > .25 && openId) { cardAcc = 0; paintCard(false); }
  }
  /* Take this town's screen down (switching towns builds a new one). */
  const destroy = () => { for (const off of offs) off(); ui.remove(); const lc = document.getElementById('lostCard'); if (lc) lc.remove(); };
  return { frame, open, openSpot, close, current: () => openId, el: ui, sheets, openGoods, strip, openMenu, openResearch, openPerks, openAuto, openIncome, openVault, openPlaces, openCapital, destroy };
}

/* Toasts wait their turn: one at a time, at most three waiting (the oldest goes), and a line already showing or
   waiting is not added again. While others wait, each one stays up a little shorter. first: it goes to the front of the
   line (the Welcome back line, which comes after catching up and would wait behind the news of the time away). */
const toasts = { queue: [], up: null };
export function toast(text, ms = 4000, { first = false } = {}) {
  if ((toasts.up && toasts.up.text === text) || toasts.queue.some(q => q.text === text)) return;
  if (first) toasts.queue.unshift({ text, ms }); else toasts.queue.push({ text, ms });
  if (toasts.queue.length > 3) { if (first) toasts.queue.pop(); else toasts.queue.shift(); }
  if (!toasts.up) nextToast();
}
/* The lowest edge of the top bar's two columns (one read per toast), or null to keep the place in the stylesheet. */
function underHud() {
  let y = 0;
  for (const n of document.querySelectorAll('.hud .hudleft, .hud .hudright')) { const b = n.getBoundingClientRect(); if (b.height) y = Math.max(y, b.bottom); }
  return y && y + 8 < innerHeight * .6 ? Math.round(y + 8) : null;
}
function nextToast() {
  const q = toasts.queue.shift();
  if (!q) { toasts.up = null; return; }
  const t = el('div', 'toast', q.text); t.setAttribute('role', 'status');
  const below = underHud(); if (below) t.style.top = below + 'px';
  document.body.append(t);
  toasts.up = q;
  const ms = toasts.queue.length ? Math.min(q.ms, 2500) : q.ms;
  setTimeout(() => { t.classList.add('out'); setTimeout(() => { t.remove(); nextToast(); }, 400); }, ms);
}
