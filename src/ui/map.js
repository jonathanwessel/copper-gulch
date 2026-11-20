/* The empire map's screen (GDD.md, Empire map), over the 3D map (src/render/empire-view.js): the coins, Pause and a
   button back to the town in play; a badge under every site (its wave, its vault, what it earns, a pulsing dot when it
   needs you); and the card a tapped site opens, with Play to fly in. Words follow the writing rule in PLAN.md. */
import { TOWNS } from '../data/towns/index.js';
import { GOODS } from '../data/goods.js';
import { BUILDINGS } from '../data/buildings.js';
import { siteInfo, lockedRules, mapRoutes, makesOf } from '../core/map.js';
import { foundTown } from '../core/empire.js';
import { fmt, fmtLive, splitLive } from './format.js';
import { lostLine, lostToast, retryLine } from './lost.js';
import { capitalOpen, capitalOf, foundCapital } from '../core/capital.js';
import { CAPITAL_DEF } from '../data/capital.js';
import { capitalPanel, contractDone, sentWords } from './capital.js';
import { treeCalls } from '../core/tree.js';
import { retryState } from '../core/automation.js';

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const setText = (n, s) => { if (n.textContent !== s) n.textContent = s; };
const nameOf = id => id === 'capital' ? 'The Capital' : TOWNS[id].name;
const shortOf = id => id === 'capital' ? 'Capital' : TOWNS[id].short || TOWNS[id].name;
/* A won outpost out of play sends its goods to the town in play and earns next to nothing itself (review 2026-11-18:
   Dry Creek's label read +0/s once won). */
const sendsOnly = info => !!(info.won && !info.inPlay && info.income < .1);
/* A place's card says what it is, before and after it opens, so the word outpost is known wherever it shows
   (review of 2026.11.19-6: "Outposts" on the Capital meant nothing next to open outposts that never said it). */
const whatIs = id => (TOWNS[id].kind === 'outpost' ? 'An outpost that makes ' : 'Makes '); // a town: its name is the heading (review of 2026.11.20-3: "A town that makes")
/* Each label's words for what it earns: its share of the top bar's total, so the labels add up to it (review of
   2026.11.19-6). infos: { id: siteInfo }. A won outpost that only sends goods says so and takes no share. */
export function badgeRates(total, infos) {
  const ids = Object.keys(infos).filter(id => infos[id]);
  const sp = splitLive(total, ids.map(id => (sendsOnly(infos[id]) ? 0 : infos[id].income))), out = {}, nums = {};
  ids.forEach((id, i) => {
    const v = sp.rows[i]; nums[id] = v || '0';
    out[id] = v ? (v.startsWith('under') ? v + '/s' : '+' + v + '/s') : sendsOnly(infos[id]) ? 'Sends goods' : '+0/s';
  });
  return { words: out, nums, total: '+' + sp.total + '/s' };
}
/* A town's vault on its map card: Full, or the hits left as its Vault sheet counts them (review of 2026.11.20-3:
   "20 / 20 hits" read as a score). */
export const vaultHits = t => { const v = t.vault || { hp: 0, max: 0 }, n = Math.max(0, Math.ceil(v.hp)); return n + (n === 1 ? ' hit' : ' hits'); }; // beside "Vault can take" (review of 2026.11.20-4: "Vault Full" never said what a vault is)
/* "a, b and c" */
const list = xs => xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1];
const goodsLower = gs => list(gs.map(g => GOODS[g].name.toLowerCase()));
/* What a place makes, in the same words on its card before and after it opens: its top goods, or every good it makes. */
export const makesWords = id => TOWNS[id].makesText || goodsLower(makesOf(id));

/* A rule a town not open yet has, in words; the badge gets the short form. */
function ruleText(game, r, short = false) {
  if (r.kind === 'wave') return (short ? 'Opens at wave ' : 'Beat wave ') + r.wave + ' in ' + shortOf(r.town);
  if (r.kind === 'coins') return fmt(r.coins) + ' coins';
  if (r.kind === 'deeds') return short ? 'Needs ' + r.deeds + ' deeds' : 'Deeds';
  if (r.kind === 'with') return short ? 'Needs ' + shortOf(r.town) : 'It opens when you start ' + nameOf(r.town) + '.';
  if (r.kind === 'win') return short ? 'Win ' + shortOf(r.town) : 'It opens when you win ' + nameOf(r.town) + '.';
  return short ? 'Coming later' : 'The Capital will be built here.';
}

/* Badges as { x (center), y (bottom), w, h }: the lowest keeps its place (or `first`, the open card's site, so its
   label stays over its own town), and each one after it that would cover a badge already placed moves the least it can:
   lifted until its bottom sits 2 px over that badge's top, or slid sideways beside it (at most 60% of its width, so it
   stays over its town, review of 2026.11.19-11: labels round the Capital covered the towns), or below as a last resort.
   `bar` is the top bar's boxes as [{ l, r, b }] (left, right, bottom): a badge whose town is under one of them sits just
   below it, and no badge moves under one. `W` is the screen width a slid badge stays inside. Changes x and y in place;
   returns them. */
export function liftBadges(rs, bar = [], gap = 2, { W = Infinity, first = null } = {}) {
  const done = [];
  const topAt = (x, w) => Math.max(gap, ...bar.filter(q => q.l < x + w / 2 && q.r > x - w / 2).map(q => q.b + gap));
  const hit = (r, x, y) => done.find(o => Math.abs(x - o.x) < (r.w + o.w) / 2 && y > o.y - o.h - gap && y - r.h < o.y + gap);
  const settle = (r, x, y, up) => {
    for (let o, n = 0; (o = hit(r, x, y)) && n < 20; n++) y = up ? o.y - o.h - gap : o.y + r.h + gap;
    return y;
  };
  for (const r of rs) r.y = Math.max(r.y, topAt(r.x, r.w) + r.h); // never under the top bar's boxes
  const order = rs.slice().sort((a, b) => (b === first) - (a === first) || b.y - a.y);
  for (const r of order) {
    if (hit(r, r.x, r.y)) {
      const tries = [], x0 = r.x, y0 = r.y;
      const up = settle(r, x0, y0, true);
      if (up - r.h >= topAt(x0, r.w)) tries.push({ x: x0, y: up, cost: y0 - up });
      for (const o of done) for (const side of [-1, 1]) {
        const x = o.x + side * ((r.w + o.w) / 2 + gap);
        if (Math.abs(x - x0) > r.w * .6 || x - r.w / 2 < 4 || x + r.w / 2 > W - 4 || y0 - r.h < topAt(x, r.w) || hit(r, x, y0)) continue;
        tries.push({ x, y: y0, cost: Math.abs(x - x0) * 1.2 }); // a slide costs a little more than a lift of the same size
      }
      if (!tries.length) tries.push({ x: x0, y: settle(r, x0, y0, false), cost: 0 });
      const best = tries.reduce((p, q) => (q.cost < p.cost ? q : p));
      r.x = best.x; r.y = best.y;
    }
    done.push(r);
  }
  return rs;
}

/* Which badges are crowded: those whose town sits within a full-size badge of another shown badge's town. They show only
   their name, so they cover less of the map. rs: [{ x, y, w, h, keep }] at full size (keep: the open card's place,
   never shrunk). Returns a Set of indexes. Decided from the towns' points, not from where the badges land, so a badge
   does not flip size as it moves. */
export function crowdedBadges(rs) {
  const out = new Set();
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
    const a = rs[i], b = rs[j];
    if (Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < Math.max(a.h, b.h) * 1.5) { if (!a.keep) out.add(i); if (!b.keep) out.add(j); }
  }
  return out;
}

/* shell: { meter, play(id) (fly into a town), back() (fly into the town in play), toast(text) } */
export function mountMap(root, game, view, shell) {
  // a town that loses while the player is on the map holds its waves: say so here too (owner rule, 2026-11-17)
  const offLost = game.bus.on('breach', e => { if (e.held && !game.catching && game.towns[e.town] && shell.toast) shell.toast(lostToast(game.towns[e.town], false, game, true), 6000); });
  const offDone = game.bus.on('contract:done', e => { if (!game.catching && shell.toast) shell.toast(contractDone(e), 5000); });
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
  // the capitol's place on screen, for toasts to keep off (placeToast in src/ui/play.js); never takes a touch
  const keep = el('div', 'mapkeep'); keep.setAttribute('aria-hidden', 'true');
  ui.append(badges, hud, card, banner, keep);
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

  let openId = null, acc = 1, lastTap = { id: null, t: 0 }, cap = null;
  function openSite(id) {
    if (!id) { close(); return; }
    const now = performance.now();
    // a second tap on the same open town flies in
    if (lastTap.id === id && now - lastTap.t < 450 && game.towns[id]) { lastTap.id = null; shell.play(id); return; }
    lastTap = { id, t: now };
    openId = id; card.hidden = false; card.dataset.site = id; paintCard();
    view.select(id === 'income' ? null : id); acc = 1;
  }
  function close() { cardBox = null; view.select(null); openId = null; cap = null; card.hidden = true; card.replaceChildren(); delete card.dataset.site; delete card.dataset.sig; }
  const head = (text, sub) => { const h = el('div', 'cardhead'), x = el('button', 'btn small', 'Close'); x.id = 'mapClose'; x.addEventListener('click', close); h.append(el('h2', '', text)); if (sub) h.append(el('span', 'lv', sub)); h.append(x); return h; };
  const stat = (label, value, cls = '') => { const r = el('div', 'stat static ' + cls); r.append(el('span', '', label), el('b', '', value)); return r; };
  function paintCard() {
    const id = openId;
    if (!id) return;
    if (id === 'capital' && capitalOpen(game)) { paintCapital(); return; }
    cap = null;
    const kids = [];
    if (id === 'income') {
      kids.push(head('Income', 'Coins a second'));
      const rows = Object.keys(game.towns).map(t => [t, shell.meter ? shell.meter.income[t] || 0 : 0]).sort((a, b) => b[1] - a[1]);
      const box = el('div', 'explain why'), sp = splitLive(shell.meter ? shell.meter.total : 0, rows.map(r => r[1])); // rows add up as written
      for (const [i, [t]] of rows.entries()) { const r = el('div'); r.append(el('span', '', nameOf(t)), el('b', '', sp.rows[i] || '0')); box.append(r); }
      const tot = el('div', 'total'); tot.append(el('span', '', 'All your towns'), el('b', '', sp.total)); box.append(tot);
      kids.push(box);
    } else if (game.towns[id]) {
      const t = game.towns[id], info = siteInfo(game, id, shell.meter), d = TOWNS[id];
      kids.push(head(d.name, info.inPlay ? 'Playing now' : ''));
      const store = d.store === 'stockpile' ? 'Stockpile' : 'Vault';
      const grid = el('div', 'statgrid');
      grid.append(stat(info.won ? 'Won' : 'Wave', info.won ? 'Wave ' + info.wave : String(info.wave)), stat(store + ' can take', vaultHits(t), info.alert === 'vault' ? 'low' : ''), sendsOnly(info) ? stat('Goods', 'Sent to ' + shortOf(game.active)) : stat('Coins', rates.words[id] || '+0/s'));
      // the vault in hits, as its sheet in the town counts them, and the coins as the label under the town writes them
      // (review of 2026.11.19-9: 100% here beside a sheet of hits, "under 1 a second" beside "under 1/s")
      kids.push(grid);
      kids.push(el('p', 'uses', whatIs(id) + makesWords(id) + '.')); // the same words as its card before it opened (review 2026-11-18)
      for (const l of mapRoutes(game)) {
        if (l.from === id) kids.push(el('p', 'uses', 'Sends ' + goodsLower(l.goods) + ' to ' + shortOf(l.to) + '.'));
        if (l.to === id) kids.push(el('p', 'uses', 'Gets ' + goodsLower(l.goods) + ' from ' + shortOf(l.from) + '.'));
      }
      if (info.alert === 'lost') kids.push(el('p', 'warn', retryState(game, t) === 'stuck' ? retryLine(game, t) : lostLine(t)));
      else if (info.alert === 'retry' || info.alert === 'retrying') kids.push(el('p', 'uses', retryLine(game, t)));
      else if (info.alert === 'raided') kids.push(el('p', 'warn', 'Raiders got through to the ' + store.toLowerCase() + ' here while you were away.'));
      else if (info.alert === 'vault') kids.push(el('p', 'warn', 'The ' + store.toLowerCase() + ' is under half strength.'));
      else if (info.alert === 'short') {
        // a good shipped in from another town: say which building there to build or upgrade
        const g = info.needs, home = g && GOODS[g].town !== id && game.towns[GOODS[g].town], mk = home && home.def.buildings.find(b => BUILDINGS[b].makes === g);
        const wheel = g && GOODS[g].grid && TOWNS[id].buildings.find(b => BUILDINGS[b].makes === g); // the power grid: upgrade the Water Wheel there
        const fix = wheel ? ' Upgrade the ' + BUILDINGS[wheel].name + '.' : mk ? ' ' + (home.level(mk) ? 'Upgrade the ' : 'Build a ') + BUILDINGS[mk].name + ' in ' + shortOf(home.id) + '.' : '';
        kids.push(el('p', 'warn', 'The ' + BUILDINGS[info.short].name + (g ? ' needs more ' + GOODS[g].name.toLowerCase() + '.' + fix : ' is short of goods.')));
      }
      const row = el('div', 'row'), go = el('button', 'btn primary buy', (info.inPlay ? 'Back to ' : 'Play ') + shortOf(id)); go.id = 'mapPlay';
      go.addEventListener('click', () => shell.play(id));
      row.append(go); kids.push(row);
    } else {
      const lr = lockedRules(game, id);
      kids.push(head(nameOf(id), lr.ready ? '' : (id === 'capital' ? 'Not built yet' : 'Not open yet'))); // ready: the Start button says it
      if (id === 'capital') kids.push(el('p', 'uses', 'Send goods here for coins and Influence. Spend Influence on upgrades for every town.'));
      else kids.push(el('p', 'uses', whatIs(id) + makesWords(id) + '.'));
      for (const r of lr.rules) {
        if (r.kind === 'deeds') {
          kids.push(stat(ruleText(game, r), r.done ? 'Done' : r.have + ' / ' + r.deeds, r.done ? 'done' : 'short'));
          if (!r.done) kids.push(el('p', 'uses', 'To earn deeds, tap Perks in a town, then tap Sign the charter.'));
        }
        else if (r.kind === 'wave' || r.kind === 'coins') {
          const from = game.towns[id === 'capital' ? CAPITAL_DEF.found.from : (TOWNS[id].found || {}).from];
          // the wave the town's own label shows, out of the one it needs ("Best wave 9" beside its "Wave 10" label read as
          // wrong, and "21 waves to go" did not match 30 minus 10, review of 2026.11.19-5); coins as the top bar writes them
          const have = r.kind === 'coins' ? fmtLive(from ? from.coins : 0) + ' / ' + fmt(r.coins) : 'Wave ' + (from ? from.wave : 1) + ' / ' + r.wave;
          kids.push(stat(ruleText(game, r), r.done ? 'Done' : have, r.done ? 'done' : 'short'));
        } else kids.push(el('p', 'uses', ruleText(game, r)));
      }
      if (lr.ready) {
        const row = el('div', 'row'), go = el('button', 'btn primary buy', id === 'capital' ? 'Build the Capital' : 'Start ' + TOWNS[id].name); go.id = 'mapFound';
        go.addEventListener('click', () => {
          if (id === 'capital') { if (foundCapital(game)) paintCard(); return; } // the card itself shows it is built, no toast
          const from = game.towns[TOWNS[id].found.from], held = !!(from && from.waves && from.waves.hold && !from.waves.autoHold);
          if (foundTown(game, id)) { shell.toast(TOWNS[id].name + ' is open.' + (held ? ' The waves in ' + from.def.name + ' start again.' : '')); shell.play(id); }
        });
        row.append(go); kids.push(row);
      }
    }
    // only rebuild when something on it changed, so a tap on its button is never lost to a repaint
    const sig = kids.map(k => k.textContent).join('|');
    if (sig !== card.dataset.sig) { card.dataset.sig = sig; card.replaceChildren(...kids); }
  }
  // the Capital's card: built once for each set of contracts, then only its words and bars change (src/ui/capital.js)
  function paintCapital() {
    if (!cap || card.dataset.sig !== 'capital|' + cap.sig()) {
      cap = capitalPanel(game, { changed: () => { cap = null; paintCard(); }, toast: (s, ms) => shell.toast && shell.toast(s, ms) });
      card.dataset.sig = 'capital|' + cap.sig(); card.replaceChildren(head(CAPITAL_DEF.name), cap.el);
    }
    cap.paint();
  }
  coins.addEventListener('click', () => openSite('income'));
  coins.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openSite('income'); });

  // each label's rate is its share of the top bar's +N/s, so the labels add up to it (review of 2026.11.19-6); a town on
  // hold still earns from its buildings, so it shows its rate too and says On hold after its wave
  let rates = { words: {}, nums: {} };
  function paintBadges() {
    const infos = {}; for (const s of view.sites) infos[s.id] = siteInfo(game, s.id, shell.meter);
    rates = badgeRates(shell.meter ? shell.meter.total : 0, infos);
    for (const s of view.sites) {
      const B = badge[s.id], info = infos[s.id];
      // the yellow border marks the place whose card is open, else the town in play (review of 2026.11.19-11: it stayed on
      // Pine Hollow, the town in play, while Iron Ridge's card was open and its ring was on the ground)
      B.b.classList.toggle('on', openId && badge[openId] ? openId === s.id : !!(info && info.inPlay));
      B.b.classList.toggle('locked', !info && !(s.id === 'capital' && capitalOpen(game)));
      if (info) {
        const st = info.alert === 'lost' ? ' · On hold' : info.alert === 'retry' ? ' · Retry soon' : info.alert === 'retrying' ? ' · Retrying' : '';
        setText(B.wave, (info.won ? 'Won' : 'Wave ' + info.wave) + st);
        B.vault.hidden = false; B.line.hidden = false;
        const w = Math.round(info.vault * 100) + '%'; if (B.fill.style.width !== w) B.fill.style.width = w;
        B.fill.classList.toggle('low', info.alert === 'vault');
        setText(B.extra, rates.words[s.id]);
        B.b.classList.toggle('dot', !!info.alert && info.alert !== 'retry' && info.alert !== 'retrying');
      } else if (s.id === 'capital' && capitalOpen(game)) {
        const c = capitalOf(game), a = c.active;
        setText(B.wave, a ? sentWords(a) : 'Take a contract'); // the card's figure (review of 2026.11.19-13: "40% done" against "16 of 42 sent") // it names the contract (review 2026-11-18)
        B.vault.hidden = true; B.line.hidden = openId === 'capital'; setText(B.extra, openId === 'capital' ? '' : c.influence + ' Influence'); // its open card says these (review of 2026.11.20-4: the figure three times on one screen)
        B.b.classList.toggle('dot', !a || treeCalls(game));
      } else {
        const lr = lockedRules(game, s.id);
        setText(B.wave, lr.ready ? (s.id === 'capital' ? 'Ready to build' : 'Ready to start') : '');
        B.line.hidden = !lr.ready; // a locked place is just its name: what it needs is on its card (review of 2026.11.19-11: long locked labels covered the towns)
        B.vault.hidden = true; setText(B.extra, '');
        B.b.classList.toggle('dot', lr.ready);
      }
    }
  }
  // badges sit above their towns, kept inside the screen (their sizes are measured with the 4-a-second paint). Two
  // badges never cover each other: the one lower on screen (the nearer town) keeps its place and the other is lifted
  // just above it (the 2026.11.18-15 screenshots had the labels round the Capital piled on top of each other).
  const widths = {}, heights = {}, full = {}; let bar = [], cardBox = null;
  function placeBadges() {
    const W = innerWidth, H = innerHeight, shown = [];
    for (const s of view.sites) {
      const B = badge[s.id], p = view.badgePoint(s.id), w = widths[s.id] || 80;
      // a town off the screen has no label: clamped to the edge, they piled up under the coins (review of 2026.11.20-3, the
      // Capital close-up)
      if (!p || p.x < 0 || p.x > W || p.y < 0 || p.y > H + 40) { B.b.hidden = true; continue; }
      B.b.hidden = false;
      // a town left of a side card keeps its label left of the card, never pushed under it (review of 2026.11.20-4: the
      // open card's own town lost its label in landscape)
      const R = cardBox && cardBox.l > W * .35 && p.x < cardBox.l ? cardBox.l - 4 : W;
      shown.push({ B, id: s.id, w, h: heights[s.id] || 40, x: Math.max(w / 2 + 4, Math.min(p.x, R - w / 2 - 4)), y: p.y });
    }
    // crowded labels show only their name, judged at full size so a label does not flip between the two
    const crowd = crowdedBadges(shown.map(r => ({ x: r.x, y: r.y, w: (full[r.id] || [r.w])[0], h: (full[r.id] || [0, r.h])[1], keep: r.B === badge[openId] || r.B.b.classList.contains('dot') })));
    shown.forEach((r, i) => { const c = crowd.has(i); if (r.B.b.classList.contains('small') !== c) r.B.b.classList.toggle('small', c); });
    for (const r of liftBadges(shown, bar, 2, { W, first: shown.find(r => r.B === badge[openId]) })) {
      // a label the open card would cut in half hides under it (review of 2026.11.19-5: Dry Creek and Sandy Bend cut off)
      const c = cardBox, under = c && r.x - r.w / 2 < c.r && r.x + r.w / 2 > c.l && r.y - r.h < c.b && r.y > c.t;
      if (r.B.b.hidden !== !!under) r.B.b.hidden = !!under;
      if (under) continue;
      const tr = `translate(${r.x.toFixed(1)}px, ${r.y.toFixed(1)}px) translate(-50%, -100%)`;
      if (r.B.b.style.transform !== tr) r.B.b.style.transform = tr;
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
        for (const s of view.sites) if (!badge[s.id].b.hidden) {
          const b = badge[s.id].b; widths[s.id] = b.offsetWidth; heights[s.id] = b.offsetHeight;
          if (!b.classList.contains('small')) full[s.id] = [b.offsetWidth, b.offsetHeight]; // its full size, for crowdedBadges
        }
        const c = card.hidden ? null : card.getBoundingClientRect();
        cardBox = c && c.height ? { l: c.left, t: c.top, r: c.right, b: c.bottom } : null;
        bar = [left, right].map(e => e.getBoundingClientRect()).map(q => ({ l: q.left, r: q.right, b: q.bottom }));
        { const k = view.capitolBox ? view.capitolBox() : null; keep.hidden = !k; if (k) Object.assign(keep.style, { left: Math.round(k.l) + 'px', top: Math.round(k.t) + 'px', width: Math.round(k.r - k.l) + 'px', height: Math.round(k.b - k.t) + 'px' }); }
        view.setView(hud.getBoundingClientRect().bottom, c && { l: c.left, t: c.top, r: c.right, b: c.bottom });
        setText(coinNum, fmtLive(game.town.coins)); setText(inc, '+' + fmtLive(shell.meter ? shell.meter.total : 0) + '/s');
      }
      if (openId && acc === 0) paintCard(); // with the badges, so a card and its label read the same rate (review of 2026.11.19-5: 2.5 beside +1.9/s)
    },
    destroy() { offLost(); offDone(); ui.remove(); },
  };
}
