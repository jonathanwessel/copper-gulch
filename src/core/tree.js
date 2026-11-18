/* Institutions and the Empire tree (GDD.md, Institutions). Pure: no DOM, no three.js, no Math.random.
   Once the Capital is built, the player founds institutions (src/data/institutions.js) with coins from the purse, one
   at a time in any order; each one founded makes the next cost more. Each institution is a branch: upgrades bought in
   order with the Capital's Influence. Every upgrade bought puts its effect on every town's stats as a named source
   (the institution's name: "Bank"), so the explain view lists it and the stat's cap holds it.
   The Capital's own stat (Influence a contract pays) lives on game.mods, an empire-wide Mods that is not saved and is
   rebuilt from the tree.
   Empire-wide state: game.shared.tree = { founded: [institution id, in the order founded], nodes: { id: count },
   spent }. Charters keep it (only the Convention, M7, will reset it).
   Events: 'institution:found' { id, coins }, 'node:buy' { id, node, level, cost }. */
import { INSTITUTIONS, INSTITUTION, FOUND, NODE_COST } from '../data/institutions.js';
import { Mods } from './mods.js';
import { capitalOpen, capitalOf } from './capital.js';
import { isOutpost } from './economy.js';

export const treeOf = game => game.shared.tree;
export const founded = (game, id) => treeOf(game).founded.includes(id);
export const nodesOf = (game, id) => treeOf(game).nodes[id] || 0;
export const influence = game => (capitalOf(game) || {}).influence || 0;

/* Coins the next institution costs (the same whichever it is). */
export const foundCost = game => FOUND.coins * FOUND.growth ** treeOf(game).founded.length;
/* Influence the next upgrade of a branch costs, or null when every one is bought. */
export function nodeCost(game, id) { const n = nodesOf(game, id); return n < INSTITUTION[id].nodes.length ? NODE_COST[n] : null; }
/* The next upgrade of a branch, or null. */
export function nextNode(game, id) { const n = nodesOf(game, id); return INSTITUTION[id].nodes[n] || null; }

/* Why an institution cannot be founded now: 'closed' (no Capital), 'done', 'coins', or null when it can. */
export function foundBlock(game, id) {
  if (!INSTITUTION[id] || !capitalOpen(game)) return 'closed';
  if (founded(game, id)) return 'done';
  if (game.shared.purse.coins + 1e-9 < foundCost(game)) return 'coins';
  return null;
}
export function foundInstitution(game, id) {
  if (foundBlock(game, id)) return false;
  const c = foundCost(game);
  game.shared.purse.coins -= c;
  treeOf(game).founded.push(id);
  game.bus.emit('institution:found', { id, coins: c });
  return true;
}

/* Why the next upgrade of a branch cannot be bought now: 'closed' (not founded), 'max', 'influence', or null. */
export function nodeBlock(game, id) {
  if (!INSTITUTION[id] || !capitalOpen(game) || !founded(game, id)) return 'closed';
  const c = nodeCost(game, id);
  if (c === null) return 'max';
  if (influence(game) + 1e-9 < c) return 'influence';
  return null;
}
export function buyNode(game, id) {
  if (nodeBlock(game, id)) return false;
  const c = nodeCost(game, id), node = nextNode(game, id), t = treeOf(game);
  capitalOf(game).influence -= c;
  t.nodes[id] = nodesOf(game, id) + 1; t.spent += c;
  applyTree(game);
  game.bus.emit('node:buy', { id, node: node.id, level: t.nodes[id], cost: c });
  return true;
}
/* Something the player can do in the tree right now (the Capital's badge dot). */
export const treeCalls = game => capitalOpen(game) && INSTITUTIONS.some(i => !foundBlock(game, i.id) || !nodeBlock(game, i.id));

/* The bought upgrades' factors, by stat, for one institution: { stat: mul }, split by where they apply. */
function factors(game, inst, town) {
  const out = {};
  for (const node of inst.nodes.slice(0, nodesOf(game, inst.id))) for (const e of node.effects) {
    if (e.stat === 'influence') continue;
    if (e.where === 'outpost' && !(town && isOutpost(town))) continue;
    out[e.stat] = (out[e.stat] || 1) * e.mul;
  }
  return out;
}
/* Every stat any upgrade can touch (so a source is cleared when nothing is bought, e.g. after the Convention). */
const STATS = [...new Set(INSTITUTIONS.flatMap(i => i.nodes.flatMap(n => n.effects.map(e => e.stat))))];

/* Put the tree on one town's stats. Safe to run again: it sets, never adds. */
export function applyTown(game, town) {
  for (const inst of INSTITUTIONS) {
    const f = factors(game, inst, town);
    for (const st of STATS) if (st !== 'influence') town.mods.set(st, inst.name, { mul: f[st] || 1 });
  }
}
/* The empire-wide stats (Influence a contract pays). */
export function applyEmpire(game) {
  if (!game.mods) Object.defineProperty(game, 'mods', { value: new Mods(), writable: true, enumerable: false, configurable: true });
  for (const inst of INSTITUTIONS) {
    let mul = 1;
    for (const node of inst.nodes.slice(0, nodesOf(game, inst.id))) for (const e of node.effects) if (e.stat === 'influence') mul *= e.mul;
    game.mods.set('influence', inst.name, { mul });
  }
}
export function applyTree(game) {
  applyEmpire(game);
  for (const t of Object.values(game.towns)) applyTown(game, t);
}
/* Influence a contract pays, with the tree's bonus. */
export const influenceFor = (game, base) => {
  if (!game.mods) applyEmpire(game);
  return Math.max(1, Math.round(base * game.mods.factor('influence')));
};

export const tree = {
  id: 'tree',
  setup(game) {
    if (!game.shared.tree) game.shared.tree = { founded: [], nodes: {}, spent: 0 };
    applyEmpire(game);
  },
  init(town, game) { applyEmpire(game); applyTown(game, town); },
  load(town, game) {
    const t = treeOf(game);
    t.founded = (t.founded || []).filter(id => INSTITUTION[id]); t.nodes = t.nodes || {}; t.spent = t.spent || 0;
    applyEmpire(game); applyTown(game, town);
  },
};
