/* The Capital (GDD.md, The Capital) and its federal contracts. Pure: no DOM, no three.js, no Math.random.
   The Capital is not a town: it has no board, road or raiders, and lives in game.shared.capital:
     { open, influence, earned, filled, offers: [contract], active: contract | null, rng, n, wait }
   contract: { id, good, town, need, got, coins, influence, minutes }
   Founding it (canFoundCapital, foundCapital) takes Iron Ridge's best wave and coins from the purse (CAPITAL_DEF.found).
   Once open it keeps `board` offers on its board. Each asks for a good one of your towns makes, about a few minutes of
   that town's spare output. The player takes one at a time (takeContract). While it runs, the town that makes the good
   sends it to the Capital by itself, before the market sells any, from what it has above its workshops' buffer and
   its tower reserve, as a route does (the Sell switch does not stop it). Economy calls claim() for that.
   A full contract pays its coins into the purse, as the making town's own earnings ('contract' in the income
   explained), and its Influence. Taking another offer while one runs drops the one running, and its goods are kept by
   the Capital. Events: 'capital:found' { coins }, 'contract:take' { id, good }, 'contract:drop' { id, good },
   'contract:done' { id, good, town, coins, influence }.
   Kinds (CAPITAL_DEF.contracts.kinds, clarity fix 3b part 3a): once the Capital has filled `at` contracts, a kind
   opens for good ('contract:new' { kind }, once, kept in c.opened). A new offer is that kind, by chance, while none
   of it is on the board or running. A rush contract asks for less, pays twice the Influence and has a clock that starts
   when it is taken ('contract:miss' { id, good, town } when it runs out; the goods sent stay at the Capital). A big one
   asks for much more and pays a little more for each minute. contract.kind is 'rush', 'big' or absent. */
import { CAPITAL_DEF } from '../data/capital.js';
import { GOODS } from '../data/goods.js';
import { BUILDINGS } from '../data/buildings.js';
import { Rng } from './rng.js';
import { demand, output, isOutpost, importers, KEEP_SECONDS } from './economy.js';

const C = CAPITAL_DEF.contracts, KINDS = C.kinds;
export const capitalOf = game => game.shared.capital;
export const capitalOpen = game => !!(game.shared.capital && game.shared.capital.open);

/* The Capital as the map shows it before it is built: null until its paying town's best wave reaches `shows`, then
   { waveOk, coinsOk, ready }. */
export function capitalNext(game) {
  const f = CAPITAL_DEF.found, from = game.towns[f.from];
  if (capitalOpen(game) || !from || (from.bestWave || 0) < f.shows) return null;
  return { ...f, waveOk: from.bestWave >= f.wave, coinsOk: from.coins + 1e-9 >= f.coins, ready: canFoundCapital(game) };
}
export function canFoundCapital(game) {
  const f = CAPITAL_DEF.found, from = game.towns[f.from];
  return !!(from && !capitalOpen(game) && from.bestWave >= f.wave && from.coins + 1e-9 >= f.coins);
}
/* 'capital:ready' { town, coins }, once per game: the paying town's best wave reached the Capital's. The flag lives on
   empire (game.shared.capital.told), so a charter in that town never fires it again. An old save past the wave and
   without the Capital gets it once, which is its news too. */
function readyOnce(game) {
  const f = CAPITAL_DEF.found, from = game.towns[f.from];
  if (!from || (from.bestWave || 0) < f.wave || capitalOf(game).told) return;
  capitalOf(game).told = true;
  game.bus.emit('capital:ready', { town: f.from, coins: f.coins });
}
/* Found it: the purse pays and the board fills. Returns true when it was founded. */
export function foundCapital(game) {
  if (!canFoundCapital(game)) return false;
  const c = capitalOf(game), f = CAPITAL_DEF.found;
  game.towns[f.from].coins -= f.coins;
  c.open = true; c.wait = 0;
  fill(game);
  game.bus.emit('capital:found', { coins: f.coins });
  return true;
}

/* The units a second a town has left over of a good it makes: what its buildings make, less what its own workshops
   and the towns it ships that good to use. */
export function spareRate(game, town, good) {
  let made = 0;
  for (const id of town.def.buildings) if (BUILDINGS[id].makes === good) made += output(town, id);
  let used = demand(town)[good] || 0;
  for (const to of importers(game, town)) if ((to.def.imports || []).includes(good)) used += demand(to)[good] || 0;
  return Math.max(0, made - used);
}
/* What a town can send right now: its stock above its workshops' buffer and its tower reserve. */
export function spareNow(town, good) {
  return Math.max(0, (town.goods[good] || 0) - (demand(town)[good] || 0) * KEEP_SECONDS - ((town.keep || {})[good] || 0));
}

/* Goods a contract can ask for now: made goods (not raw) of an open town (not an outpost) that it has to spare. */
export function contractGoods(game) {
  const c = capitalOf(game), taken = new Set([...c.offers.map(o => o.good), ...(c.active ? [c.active.good] : [])]);
  const out = [];
  for (const [g, d] of Object.entries(GOODS)) {
    const t = game.towns[d.town];
    if (d.tier < 1 || !t || isOutpost(t) || taken.has(g)) continue;
    const r = spareRate(game, t, g);
    if (r > 1e-6) out.push({ good: g, town: t.id, rate: r });
  }
  return out;
}
/* Round to two figures (3456 -> 3500), so an ask reads well. */
export const nice = n => { if (!(n > 0)) return 0; const p = 10 ** Math.max(0, Math.floor(Math.log10(n)) - 1); return Math.round(n / p) * p; };

/* Draw one new offer onto the board, or null when no good can be asked for. */
function offer(game) {
  const c = capitalOf(game), list = contractGoods(game);
  if (!list.length) return null;
  const rng = Rng.from(c.rng);
  const w = Object.fromEntries(list.map((x, i) => [i, GOODS[x.good].tier])); // finished goods come up twice as often
  const x = list[+rng.weighted(w)], tier = GOODS[x.good].tier;
  // a kind that is open and has no offer on the board or running comes up by chance
  const has = k => c.offers.some(o => o.kind === k) || (c.active && c.active.kind === k);
  const can = Object.keys(KINDS).filter(k => (c.opened || {})[k] && !has(k)).filter(k => rng.chance(KINDS[k].chance));
  const kind = can.length ? can[0] : null, K = kind ? KINDS[kind] : null, span = K ? K.minutes : C.minutes;
  const minutes = Math.round(rng.range(span[0], span[1]) * 2) / 2;
  c.rng = rng.state;
  const need = Math.max(C.least[tier], nice(x.rate * 60 * minutes));
  const o = {
    id: c.n++, good: x.good, town: x.town, need, got: 0, minutes,
    coins: Math.round(need * GOODS[x.good].price * C.pay * (K ? K.pay : 1)),
    influence: Math.max(1, Math.round(C.influence[tier] * minutes / C.per * (K ? K.influence : 1))),
  };
  if (kind) o.kind = kind;
  // a rush contract's clock: its ask at the spare rate it was drawn at, times `time`, in whole seconds
  if (kind === 'rush') o.time = Math.ceil(need / x.rate * K.time / 10) * 10;
  c.offers.push(o);
  return o;
}
/* Fill the board's empty spots. A spot that finds nothing to ask for looks again after C.retry seconds. */
function fill(game) {
  const c = capitalOf(game);
  while (c.offers.length < C.board) if (!offer(game)) { c.wait = C.retry; return; }
  c.wait = 0;
}

/* Take an offer. A contract already running is dropped (the goods it got stay with the Capital). */
export function takeContract(game, id) {
  const c = capitalOf(game), i = c.offers.findIndex(o => o.id === id);
  if (!c.open || i < 0) return false;
  if (c.active) dropContract(game);
  c.active = c.offers.splice(i, 1)[0];
  if (c.active.kind === 'rush') c.active.left = c.active.time;
  game.bus.emit('contract:take', { id, good: c.active.good });
  fill(game);
  return true;
}
export function dropContract(game) {
  const c = capitalOf(game);
  if (!c.active) return false;
  const a = c.active; c.active = null;
  game.bus.emit('contract:drop', { id: a.id, good: a.good });
  return true;
}

/* Send what the town that makes the running contract's good has to spare (economy calls this before it sells). */
export function claim(game, town) {
  const c = capitalOf(game), a = c && c.active;
  if (!a || a.town !== town.id) return;
  const n = Math.min(spareNow(town, a.good), a.need - a.got);
  if (n > 1e-9) { town.goods[a.good] -= n; a.got += n; }
  if (a.got >= a.need - 1e-6) {
    // the Empire tree may raise the Influence it pays (game.mods, src/core/tree.js)
    const inf = Math.max(1, Math.round(a.influence * (game.mods ? game.mods.factor('influence') : 1)));
    c.active = null; c.filled++; c.influence += inf; c.earned += inf;
    town.earn(a.coins, false, 'contract');
    game.bus.emit('contract:done', { id: a.id, good: a.good, town: town.id, coins: a.coins, influence: inf });
    fill(game);
  }
}

/* A rush contract whose clock ran out: it ends, and what it got stays at the Capital, unpaid. */
function miss(game) {
  const c = capitalOf(game), a = c.active;
  c.active = null; c.missed = (c.missed || 0) + 1;
  game.bus.emit('contract:miss', { id: a.id, good: a.good, town: a.town });
  fill(game);
}
/* Open each kind once the Capital has filled enough contracts. An old save already past the count opens it on its
   first step, which is its news too. */
function openKinds(game) {
  const c = capitalOf(game);
  c.opened ||= {};
  for (const [k, K] of Object.entries(KINDS)) if (!c.opened[k] && c.filled >= K.at) { c.opened[k] = true; game.bus.emit('contract:new', { kind: k }); }
}

export const capital = {
  id: 'capital',
  setup(game) {
    if (!game.shared.capital) game.shared.capital = { open: false, influence: 0, earned: 0, filled: 0, missed: 0, opened: {}, offers: [], active: null, rng: new Rng(game.seed + ':capital').state, n: 1, wait: 0 };
  },
  tick(dt, game) {
    const c = capitalOf(game);
    // the Capital's gate passed, once: its paying town beat its wave and only the coins are left (clarity fix 3b part
    // 2b: the strip turned to "Tap Hold waves while you save for the Capital" with no word of why)
    if (!c.open) readyOnce(game);
    if (!c.open) return;
    openKinds(game);
    const a = c.active;
    if (a && a.kind === 'rush' && (a.left -= dt) <= 1e-9) miss(game);
    if (c.offers.length >= C.board) return;
    if ((c.wait -= dt) <= 0) fill(game);
  },
  claim,
};
