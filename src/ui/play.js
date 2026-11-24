/* The play screen over the board: the coin bar, a tag over every plot, and the building card that slides up when a
   plot is tapped (build, upgrade, what it makes and why, and whether its good is sold). The phone shell box grows
   this into the full HUD with tabs and sheets. */
import { BUILDINGS } from '../data/buildings.js';
import { GOODS } from '../data/goods.js';
import { build, cost, output, missing, unlocked, uses, gridOf, onGrid, isGrid } from '../core/economy.js';
import { boomNow, sellMode, setSellMode } from '../core/market.js';
import { explainMade, explainTower, explainEmpireIncome, incomeSnap, paysEach, usedBy } from '../core/explain.js';
import { explainBox, incomeSheet, vaultSheet, reachWord, shotsWord, blastWord, foremanLine, keepLine } from './explain.js';
import { TOWERS, PATHS, PATH_LEVEL, FORKS, SELL_BACK, EATS_ARMOR, eatWords, hurtWords } from '../data/towers.js';
import { forkNext, buildTower, upgradeTower, sellTower, towerCost, towerStats, towerAt, canPay, callEarly, canCall, setHold, isPit, fitsSpot, towerOpen, towerIn, setReserve, shortfall, bossWave, oldGround, normalTowers, crowdOf } from '../core/defense.js';
import { WAVE_TYPES, FOES } from '../data/foes.js';
import { TOWNS } from '../data/towns/index.js';
import { nextTowns } from '../core/empire.js';
import { mapOpen, needsYou, mapDot } from '../core/map.js';
import { isOutpost } from '../core/economy.js';
import { orderDone, orderMissed } from './sheets.js';
import { createSheets, goodsSheet, menuSheet, researchSheet, perksSheet, foundSheet, placesSheet, autoSheet, armsSheet, clock, leftWord, STOCK_LABEL } from './sheets.js';
import { charterOffered, perksToPick, deedsFor } from '../core/charter.js';
import { researchOpen, labsRunning } from '../core/research.js';
import { FOREMAN_LEVEL, SHARE, canHire, hasForeman, foremanOn, hireCost, hireForeman, setForeman, foremanWait } from '../core/foremen.js';
import { autoOn, retryState } from '../core/automation.js';
import { RESEARCH } from '../data/research.js';
import { tabs, dots, look, lookGoods, lookPerks, stripGoods, stripFit } from '../core/reveal.js';
/* How many chips the goods strip holds in two rows: its columns (the stylesheet's, or as many 84 px chips as fit beside
   a side card) times 2. */
/* A phone turned sideways (the stylesheet's landscape max-height 500px): the strip keeps to one row there (review of
   2026.11.19-13: two rows of up to 10 goods covered a quarter of a 400 px high screen). */
const shortLand = () => innerHeight <= 500 && innerWidth >= innerHeight;
const stripRoom = strip => (strip.classList.contains('oneline') ? 1 : 2) * (strip.classList.contains('narrow') ? Math.max(3, Math.floor((parseInt(strip.style.width) || innerWidth - 24) / 84)) : innerWidth < 600 ? 3 : innerWidth < 1100 ? 6 : 8);
import { goalNow, goalContext, goalsOf, goalText, sendsAway, meterWords, earnRate, readyIn, readyWords } from '../core/goals.js';
import { lostToast, lostCard, bossName } from './lost.js';
import { setSwitch } from './switch.js';
import { waveSheet, waveBar, waveTitle } from './wave.js';
import { foeCard } from './foe.js';
import { bossBar } from './boss.js';
import { workerCard } from './worker.js';
import { contractDone, contractMissed, capitalSheet, capitalReadyWords } from './capital.js';

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
import { fmt, fmtDmg, fmtLive, sellsFor, perSecond, oneOf, vaultCount, haveWords, MODE_WORDS } from './format.js';
import { heart } from './heart.js';
const cap = s => s[0].toUpperCase() + s.slice(1);
/* Pixels the goal's tag stands above its building, on a stem, so its frame never covers the building it names. */
const GOAL_LIFT = 18;
export { fmt };
export { fmtLive };
const rate = n => fmtLive(n) + '/s';
/* On a stone pad's card once the town has its list-price towers: why a new one costs more (src/core/defense.js, crowdFactor). */
export const crowdLine = town => { const n = normalTowers(town); return n >= crowdOf(town) ? 'You have ' + n + ' towers here. Each new tower costs more.' : ''; };
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
  const paintPlace = () => {
    const b = game.back, next = nextTowns(game);
    if (backBtn.hidden !== !b) backBtn.hidden = !b;
    setText(name, town.def.short || town.def.name); // the short name, as the map and the back button say it (review of 2026.11.19-4), so all three fit on a phone
    if (b) { const s = TOWNS[b].short || TOWNS[b].name; setText(backBtn, s); if (backBtn.dataset.town !== b) { backBtn.dataset.town = b; backBtn.setAttribute('aria-label', 'Back to ' + s); } backBtn.classList.toggle('dot', !!needsYou(game, b)); }
    const show = mapOpen(game); if (mapBtn.hidden !== !show) mapBtn.hidden = !show;
    // one source with the map's labels and the goal strip (needsYou, clarity fix 5)
    mapBtn.classList.toggle('dot', mapDot(game, town.id));
  };
  const store = town.def.store || 'vault'; // what raiders ride for here: the vault, or an outpost's stockpile
  // the wave: its number, the vault's strength, and the countdown with a button to call it early
  const wave = el('div', 'wave'); wave.id = 'wave';
  // the wave number opens the raiders card (the next wave's raiders left the bar, owner 2026-11-19), the vault bar its strength
  const waveNum = el('b'), vault = el('span', 'vnum'), waveInfo = el('span', 'winfo'); // the vault as hits left of its full strength, "20/20" (review of 2026.11.20-13: the bar read as a countdown)
  const waveBtn = el('button', 'wavebtn'); waveBtn.id = 'waveBtn'; waveBtn.append(waveNum);
  const vaultBtn = el('button', 'vaultbtn'); vaultBtn.id = 'vaultBtn'; vaultBtn.append(heart(), vault); // a heart and the hits it can take, the same at every place (review of 2026.11.20-14: the small "Vault" and "Stock" read as gold) // tap it: the vault's strength explained. Its name over the bar says what the bar is (review of 2026.11.20-12: a strongbox icon and a green bar with no word read as nothing; review of 2026.11.19-14 had added the icon)
  vaultBtn.setAttribute('aria-label', 'Hits the ' + store + ' can take');
  const call = el('button', 'btn small call', 'Call now'); call.id = 'callWave';
  call.addEventListener('click', () => { const b = callEarly(game, town); if (b > 0) toast('Wave called early. You got ' + fmt(b) + ' bonus coins.', 2500); });
  wave.append(waveBtn, vaultBtn, waveInfo, call);
  // Pause stops the whole game; Hold waves keeps the town working but the next wave waits
  const ctl = el('div', 'hudrow');
  const pause = el('button', 'btn small', 'Pause'); pause.id = 'pauseBtn';
  const hold = el('button', 'btn small', 'Hold waves'); hold.id = 'holdWaves';
  // only touch the page when something changed (rewriting the same text still costs a layout)
  const setText = (n, s) => { if (n.textContent !== s) n.textContent = s; };
  let ctlSig = '';
  const paintCtl = () => {
    const p = viewApi.paused(), bar = waveBar(town.waves), h = bar.hold, sig = p + ',' + h;
    if (sig === ctlSig) return; ctlSig = sig;
    setText(pause, p ? 'Resume' : 'Pause'); pause.setAttribute('aria-pressed', String(p)); banner.hidden = !p;
    setText(hold, bar.button); hold.setAttribute('aria-pressed', String(h)); hold.classList.toggle('on', h);
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
  // a goal on the board opens the card of what it names, so an upgrade's price shows as have / need there (clarity fix
  // 3b part 2: "Tap the Rolling Mill and upgrade it to level 5" had no count, and a count beside the level was read as one
  // number in two reviews); a goal on a button only points at it again
  goal.addEventListener('click', () => {
    const at = goalCur && typeof goalCur.at === 'function' && doneFor <= 0 ? goalCur.at(goalContext(game, town)) || {} : {}, s = at.spot ?? at.tower;
    if (at.plot && BUILDINGS[at.plot] && town.def.buildings.includes(at.plot)) { open(at.plot); return; }
    if (s !== null && s !== undefined && !at.el) { openSpot(s); return; }
    mark.classList.remove('ping'); void mark.offsetWidth; mark.classList.add('ping');
  });
  // the boss bar (src/ui/boss.js) at the foot of the column, so showing it moves nothing above it; a tap opens the boss's card
  const boss = bossBar(town, { store, onTap: id => openFoe(id) });
  const left = el('div', 'hudleft'); left.append(place, wave, ctl, goal, boss.el); paintPlace();
  // side buttons under the coins: Goods and Menu open slide-up sheets
  const side = el('div', 'side');
  const goodsBtn = el('button', 'btn small', 'Goods'); goodsBtn.id = 'goodsBtn'; goodsBtn.hidden = true;
  const menuBtn = el('button', 'btn small', 'Menu'); menuBtn.id = 'menuBtn';
  const labBtn = el('button', 'btn small', 'Research'); labBtn.id = 'researchBtn'; labBtn.hidden = true;
  // the time left sits on a small second line, so the side column keeps its width (the 2026.11.20-2 screenshots:
  // "Research · 13 sec" pushed the column over Call now on a phone)
  const labLeft = el('small', 'btime'); labLeft.hidden = true; labBtn.append(labLeft);
  const perksBtn = el('button', 'btn small', 'Perks'); perksBtn.id = 'perksBtn'; perksBtn.hidden = true;
  const autoBtn = el('button', 'btn small', 'Auto'); autoBtn.id = 'autoBtn'; autoBtn.hidden = true;
  // Call to arms: its fight or its wait on a small fixed-width second line, like Research's time
  const armsBtn = el('button', 'btn small', 'To arms'); armsBtn.id = 'armsBtn'; armsBtn.hidden = true;
  const armsLeft = el('small', 'btime'); armsLeft.hidden = true; armsBtn.append(armsLeft);
  side.append(goodsBtn, labBtn, perksBtn, autoBtn, armsBtn, menuBtn);
  const right = el('div', 'hudright'); right.append(coins, side);
  hud.append(left, right);
  // the goods strip along the bottom (owner rule: you can always see how much of each good you have); tap one for Goods
  const strip = el('div', 'goodstrip'); strip.id = 'goodsStrip'; strip.hidden = true;
  let stripSig = '', stripNums = {}, room = 0, viewW = innerWidth, powerNum = null, powerChip = null;
  /* Power on the strip once the town makes it (review of 2026.11.20-11: power was never on the strip): what the grid
     makes, red when the workshops want more. Tap it for the building that makes it. */
  const gridMaker = () => Object.keys(BUILDINGS).find(id => BUILDINGS[id].town === town.id && isGrid(BUILDINGS[id].makes) && town.level(id) > 0) || null;
  const tagTr = new WeakMap(); // the transform each level tag was last given, so a still tag is not written again
  const paintStrip = () => {
    const gm = gridMaker(), { list, more } = stripFit(town, (room || (room = stripRoom(strip))) - (gm ? 1 : 0)), s = list.join() + '+' + more + '/' + room + (gm || ''); // room: kept by measure(). The tower goods always show, and the more box only fits in a free place
    if (s !== stripSig) {
      stripSig = s; stripNums = {}; strip.hidden = !list.length && !gm; powerNum = powerChip = null;
      strip.replaceChildren(...list.map(g => {
        const b = el('button', 'goodchip'); b.dataset.good = g; b.title = GOODS[g].name;
        const n = el('b'); b.append(goodIcon(g), el('span', 'gname', GOODS[g].name), n); stripNums[g] = n;
        b.addEventListener('click', () => openGoods(g));
        return b;
      }));
      // no free place (the tower goods fill the room): the more box sits on the strip's top edge, so no good is hidden
      // without a way to it (review of 2026.11.19-14: six tower goods on a phone hid Tools with no more box). In one row
      // (a phone turned sideways) it stays inline.
      if (gm) {
        const g = BUILDINGS[gm].makes; powerChip = el('button', 'goodchip powerchip'); powerChip.dataset.good = g; powerChip.id = 'stripPower'; powerChip.title = GOODS[g].name;
        powerChip.append(goodIcon(g), el('span', 'gname', GOODS[g].name), powerNum = el('b'));
        powerChip.addEventListener('click', () => open(gm)); strip.append(powerChip);
      }
      if (more) { const m = el('button', 'morechip', more + ' more'); m.id = 'stripMore'; m.addEventListener('click', () => openGoods()); strip.append(m); }
    }
    if (powerNum) { const gr = gridOf(town); setText(powerNum, fmtLive(Math.floor(gr.made + 1e-9))); const low = gr.share < .999; if (powerChip.classList.contains('low') !== low) { powerChip.classList.toggle('low', low); powerChip.querySelector('.gname').textContent = low ? 'Low power' : GOODS[BUILDINGS[gm].makes].name; } } // the red count says why (review of 2026.11.23-9)
    for (const [g, n] of Object.entries(stripNums)) setText(n, fmtLive(Math.floor((town.goods[g] || 0) + 1e-9)));
    // a boom or bust (src/core/market.js): a small arrow in the chip's corner, so the chip keeps its size
    const bm = boomNow(game), ev = bm ? (bm.f > 1 ? 'boom' : 'bust') : '';
    for (const [g, n] of Object.entries(stripNums)) {
      const c = n.parentNode, want = bm && bm.good === g ? ev : '';
      if ((c.dataset.ev || '') === want) continue;
      c.dataset.ev = want; c.classList.toggle('boom', want === 'boom'); c.classList.toggle('bust', want === 'bust');
      c.title = GOODS[g].name + (want === 'boom' ? ', boom' : want === 'bust' ? ', bust' : '');
    }
  };
  // tags over the plots
  const tags = el('div', 'tags'), tag = {};
  for (const id of Object.keys(town.def.board.plots)) { const t = el('button', 'tag'); t.append(el('span', 'tl')); t.dataset.plot = id; t.addEventListener('click', () => open(id)); tags.append(t); tag[id] = t; }
  // tower spots get tags only in the list view (no 3D); on the board their stone pads are tapped
  const spotTags = town.def.board.spots.map((_, i) => { const t = el('button', 'tag spot'); t.hidden = true; t.addEventListener('click', () => openSpot(i)); tags.append(t); return t; });
  // the building card
  const card = el('div', 'card'); card.id = 'card'; card.hidden = true;
  ui.append(tags, hud, strip, card, mark, banner);
  root.append(ui);
  requestAnimationFrame(placeToasts); // a toast from the switch here came before this top bar
  const sheets = createSheets(ui, { onOpen: () => { close(); requestAnimationFrame(placeToasts); } });
  const openGoods = (focus = null) => { lookGoods(town, game); goodsBtn.classList.remove('dot'); sheets.open('goods', titled('Goods'), goodsSheet(game, town, typeof focus === 'string' ? focus : null)); };
  const menuCtx = { game, audio: shell.audio || null, view: shell.view || null, toast, leave: shell.leave || (() => {}), onHelp: shell.onHelp || (() => {}), reopen: () => openMenu() };
  const openMenu = () => sheets.open('menu', 'Menu', menuSheet(menuCtx));
  // every sheet that acts on one place names it (owner, 2026-11-22: "is research empire wide or town specific?")
  const here = () => (town.def && (town.def.short || town.def.name)) || town.id;
  const titled = name => name + ' · ' + here();
  const researchIn = id => { sheets.close(); if (shell.go && shell.go(id) && window.CG && window.CG.play) window.CG.play.openResearch(); };
  const openResearch = () => sheets.open('research', titled('Research'), researchSheet(game, town, researchIn));
  const openAuto = () => { (game.shared.seen ||= {})['auto:sheet'] = true; autoBtn.classList.remove('dot'); sheets.open('auto', titled('Auto'), autoSheet(game, town, () => openResearch())); };
  const openArms = () => sheets.open('arms', titled('To arms'), armsSheet(game, town));
  const openPerks = () => { lookPerks(town); perksBtn.classList.remove('dot'); sheets.open('perks', titled('Perks'), perksSheet({ game, town, leave: shell.leave || (() => {}) })); };
  const openIncome = () => sheets.open('income', 'Coins a second', incomeSheet(income));
  const openFound = id => sheets.open('found', TOWNS[id].name, foundSheet(game, id, to => { sheets.close(); toast(TOWNS[to].name + ' is open.', 3000); if (shell.go) shell.go(to); }));
  const openCapital = () => sheets.open('capital', 'The Capital', capitalSheet(game, toast));
  const openPlaces = () => sheets.open('places', 'Map', placesSheet(game, { go: id => { sheets.close(); if (shell.go) shell.go(id); }, found: id => openFound(id), capital: openCapital }));
  const openVault = () => sheets.open('vault', titled(store === 'vault' ? 'Vault' : 'Stockpile'), vaultSheet(town)); // names its place (review of 2026.11.23-11)
  coins.addEventListener('click', openIncome); coins.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openIncome(); });
  vaultBtn.addEventListener('click', openVault);
  const openWave = () => sheets.open('wave', waveTitle(town), waveSheet(town));
  waveBtn.addEventListener('click', openWave);
  goodsBtn.addEventListener('click', () => openGoods()); menuBtn.addEventListener('click', openMenu); labBtn.addEventListener('click', openResearch); autoBtn.addEventListener('click', openAuto); armsBtn.addEventListener('click', openArms); perksBtn.addEventListener('click', openPerks);

  let openId = null, why = false, whyStat = null; // the number tapped on the open card, explained under it
  let showWhy = false; // set by a tap that opens a breakdown: the card scrolls it into view once, above the pinned row
  /* Bring a breakdown just opened into view above the card's pinned Upgrade row (review of 2026.11.19-11: in landscape
     the Damage breakdown opened under the cost row). Its top stays in view when it is taller than the room. */
  function showAbovePin(first, last = first) {
    showWhy = false;
    requestAnimationFrame(() => {
      if (!first.isConnected) return;
      const box = card.getBoundingClientRect(), pin = card.querySelector(':scope > .buybar:not(.pathbar), :scope > .row:has(> #buy)');
      const bottom = pin ? Math.min(box.bottom, pin.getBoundingClientRect().top) : box.bottom;
      // the top stays below the card's sticky title row (review of 2026.11.20-5: the Damage row sliced under it)
      const head = card.querySelector(':scope > .cardhead'), roof = head ? Math.max(box.top, head.getBoundingClientRect().bottom) : box.top;
      let top = first.getBoundingClientRect().top; const end = last.getBoundingClientRect().bottom;
      // the row and its breakdown do not both fit: the breakdown whole, down to its Total, the row above it under the
      // title (review of 2026.11.20-7: in landscape the Total sat under the cost bar)
      if (last !== first && end - top > bottom - roof - 4) top = Math.max(top, last.getBoundingClientRect().top);
      const down = Math.min(end - bottom, top - roof - 4);
      if (down < 0 && top < roof) { card.scrollTop += top - roof - 4; return; } // already scrolled past it: back up to it
      if (down > 0) card.scrollTop += down;
    });
  }
  let foeUi = null; // the raider card while it is open (src/ui/foe.js)
  function open(id) {
    if (sheets.current) sheets.close();
    if (foeUi) { foeUi = null; card.classList.remove('foecard', 'gonefoe', 'workercard'); }
    openId = id; why = false; whyStat = null; card.hidden = false; paintCard();
    viewApi.select(id.startsWith('spot:') ? { spot: +id.slice(5) } : { plot: id }); // highlight it on the board while the card is open
  }
  function openSpot(i) { open('spot:' + i); }
  /* A raider's card (owner, 2026-11-22): it follows the raider live, with the ring on it, while the game runs. */
  function openFoe(id) {
    const f = town.waves.foes.find(x => x.id === id && x.hp > 0);
    if (!f) return false;
    if (sheets.current) sheets.close();
    openId = 'foe:' + id; why = false; whyStat = null; card.hidden = false;
    foeUi = foeCard(card, town, f, { store, onClose: () => close() });
    viewApi.select({ foe: id });
    return true;
  }
  /* A building's workers called to arms (the card follows the call and closes a moment after it ends). */
  function openWorker(id) {
    if (!(town.arms && town.arms.t > 0)) return false;
    if (sheets.current) sheets.close();
    openId = 'worker:' + id; why = false; whyStat = null; card.hidden = false;
    foeUi = workerCard(card, town, id, { onClose: () => close() });
    viewApi.select({ worker: id });
    return true;
  }
  function close() { openId = null; foeUi = null; card.hidden = true; card.classList.remove('foecard', 'gonefoe', 'workercard'); viewApi.select(null); }
  viewApi.onTap = hit => { if (hit && hit.worker !== undefined) { if (!openWorker(hit.worker)) close(); } else if (hit && hit.foe !== undefined) { if (!openFoe(hit.foe)) close(); } else if (hit && hit.plot) open(hit.plot); else if (hit && hit.spot !== undefined) openSpot(hit.spot); else close(); };

  // the card is rebuilt only when something on it changes, so a button is never swapped under a finger
  let sig = '', madeEl = null, usedEl = null;
  function paintCard(force = true) {
    if (!openId) return;
    if (foeUi) return; // painted from the frame (foeAcc)
    if (openId.startsWith('spot:')) return paintSpot(+openId.slice(5), force);
    const id = openId, b = BUILDINGS[id], L = town.level(id), g = GOODS[b.makes];
    const kept = Math.ceil((town.keep || {})[b.makes] || 0), keepOn = !(town.reserveOff || {})[b.makes];
    const wait = foremanOn(town, id) ? foremanWait(game, town, id) : null;
    const grid = gridOf(town), gridShort = L > 0 && (onGrid(id) || isGrid(b.makes)) && grid.share < .999;
    // a short workshop that makes none says so (review of 2026.11.19-8: "Makes 0 boilers a second")
    const made = L ? explainMade(town, id) : null, madeText = made && made.lacking && fmt(made.value) === '0' ? 'Nothing right now' : isGrid(b.makes) ? Math.floor((made ? made.value : b.rate) + 1e-9) + ' power' : perSecond(made ? made.value : b.rate, g); // power as the workshops count it (review of 2026.11.20-4: "6 power a second" beside "need 9 power")
    if (madeEl && !why) setText(madeEl, madeText); // the rate moves as wagons come in: written in place, the card is not rebuilt for it
    // where the good goes in this town (review of 2026.11.20-12: "Makes 36 timber a second" beside a Timber count that
    // stayed at 84, the Sawmill used it), written in place like the rate
    const used = L && !isGrid(b.makes) ? usedBy(town, b.makes) : { ids: [] };
    const usedText = usedLine(used, g);
    if (usedEl) setText(usedEl, usedText);
    const now = [id, L, why, why ? madeText : !!(made && made.lacking), used.ids.join(), wait && wait.why + wait.good, Math.round(grid.made * 10), Math.round(grid.want * 10), cost(town, id), town.coins >= cost(town, id), String(town.starved[id] || ''), missing(town, id).length, town.sell[b.makes], kept, keepOn, hasForeman(town, id), foremanOn(town, id), canHire(town, id) && town.coins >= hireCost(town, id)].join();
    if (!force && now === sig) return;
    sig = now;
    card.replaceChildren();
    const head = el('div', 'cardhead');
    head.append(el('h2', null, b.name), el('span', 'lv', L ? 'Level ' + L : unlocked(town, id) ? 'Not built' : 'Locked'));
    const x = el('button', 'btn small close', 'Close'); x.addEventListener('click', close); head.append(x);
    card.append(head);
    const line = el('button', 'stat');
    line.append(el('span', null, L ? 'Makes' : 'Makes at level 1'), madeEl = el('b', null, madeText)); // what it really makes: less when short
    line.addEventListener('click', () => { why = !why; showWhy = why; paintCard(); });
    card.append(line);
    line.setAttribute('aria-expanded', String(why && !!L));
    if (why && L) card.append(explainBox(made));
    const ins = Object.entries(b.inputs), goodsIn = ins.filter(([k]) => !isGrid(k)); // power is not used up by each one, so it has its own line (review of 2026.11.20-12: "Each glass uses 2 sand and 1 power")
    if (goodsIn.length) card.append(el('p', 'uses', 'Each ' + oneOf(g) + ' uses ' + goodsIn.map(([k]) => fmt(uses(town, id, k)) + ' ' + GOODS[k].name.toLowerCase()).join(' and ') + '.'));
    usedEl = null; if (usedText) card.append(usedEl = el('p', 'uses', usedText)); // what goes in, then where it goes
    // the tapped row stays in view above the pinned price, down to the line of where its goods go (review of
    // 2026.11.23-9: that last line sat under the pinned bar)
    if (why && L && showWhy) showAbovePin(line, card.lastElementChild);
    // goods shipped in from another town (src/core/economy.js, ship): where they come from, and what to do when short
    const imp = ins.map(([k]) => k).filter(k => ((town.def && town.def.imports) || []).includes(k));
    const fromName = g => { const t = TOWNS[GOODS[g].town]; return t ? t.short || t.name : 'another town'; };
    const makerOf = g => Object.values(BUILDINGS).find(x => x.makes === g && x.town === GOODS[g].town);
    // the power grid (Silver Falls): the Water Wheel says how much of its power the workshops use
    // power as have / need in whole numbers, one short line (review of 2026.11.19-14: four sentences and "8.4 power"),
    // red when short (review of 2026.11.19-7: power was named but never counted)
    if ((isGrid(b.makes) || onGrid(id)) && L) {
      const want = Math.ceil(grid.want - 1e-9), pr = el('p', 'uses powerline'), n = el('span', 'need' + (gridShort ? ' low' : ''), isGrid(b.makes) ? want + ' power' : Math.floor(grid.made + 1e-9) + ' / ' + want);
      pr.append(isGrid(b.makes) ? 'Buildings here need ' : 'Town power ', n); card.append(pr); // the Wheel's Makes row shows what it makes
    }
    // the line above shows the shortage, so the warning only says what it does and what to upgrade
    // said for this card, not as a rule (review of 2026.11.20-12: the same sentence on every card read like a manual)
    if (gridShort) card.append(el('p', 'warn', isGrid(b.makes) ? 'Upgrade it so they run at full speed.' : 'Not enough power, so it works slower. Upgrade the Water Wheel.'));
    const shortImp = imp.filter(g => (town.goods[g] || 0) < uses(town, id, g));
    // where shipped goods come from, unless the short warning below says it (review of 2026.11.20-11: "Bricks come by
    // wagon" beside "Not enough bricks" on the Boiler Shop)
    if (imp.length && !(town.starved[id] && L && shortImp.length && !gridShort && town.starved[id] !== 'towers')) card.append(el('p', 'uses', imp.map(g => GOODS[g].name).join(' and ') + ' come by wagon from ' + fromName(imp[0]) + '.'));
    if (gridShort) { /* said above */ }
    else if (town.starved[id] === 'towers' && L) {
      // held back by the tower reserve (src/core/economy.js, WORKSHOP): the yard has the input, the towers come first
      const g0 = Object.keys(b.inputs).find(g => (town.goods[g] || 0) - ((town.keepUse || {})[g] || 0) < uses(town, id, g)) || Object.keys(b.inputs)[0];
      card.append(el('p', 'warn', 'Your towers get the ' + GOODS[g0].name.toLowerCase() + ' first. This runs again when there is more.'));
    }
    else if (town.starved[id] && L && shortImp.length) {
      // the town that makes it may not have built its maker yet: then the line says to build it
      const g0 = shortImp[0], mk = makerOf(g0), src = game.towns[GOODS[g0].town], mid = mk && Object.keys(BUILDINGS).find(k => BUILDINGS[k] === mk);
      const verb = src && mid && !src.level(mid) ? 'Build a ' : 'Upgrade the ';
      card.append(el('p', 'warn', 'Not enough ' + GOODS[g0].name.toLowerCase() + '. ' + verb + (mk || { name: 'workshop' }).name + ' in ' + fromName(g0) + '.'));
    }
    else if (town.starved[id] && L) card.append(el('p', 'warn', 'It ran out of materials. Upgrade the building that supplies it.'));
    const miss = missing(town, id);
    if (miss.length) card.append(el('p', 'warn', 'Unlocks when ' + miss.map(m => 'the ' + BUILDINGS[m.id].name + ' reaches level ' + m.level).join(' and ') + '.'));
    const row = el('div', 'row sellrow');
    const c = cost(town, id), buy = el('button', 'btn primary buy');
    buy.id = 'buy'; buy.textContent = L ? 'Upgrade' : 'Build';
    const bcost = el('div', 'buybar'); bcost.append(costRow({ coins: c, goods: {} }));
    buy.disabled = !!miss.length || town.coins < c;
    buy.addEventListener('click', () => { if (build(game, town, id)) paintCard(); });
    row.append(buy);
    const mode = sellMode(town, b.makes), selling = mode !== 'off', sell = setSwitch(el('button', 'btn small'), 'Sell spare ' + g.name.toLowerCase(), MODE_WORDS[mode], selling); // one line, under Upgrade when both do not fit (.sellrow); the Goods sheet picks Skip busts or Booms only
    sell.id = 'sell';
    sell.title = cap(sellsFor(paysEach(game, town, b.makes)));
    sell.addEventListener('click', () => { setSellMode(town, b.makes, selling ? 'off' : 'always'); paintCard(); });
    bcost.append(row); card.append(bcost);
    // the Sell switch sits under the pinned bar, away from the price, so the price reads as Upgrade's alone (review of
    // 2026.11.19-13: "401 / 12 coins" sat above both Upgrade and Sell), with the tower reserve's switch beside it
    const kr = el('div', 'row keeprow switchrow');
    if (!isGrid(b.makes)) kr.append(sell); // power is never sold
    if (L && selling && Object.entries(TOWERS).some(([k, t]) => towerIn(town, k) && (t.goods[town.id] || {})[b.makes])) {
      const ks = setSwitch(el('button', 'btn small'), STOCK_LABEL, keepOn ? 'On' : 'Off', keepOn); // one name with the Goods sheet (review of 2026.11.20-15)
      ks.id = 'keepTowers';
      ks.addEventListener('click', () => { setReserve(town, b.makes, !keepOn); paintCard(); });
      kr.append(ks);
    }
    if (kr.children.length) card.append(kr);
    // a foreman: hired once the building reaches level 10, then it buys levels by itself until switched off
    if (L >= FOREMAN_LEVEL || hasForeman(town, id)) {
      const fr = el('div', 'row keeprow');
      if (!hasForeman(town, id)) {
        const h = el('button', 'btn small', 'Hire foreman'); h.id = 'hireForeman'; // its price as have / need beside it (review of 2026.11.19-13)
        // what a foreman does, in a few words (review of 2026.11.20-7: Hire foreman alone did not say)
        card.append(el('p', 'uses', 'A foreman upgrades this building for you.')); // its own line, never wrapped beside the price
        fr.append(costRow({ coins: hireCost(town, id), goods: {} }));
        h.disabled = town.coins < hireCost(town, id);
        h.addEventListener('click', () => { if (hireForeman(game, town, id)) paintCard(); });
        fr.append(h);
      } else {
        const on = foremanOn(town, id);
        fr.append(el('span', 'uses', !on ? '' : wait ? waitText(wait) : 'Upgrades to level ' + (L + 1) + ' when you have ' + fmt(cost(town, id) / SHARE) + ' coins.'));
        const sw = setSwitch(el('button', 'btn small'), 'Foreman upgrades', on ? 'On' : 'Off', on); sw.id = 'foremanSwitch'; // says what it does (review of 2026.11.20-3: "Foreman · On" said nothing)
        sw.addEventListener('click', () => { setForeman(town, id, !on); paintCard(); });
        fr.append(sw);
      }
      card.append(fr);
    }
  }

  /* Why a working foreman is not buying (src/core/foremen.js, foremanWait), in plain words (foremanLine, src/ui/explain.js). */
  const waitText = w => foremanLine(w.why, GOODS[w.good].name.toLowerCase());

  let armed = null; // a path tapped once, waiting for the second tap
  /* A cost as a row: the coins, then each good with its square, each "have / need", red when short (review 2026-11-18:
     coins showed only a price). The coins cell keeps up with the purse 5 times a second (paintCoinCosts), so the card is
     not rebuilt for it. */
  const coinCost = need => fmt(need) + ' coins'; // the price first, what you have under it (review of 2026.11.20-14: "400 / 12 coins" read as 400 out of 12) // one have / need form on every card, the path bar too (review of 2026.11.20-9: the path bar's price-first form was the odd one out) // lead: the price first, after "Each path costs" (review of 2026.11.20-8: it read as a 9.99M price) // the purse as the top bar writes it
  const costRow = (c, lead = false) => {
    const r = el('span', 'costrow'), cc = el('span', 'need coinneed' + (town.coins + 1e-9 < c.coins ? ' low' : ''));
    const ct = el('span', 'nd', coinCost(c.coins)), ch = el('small', 'hv', haveWords(town.coins)); cc.append(ct, ch);
    cc.dataset.need = c.coins; if (lead) cc.dataset.lead = '1'; r.append(cc);
    for (const [g, n] of Object.entries(c.goods)) {
      const have = Math.floor((town.goods[g] || 0) + 1e-9), p = el('span', 'need goodneed' + (have < n ? ' low' : ''));
      p.dataset.good = g; p.dataset.need = n;
      const top = el('span', 'nd'); top.append(goodIcon(g), el('span', 'gname', fmt(n) + ' ' + GOODS[g].name.toLowerCase()));
      p.title = GOODS[g].name; p.append(top, el('small', 'hv hn', haveWords(have))); // the count as the goods strip writes it, kept up in place (paintCoinCosts)
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
    const when = 'You will have enough ' + name.toLowerCase() + (s.seconds < 5 ? ' in a moment.' : ' in about ' + time(s.seconds) + '.');
    return s.seconds < 20 ? when : when + ' Upgrade the ' + b.name + ' to make ' + name.toLowerCase() + ' faster.'; // a short wait needs no advice
  });
  // names the goods, not amounts: the cost row above has them (review of 2026.11.19-9: "20 copper and 20 bricks are set aside" said the cost twice)
  const keepText = c => { const g = Object.keys(c.goods).filter(k => ((town.keep || {})[k] || 0) > 0); if (!g.length) return ''; return keepLine(g.map(k => GOODS[k].name.toLowerCase()), pathNext ? 'path' : 'upgrade'); };
  // "You will have enough ... in about 4 seconds" is good news, so it reads in plain ink, not red (review 2026-11-18)
  const soon = s => s.startsWith('You will have enough');
  const bossWords = s => (s || '').replace('{boss}', 'the ' + bossName(town));
  let pathNext = false;
  function paintSpot(i, force) {
    const t = towerAt(town, i), pit = isPit(town, i), kinds = Object.keys(TOWERS).filter(k => towerIn(town, k) && fitsSpot(town, i, k));
    const shorts = t ? shortText(towerCost(town, t.kind, t.level)) : kinds.map(k => shortText(towerCost(town, k, 0)));
    const now = ['spot', i, t ? [t.kind, t.level, t.path, t.fork, whyStat, fmtDmg(towerStats(town, t).dmg)] : '', ...(t ? [canPay(town, towerCost(town, t.kind, t.level)), haveSig(towerCost(town, t.kind, t.level))] : kinds.map(k => canPay(town, towerCost(town, k, 0)) + towerOpen(town, k) + haveSig(towerCost(town, k, 0)))), JSON.stringify(shorts)].join();
    if (!force && now === sig) return;
    sig = now;
    card.replaceChildren();
    const head = el('div', 'cardhead');
    const x = el('button', 'btn small close', 'Close'); x.addEventListener('click', close);
    if (!t) {
      head.append(el('h2', null, pit ? 'Mortar pit' : 'Stone pad'), x); card.append(head);
      const cl = pit ? '' : crowdLine(town); if (cl) card.append(el('p', 'uses crowdline', cl)); // why the price is up (owner, 2026-11-20: more pads)
      if (pit && !kinds.some(k => towerOpen(town, k))) {
        card.append(el('p', 'uses', 'You can build a Mortar here at wave ' + TOWERS.mortar.opens + '.'));
        return;
      }
      for (const k of kinds) {
        const d = TOWERS[k], c = towerCost(town, k, 0), row = el('div', 'option'), shut = !towerOpen(town, k);
        const txt = el('div'); txt.append(el('b', null, d.name), el('span', null, bossWords(d.about)), shut ? el('small', null, 'You can build it at wave ' + d.opens) : costRow(c));
        if (!shut) for (const s of shortText(c)) txt.append(el('small', soon(s) ? 'soon' : 'short', s));
        const go = el('button', 'btn small build', 'Build'); go.dataset.kind = k; go.disabled = shut || !canPay(town, c);
        go.addEventListener('click', () => { if (buildTower(game, town, i, k)) paintCard(); });
        row.append(txt, go); card.append(row);
      }
      return;
    }
    const d = TOWERS[t.kind], st = towerStats(town, t), p = t.path ? PATHS[t.kind][t.path] : null, fk = t.fork && FORKS[t.kind] ? FORKS[t.kind][t.fork] : null;
    // Sell sits in the card's head at every size: a Sell row over the pinned price was cut under it, in landscape
    // (review of 2026.11.20-15) and then on a phone for a level-20 tower (reviews of 2026.11.21-8 and -9)
    const sellHead = el('button', 'btn small sellhead', 'Sell '); sellHead.id = 'sellTowerHead'; // the coin square is the unit (review of 2026.11.21-2: "Sell 60" had none)
    sellHead.append(el('span', 'coin'), fmt(Math.floor(t.spent * SELL_BACK)));
    sellHead.addEventListener('click', () => { sellTower(game, town, i); paintCard(); });
    const nm = el('div', 'namecol'); nm.append(el('h2', null, fk ? fk.name : p ? p.name : d.name), el('span', 'lv', 'Level ' + t.level)); // the level drops under a long name (review of 2026.11.23-6: the Sharpshooter card scrolled sideways on a phone)
    head.append(nm, sellHead, x); card.append(head);
    const stats = el('div', 'explain'), ex = explainTower(town, t), whyBox = [], statRow = {};
    // Damage, Shots and Range can be tapped: what makes the number shows under the list
    const line = (a, b, key) => {
      // statline: a stat with nothing to tap (Best against), laid out like the others in landscape
      const r = el(key ? 'button' : 'div', key ? 'statrow' : 'statline'); r.append(el('span', null, a), el('b', null, b)); stats.append(r);
      if (!key) return;
      statRow[key] = r;
      r.dataset.why = key; r.setAttribute('aria-expanded', String(whyStat === key)); r.classList.toggle('on', whyStat === key);
      r.addEventListener('click', () => { whyStat = whyStat === key ? null : key; showWhy = !!whyStat; paintCard(); });
    };
    line('Damage', fmtDmg(st.dmg) + ' a hit' + (st.poison || st.rot ? ' + ' + fmtDmg(st.poison || st.rot) + ' poison a second' : ''), 'dmg'); // in words like Shots (review of 2026.11.23-9: "105/s poison" beside "1.4 a second")
    if (st.rot) line('Poison lasts', 'Until the raider falls');
    // poison eats armor (M6a): from its level, and before it what the level brings
    if (st.eat) line('Poisoned raiders', eatWords(st.eat));
    else if (st.poison || st.rot) line('At level ' + EATS_ARMOR.from, 'Poison eats armor');
    if (st.hurt) line('Raiders low on health', hurtWords());
    if (st.rockets) line('Rockets', st.rockets + ' at once');
    if (st.pierce) line('Each bolt hits', 'Up to ' + st.pierce + ' raiders');
    if (st.sharp) line('Aims at', 'The toughest raider');
    if (st.boss > 1) { const b = bossWords('{boss}'); line('Against ' + b, st.boss === 2 ? 'Twice the damage' : st.boss + ' times the damage'); }
    line('Shots', shotsWord(st.rate), 'rate'); line('Range', reachWord(st.range, st.minRange), 'range');
    if (st.splash) line('Blast', blastWord(st.splash), 'splash');
    if (st.slow) line('Slows raiders', Math.round(st.slow * 100) + '%');
    if (st.fire) line('Burning ground', 'slows and hurts');
    if ((fk && fk.bestText) || d.bestText) line('Best against', bossWords((fk && fk.bestText) || d.bestText)); // a fork can change the job
    // no Path row after the fork: "Path · Heavy Cannon" was flagged in two reviews (2026.11.21-9, 2026.11.22-1); the model shows it
    card.append(stats);
    if (whyStat === 'dmg') { whyBox.push(explainBox(ex.dmg)); if (ex.poison) whyBox.push(explainBox(ex.poison, { total: 'Poison a second' })); }
    else if (whyStat) whyBox.push(explainBox(ex[whyStat], { extra: { minRange: st.minRange } }));
    card.append(...whyBox);
    // the breakdown opens right under its row, and the rows after it carry on below (review of 2026.11.20-6: under the
    // whole list it ran under the pinned cost bar, "Total 59" sliced)
    if (whyBox.length && statRow[whyStat]) {
      const rest = []; for (let n = statRow[whyStat].nextSibling; n; n = n.nextSibling) rest.push(n);
      if (rest.length) { const more = el('div', 'explain'); more.append(...rest); card.append(more); }
    }
    if (showWhy && whyBox.length) showAbovePin(statRow[whyStat] || whyBox[0], whyBox[whyBox.length - 1]); // from the tapped row (screenshot review of this release) // after the bar is in: see the end of paintSpot
    const c = towerCost(town, t.kind, t.level), row = el('div', 'row');
    // the main action stays at the card's bottom edge while the card scrolls (Evaluation 2, landscape): the path choice,
    // or the cost, what is short and the Upgrade button
    // the level-5 path and the level-20 fork (FORKS) are the same choice on the card: two sides, one price
    const forkUp = forkNext(t), choices = t.level + 1 === PATH_LEVEL ? PATHS[t.kind] : forkUp ? FORKS[t.kind] : null;
    const path = !!choices, bar = el('div', path ? 'buybar pathbar' : 'buybar');
    if (choices) {
      const ph = el('div', 'pathhead'), pt = el('div');
      // one name for both picks (review of 2026.11.23-9: "Pick an upgrade" against "Pick a path")
      pt.append(el('b', null, 'Pick an upgrade'), el('small', null, 'Can\'t be undone'));
      const pc = costRow(c, true); // one price above two Choose buttons (review of 2026.11.19-13), on its own row under Pick a path with no label (review of 2026.11.20-13: "Either path 9.99M / 2.31K coins" read as a cut-off label, and Bricks wrapped)
      const pw = el('div', 'pathcost'); pw.append(el('small', null, 'Either one costs'), pc); // says both paths cost the same (review of 2026.11.20-14), now that the price comes first
      ph.append(pt, pw); bar.append(ph);
      for (const [key, P] of Object.entries(choices)) {
        const opt = el('div', 'option'), txt = el('div'); txt.append(el('b', null, P.name), el('span', null, bossWords(P.about)));
        const sure = armed && armed.spot === i && armed.path === key && Date.now() - armed.at < 4000;
        const go = el('button', 'btn small build', sure ? 'Tap again to choose' : 'Choose'); go.dataset.path = key; go.disabled = !canPay(town, c);
        go.addEventListener('click', () => {
          if (armed && armed.spot === i && armed.path === key && Date.now() - armed.at < 4000) { armed = null; if (upgradeTower(game, town, i, key)) paintCard(); return; }
          armed = { spot: i, path: key, at: Date.now() }; paintCard();
          setTimeout(() => { if (armed && Date.now() - armed.at >= 4000) { armed = null; paintCard(); } }, 4100);
        });
        opt.append(txt, go); bar.append(opt);
      }
      head.after(bar); // too tall to pin on a short screen: the choice comes first, right under the name
    } else {
      const up = el('button', 'btn primary buy', 'Upgrade'); up.id = 'buy'; up.disabled = !canPay(town, c);
      up.addEventListener('click', () => { if (upgradeTower(game, town, i)) paintCard(); });
      bar.append(costRow(c));
      row.append(up);
    }
    // what the buy is short of sits in the card over the pinned bar, never in it, so the bar stays one price and one
    // button and covers no stat (reviews of 2026.11.21-7 to -9: in landscape the bar took half the card)
    const sh = shortText(c); pathNext = path;
    const lines = card;
    // the first sentence (how long) and the rest (which building to upgrade) apart: a short landscape screen shows only
    // the first, so the note stays whole over the pinned price (2026.11.21-10)
    if (sh.length) for (const s of sh) { const p = el('p', soon(s) ? 'uses soon' : 'warn short'), k = s.indexOf('. ') + 1; if (k > 0) p.append(s.slice(0, k), el('span', 'more', s.slice(k))); else p.textContent = s; lines.append(p); }
    // the kept goods line sits over the pinned bar, not in it, so the bar stays short and the stats stay in view (review
    // of 2026.11.19-9: in landscape the Cannon card's Blast row was cut by its cost row)
    // only while the buy is still short of something: once it can be paid the line says nothing (screenshot review of 2026.11.20-3)
    else if (!canPay(town, c) && keepText(c)) card.append(el('p', 'uses', keepText(c)));
    if (!path) {
      bar.append(row); card.append(bar);
      // on a short landscape screen a note that would sit half under the pinned price is left out: the red have in the
      // price says what is short (smoke: nothing half under the price bar, 2026.11.21-10)
      if (shortLand()) for (const p of card.querySelectorAll(':scope > p')) { const b = bar.getBoundingClientRect(), r = p.getBoundingClientRect(); if (r.height && r.bottom > b.top + 1) p.hidden = true; }
    }
  }

  // news from the road
  const offs = [
    game.bus.on('wave:start', e => { if (e.town === town.id && e.boss) toast('Wave ' + e.wave + '. The ' + (FOES[town.def.boss || 'wagon'] || FOES.wagon).name.toLowerCase() + ' is coming. Stop it before it reaches the ' + store + '.', 4000); }),
    game.bus.on('charter:offer', e => { if (e.town === town.id && !isOutpost(town)) toast('You can sign the charter for ' + e.deeds + (e.deeds === 1 ? ' deed' : ' deeds') + '. Tap Perks.', 4000, { kind: 'here' }); }), // only where Perks shows (review of 2026.11.23-6: in Pine Hollow)
    game.bus.on('contract:done', e => { if (!game.catching) toast(contractDone(e) + ' Tap Map, then Capital, to take another contract.', 5000, { kind: 'tomap' }); }),
    game.bus.on('contract:miss', e => { if (!game.catching) toast(contractMissed(e) + ' Tap Map, then Capital, to take another contract.', 5000, { kind: 'tomap' }); }),
    game.bus.on('capital:ready', e => { if (!game.catching) toast(capitalReadyWords(e), 5000); }),
    game.bus.on('order:done', e => { if (!game.catching) toast(orderDone(e, e.town === town.id), 4000); }),
    game.bus.on('order:miss', e => { if (!game.catching && !e.gaveUp) toast(orderMissed(e, e.town === town.id), 5000); }),
    game.bus.on('arms:end', e => { if (e.town === town.id) toast('Your workers are back at work.', 2500); }),
    // not over the open Research sheet, whose rows already show it (review of 2026.11.23-9)
    game.bus.on('research:done', e => { if (e.town === town.id && sheets.current !== 'research') toast(RESEARCH[e.id].name + ' level ' + e.level + ' is done.', 3000, { kind: 'here' }); }),
    game.bus.on('research:new', e => { if (e.town === town.id && sheets.current !== 'research') toast('New research. Tap Research to see ' + RESEARCH[e.id].name + '.', 4000, { kind: 'here' }); }),
    game.bus.on('breach', e => {
      // a town away that lost holds its own waves: say so wherever the player is (owner rule, 2026-11-17)
      if (e.held && game.catching) return; // time away: the Welcome back line lists it (src/main.js)
      if (e.held && !e.away && e.town === town.id) { showLost(); return; } // the boss got through here: a card, waves on hold
      if (e.held && game.towns[e.town]) { toast(lostToast(game.towns[e.town], e.town === town.id, game), 6000, { kind: 'lost' }); return; }
      if (e.town !== town.id) return;
      if (e.goods) toast('Raiders got through to the ' + store + ' and took a quarter of its goods.', 5000);
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
    ok.addEventListener('click', () => { layer.remove(); paintGoal(0); });
    card.append(el('b', 'newstitle', c.title), body, ok); layer.append(card); root.append(layer);
    paintCtl();
  }

  // the goal strip: a finished goal shows Done for a moment, then the next one comes in
  let goalId = null, goalCur = null, doneFor = 0;
  // a goal that saves coins adds have / need, written with the top bar; heldText changes the words once the waves are held
  // meter: the empire's next step counts a wave or deeds the same way (src/core/goals.js, nextStep)
  // a coin goal also says how soon it is ready if you save, at the empire's income over the last minute (clarity fix 2)
  const earnHist = []; let earnPer = 0;
  const readyOf = g => { const w = readyWords(readyIn(town.coins, g.need, earnPer)); return w ? ' · ' + w : ''; };
  /* A place's name never breaks across lines on the strip (review of 2026.11.23-6: "Save coins to open Iron / Ridge"). */
  const NAMES = Object.values(TOWNS).map(t => t.name).filter(n => n.includes(' ')).concat(['the Capital']);
  const keepNames = s => NAMES.reduce((a, n) => a.split(n).join(n.replace(/ /g, '\u00a0')), s);
  // a goal for several towers counts them, "2 of 5", and a coin count names coins (review of 2026.11.23-7)
  const countOf = g => { if (!g.count) return ''; const [a, b] = g.count(goalContext(game, town)); return ' · ' + Math.min(a, b) + ' of ' + b; };
  const goalWordsOf = g => { const t = goalText(game, town, g); return keepNames(t) + (g.meter ? (meterWords(g, game) ? ' · ' + meterWords(g, game) : '') : g.need && town.coins < g.need ? ' · ' + fmtLive(Math.floor(town.coins)) + ' / ' + fmt(g.need) + (/coins/.test(t) ? '' : ' coins') + readyOf(g) : countOf(g)); }; // whole coins (review of 2026.11.23-2: "2.9 / 30"), and only while short (review of 2026.11.23-6: "9.99M / 250" beside a lot the purse could buy 40,000 times)
  function paintGoal(dt) {
    const ws = town.waves, boss = ws.phase !== 'break' && bossWave(town, town.wave);
    const g0 = goalNow(game), lostUp = !!(g0 && g0.resume && document.getElementById('lostCard')), sh = game.shared.goals || { done: {} };
    // an explainer card is up and stops the game, so a goal it just finished is not marked done yet: it goes from the
    // strip at once (review of 2026.11.19-4: "Beat wave 10 to open Copper Gulch" behind "Copper Gulch is open")
    const coachEl = document.getElementById('coach'), stale = !!(g0 && g0.done && coachEl && !coachEl.hidden && g0.done(goalContext(game, town)));
    // a card with its own Play button for the next place is up: the strip does not say the same trip a second way
    // (review of 2026.11.23-9: "Tap Map, then tap Copper Gulch" beside the card's Play Copper Gulch)
    const goBtn = document.getElementById('coachGo'), goCard = !!(coachEl && !coachEl.hidden && goBtn && !goBtn.hidden);
    // a boss fight here: no goal that sends you away
    const now = (boss && sendsAway(g0)) || (goCard && sendsAway(g0)) || lostUp || stale ? null : g0;
    if (doneFor > 0) { doneFor -= dt; if (doneFor > 0) return; goal.classList.remove('done'); setText(goalTag, 'Goal'); if (!now) goal.hidden = true; } // nothing next: the finished goal's words go too
    if ((now && now.id) === goalId) return;
    if (goalId && sh.done[goalId]) {
      doneFor = 1.4; goal.classList.add('done'); setText(goalTag, 'Done'); if (goalCur) setText(goalWords, goalCur.doneText || goalCur.text); goalId = null; goalCur = null;
      // only with no next goal at all (reviews of 2026.11.23-6 and -7: beside "Reach wave 30 in Iron Ridge" and the Capital's first building)
      if (!now && goalsOf(town.id).every(g => sh.done[g.id])) toast('You finished every goal in this town.', 4000, { kind: 'here' });
      return;
    }
    goalId = now ? now.id : null; goalCur = now;
    goal.hidden = !now;
    if (!now) return;
    setText(goalWords, goalWordsOf(now));
    goal.classList.remove('new'); void goal.offsetWidth; goal.classList.add('new');
  }
  // the spotlight on what the goal says to tap: a pulsing frame over it, under the cards and sheets. Things on the board
  // follow the camera every frame from their projected point (no reads of the page, which would force a layout);
  // what it points at, and the size of a button or tag, are looked up five times a second (measure).
  let cardTop = 0, hudTop = 0, sideBot = -1, coverBoxes = [], stripUp = -1, foldSig = '';
  /* A short landscape screen: the side buttons sit in one row beside Pause and Hold waves until that row would run over
     them, then fold into 3 columns, then 2, and last Pause and Hold waves drop under the wave bar (review of
     2026.11.23-6: at 860x400 six side buttons covered Hold waves, so "Resume waves" read "Resu"). Tried only when what
     sets the widths changes: the screen, which buttons show, and the words on Pause and Hold waves. */
  const FOLDS = [[], ['c3'], ['c2'], ['c2', 'low']];
  const fold = () => {
    const sig = innerWidth + 'x' + innerHeight + ':' + [...side.children].map(n => n.hidden ? '-' : n.firstChild.textContent).join() + ':' + pause.textContent + hold.textContent;
    if (sig === foldSig) return; foldSig = sig;
    const set = f => { for (const c of ['c3', 'c2']) side.classList.toggle(c, f.includes(c)); left.classList.toggle('ctllow', f.includes('low')); };
    if (!shortLand()) { set([]); return; }
    for (const f of FOLDS) {
      set(f);
      const r = right.getBoundingClientRect(), a = ctl.getBoundingClientRect(), w = wave.getBoundingClientRect();
      if (Math.max(a.right, w.right) + 6 <= r.left) return;
    }
  };
  let markAt = null; // the goal's tag's point this frame (frame), for the mark around it (placeMark)
  let markTg = null, markBox = null, markW = 0, markH = 0, markSig = '', stripBox = null, stripH = -1, stripW = '', leftBox = null;
  const tagSize = new WeakMap(); // each level tag's size, read with the 5-a-second measure
  function measure() {
    fold(); // first, since the card's top and the sheet's room below read the side buttons' height
    // a card at the bottom opens above the goods strip, so the counts stay in view (owner rule: you can always see what
    // you have; review of 2026.11.19-4: the mortar pit card cut off the timber count)
    const sh = strip.hidden ? 0 : Math.round(strip.getBoundingClientRect().height + 4);
    if (sh !== stripH) { stripH = sh; ui.style.setProperty('--striph', sh + 'px'); }
    // how far up from the screen's bottom edge the strip reaches: a sheet sits on it (bottom is 0 with no strip)
    const su = strip.hidden ? 0 : Math.max(0, Math.round(innerHeight - strip.getBoundingClientRect().top + 4));
    if (su !== stripUp) { stripUp = su; ui.style.setProperty('--stripup', su + 'px'); }
    // a side card (a short landscape screen) leaves the strip the room to its left, so it covers no count
    let sw = '';
    // one row beside a side card only when the goods it must show fit in it (the tower goods always show, so on a wide
    // path card they ran under the card)
    const oneFits = w => { const n = Math.max(3, Math.floor(w / 84)), f = stripFit(town, n - (gridMaker() ? 1 : 0)); return f.list.length + (f.more ? 1 : 0) + (gridMaker() ? 1 : 0) <= n; };
    // (a side sheet too: review of 2026.11.19-7, the Perks and Menu sheets cut "Clay 40" in landscape)
    const sheetEl = sheets.current ? document.getElementById('sheet') : null;
    if (!strip.hidden) for (const p of [openId && !card.hidden ? card : null, sheetEl]) {
      if (!p) continue;
      const c = p.getBoundingClientRect(), s0 = strip.getBoundingClientRect();
      if (c.width && c.left > innerWidth * .35 && c.bottom > s0.top) { const w = Math.max(160, Math.floor(c.left - s0.left - 8)); if (!sw || w < parseInt(sw)) sw = w + 'px'; }
    }
    // a sheet starts below the side buttons when that leaves it room, and a side button it would still cut hides while
    // it is open, so none shows cut in half (review of 2026.11.19-6: the Perks sheet cut Perks and hid Menu)
    { const b = side.getBoundingClientRect(), sb = b.height ? Math.round(b.bottom + 6) : 0; if (sb !== sideBot) { sideBot = sb; ui.style.setProperty('--sidebot', sb + 'px'); } }
    { const sh0 = sheets.current && document.getElementById('sheet'), r = sh0 && sh0.getBoundingClientRect();
      for (const n of side.children) { const c = r && r.height && !n.hidden ? n.getBoundingClientRect() : null, cut = !!(c && c.left < r.right && c.right > r.left && c.top < r.bottom && c.bottom > r.top); if (n.classList.contains('undersheet') !== cut) n.classList.toggle('undersheet', cut); } }
    if (sw !== stripW) { stripW = sw; strip.style.maxWidth = sw; strip.style.width = sw; } // three columns there, so every name and count fits
    // a phone held upright with more goods than three columns hold: four smaller chips a row, name under the count, so
    // fewer goods hide behind a more box (review of 2026.11.20-3: "more boxes hide goods")
    const dense = !sw && !shortLand() && innerWidth < 600 && stripGoods(town).length > 6;
    { const nw = !!sw || shortLand() || dense, one = shortLand() && (!sw || oneFits(parseInt(sw))); if (strip.classList.contains('narrow') !== nw) strip.classList.toggle('narrow', nw); if (strip.classList.contains('oneline') !== one) strip.classList.toggle('oneline', one); } // a short landscape screen: one row of small chips, beside a side card too, so a picked building or its ring has room above it (review of 2026.11.20-14: short-land, pit-land, foreman-wait-land)
    room = stripRoom(strip); // the strip's two rows, read here with the other measures (the layout is fresh)
    // a frame on the board never covers the goal strip it belongs to (it would hide the words): kept here, read 5 times a second
    if (goalCur && goalCur.wait && doneFor <= 0) setText(goalWords, goalText(game, town, goalCur)); // "Wait for..." until it can be paid
    // what covers the board: the camera fits its home view under the top bar and keeps the selection clear of the card
    if (viewApi.setView) {
      let top = 0;
      for (const n of hud.querySelectorAll('.hudleft, .hudright')) { const b = n.getBoundingClientRect(); if (b.height) top = Math.max(top, b.bottom); }
      // landscape cards and sheets start below Pause, Hold waves and the coins (Evaluation 2: a side card covered them)
      let ct = 0;
      for (const n of [right, ctl]) { const b = n.getBoundingClientRect(); if (b.height) ct = Math.max(ct, b.bottom); }
      ct = Math.round(ct + 6);
      if (ct > 6 && ct !== cardTop) { cardTop = ct; ui.style.setProperty('--cardtop', ct + 'px'); }
      // a tall card on a phone stops under the whole top bar: Pause, Hold waves and the goal strip (review of 2026.11.19-9:
      // the stone pad card covered their bottom edge)
      const ht = Math.round(Math.max(top, ct - 6) + 6);
      if (ht > 6 && ht !== hudTop) { hudTop = ht; ui.style.setProperty('--hudtop', ht + 'px'); }
      const cb = openId && !card.hidden ? card.getBoundingClientRect() : null;
      // the goods strip too: a selection never slides under it (review of 2026.11.20-8: in landscape the strip covered
      // the selected Lumber Camp)
      const sb = strip.hidden ? null : strip.getBoundingClientRect();
      viewApi.setView(top, cb && cb.height ? { l: cb.left, t: cb.top, r: cb.right, b: cb.bottom } : null, sb && sb.height ? { l: sb.left, t: sb.top, r: sb.right, b: sb.bottom } : null);
    }
    if (goal.hidden) stripBox = null; else { const b = goal.getBoundingClientRect(); stripBox = { x: b.left, y: b.top, w: b.width, h: b.height }; }
    { const b = left.getBoundingClientRect(); leftBox = b.height ? { l: b.left, r: b.right, b: b.bottom } : null; }
    // what a level tag may never show cut in half under: the top bar's two columns, the goods strip and an open card or
    // sheet (review of 2026.11.19-7: "Lv 5" cut by a card's edge, "Lv 13" by the strip, "Lv 8" by Pause)
    coverBoxes = [left, right, strip.hidden ? null : strip, openId && !card.hidden ? card : null, sheets.current ? document.getElementById('sheet') : null]
      .filter(Boolean).map(n => [n, n.getBoundingClientRect()]).filter(([, b]) => b.width && b.height).map(([n, b]) => ({ n, l: b.left, r: b.right, t: b.top, b: b.bottom }));
    for (const t of Object.values(tag)) if (!t.hidden) tagSize.set(t, [t.offsetWidth, t.offsetHeight]);
    const coachUp = document.getElementById('coach'), busy = sheets.current || (coachUp && !coachUp.hidden) || doneFor > 0;
    markTg = !busy && goalCur && goalCur.at ? goalCur.at(goalContext(game, town)) : null;
    markBox = null;
    // the card of the spotlit pad or building is open: point at its Build, Upgrade or path button instead
    const s = markTg && (markTg.spot ?? markTg.tower);
    if (markTg && openId && (openId === markTg.plot || (s !== null && s !== undefined && openId === 'spot:' + s))) {
      const k = goalCur.kind, b = (k && card.querySelector('.build[data-kind="' + k + '"]')) || (!k && (card.querySelector('#buy') || card.querySelector('.build[data-path]')));
      markTg = b ? { el: b } : null;
    } else if (openId) markTg = null; // a card for something else is open: it has the player's attention
    if (markTg && markTg.el) { const n = typeof markTg.el === 'string' ? document.querySelector(markTg.el) : markTg.el; if (n && n.offsetParent !== null) { const b = n.getBoundingClientRect(); markBox = { x: b.left - 2, y: b.top - 2, w: b.width + 4, h: b.height + 4 }; } } // snug on the button, so it never covers the next one (review of 2026.11.20-6: the back button's frame sat on Map and its dot)
    else if (markTg && markTg.plot && tag[markTg.plot] && !tag[markTg.plot].hidden) { markW = tag[markTg.plot].offsetWidth + 10; markH = tag[markTg.plot].offsetHeight + 10; }
  }
  function placeMark() {
    const tg = markTg;
    let r = null;
    if (!tg || (tg.plot && openId === tg.plot)) r = null; // its card is open: the selection shows it
    else if (tg.el) r = markBox;
    else if (tg.plot) { const p = markW && markAt; if (p) r = { x: p.x - markW / 2, y: p.y - markH + 5, w: markW, h: markH }; } // where its tag went this frame (lifted, GOAL_LIFT, kept on screen and under the top bar)
    else if (openId !== 'spot:' + (tg.spot ?? tg.tower)) {
      const sp = tg.spot ?? tg.tower, p = sp !== null && sp !== undefined && shell.locate ? shell.locate({ spot: sp }) : null;
      // an empty pad: a ring lying on it, its rim as the camera sees it (padded a little, never tiny)
      const f = tg.spot !== undefined && shell.locate && shell.locate.foot ? shell.locate.foot(tg.spot) : null;
      if (f && f.w > 0) { const w = Math.max(40, f.w + 8), h = Math.max(24, f.h + 8); r = { x: f.x + f.w / 2 - w / 2, y: f.y + f.h / 2 - h / 2, w, h }; }
      else if (p) r = { x: p.x - 26, y: p.y - 26, w: 52, h: 52 };
    }
    { const onPad = !!(r && tg && !tg.el && !tg.plot && tg.spot !== undefined && shell.locate && shell.locate.foot); if (mark.classList.contains('onpad') !== onPad) mark.classList.toggle('onpad', onPad); }
    const over = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    if (r && !tg.el && stripBox && over(r, stripBox)) r = null; // the thing is under the strip: show the words, not the frame
    if (mark.hidden !== !r) mark.hidden = !r;
    if (!r) return;
    const onTag = !!(tg.plot && !tg.el); if (mark.classList.contains('ontag') !== onTag) mark.classList.toggle('ontag', onTag);
    const onEl = !!tg.el; if (mark.classList.contains('onel') !== onEl) mark.classList.toggle('onel', onEl); // the goal's tag has its own gold frame: the mark only pulses around it (review of 2026.11.19-14: a loud double frame)
    mark.style.transform = `translate(${r.x.toFixed(1)}px, ${r.y.toFixed(1)}px)`;
    const sig = Math.round(r.w) + ',' + Math.round(r.h);
    if (sig !== markSig) { markSig = sig; mark.style.width = Math.round(r.w) + 'px'; mark.style.height = Math.round(r.h) + 'px'; }
  }

  function paintCoinCosts() {
    if (card.hidden) return;
    for (const n of card.querySelectorAll('.coinneed')) { const need = +n.dataset.need, h = n.querySelector('.hv'); if (h) setText(h, haveWords(town.coins)); n.classList.toggle('low', town.coins + 1e-9 < need); }
    // each good's have / need too, so it reads the same as the goods strip (review of 2026.11.19-4: the card said 5 / 9 while the strip said 6)
    for (const n of card.querySelectorAll('.goodneed')) {
      const need = +n.dataset.need, have = Math.floor((town.goods[n.dataset.good] || 0) + 1e-9), h = n.querySelector('.hn');
      if (h) setText(h, haveWords(have)); n.classList.toggle('low', have < need);
    }
  }
  // income: coins earned over the last few seconds
  const hist = []; let acc = .2, cardAcc = 0; // the top bar paints on the first frame, never blank (review of 2026.11.19-7)
  // the Income sheet explains the same few seconds as the number at the top
  // the Income sheet shows the very numbers the top bar last wrote, so the two never disagree (screenshot review 2026-11-19: +28/s and +25/s)
  let lastIncome = null;
  const incomeNow = () => { const h = hist[0], now = incomeSnap(game); return explainEmpireIncome(game, h ? h[1] : now, now, h ? town.t - h[0] : 0, shell.meter ? shell.meter.income : null); };
  const income = () => lastIncome || (lastIncome = incomeNow());
  // a card or sheet that grows or shrinks (a stat row opened, a sheet scrolled in) is measured again before the next
  // frame places the tags, so no tag shows cut under it in between the 5-a-second measures (smoke, tower card)
  let reMeasure = false;
  // the goods strip that wraps to a second row (a card that opens adds its goods to it) moves the card up in the same
  // frame, before it is drawn: at 5 measures a second the phone tower card sat over the strip's new row for up to 0.2 s
  // (smoke failed on it in 3 of 7 runs, 2026.11.22-1 and -2)
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(es => {
    reMeasure = true;
    for (const e of es) if (e.target === strip) { const sh = strip.hidden ? 0 : Math.round(e.target.getBoundingClientRect().height + 4); if (sh !== stripH) { stripH = sh; ui.style.setProperty('--striph', sh + 'px'); } }
  }) : null;
  if (ro) { ro.observe(card); ro.observe(strip); const sh = ui.querySelector('#sheet'); if (sh) ro.observe(sh); }
  let foeAcc = 0, bossAcc = 0;
  function frame(dt) {
    acc += dt; cardAcc += dt;
    // a raider's card keeps up with it ten times a second (the simulation steps four times a second)
    if (foeUi && (foeAcc += dt) > .1) { foeAcc = 0; if (!foeUi.update()) close(); }
    if ((bossAcc += dt) > .1) { boss.update(bossAcc); bossAcc = 0; } // the boss bar, ten times a second
    viewW = innerWidth; // read once, before this frame moves any tag (a read between moves lays the page out again)
    if (reMeasure) { reMeasure = false; measure(); }
    sheets.frame(dt);
    paintGoal(dt); markAt = null;
    // in a fight a quiet level pill steps aside while a raider is under it, and stays solid otherwise (review of
    // 2026.11.20-5: pills faded to half all through a wave read as a glitch)
    const foes = ui.classList.contains('fighting') && viewApi.foePoints ? viewApi.foePoints() : null;
    // every write below is made only when the value changes: setting hidden to true on a hidden tag still counts as a
    // change to the page, and two tags did it every frame (Room on the Silver Falls script gate, 2026.11.21-4)
    for (const [id, t] of Object.entries(tag)) {
      const p = viewApi.project(id), L = town.level(id), un = unlocked(town, id);
      const flat = !p && document.documentElement.classList.contains('flat');
      // an empty plot's Build tag hides while a tower card is open: it sat on the selected tower's ring (review of 2026.11.19-11)
      if ((!p && !flat) || (!L && !un) || (!L && openId && openId.startsWith('spot:'))) { if (!t.hidden) t.hidden = true; continue; }
      // a tag stays whole on screen while its building shows (review of 2026.11.19-11: "Lv 1" cut at the right edge)
      const marked = markTg && markTg.plot === id && markW;
      // the open card names it and says its level, and the glow marks it (review of 2026.11.20-10: "Level 10" over "Level 10")
      if (p && !marked && openId === id) { if (!t.hidden) t.hidden = true; continue; }
      // quiet by default: a small dark pill with the level (an up mark when it can be upgraded, a red line when it is
      // short). The full tag only for the goal's building, the one whose card is open, and the list view without 3D
      // (owner, 2026-11-19: a big orange "Lv 25" box on every building, always on, covered the models)
      const full = !!(flat || marked || openId === id);
      const txt = full ? (flat || marked ? BUILDINGS[id].name + ' · ' : '') + (L ? 'Level ' + L : 'Build') : (L ? String(L) : 'Build'); // "Level" as the cards say it (review of 2026.11.20-1)
      // the text and its style change before the tag is placed, and a new width is measured then, so this frame already
      // keeps it whole at the edge (review of 2026.11.19-13: "Sand Pit · Lv 1" cut at the left; smoke, 2026.11.21-2: the
      // Quarry's goal tag placed one frame with the small pill's width)
      const tl = t.firstChild, q = t.classList.contains('quiet') === full;
      if (tl.textContent !== txt || q) { tl.textContent = txt; if (q) t.classList.toggle('quiet', !full); if (p && t.offsetWidth) tagSize.set(t, [t.offsetWidth, t.offsetHeight]); } // (a hidden tag keeps its last size)
      const half = Math.max(marked ? markW / 2 : 0, (tagSize.get(t) || [56])[0] / 2 + 2);
      if (p && !marked && (p.x < -half || p.x > viewW + half)) { if (!t.hidden) t.hidden = true; continue; } // the goal's tag always shows, at the edge
      const px = p && Math.min(Math.max(p.x, half), viewW - half);
      // a tag that would slide under the top bar's left column (the place, the wave row, Pause and the goal strip) sits
      // just below it, still on its building (review of 2026.11.19-5: the goal strip covered the Ridge's top row of tags)
      let py = p && (marked ? p.y - GOAL_LIFT : p.y);
      if (p && leftBox) { const [tw, th] = tagSize.get(t) || [56, 26]; if (px - tw / 2 < leftBox.r && px + tw / 2 > leftBox.l && py > leftBox.b && py - th < leftBox.b + 2) py = leftBox.b + 2 + th; } // (only while its building shows below the bar)
      // the goal's tag never hides under the top bar: it sits just below it, over its building (review of 2026.11.20-2:
      // in landscape the Sawmill's lifted tag went under the goal strip, and the goal named a tag no one could see)
      if (p && marked) { const [tw, th] = tagSize.get(t) || [56, 26]; for (const c of coverBoxes) if ((c.n === left || c.n === right) && px - tw / 2 < c.r && px + tw / 2 > c.l && py - th < c.b + 2) py = Math.max(py, c.b + 2 + th); markAt = { x: px, y: py }; }
      if (p) { const [tw, th] = tagSize.get(t) || [56, 26], l = px - tw / 2, r = px + tw / 2, tp = py - th; if (coverBoxes.some(c => !c.n.hidden && l < c.r && r > c.l && tp < c.b && py > c.t)) { if (!t.hidden) t.hidden = true; if (marked) markAt = null; continue; } }
      if (t.hidden) t.hidden = false;
      if (p) { const tr = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px) translate(-50%, -100%)`; if (tagTr.get(t) !== tr) { tagTr.set(t, tr); t.style.transform = tr; } }
      // a goal tag kept on screen points its stem at its building, or an arrow its way when the building is off screen
      // (review of 2026.11.20-10: the Quarry's tag, held in from the edge, pointed at the water tower)
      if (p && marked) {
        const side = p.x < 0 ? 'l' : p.x > viewW ? 'r' : '', sx = side ? 0 : Math.round(Math.max(-half + 6, Math.min(half - 6, p.x - px)));
        if (t.dataset.side !== side) { t.dataset.side = side; t.classList.toggle('offl', side === 'l'); t.classList.toggle('offr', side === 'r'); }
        const sv = sx + 'px'; if (t.style.getPropertyValue('--sx') !== sv) t.style.setProperty('--sx', sv);
      } else if (t.dataset.side) { t.dataset.side = ''; t.classList.remove('offl', 'offr'); t.style.removeProperty('--sx'); } // only when it moved; sub-pixel: whole pixels make tags step as the camera glides
      const over = !!(foes && !full && p && foes.length && (() => { const [tw, th] = tagSize.get(t) || [32, 32]; return foes.some(f => Math.abs(f.x - px) < tw / 2 + 14 && f.y > py - th - 14 && f.y < py + 18); })());
      if (t.classList.contains('overfoe') !== over) t.classList.toggle('overfoe', over);
      t.classList.toggle('short', !!(L && town.starved[id] === true)); // held for towers is not a problem to fix
      t.classList.toggle('goaltag', !!marked);
      t.classList.toggle('can', !!L && town.coins >= cost(town, id)); // an up mark only on a building, never on an empty plot's Build
      t.classList.toggle('boss', full && foremanOn(town, id));
    }
    placeMark(); // after the tags, so the mark sits on the goal's tag where it went this frame
    if (document.documentElement.classList.contains('flat')) spotTags.forEach((t, i) => {
      const tw = towerAt(town, i), txt = (isPit(town, i) ? 'Mortar pit ' : 'Spot ') + (i + 1) + ' · ' + (tw ? TOWERS[tw.kind].name + ' ' + tw.level : 'empty');
      t.hidden = false; if (t.textContent !== txt) t.textContent = txt;
    });
    if (acc < .2) return;
    acc = 0;
    hist.push([town.t, incomeSnap(game)]); while (hist.length > 25) hist.shift();
    lastIncome = incomeNow(); const per = lastIncome.value; // every town and outpost pays into the one purse
    earnPer = earnRate(game, earnHist);
    setText(coinNum, fmtLive(town.coins)); setText(inc, '+' + rate(per));
    if (goalCur && (goalCur.need || goalCur.meter || goalCur.heldText || goalCur.count) && doneFor <= 0) setText(goalWords, goalWordsOf(goalCur));
    paintStrip(); paintCoinCosts();
    sheets.sync(); // Goods and Income paint in this frame, with the very numbers the top bar and strip just wrote
    const ws = town.waves;
    setText(waveNum, waveTitle(town)); // a won outpost says Raids, not a wave number that never moves (owner, 2026-11-20)
    wave.classList.toggle('old', oldGround(town)); // gold while the towers hit harder on waves beaten before (review of 2026.11.19-12)
    setText(vault, vaultCount(town.vault)); const vlow = town.vault.hp < .5 * town.vault.max; if (vault.classList.contains('low') !== vlow) vault.classList.toggle('low', vlow);
    paintCtl();
    measure();
    setText(waveInfo, waveBar(ws).word); // one fixed box: "in 28s", "On hold" or "Fighting", from the same state as the hold button
    // kept in place, so the bar never changes width; hidden during a wave and while held (one state with the hold button)
    const away = !waveBar(ws).call, onRoad = ws.phase !== 'break'; if (call.classList.contains('away') !== away) call.classList.toggle('away', away);
    if (ui.classList.contains('fighting') !== onRoad) ui.classList.toggle('fighting', onRoad); // quiet tags fade while raiders are on the road (review of 2026.11.19-13: a tag covered raiders)
    const callable = canCall(town); if (call.disabled === callable) call.disabled = !callable; // never locked in a break (owner rule); hidden while a wave is on the road
    // the side buttons come out as they become useful (src/core/reveal.js), with a dot when something there wants you
    look(town);
    const T = tabs(game, town), D = dots(game, town);
    goodsBtn.hidden = !T.goods; goodsBtn.classList.toggle('dot', D.goods);
    labBtn.hidden = !T.research; labBtn.classList.toggle('dot', D.research);
    menuBtn.classList.toggle('dot', !!document.getElementById('updateBar'));
    // only this town's own research time (owner, 2026-11-22: in Dry Creek the button showed another town's time, so
    // research looked shared; that town's time is on the Research sheet under Your towns)
    { const lab = town.lab || null, s = lab ? leftWord(lab.left).replace(' left', '') : ''; setText(labLeft, s); if (labLeft.hidden !== !s) labLeft.hidden = !s; }
    labBtn.classList.toggle('on', !!town.lab);
    // the Perks button shows from the first charter offer, gold while a perk waits to be picked or the charter pays
    perksBtn.hidden = !T.perks; perksBtn.classList.toggle('dot', D.perks); // an outpost has no charter
    autoBtn.hidden = !T.auto; autoBtn.classList.toggle('dot', D.auto);
    autoBtn.classList.toggle('on', autoOn(game, town, 'towers') || autoOn(game, town, 'research'));
    // the clock says what it counts to (review of 2026.11.23-9: "To arms 3:54" said nothing of what the time was)
    armsBtn.hidden = !T.arms;
    if (T.arms) { const a = town.arms || { t: 0, cd: 0 }, s = a.t > 0 ? 'Back in ' + clock(a.t) : a.cd > 0 ? 'Ready in ' + clock(a.cd) : ''; setText(armsLeft, s); if (armsLeft.hidden !== !s) armsLeft.hidden = !s; if (armsBtn.classList.contains('on') !== a.t > 0) armsBtn.classList.toggle('on', a.t > 0); }
    paintPlace();
    perksBtn.classList.toggle('on', perksToPick(game) > 0 || deedsFor(town) > 0);
    if (cardAcc > .25 && openId) { cardAcc = 0; paintCard(false); }
  }
  /* Take this town's screen down (switching towns builds a new one). */
  // a toast about this town's own things goes with it, so it never shows in the next place (review of 2026.11.23-6: Iron
  // Ridge's "New research" toast in Pine Hollow, over its Research sheet)
  const destroy = () => { dropToasts('here'); if (ro) ro.disconnect(); for (const off of offs) off(); ui.remove(); const lc = document.getElementById('lostCard'); if (lc) lc.remove(); };
  return { frame, open, openSpot, openFoe, openWorker, close, current: () => openId, el: ui, sheets, openGoods, strip, openMenu, openResearch, openPerks, openAuto, openArms, openIncome, openVault, openWave, openPlaces, openCapital, destroy };
}

/* Toasts wait their turn: one at a time, at most three waiting (the oldest goes), and a line already showing or
   waiting is not added again. While others wait, each one stays up a little shorter. first: it goes to the front of the
   line (the Welcome back line, which comes after catching up and would wait behind the news of the time away).
   A toast only shows where it covers nothing the player needs: not the top bar (with Pause and the wave row), not an
   open card or sheet, not a town's label on the map. On the map, when the labels leave no place, it shows under the top
   bar and the labels it would cut in half hide until it goes. When there is no place at all (a sheet as tall as the
   phone), it waits, hidden, with its time stopped, until there is one (review of 2026.11.19-5: a toast over Pause on
   the Perks sheet, and over the labels round the Capital). */
const toasts = { queue: [], up: null, el: null, left: 0, tick: null, last: 0 };
const TICK = 200;
export function placeToasts() { if (toasts.el) showIfRoom(toasts.el); }
/* Take away every toast of one kind, showing or waiting (review of 2026.11.19-3: the lost toast from the town sat over the
   map's town labels when the map opened, and the map already shows that town on hold). */
export function dropToasts(kind) {
  toasts.queue = toasts.queue.filter(q => q.kind !== kind);
  if (toasts.up && toasts.up.kind === kind && toasts.el) { const t = toasts.el; toasts.el = null; t.remove(); unhide(); clearTimeout(toasts.tick); nextToast(); }
}
/* Where a good goes in its town, for the card of the building that makes it: "The Sawmill takes 2 timber a second.",
   "The Sawmill, Smelter and Kiln take 4 timber a second.", "Glass goes to the Bulb Works." while they make none, or ''
   when no building here uses it. "Takes", so it never reads against the card's "Each glass uses 2 sand" (screenshot
   review of 2026.11.20-13). */
export function usedLine(used, g) {
  const n = used.ids.map(k => BUILDINGS[k].name);
  if (!n.length) return '';
  const who = n.length === 1 ? n[0] : n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1];
  return used.rate >= .05 ? 'The ' + who + ' take' + (n.length > 1 ? '' : 's') + ' ' + perSecond(used.rate, g) + '.' : g.name + (/[^s]s$/.test(g.name) ? ' go' : ' goes') + ' to the ' + who + '.'; // "Boilers go" (review of 2026.11.20-14)
}
export function toast(text, ms = 4000, { first = false, kind = '' } = {}) {
  if ((toasts.up && toasts.up.text === text) || toasts.queue.some(q => q.text === text)) return;
  if (first) toasts.queue.unshift({ text, ms, kind }); else toasts.queue.push({ text, ms, kind });
  if (toasts.queue.length > 3) { if (first) toasts.queue.pop(); else toasts.queue.shift(); }
  if (!toasts.up) nextToast();
}
const boxes = sel => [...document.querySelectorAll(sel)].map(n => n.getBoundingClientRect()).filter(r => r.width && r.height);
/* The lowest edge of the top bar's two columns (one read per toast), or null to keep the place in the stylesheet. */
function underHud() {
  let y = 0;
  for (const b of boxes('.hud .hudleft, .hud .hudright')) y = Math.max(y, b.bottom);
  return y && y + 8 < innerHeight * .6 ? Math.round(y + 8) : null;
}
/* A toast never covers an open card (review 2026-11-18: "The Capital is built." sat on the card's title in landscape).
   A card on the right side (landscape) moves the toast into the space left of it. Exported for the smoke test. */
export function clearOfCards(t) {
  if (!t.isConnected) return;
  const a = t.getBoundingClientRect();
  for (const r of boxes('.card, .sheet')) {
    if (!(r.left > innerWidth * .35 && a.left < r.right && a.right > r.left)) continue; // a side card: center the toast in the space to its left
    const room = r.left - 20;
    t.style.maxWidth = Math.max(120, room - 12) + 'px'; t.style.left = Math.round(Math.max(10, room / 2 + 10 - Math.min(a.width, room - 12) / 2)) + 'px'; t.style.transform = 'none';
    return;
  }
}
/* The first height, from just under the top bar down, where the toast covers no part of the top bar, no card or sheet
   and no town label, or null when there is none. Exported for the smoke test. */
export function clearOfBadges(t, labels = true) {
  if (!t.isConnected) return null;
  const all = [...boxes('.hud .hudleft, .hud .hudright, .card, .sheet, .goodstrip, .lostcard' + (labels ? ', .mapbadge, .mapkeep' : '')), ...boxes('#coach').filter(r => r.height < innerHeight * .8)];
  const a = t.getBoundingClientRect(), from = underHud() ?? a.top;
  const hitAt = y => all.some(r => a.left < r.right && a.right > r.left && y < r.bottom && y + a.height > r.top);
  for (let y = Math.ceil(from); y + a.height < innerHeight - 8; y += 6) if (!hitAt(y)) return y;
  return null;
}
/* Place it: under the top bar, beside a side card, then at the first free height. False when there is no room. */
function placeToast(t) {
  if (!t.isConnected) return false;
  t.style.left = ''; t.style.transform = ''; t.style.maxWidth = '';
  const below = underHud(); t.style.top = below ? below + 'px' : '';
  clearOfCards(t);
  unhide();
  let y = clearOfBadges(t), hide = false;
  if (y === null && document.querySelector('.mapbadge')) { y = clearOfBadges(t, false); hide = true; }
  if (y === null) return false;
  t.style.top = y + 'px';
  // a building's level tag under it hides until it goes (review of 2026.11.19-6). In the town the toast never moves
  // down for the tags: they follow the camera, so it would hop about, and it never waits for them
  const a = t.getBoundingClientRect();
  for (const n of document.querySelectorAll(hide ? '.mapbadge, .tags .tag' : '.tags .tag')) { const r = n.getBoundingClientRect(); if (r.width && a.left < r.right && a.right > r.left && a.top < r.bottom && a.bottom > r.top) n.classList.add('undertoast'); }
  return true;
}
const unhide = () => { for (const n of document.querySelectorAll('.undertoast')) n.classList.remove('undertoast'); };
function showIfRoom(t) { const ok = placeToast(t); t.classList.toggle('wait', !ok); return ok; }
function nextToast() {
  clearTimeout(toasts.tick);
  const q = toasts.queue.shift();
  if (!q) { toasts.up = null; toasts.el = null; return; }
  const t = el('div', 'toast', q.text); t.setAttribute('role', 'status');
  document.body.append(t);
  toasts.up = q; toasts.el = t; toasts.left = toasts.queue.length ? Math.min(q.ms, 2500) : q.ms; toasts.last = performance.now();
  showIfRoom(t);
  // placed again every tick: a card opened by the same tap, the new town's top bar after a switch, a sheet closing
  const tick = () => {
    if (toasts.el !== t) return;
    const now = performance.now(), dt = now - toasts.last; toasts.last = now;
    if (showIfRoom(t)) toasts.left -= dt; // its time only runs while it shows
    if (toasts.left > 0) { toasts.tick = setTimeout(tick, TICK); return; }
    t.classList.add('out'); toasts.tick = setTimeout(() => { t.remove(); unhide(); if (toasts.el === t) nextToast(); }, 220);
  };
  toasts.tick = setTimeout(tick, TICK);
}
