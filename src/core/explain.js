/* Every number explains itself (owner rule, CLAUDE.md): tapping a number on screen shows what it is made of.
   Each function here returns { value, unit, rows } where rows are
     { label, base }   the starting value (one per explanation, first)
     { label, mul }    a factor on it: a level, a path, the market, or a named bonus source (src/core/mods.js)
   and value is base times every mul, the number on screen (test/explain.test.js proves it for each one). Every bonus
   source on the stat gets its own row, so nothing stacks out of sight. Income is a sum instead: { value, rows:
   [{ label, value }] } plus the bonuses already counted in it. Pure: no formatting, no DOM.
   unit tells the screen how to show a value: 'rate' (a second), 'coins', 'hits', 'dmg', 'shots' (a second),
   'reach' (Short, Medium, Long). */
import { BUILDINGS, MILESTONES } from '../data/buildings.js';
import { GOODS } from '../data/goods.js';
import { FORKS, TOWERS, PATHS, PER_LEVEL } from '../data/towers.js';
import { FOES } from '../data/foes.js';
import { TOWNS } from '../data/towns/index.js';
import { milestonesAt, output, uses, isGrid, gridOf, buildingsOf } from './economy.js';
import { saturation, eventFactor } from './market.js';
import { towerStats, wavesOf, vaultMax, mendHits, OLD_LABEL } from './defense.js';

/* The named sources on a stat as rows, plus a "Top limit" row when the stat's cap holds it back. */
export function modRows(mods, stat) {
  const ex = mods.explain(stat, 1), rows = ex.parts.filter(p => p.mul !== 1).map(p => ({ label: p.source, mul: p.mul }));
  if (ex.capped) rows.push({ label: 'Top limit', mul: ex.factor / ex.raw });
  return rows;
}
const total = rows => rows.reduce((v, r) => (r.base !== undefined ? r.base : v * r.mul), 1);
const done = (unit, rows) => ({ unit, rows, value: total(rows) });

/* A building's output a second at full supply. */
export function explainOutput(town, id) {
  const b = BUILDINGS[id], L = town.level(id), m = milestonesAt(L);
  const rows = [{ label: 'Before bonuses', base: b.rate * L }]; // the card shows the level, so this row does not say it again (review of 2026.11.19-5)
  // each milestone level reached doubles it: "Level 10 bonus", "Level 10 and 25 bonuses"
  const at = MILESTONES.filter(x => L >= x), list = at.length > 1 ? at.slice(0, -1).join(', ') + ' and ' + at[at.length - 1] : String(at[0]);
  if (m) rows.push({ label: 'Level ' + list + (m === 1 ? ' bonus' : ' bonuses'), mul: 2 ** m });
  rows.push(...modRows(town.mods, 'prod'), ...modRows(town.mods, 'prod:' + id));
  return done('rate', rows);
}

/* What a building really makes a second: its output at full supply, and when it runs short (town.ran, smoothed in
   src/core/economy.js, under SHORT_SHARE of that) one more row for what it is short of, so the card never says
   "Makes 1 boiler a second" beside "Not enough bricks" (review of 2026.11.19-4). ex.short is the good it lacks, or null. */
export const SHORT_SHARE = .97;
export function explainMade(town, id) {
  const ex = explainOutput(town, id), full = ex.value, ran = town.ran && town.ran[id];
  ex.short = null; ex.lacking = false;
  const ins = Object.keys(BUILDINGS[id].inputs);
  // a camp needs nothing, so it is never short: its smoothed rate only lags a new bonus (review of 2026.11.19-10 screenshots)
  if (!ins.length || !town.level(id) || !(full > 0) || ran === undefined || ran >= full * SHORT_SHARE) return ex;
  const out = output(town, id);
  // held back for the towers (src/core/economy.js, WORKSHOP): the yard has the good, the towers get it first
  const held = !!town.starved && town.starved[id] === 'towers', ku = held ? town.keepUse || {} : {};
  const g = ins.find(k => isGrid(k) ? gridOf(town).share < .999 : (town.goods[k] || 0) - (ku[k] || 0) < out * uses(town, id, k)) || null;
  ex.short = g; ex.lacking = true; ex.held = held;
  ex.rows.push({ label: g ? (held ? GOODS[g].name + ' kept for towers' : 'Not enough ' + GOODS[g].name.toLowerCase()) : 'Not enough materials', mul: Math.max(0, ran) / full });
  ex.value = Math.max(0, ran);
  return ex;
}

/* The town's own workshops that use a good, and how much of it they use a second right now (what each really made,
   town.ran, times what it uses), so a camp's card can say where its good goes (review of 2026.11.20-12: "Makes 36
   timber a second" beside a Timber count that stayed at 84). { ids, rate }. */
export function usedBy(town, good) {
  const ids = [];
  let rate = 0;
  if (isGrid(good)) return { ids, rate };
  for (const id of buildingsOf(town)) {
    if (!(good in BUILDINGS[id].inputs) || !town.level(id)) continue;
    ids.push(id);
    const ran = town.ran && town.ran[id];
    rate += Math.max(0, ran === undefined ? output(town, id) : ran) * uses(town, id, good);
  }
  return { ids, rate };
}

/* What one unit of a good pays right now: its base price, the market (selling a lot lowers it for a while, an event
   moves it) and the town's bonuses on prices and on every coin earned. */
export function explainPrice(game, town, good) {
  const rows = [{ label: 'Base price', base: GOODS[good].price }];
  const s = saturation(game, good), e = eventFactor(game, good);
  if (s < .995) rows.push({ label: 'Sold a lot lately', mul: s });
  if (e !== 1) rows.push({ label: e > 1 ? 'Boom' : 'Bust', mul: e });
  rows.push(...modRows(town.mods, 'price'), ...modRows(town.mods, 'income'));
  return done('coins', rows);
}
/* The price on screen: what one unit pays now, bonuses included. */
export const paysEach = (game, town, good) => explainPrice(game, town, good).value;

/* A tower's damage, shots and reach, each from its kind, its level, its path and the town's bonuses.
   Returns { dmg, rate, range, poison? }, each explained. */
export function explainTower(town, t) {
  const d = TOWERS[t.kind], L = t.level, p = t.path ? PATHS[t.kind][t.path] : null, lv = 'Level ' + L, k = t.fork && FORKS[t.kind] ? FORKS[t.kind][t.fork] : null;
  const part = (stat, base, levelMul, pathMul, unit, name, forkMul = 1) => {
    const rows = [{ label: name, base }];
    if (L > 1 && levelMul !== 1) rows.push({ label: lv, mul: levelMul });
    // the path by its own name, like the level-20 pick (review of 2026.11.23-7: "Heavy Cannon path")
    if (p && pathMul && pathMul !== 1) rows.push({ label: p.name, mul: pathMul });
    if (k && forkMul !== 1) rows.push({ label: k.name, mul: forkMul });
    // the old-waves bonus names the wave it lasts to (review of 2026.11.19-10: "Until you beat your best wave" was unclear)
    rows.push(...modRows(town.mods, stat).map(r => (r.label === OLD_LABEL ? { ...r, label: oldWavesLabel(town), old: true } : r)));
    return done(unit, rows);
  };
  // the first row is the tower when new (review of 2026.11.23-7: "Base damage" was a word a new player had not learned)
  const NEW = 'New ' + d.name;
  const out = {
    dmg: part('towerDmg', d.dmg, (d.grow || PER_LEVEL.dmg) ** (L - 1), p && p.dmg, 'dmg', NEW, (k && k.dmg) || 1),
    rate: part('towerRate', d.rate, PER_LEVEL.rate ** (L - 1), p && p.rate, 'shots', NEW, (k && k.rate) || 1),
    range: part('towerRange', d.range, (d.range + PER_LEVEL.range * (L - 1)) / d.range, p && p.range, 'reach', NEW, (k && k.range) || 1),
  };
  if (d.poison && !(k && k.rot)) out.poison = part('towerDmg', d.poison, PER_LEVEL.poison ** (L - 1), p && p.poison, 'dmg', NEW);
  // the blast opens like Damage, Shots and Range (review of 2026.11.20-1: Blast had no ">")
  if (d.splash) out.splash = part('blast', d.splash, 1, p && p.splash, 'blast', NEW, (k && k.splash) || 1);
  const st = towerStats(town, t); // the same numbers the battle uses
  out.dmg.value = st.dmg; out.rate.value = st.rate; out.range.value = st.range;
  // Slow Rot: its poison is a share of its damage a second (src/core/defense.js, towerStats)
  if (st.rot) { out.poison = done('dmg', [{ label: 'Damage a second', base: st.dmg * st.rate }, { label: k.name, mul: k.rot }]); out.poison.value = st.rot; }
  else if (out.poison) out.poison.value = st.poison;
  if (out.splash) out.splash.value = st.splash;
  return out;
}

/* The tower card's row for the old-waves bonus: "Already beaten, up to wave 57". */
/* Short, so "× 3" stays on its line on a phone (review of 2026.11.19-12: "Stronger on waves you beat before, up to wave 23"
   wrapped and read as a sentence). The wave number on the play screen turns gold while it lasts. */
/* (review of 2026.11.19-13: "Beaten waves 1-23 × 3" on wave 3 read as a mystery; the wave number turns gold while it lasts) */
/* (review of 2026.11.23-9: "Won last time" was flagged again, after six rewordings, so by the twice-flagged rule the
   words gave way to a picture: the row's label is the wave number in gold, drawn like the wave bar's own gold number,
   which is gold while this bonus lasts. The row carries old: true so the box draws it as that badge.) */
export const oldWavesLabel = town => (town && town.wave ? 'Wave ' + town.wave : 'Wave');

/* The vault's strength in hits (a stockpile's too), and how many hits each raider that gets there takes. */
export function explainVault(town) {
  // the start is named by the place's store, the total in the sheet is Most hits (review of 2026.11.23-11: "Full vault"
  // and "Full strength" were two names for one thing)
  const rows = [{ label: town.def && town.def.store === 'stockpile' ? 'Stockpile' : 'Vault', base: wavesOf(town).vault }, ...modRows(town.mods, 'vault')];
  const ex = done('hits', rows);
  ex.value = vaultMax(town); // whole hits, as the battle uses
  ex.left = Math.max(0, Math.ceil(town.vault.hp));
  ex.mend = mendHits(town); // hits back for each wave beaten, as the battle gives them
  const boss = (town.def && town.def.boss) || 'wagon';
  ex.raiders = Object.entries(FOES).filter(([k, f]) => (!f.boss || k === boss) && (!f.only || (FOES[boss].stages || []).some(st => st.drop === k)) && (!f.water || !!(town.def.board && town.def.board.river))).map(([k, f]) => ({ kind: k, label: f.name, hits: f.leak }));
  return ex;
}

/* Income. Town.earn files every coin under a key (town.tally, not saved): 'sale:<good>', 'bounty', 'call', 'contract', 'order'. Given two
   snapshots of the tally and the seconds between them, the coins a second from each, biggest first, and the bonuses
   already in those numbers. explainEmpireIncome adds a row for every other town and outpost ('town:<id>'), since all
   their coins go into the same purse. */
const townName = id => (TOWNS[id] ? TOWNS[id].short || TOWNS[id].name : id); // the name the map uses (review of 2026.11.19-10: "Dry Creek Outpost")
export function incomeLabel(key) {
  const [kind, id] = key.split(':');
  if (kind === 'sale') return 'Selling ' + (GOODS[id] ? GOODS[id].name.toLowerCase() : id);
  if (kind === 'town') return 'Earned in ' + townName(id); // a town's name alone did not say what the row was (review of 2026.11.19-5)
  if (kind === 'bounty') return 'Raiders beaten';
  if (kind === 'call') return 'Waves called early';
  if (kind === 'contract') return 'Contracts for the Capital';
  if (kind === 'order') return 'Orders filled';
  return 'Other';
}
export function explainIncome(town, before, now, seconds) {
  const rows = [];
  for (const k of Object.keys(now)) {
    const n = (now[k] || 0) - ((before && before[k]) || 0);
    if (n > 1e-9 && seconds > 0) rows.push({ key: k, label: incomeLabel(k), value: n / seconds });
  }
  rows.sort((a, b) => b.value - a.value);
  const on = (stat, what) => modRows(town.mods, stat).map(r => ({ ...r, on: what }));
  const bonuses = [...on('income', 'all'), ...on('price', 'sales'), ...on('bounty', 'raiders')];
  return { unit: 'rate', rows, value: rows.reduce((s, r) => s + r.value, 0), bonuses };
}
/* A snapshot for explainEmpireIncome: the town in play's tally and what every town has earned. */
export function incomeSnap(game) {
  return { active: game.active, tally: { ...game.town.tally }, life: Object.fromEntries(Object.entries(game.towns).map(([id, t]) => [id, t.lifetime])) };
}
/* The purse's income: the town in play by source, then one row for each other town and outpost. A town that signed its
   charter between the snapshots starts again from 0, so it shows nothing until the next snapshot. */
/* others: { id: coins a second } for the other towns, from the map's meter (src/core/map.js FlowMeter), so a town's row
   reads as its map label does (review of 2026.11.19-8: Pine Hollow +1/s here and +9/s on the map, since an outpost's
   bounties come in bursts a few seconds miss). Without it, the lifetime coins between the snapshots. */
export function explainEmpireIncome(game, before, now, seconds, others = null) {
  const ex = explainIncome(game.town, before.active === now.active ? before.tally : now.tally, now.tally, before.active === now.active ? seconds : 0);
  for (const [id, n] of Object.entries(now.life)) {
    if (id === now.active) continue;
    const d = n - ((before.life && before.life[id]) || 0), v = others ? others[id] || 0 : seconds > 0 ? d / seconds : 0;
    if (v > 1e-9) ex.rows.push({ key: 'town:' + id, label: incomeLabel('town:' + id), value: v });
  }
  ex.rows.sort((a, b) => b.value - a.value);
  ex.value = ex.rows.reduce((s, r) => s + r.value, 0);
  return ex;
}

