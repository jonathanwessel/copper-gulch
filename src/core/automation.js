/* Automation (GDD.md, Automation): per-town switches that keep buying what the player already chose by hand.
   - Foremen (Auto-build) are hired per building (src/core/foremen.js); the sheet switches all of a town's on or off.
   - Auto-towers (opened by the War Office): one tower level every towerEvery seconds, the cheapest raise of a tower
     that stands, never a new tower and never past level 4 until the player picks that tower's path.
   - Auto-research (opened by the University): when the lab is idle, the cheapest next level of an item the player has
     researched at least once.
   Each buys only when the price is at most AUTO.share of the coins on hand, so half the purse always stays.
   State: game.shared.auto[town id] = { towers, research, wait, last }; it survives a charter (the switches are the
   player's settings). It keeps working out of play and while time away is caught up.
   Events: 'auto:set' { town, kind, on }, 'auto:tower' { town, spot, level }, 'auto:research' { town, id, level }. */
import { AUTO } from '../data/automation.js';
import { PATH_LEVEL } from '../data/towers.js';
import { founded } from './tree.js';
import { towerCost, canPay, upgradeTower } from './defense.js';
import { itemsOf, researchLevel, researchBlock, researchCost, startResearch } from './research.js';
import { hasForeman, foremanOn, setForeman } from './foremen.js';

export const KINDS = ['towers', 'research'];
export const autoOf = (game, town) => {
  const all = game.shared.auto || (game.shared.auto = {});
  return all[town.id] || (all[town.id] = { towers: false, research: false, wait: 0, last: null });
};
export const autoOpen = (game, kind) => !!game.shared.tree && founded(game, AUTO.opens[kind]);
export const autoOn = (game, town, kind) => autoOpen(game, kind) && !!autoOf(game, town)[kind];
export const anyAuto = game => KINDS.some(k => autoOpen(game, k));
/* Seconds between two Auto-towers upgrades: shorter with each War Office upgrade. */
export const towerEvery = game => AUTO.towerEvery * AUTO.faster ** ((game.shared.tree && game.shared.tree.nodes.war) || 0);
const affords = (town, coins) => coins <= town.coins * AUTO.share + 1e-9;

/* Switch one on or off. Returns false while it is not open yet. */
export function setAuto(game, town, kind, on) {
  if (!KINDS.includes(kind) || !autoOpen(game, kind)) return false;
  const a = autoOf(game, town);
  a[kind] = !!on;
  game.bus.emit('auto:set', { town: town.id, kind, on: !!on });
  return true;
}

/* The raise Auto-towers buys next: the cheapest one of a standing tower, skipping towers that wait for a path. Returns
   { tower, cost } or null. `needPath` counts the towers held back for a path. */
export function nextTowerUp(town) {
  let best = null, needPath = 0;
  for (const t of town.towers || []) {
    if (t.level + 1 === PATH_LEVEL && !t.path) { needPath++; continue; }
    const c = towerCost(town, t.kind, t.level);
    if (!best || c.coins < best.cost.coins) best = { tower: t, cost: c };
  }
  return best ? { ...best, needPath } : needPath ? { tower: null, cost: null, needPath } : null;
}
/* Why Auto-towers is not buying right now: 'off', 'wait' (its clock), 'none' (no tower to raise), 'path' (every tower
   waits for a path), 'coins' (the raise costs more than half the coins, or its goods are short), or null. */
export function towerBlock(game, town) {
  if (!autoOn(game, town, 'towers')) return 'off';
  const n = nextTowerUp(town);
  if (!n) return 'none';
  if (!n.tower) return 'path';
  if (!affords(town, n.cost.coins) || !canPay(town, n.cost)) return 'coins';
  if (autoOf(game, town).wait > 1e-9) return 'wait';
  return null;
}

/* The item Auto-research starts next: the cheapest next level of an item done at least once that can start now. */
export function nextResearch(town) {
  let best = null;
  for (const id of itemsOf(town)) {
    if (researchLevel(town, id) < 1 || researchBlock(town, id)) continue;
    const c = researchCost(town, id);
    if (affords(town, c) && (!best || c < best.cost)) best = { id, cost: c };
  }
  return best;
}

/* Foremen: the town's hired ones, and how many work. setForemen switches every one. */
export const foremenOf = town => Object.keys(town.foremen || {}).filter(id => hasForeman(town, id));
export const foremenWorking = town => foremenOf(town).filter(id => foremanOn(town, id)).length;
export function setForemen(town, on) { for (const id of foremenOf(town)) setForeman(town, id, on); }

function work(game, town, dt) {
  if (!game.shared.auto || !game.shared.auto[town.id]) return;
  const a = game.shared.auto[town.id];
  if (autoOn(game, town, 'towers')) {
    a.wait = Math.max(0, a.wait - dt);
    if (!towerBlock(game, town)) {
      const { tower } = nextTowerUp(town);
      if (upgradeTower(game, town, tower.spot)) {
        a.wait = towerEvery(game); a.last = { kind: tower.kind, level: tower.level };
        game.bus.emit('auto:tower', { town: town.id, spot: tower.spot, level: tower.level });
      }
    }
  }
  if (autoOn(game, town, 'research') && !town.lab) {
    const n = nextResearch(town);
    if (n && startResearch(game, town, n.id)) game.bus.emit('auto:research', { town: town.id, id: n.id, level: researchLevel(town, n.id) + 1 });
  }
}

export const automation = {
  id: 'automation',
  setup(game) { if (!game.shared.auto) game.shared.auto = {}; },
  step(town, dt, game) { work(game, town, dt); },
};
