/* Automation (GDD.md, Automation): per-town switches that keep buying what the player already chose by hand.
   - Foremen (Auto-build) are hired per building (src/core/foremen.js); the sheet switches all of a town's on or off.
   - Auto-towers (opened by the War Office): one tower level every towerEvery seconds, the cheapest raise of a tower
     that stands, never a new tower and never past level 4 until the player picks that tower's path.
   - Auto-research (opened by the University): when the lab is idle, the cheapest next level of an item the player has
     researched at least once.
   - Keep trying the boss (opened with Auto-towers, owner 2026-11-17): a town that lost a boss wave, or whose vault fell
     on any wave (since 2026.11.19-1), holds its waves as always, then starts them again by itself once a tower has gone up a level (or a new one stands) since the loss, so
     it drops back, climbs and tries the boss again. One coin loss per try, and every try meets stronger towers.
   Each buys only when the price is at most AUTO.share of the coins on hand, so half the purse always stays.
   State: game.shared.auto[town id] = { towers, research, retry, wait, last, boss, raids } where raids (a won outpost
   only, optional, 0 when missing) is its breaches at the last raise (raidsHeld) and boss is the try in progress
   { wave, power, at, tries } (power: the town's tower levels when it lost); it survives a charter (the switches are the
   player's settings). It keeps working out of play and while time away is caught up.
   Events: 'auto:set' { town, kind, on }, 'auto:tower' { town, spot, level }, 'auto:research' { town, id, level },
   'auto:retry' { town, wave, tries }. */
import { AUTO } from '../data/automation.js';
import { PATH_LEVEL } from '../data/towers.js';
import { founded } from './tree.js';
import { towerCost, canPay, upgradeTower, setHold, bossWave, wavesOf } from './defense.js';
import { itemsOf, researchLevel, researchBlock, researchCost, startResearch } from './research.js';
import { hasForeman, foremanOn, setForeman } from './foremen.js';

export const KINDS = ['towers', 'research', 'retry'];
export const autoOf = (game, town) => {
  const all = game.shared.auto || (game.shared.auto = {});
  return all[town.id] || (all[town.id] = { towers: false, research: false, retry: false, wait: 0, last: null, boss: null });
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
  if (raidsHeld(game, town)) return 'won';
  const n = nextTowerUp(town);
  if (!n) return 'none';
  if (!n.tower) return 'path';
  if (!affords(town, n.cost.coins) || !canPay(town, n.cost)) return 'coins';
  if (autoOf(game, town).wait > 1e-9) return 'wait';
  return null;
}

/* A won outpost only meets light raids at its wave-10 strength, which its towers already beat, so Auto-towers raises
   one there only after a raid got through, one raise per raid lost (Evaluation 2, 2026-11-19: in the 12-hour idle run
   its biggest buys, up to 393K at once, went to Pine Hollow and Dry Creek while the Gulch waited for coins). The raids
   it has answered: autoOf(...).raids, the outpost's breaches at its last raise. */
export const raidsHeld = (game, town) => !!town.won && (town.breaches || 0) <= (autoOf(game, town).raids || 0);

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

/* Keep trying the boss. The town holds its waves after losing a boss wave: its boss got through, or its vault fell
   on it. towerPower counts a tower's levels (a new tower counts too), so any raise or new tower since the loss shows. */
export const towerPower = town => (town.towers || []).reduce((n, t) => n + (t.level || 0) + 1, 0);
export const lostBoss = town => !!(town.waves && town.waves.autoHold && town.lost && (town.lost.why === 'boss' || bossWave(town, town.lost.wave)));
/* What Keep trying the boss takes up: any loss that holds the waves, a boss that got through or a vault that fell on a
   plain wave (Evaluation 2, 2026-11-19: in the 24 h idle run the Gulch's vault fell on wave 26-33 while away on every
   seed, and the town sat on hold for the whole day while Auto-towers kept raising its towers). */
export const lostTry = town => !!(town.waves && town.waves.autoHold && town.lost);
/* The town in play just lost its boss and will try again by itself. */
export const willRetry = (game, town) => autoOn(game, town, 'retry') && lostTry(town);
/* Where a try stands: null (no try, or the switch is off), 'wait' (on hold until a tower goes up a level, which
   Auto-towers will do), 'stuck' (on hold, and Auto-towers cannot raise one: it is off, there is no tower, or every
   tower waits for its path), or 'climb' (playing back up to the boss wave). */
export function retryState(game, town) {
  if (!autoOn(game, town, 'retry')) return null;
  if (lostTry(town)) {
    const b = towerBlock(game, town);
    return b === 'off' || b === 'none' || b === 'path' ? 'stuck' : 'wait';
  }
  const a = autoOf(game, town).boss;
  return a && !town.waves.autoHold && town.bestWave < a.wave ? 'climb' : null;
}
function retry(game, town, a) {
  if (lostTry(town)) {
    const l = town.lost;
    if (!a.boss || a.boss.at !== l.at || a.boss.wave !== l.wave) a.boss = { wave: l.wave, power: towerPower(town), at: l.at, tries: (a.boss && a.boss.wave === l.wave ? a.boss.tries : 0) + 1 };
    if (towerPower(town) > a.boss.power) {
      setHold(game, town, false);
      game.bus.emit('auto:retry', { town: town.id, wave: a.boss.wave, tries: a.boss.tries });
    }
  } else if (a.boss && (town.bestWave >= a.boss.wave || town.wave < a.boss.wave - wavesOf(town).breachBack)) a.boss = null; // beaten, or fell further back (a charter, a vault)
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
        if (town.won) a.raids = town.breaches || 0;
        game.bus.emit('auto:tower', { town: town.id, spot: tower.spot, level: tower.level });
      }
    }
  }
  if (autoOn(game, town, 'retry')) retry(game, town, a);
  else if (a.boss) a.boss = null;
  if (autoOn(game, town, 'research') && !town.lab && !town.labNext) { // a lined-up item is the player's pick
    const n = nextResearch(town);
    if (n && startResearch(game, town, n.id)) game.bus.emit('auto:research', { town: town.id, id: n.id, level: researchLevel(town, n.id) + 1 });
  }
}

export const automation = {
  id: 'automation',
  setup(game) { if (!game.shared.auto) game.shared.auto = {}; },
  step(town, dt, game) { work(game, town, dt); },
};
