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
import { TOWERS, PATHS, PER_LEVEL } from '../data/towers.js';
import { FOES } from '../data/foes.js';
import { TOWNS } from '../data/towns/index.js';
import { milestonesAt } from './economy.js';
import { saturation, eventFactor } from './market.js';
import { towerStats, wavesOf, vaultMax } from './defense.js';

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
  const rows = [{ label: 'Base at level ' + L, base: b.rate * L }];
  // each milestone level reached doubles it: "Level 10 bonus", "Level 10 and 25 bonuses"
  const at = MILESTONES.filter(x => L >= x), list = at.length > 1 ? at.slice(0, -1).join(', ') + ' and ' + at[at.length - 1] : String(at[0]);
  if (m) rows.push({ label: 'Level ' + list + (m === 1 ? ' bonus' : ' bonuses'), mul: 2 ** m });
  rows.push(...modRows(town.mods, 'prod'), ...modRows(town.mods, 'prod:' + id));
  return done('rate', rows);
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
  const d = TOWERS[t.kind], L = t.level, p = t.path ? PATHS[t.kind][t.path] : null, lv = 'Level ' + L;
  const part = (stat, base, levelMul, pathMul, unit, name) => {
    const rows = [{ label: name, base }];
    if (L > 1 && levelMul !== 1) rows.push({ label: lv, mul: levelMul });
    if (p && pathMul && pathMul !== 1) rows.push({ label: p.name + ' path', mul: pathMul });
    rows.push(...modRows(town.mods, stat));
    return done(unit, rows);
  };
  const out = {
    dmg: part('towerDmg', d.dmg, PER_LEVEL.dmg ** (L - 1), p && p.dmg, 'dmg', 'Base damage'),
    rate: part('towerRate', d.rate, PER_LEVEL.rate ** (L - 1), p && p.rate, 'shots', 'Base shots'),
    range: part('towerRange', d.range, (d.range + PER_LEVEL.range * (L - 1)) / d.range, p && p.range, 'reach', 'Base range'),
  };
  if (d.poison) out.poison = part('towerDmg', d.poison, PER_LEVEL.poison ** (L - 1), p && p.poison, 'dmg', 'Base poison');
  const st = towerStats(town, t); // the same numbers the battle uses
  out.dmg.value = st.dmg; out.rate.value = st.rate; out.range.value = st.range;
  if (out.poison) out.poison.value = st.poison;
  return out;
}

/* The vault's strength in hits (a stockpile's too), and how many hits each raider that gets there takes. */
export function explainVault(town) {
  const rows = [{ label: town.def && town.def.store === 'stockpile' ? 'Full stockpile' : 'Full vault', base: wavesOf(town).vault }, ...modRows(town.mods, 'vault')];
  const ex = done('hits', rows);
  ex.value = vaultMax(town); // whole hits, as the battle uses
  ex.left = Math.max(0, Math.ceil(town.vault.hp));
  const boss = (town.def && town.def.boss) || 'wagon';
  ex.raiders = Object.entries(FOES).filter(([k, f]) => (!f.boss || k === boss) && (!f.water || !!(town.def.board && town.def.board.river))).map(([k, f]) => ({ kind: k, label: f.name, hits: f.leak }));
  return ex;
}

/* Income. Town.earn files every coin under a key (town.tally, not saved): 'sale:<good>', 'bounty', 'call', 'contract'. Given two
   snapshots of the tally and the seconds between them, the coins a second from each, biggest first, and the bonuses
   already in those numbers. explainEmpireIncome adds a row for every other town and outpost ('town:<id>'), since all
   their coins go into the same purse. */
const townName = id => (TOWNS[id] ? TOWNS[id].name : id);
export function incomeLabel(key) {
  const [kind, id] = key.split(':');
  if (kind === 'sale') return 'Selling ' + (GOODS[id] ? GOODS[id].name.toLowerCase() : id);
  if (kind === 'town') return townName(id);
  if (kind === 'bounty') return 'Raiders beaten';
  if (kind === 'call') return 'Waves called early';
  if (kind === 'contract') return 'Contracts for the Capital';
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
export function explainEmpireIncome(game, before, now, seconds) {
  const ex = explainIncome(game.town, before.active === now.active ? before.tally : now.tally, now.tally, before.active === now.active ? seconds : 0);
  for (const [id, n] of Object.entries(now.life)) {
    if (id === now.active) continue;
    const d = n - ((before.life && before.life[id]) || 0);
    if (d > 1e-9 && seconds > 0) ex.rows.push({ key: 'town:' + id, label: townName(id), value: d / seconds });
  }
  ex.rows.sort((a, b) => b.value - a.value);
  ex.value = ex.rows.reduce((s, r) => s + r.value, 0);
  return ex;
}

