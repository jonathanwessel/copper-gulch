/* The goal strip (GDD.md, Onboarding): one short goal at a time through the first 30 minutes (src/data/goals.js).
   An eighth system: every step it marks the goals whose done() has come true, in any order, and remembers the towns
   the player has been to. What is done is kept in the save (game.shared.goals = { done, visited, off }).
   goalNow(game) is the goal the strip shows: the first goal of the town in play that is not done and is ready.
   Events: 'goal:done' { id, town }. */
import { GOALS } from '../data/goals.js';
import { unlocked, missing, cost, isOutpost } from './economy.js';
import { towerOpen, isPit, towerAt, fitsSpot, towerCost, canPay, bossWave, atWall, bossOn, nextBoss, skyReach } from './defense.js';
import { FOES } from '../data/foes.js';
import { TOWERS, SELL_BACK } from '../data/towers.js';
import { GOODS } from '../data/goods.js';
import { BUILDINGS, aName } from '../data/buildings.js';
import { CAPITAL_DEF } from '../data/capital.js';
import { researchOpen, itemsOf, researchBlock, researchCost } from './research.js';
import { canFound, nextTowns, deedsOf, nodesHeld } from './empire.js';
import { INSTITUTIONS } from '../data/institutions.js';
import { capitalOpen, capitalNext as capitalAhead } from './capital.js';
import { treeOf, foundCost, founded as instFounded } from './tree.js';
import { TOWNS, TOWN_ORDER } from '../data/towns/index.js';
import { stallOf } from './stall.js';
import { deedsFor, charterOffered } from './charter.js';

/* What a goal reads: a small view of one town. */
export function goalContext(game, town) {
  const sh = game.shared.goals || { visited: {} }, towers = town.towers || [], spots = town.def.board.spots;
  const free = pit => { for (let i = 0; i < spots.length; i++) if (isPit(town, i) === pit && !towerAt(town, i) && (pit || fitsSpot(town, i, 'crossbow'))) return i; return null; };
  const by = (better, filter = () => true) => { let b = null; for (const t of towers) if (filter(t) && (!b || better(t, b))) b = t; return b ? b.spot : null; };
  return {
    towers, won: !!town.won, bestWave: town.bestWave || 0, researchOpen: researchOpen(town),
    lv: id => town.level(id), unlocked: id => unlocked(town, id), open: kind => towerOpen(town, kind),
    built: kind => towers.some(t => t.kind === kind), pathed: () => towers.some(t => t.path),
    topLevel: () => towers.reduce((a, t) => Math.max(a, t.level), 0),
    called: () => !!(town.flags && town.flags.called),
    // wave 1 is on the road or past (the first Call now step goes then)
    started: () => town.wave > 1 || (town.bestWave || 0) > 0 || !!(town.waves && town.waves.phase !== 'break'),
    wonIn: id => !!(game.towns[id] && game.towns[id].won), inPlay: game.active === town.id,
    founded: id => !!game.towns[id], lvIn: (tid, id) => game.towns[tid] ? game.towns[tid].level(id) : 0, canFound: id => canFound(game, id), held: () => !!(town.waves && town.waves.hold), heldByPlayer: () => !!(town.waves && town.waves.hold && !town.waves.autoHold),
    researched: () => !!town.lab || Object.values(town.research || {}).some(n => n > 0),
    visited: id => !!sh.visited[id] || game.active === id,
    back: game.back, // the place the back button goes to (src/core/game.js)
    freeSpot: () => free(false), freePit: () => free(true),
    // the free stone pad whose Tesla Coil reaches the most of the sky lane (the first free pad when there is no sky)
    skySpot: () => { let b = null, bn = 0; for (let i = 0; i < spots.length; i++) { if (isPit(town, i) || towerAt(town, i) || !fitsSpot(town, i, 'tesla')) continue; const n = skyReach(town, i); if (n > bn) { b = i; bn = n; } } return b ?? free(false); },
    canBuild: kind => canPay(town, towerCost(town, kind)),
    // what is still missing to pay for a tower, as words that count down ("5 more coins and 3 more timber")
    shortText: kind => {
      const c = towerCost(town, kind), more = (n, name) => Math.ceil(n - 1e-9) + ' more ' + name, out = [];
      if (town.coins < c.coins) out.push(more(c.coins - town.coins, 'coins'));
      for (const [k, n] of Object.entries(c.goods)) { const have = town.goods[k] || 0; if (have < n) out.push(more(n - have, GOODS[k].name.toLowerCase())); }
      return out.join(' and ');
    },
    lowTower: () => by((a, b) => a.level < b.level),
    topTower: () => by((a, b) => a.level > b.level, t => !t.path),
    topOf: kind => by((a, b) => a.level > b.level, t => t.kind === kind && !t.path), // the highest tower of a kind with no path yet
    upTo: lvl => by((a, b) => a.level > b.level, t => t.level < lvl), // the highest tower still under that level
    // the tower whose next level costs the fewest coins: the quickest help in a fight
    wallUps: () => (town.lost && town.lost.ups) || 0, // the upgrades made at the wall since it held (RESUME_WALL)
    cheapUp: () => by((a, b) => towerCost(town, a.kind, a.level).coins < towerCost(town, b.kind, b.level).coins),
  };
}

export const goalsOf = id => GOALS.filter(g => g.town === id);

/* Waves on hold (Evaluation 2, 2026-11-19): the newcomer bot held the Gulch's waves to save for Iron Ridge as the
   strip said, never resumed them, and the Ridge's vault fell while it was in the Gulch, so from about an hour in both
   towns sat on hold for two hours, the strip asking for a Toolsmith it could not open yet. So before any other goal the
   strip asks for Resume waves in the town in play (unless it holds to save for its next town), then sends the player
   to a town that lost while away. These are never marked done: they show while the waves are held. resume: the tap
   the bots make. */
/* The save for the Capital's first building is on: the Capital stands, no building yet, and its coins are short. */
export const firstSave = game => capitalOpen(game) && !(game.shared.tree && game.shared.tree.founded.length) && game.shared.purse.coins + 1e-9 < foundCost(game);
/* A town that lost its boss while the player was away and holds its waves since. */
const lostBossAway = town => !!(town.waves && town.waves.autoHold && town.lost && town.lost.away && (town.lost.why === 'boss' || bossWave(town, town.lost.wave)));
export const RESUME = { id: 'resume', text: 'Tap Resume waves', resume: true, at: () => ({ el: '#holdWaves' }), done: () => false };
/* After a loss the lost card says to build more towers first (review of 2026.11.19-1), so the strip says the same. */
export const RESUME_LOST = { ...RESUME, text: 'Build more towers, then tap Resume waves' };
/* A town at its wall (atWall in src/core/defense.js: it lost twice with no new best wave between) asks for upgrades:
   its pads are full by then, and more of the same towers at level 1 lost twice already. */
/* It counts the upgrades made there since it held (town.lost.ups, src/core/defense.js upgradeTower) up to WALL_UPS
   (PLAN.md M6a, "How long a town waits at its wall": with one upgrade asked, the newcomer's Gulch at waves 25-29 sat on
   towers at level 1 for five hours). */
export const WALL_UPS = 8;
export const RESUME_WALL = { ...RESUME, wall: true, text: 'Tap towers and upgrade them, then tap Resume waves', at: c => c.wallUps() < WALL_UPS && c.cheapUp() != null ? { tower: c.cheapUp() } : { el: '#holdWaves' }, meter: g2 => [Math.min(WALL_UPS, (g2.town && g2.town.lost && g2.town.lost.ups) || 0), WALL_UPS], post: ' upgrades' };
const goResume = id => {
  const name = (TOWNS[id] && TOWNS[id].name) || id;
  return { id: 'resume-' + id, away: true, text: 'Tap Map, ' + name + ', then tap Resume waves', at: c => ({ el: c.back === id ? '#backBtn' : '#mapBtn', go: id }), done: () => false };
};
/* The Capital's save is on: the empire's next step is the Capital and only its coins are missing, or it can be built
   now. Returns that step, or null. */
const capitalNext = game => { const s = nextStep(game); return s && s.next === 'capital' && (s.need || s.id.endsWith(':go')) ? s : null; };
/* The save for the next town once the Capital stands works like the Capital's (the newcomer's Ridge wall, PLAN.md
   M6a): on 3 of 6 seeds the newcomer reached the Ridge's wave 52 and then saved 90 minutes for Silver Falls' 1M coins
   without getting there, since its waves ran on and the strip sent it to the Gulch to resume its waves, which spent
   the save on towers each time. Returns the step while only coins are missing or it can be opened now, or null. */
export const townSaveNext = game => { if (!capitalOpen(game)) return null; const s = nextStep(game); return s && s.next && s.next !== 'capital' && (s.need || s.id.endsWith(':go')) ? s : null; };
const holdFor = s => s.next === 'capital' ? CAPITAL_HOLD : { id: 'next:' + s.next + ':hold', next: s.next, text: REBUILD_WORDS.hold(TOWNS[s.next].name), at: () => ({ el: '#holdWaves' }), done: () => false };
/* A town saving for the Capital: the town that pays for it once past its wave, and while the save is on, every town
   but an outpost. A player who holds its waves to save is not asked to resume them until the Capital stands (clarity
   fix 3), and neither is one that lost while saving (clarity fix 3b part 2: on seed 2 "Build more towers, then tap
   Resume waves" in the Gulch spent the save on its towers). */
export const capitalSaving = (game, town) => {
  const f = CAPITAL_DEF.found;
  if (!town) return false;
  // after the Capital, while its first building is saved for, a town that lost its boss while away stays held too
  // (clarity fix 3b part 2d: on seed 5 the Gulch lost its wave-30 war wagon every few minutes, and each time the strip
  // sent the newcomer back there to spend the save on its towers, so the building never came in 30 minutes). Only a
  // lost boss: holding a town that lost a plain wave too cost its bounties (part 2c) and seeds 2 and 6 their building.
  if (townSaveNext(game)) return !isOutpost(town);
  if (capitalOpen(game)) return !isOutpost(town) && lostBossAway(town) && firstSave(game);
  if (town.id === f.from) return (town.bestWave || 0) >= f.wave;
  // once the Capital is in sight, a town that lost while away stays held until it stands (clarity fix 3b part 2b: on
  // seed 2 the Gulch lost at its own wall four times during the Ridge's climb to wave 30, and each time the strip sent
  // the newcomer there to spend the climb's coins on the Gulch's towers)
  if (!isOutpost(town) && town.waves && town.waves.autoHold && town.lost && town.lost.away && capitalAhead(game)) return true;
  return !isOutpost(town) && !!capitalNext(game);
};
/* The town in play holds its waves for no reason the strip gave: not saving for, or about to found, the town it opens
   next or the Capital. */
export const savingFor = (game, town) => nextTowns(game).some(n => n.from === town.id && n.waveOk) || capitalSaving(game, town);
// while the Capital's save is on, a town held after a loss stays held too: its waves would only cost the save
const heldHere = (game, town) => !!(town.waves && town.waves.hold && !town.won && !nextTowns(game).some(n => n.from === town.id && n.waveOk) && !(capitalSaving(game, town) && (!town.waves.autoHold || capitalNext(game) || townSaveNext(game))));
/* Another town that lost while the player was away and waits for them (Keep trying the boss off). */
// not a town at its wall (atWall): sent back each time, the newcomer's Gulch fell 32-63 times during the Ridge's climb
const heldAway = game => Object.values(game.towns).find(t => t.id !== game.active && t.waves && t.waves.autoHold && t.lost && t.lost.away && !t.won
  && !(game.shared.auto && game.shared.auto[t.id] && game.shared.auto[t.id].retry) && !capitalSaving(game, t) && !atWall(t));
/* With nothing else on the strip, a town at its wall: "Tap Map, Copper Gulch, then upgrade its towers". */
export const WALL_WORDS = { go: town => 'Tap Map, ' + town + ', then upgrade its towers' };
/* The trip to a town at its wall (PLAN.md M6a, "How long a town waits at its wall"): once it has held WALL_WAIT since
   its last loss and the purse can pay for its WALL_READY cheapest upgrades, the strip sends the player there between other
   steps (and its map label gets the red dot, needsYou 'wall'). On every seed of the build before, the newcomer's Gulch
   sat at its wall 5.5-7 hours with most towers at level 1, while each of its upgrades cost under 100 coins. A trip that
   ends in another loss at the same wave waits again: the loss moves town.lost.at. */
export const WALL_WAIT = 30 * 60;
/* The trip is ready once the purse pays for this many of its cheapest upgrades; there the strip still counts up to
   WALL_UPS, made while the purse can pay (2026.11.25-6: at 8 for both, the newcomer's Ridge waited 75 minutes after
   Silver Falls with 1.53M in the purse and 289K its cheapest upgrade, since its 8 cheapest cost about 3M). */
export const WALL_READY = 5;
export const wallCost = t => (t.towers || []).map(x => towerCost(t, x.kind, x.level).coins).sort((a, b) => a - b).slice(0, WALL_READY).reduce((a, b) => a + b, 0);
export const wallReady = (game, t) => !!t && t.id !== game.active && atWall(t) && (t.towers || []).length > 0
  && t.t - ((t.lost && t.lost.at) || 0) >= WALL_WAIT && game.shared.purse.coins + 1e-9 >= wallCost(t);
export function wallStep(game, ready = false) {
  const t = Object.values(game.towns).find(x => x.id !== game.active && atWall(x) && (!ready || wallReady(game, x)));
  if (!t) return null;
  return { id: 'wall:' + t.id, away: true, text: WALL_WORDS.go(TOWNS[t.id].name), at: c => ({ el: c.back === t.id ? '#backBtn' : '#mapBtn', go: t.id }), done: () => false };
}

/* The goal the strip shows for the town in play, or null when its goals are all done (or the strip is off).
   held false: leave out the Resume waves steps (the careful bots tap Resume waves by their own rules and read the
   strip only for what to build). */
/* A goal that takes the player to another town (review 2026-11-18: "Go to Copper Gulch and build a Smelter there"
   showed during a boss wave in the town in play). The play screen keeps such a goal off the strip during a boss wave. */
export const sendsAway = g => !!(g && (g.there || g.away));
/* The first step of the Capital's save in the town that pays for it (clarity fix 3b part 2). */
export const CAPITAL_HOLD = { id: 'next:capital:hold', next: 'capital', text: 'Tap Hold waves while you save for the Capital', at: () => ({ el: '#holdWaves' }), done: () => false };

/* A boss fight in the town in play with few hits left (clarity fix 5; review 5: "2 hearts left in a boss fight while the
   strip talks about Iron Ridge"): the strip stays on the fight and names a tap that helps now, the tower whose next
   level costs the fewest coins. Never marked done: it goes when the fight does. */
export const FIGHT_LOW = .4;
export const bossFight = (game, town) => !!town && game.active === town.id && !town.won && !!town.waves && town.waves.phase !== 'break'
  && bossWave(town, town.wave) && (town.towers || []).length > 0 && town.vault.hp <= FIGHT_LOW * town.vault.max;
const bossNameOf = town => ((FOES[nextBoss(town)] || FOES.wagon).name).toLowerCase();
/* spot: the tower the town's own goal names, so the strip never asks for two towers in turn (on seed 1 the fight's
   cheapest tower took the coins saved for the goal's level 15); else the cheapest to raise. */
/* Its words follow the boss (clarity fix 8o: "Stop the war wagon" showed before the wagon came out, with no boss bar):
   coming while it waits in the wave, stop it while it is on the road (bossOn, the boss bar's own test), and the vault
   once it fell and the wave's last raiders walk on. Only the words change, so the newcomer taps as before (the first try
   held the step back until the wagon came out, and the climb probe's newcomer lost 198K to falls against a 175K line). */
export const fightWords = town => {
  const name = bossNameOf(town), up = '. Tap a tower and upgrade it';
  if (bossOn(town)) return 'Stop the ' + name + up;
  if (((town.waves && town.waves.queue) || []).some(k => FOES[k] && FOES[k].boss)) return 'The ' + name + ' is coming' + up;
  return 'Keep raiders off the vault' + up;
};
export const fightStep = (town, spot = null) => ({ id: 'fight', fight: true, text: fightWords(town), at: c => ({ tower: spot != null ? spot : c.cheapUp() }), done: () => false });

/* The tower the town's own next goal names, or null. */
function ownTower(game, town) {
  const sh = game.shared.goals; let c = null;
  for (const g of GOALS) {
    if (g.town !== town.id || sh.done[g.id]) continue;
    c = c || goalContext(game, town);
    if (g.ready && !g.ready(c)) continue;
    if (g.away || g.there || typeof g.at !== 'function') return null;
    try { const at = g.at(c) || {}; return at.tower != null ? at.tower : null; } catch (e) { return null; }
  }
  return null;
}

export function goalNow(game, held = true) {
  const sh = game.shared.goals, town = game.town;
  if (!sh || sh.off || !town) return null;
  if (held && heldHere(game, town)) return town.waves.autoHold ? (atWall(town) ? RESUME_WALL : RESUME_LOST) : RESUME;
  if (held && bossFight(game, town)) return fightStep(town, ownTower(game, town));
  // the Capital comes first once only its coins are missing (clarity fix 3): the newcomer of seed 1 reached the Ridge's
  // wave 30 at 93 min and then followed the Ridge's own goals (a Rolling Mill to level 5 for 23 minutes), which spend
  // the same purse, and never saw the Capital's count. Not in an outpost still being won, and not for the careful bots
  // (held false), which save for it by their own rule. No step asks to hold the waves for it: tried, the newcomer of
  // seed 1 then went to the Gulch with the Ridge held and never came back (190 minutes with nothing new).
  // It also comes before going to resume another town that lost while away (clarity fix 3b part 2): on seed 2 the
  // strip sent the newcomer to the Gulch five times during the save, where "Build more towers, then tap Resume waves"
  // spent 124K of the 130K it earned, and the save took 35 minutes. A town on hold loses nothing more, and the Map's
  // dot still shows it; the strip sends the player back there once the Capital stands.
  // In every town but an outpost the save starts with Hold waves, as the save for Iron Ridge does: climbing on while
  // saving, the newcomer of seed 1 lost its vault every 7 minutes at the Ridge's waves 37-42 and spent 712K on towers
  // before the Capital stood at 216 min, and on seed 2 it sat in the Gulch for 167 minutes doing the same there. (Fix 3 tried this step before the order above and dropped it, since a resume elsewhere
  // then took the player away for good.)
  if (held && !(isOutpost(town) && !town.won)) {
    const cap = capitalNext(game) || townSaveNext(game);
    if (cap) return cap.need && !isOutpost(town) && !(town.waves && town.waves.hold) ? holdFor(cap) : cap;
  }
  const away = held && heldAway(game);
  if (away) return goResume(away.id);
  // a town that has waited at its wall long enough, with the coins for its upgrades (WALL_WAIT), not from an outpost still being won
  const trip = held && !(isOutpost(town) && !town.won) && wallStep(game, true);
  if (trip) return trip;
  const again = rebuildStep(game, town);
  if (again) return again;
  const fed = feedStep(game, town);
  if (fed) return fed;
  let c = null, shut = null;
  for (const g of GOALS) {
    if (g.town !== town.id || sh.done[g.id]) continue;
    c = c || goalContext(game, town);
    if (!g.ready || g.ready(c)) return stepFor(game, town, g);
    shut = shut || lockedStep(game, town, g);
  }
  return firstInstitution(game) || nextStep(game) || playStep(game) || shut || wallStep(game) || climbStep(game, town);
}

/* With every goal done and no place left to open (the end of the content so far), the town in play's next mark of ten
   waves ("Reach wave 60 in Silver Falls", wave 53 / 60): a higher wave pays more deeds at its next charter. A won outpost
   sends the player to the newest town. The Gulch's loss loop box: on seed 6 every goal was done 34 minutes after Silver
   Falls opened, and the strip was blank in every town from then on. */
export const CLIMB_EVERY = 10;
export function climbStep(game, town) {
  if (isOutpost(town) && town.won) {
    const last = TOWN_ORDER.filter(id => game.towns[id] && !isOutpost(game.towns[id])).pop();
    return last ? { id: 'play:' + last, away: true, text: REBUILD_WORDS.play(TOWNS[last].name), at: () => ({ el: game.back === last ? '#backBtn' : '#mapBtn', go: last }), done: () => false } : null;
  }
  const best = town.bestWave || 0, mark = (Math.floor(best / CLIMB_EVERY) + 1) * CLIMB_EVERY;
  return { id: 'climb:' + town.id + ':' + mark, text: 'Reach wave ' + mark + ' in ' + TOWNS[town.id].name, meter: g2 => [(g2.towns[town.id] || town).bestWave || 0, mark], pre: 'wave ', meterTown: town.id, done: () => false };
}

/* A goal held back by its own locked lot ("Tap the Glassworks lot, then tap Build", ready once the lot opens): the step
   that opens the lot ("Tap the Sand Pit and upgrade it to level 6 to open the Glassworks"), or null. The Gulch's loss
   loop box: once Silver Falls stood, its next goals all waited on a locked lot, no other place had a goal, and the strip
   was blank in every town for 6-9 minutes at a time. Only when nothing else is on the strip. */
function lockedStep(game, town, g) {
  if (typeof g.at !== 'function' || g.away || g.there) return null;
  let at = null; try { at = g.at(goalContext(game, town)) || {}; } catch (e) { return null; }
  if (!at.plot || !BUILDINGS[at.plot] || unlocked(town, at.plot)) return null;
  const s = stepFor(game, town, g);
  return s !== g && s.step ? s : null;
}

/* After a charter the strip asks for each tower the town had back on its old pad, highest level first (the newcomer's
   Ridge wall, PLAN.md M6a): with a full purse after the Ridge's charter the newcomer filled 15 pads with Crossbows in two
   minutes, since a Crossbow is the best buy at wave 1, and then stalled at waves 44-47 for hours with every pad taken.
   Its Ridge before the charter was a mix of Frost Lenses, Stills, Mortars and Cannons. A pad another tower stands on
   is skipped, and a kind not open yet (the Mortar until wave 12) waits until it opens. It shows only while the tower can
   be paid for: shown while short of goods, it held the newcomer in the Gulch after its charter, in place of the step
   that sends it to climb Iron Ridge, and the Capital never opened on 4 of 6 seeds.
   Right after a charter only some kinds can be paid for (the Ridge has stone again before coal or iron), so the pads
   fill with the one that can. Once the old kind can be paid, a different tower still under the path level (SWAP_BELOW,
   so selling it loses almost nothing) is swapped back: "Tap the Crossbow, tap Sell, then build a Frost Lens there". */
export const SWAP_BELOW = 5;
/* The strip's words for these steps, pinned in test/words.test.js. */
/* The steps to a town that needs a Capital building or its upgrades (Thunder Mesa's Rail Office). Short, with the
   spotlight on Map showing the first tap and the Capital's label saying the same task (clarity fix 8t: "Tap Map, the
   Capital, Buildings, then upgrade the Rail Office to open Thunder Mesa" ran to four lines on a phone). Pinned in
   test/words.test.js. */
export const INST_WORDS = {
  build: (inst, verb, town) => 'Build the ' + inst + ' in the Capital to ' + verb + ' ' + town,
  up: (inst, verb, town) => 'Upgrade the ' + inst + ' in the Capital to ' + verb + ' ' + town,
};
export const REBUILD_WORDS = {
  build: (pad, name) => 'Tap the ' + pad + ' and build ' + aName(name) + ' again',
  swap: (now, name) => 'Tap the ' + now + ', tap Sell, then build ' + aName(name) + ' there',
  hold: town => 'Tap Hold waves while you save to open ' + town,
  play: town => 'Tap Map, then tap ' + town,
};
export function rebuildStep(game, town) {
  if (!town || town.won || !Array.isArray(town.plan) || !town.plan.length) return null;
  for (const p of town.plan) {
    if (!TOWERS[p.kind] || !towerOpen(town, p.kind) || !fitsSpot(town, p.spot, p.kind)) continue;
    const now = towerAt(town, p.spot), c = towerCost(town, p.kind, 0);
    if (now && (now.kind === p.kind || now.level >= SWAP_BELOW)) continue;
    // a good nothing here makes yet: first the building that makes it (seed 6: coal came so late after the Ridge's
    // charter that its Crossbows were past the swap level before a Frost Lens could be paid)
    for (const good of Object.keys(c.goods)) {
      if (town.has(good, c.goods[good]) || ((town.def && town.def.imports) || []).includes(good)) continue;
      const makers = ((town.def && town.def.buildings) || []).filter(id => BUILDINGS[id] && BUILDINGS[id].makes === good);
      if (!makers.length || makers.some(id => town.level(id) > 0)) continue;
      return stepFor(game, town, { id: 'rebuild:' + p.spot + ':' + p.kind + '>' + makers[0], town: town.id, rebuild: true, text: 'Tap the ' + bname(makers[0]) + ' lot, then tap Build', done: () => false, step: true, at: () => ({ plot: makers[0] }) }, 1);
    }
    const back = now ? Math.floor(now.spent * SELL_BACK) : 0;
    if (town.coins + back + 1e-9 < c.coins || !Object.entries(c.goods).every(([g, n]) => town.has(g, n))) continue;
    const name = TOWERS[p.kind].name, pad = isPit(town, p.spot) ? 'Mortar pit' : 'stone pad';
    if (now) return { id: 'rebuild:' + p.spot + ':' + p.kind + ':swap', kind: p.kind, swap: true, rebuild: true, town: town.id, text: REBUILD_WORDS.swap(TOWERS[now.kind].name, name), at: () => ({ tower: p.spot, sell: true }), done: () => false };
    return { id: 'rebuild:' + p.spot + ':' + p.kind, kind: p.kind, rebuild: true, town: town.id, text: REBUILD_WORDS.build(pad, name), at: () => ({ spot: p.spot }), done: () => false };
  }
  return null;
}

/* Once no town is left to open, a town with no goal of its own sends the player to the first place that still has
   one (the newcomer founded Silver Falls, went back to Iron Ridge to resume its waves, and the strip there was blank
   for the rest of the run, so it never played the Falls). */
export function playStep(game) {
  const sh = game.shared.goals;
  for (const id of TOWN_ORDER) {
    const t = game.towns[id];
    if (!t || id === game.active || (isOutpost(t) && t.won)) continue;
    let c = null;
    const has = GOALS.some(g => {
      if (g.town !== id || sh.done[g.id]) return false;
      c = c || goalContext(game, t);
      // or a goal that waits on its locked lot, which the strip there turns into the step that opens it (lockedStep)
      return !g.ready || g.ready(c) || !!lockedStep(game, t, g);
    });
    if (has) return { id: 'play:' + id, away: true, text: REBUILD_WORDS.play(TOWNS[id].name), at: () => ({ el: game.back === id ? '#backBtn' : '#mapBtn', go: id }), done: () => false };
  }
  return null;
}

/* Once the Capital stands, the empire's next steps are its first contract, then its first building (clarity fix 3b part
   2: nothing sent the newcomer there, so it never took a contract or built one, and the 20 minutes after the Capital had
   nothing new). A contract is free to take and its goods go by themselves; the building counts its price as have / need,
   and the Capital's card has a Buildings tab with a Build button for each. Never marked done. */
/* What the Capital's map label asks for when the strip's step is at the Capital: "Upgrade the Rail Office", "Build
   the Rail Office", "Add a building", or null (its own contract words then). One source with the strip, so the place
   the player is sent to says the same task (clarity fix 8q: the strip asked for the Rail Office's upgrades while the
   Capital's label said "Take a contract"). */
export function capitalAsk(game) {
  const s = game.town ? goalNow(game) : null;
  if (!s) return null;
  if (s.inst) { const i = INSTITUTIONS.find(x => x.id === s.inst); return i ? (s.id.endsWith(':inst') ? 'Build the ' : 'Upgrade the ') + i.name : null; }
  if (s.next === 'institution') return 'Add a building';
  return null;
}
export function firstInstitution(game) {
  const tr = game.shared.tree, cp = game.shared.capital;
  if (!capitalOpen(game) || !tr || tr.founded.length) return null;
  // while the building's coins are short, a contract always runs: each one pays coins toward it (clarity fix 3b part
  // 2b: after the first contract the newcomer saved 10-12 minutes for 50K, its price then, with nothing new)
  const short = game.shared.purse.coins + 1e-9 < foundCost(game);
  if (cp && !cp.active && (!cp.filled || short) && cp.offers.length) return { id: 'next:contract', next: 'contract', text: 'Tap Map, then tap the Capital and take a contract', at: () => ({ el: '#mapBtn' }), done: () => false };
  return { id: 'next:institution', next: 'institution', text: 'Tap Map, then add a building to the Capital', need: foundCost(game), at: () => ({ el: '#mapBtn' }), done: () => false };
}

/* The clarity pass (PLAN.md M6a, 2026.11.23-2): a newcomer's play showed goals the player could not act on for 15-25
   minutes (a Smelter with no count of the 500 coins it takes, a Mortar whose bricks no building made, a Toolsmith lot
   still locked) and a blank strip from about an hour in. So a goal names the step that can be taken now:
     - a goal to build a new lot carries its price as need (the strip adds have / need); an upgrade goal does not,
     since its level and one level's price side by side read as one count (review of 2026.11.23-2: "level 3 · 172 / 12");
     - a locked lot asks for the level that opens it ("Tap the Sawmill and upgrade it to level 10 to open the Toolsmith");
     - a tower goal whose goods no building here makes yet asks for that building first.
   A derived step keeps the goal's done and gets its own id, so the strip changes as each step is taken. */
const bname = id => (BUILDINGS[id] && BUILDINGS[id].name) || id;
function stepFor(game, town, g, depth = 0) {
  if (depth > 4 || !g.at || g.away || g.there || g.resume) return g;
  const c = goalContext(game, town);
  let at = null; try { at = g.at(c) || {}; } catch (e) { return g; }
  // Research counts the coins its cheapest item takes while they are short (clarity fix 4: "Tap Research and start one" with 85 of 200)
  if (at.el === '#researchBtn' && !g.need) { const n = researchOpen(town) && !town.lab ? cheapResearch(town) : null; return n !== null && town.coins + 1e-9 < n ? { ...g, need: n } : g; }
  if (at.plot && BUILDINGS[at.plot]) {
    const m = missing(town, at.plot)[0];
    if (m) {
      const text = (town.level(m.id) > 0 ? 'Tap the ' + bname(m.id) + ' and upgrade it to level ' + m.level : 'Tap the ' + bname(m.id) + ' lot, then tap Build') + ' to open the ' + bname(at.plot);
      return stepFor(game, town, { id: g.id + '>' + m.id, town: g.town, text, done: g.done, step: true, at: () => ({ plot: m.id }) }, depth + 1);
    }
    const fix = stallStep(game, town, g, at.plot, depth);
    if (fix) return fix;
    return g.need || town.level(at.plot) > 0 ? g : { ...g, need: cost(town, at.plot) };
  }
  if (g.kind && at.spot != null) {
    const tc = towerCost(town, g.kind, 0);
    for (const [good, n] of Object.entries(tc.goods || {})) {
      if ((town.goods[good] || 0) >= n || ((town.def && town.def.imports) || []).includes(good)) continue;
      const makers = ((town.def && town.def.buildings) || []).filter(id => BUILDINGS[id] && BUILDINGS[id].makes === good);
      if (!makers.length || makers.some(id => town.level(id) > 0)) continue;
      return stepFor(game, town, { id: g.id + '>' + makers[0], town: g.town, text: 'Tap the ' + bname(makers[0]) + ' lot, then tap Build', done: g.done, step: true, at: () => ({ plot: makers[0] }) }, depth + 1);
    }
  }
  return g;
}

/* A goal on a workshop that is stalled, or one that uses a good this town's stalled workshop makes, first asks for the
   building that feeds it (clarity fix 6, review 6): the newcomer's Boiler Shop sat short of steel nearly all the time,
   and its Locomotive Works then waited up to 31 minutes for a first boiler. A maker in another town sends the player
   there (the Ridge's bricks come from a Kiln the newcomer kept at level 1 all game), and that town's strip then asks
   for it (feedStep). The step goes when the stall does. */
function stallStep(game, town, g, P, depth) {
  const own = k => ((town.def && town.def.buildings) || []).find(b => BUILDINGS[b] && BUILDINGS[b].makes === k && town.level(b) > 0);
  const ids = [P, ...Object.keys(BUILDINGS[P].inputs).map(own).filter(Boolean)];
  for (const id of ids) {
    const s = stallOf(game, town, id);
    if (!s || !s.maker || s.maker.id === id) continue;
    const mk = s.maker.id;
    if (s.maker.town !== town.id) {
      const mt = s.maker.town, src = game.towns[mt];
      if (!src || isOutpost(src)) continue;
      const tn = TOWNS[mt].short || TOWNS[mt].name, act = s.maker.built ? 'upgrade the ' + bname(mk) : 'build ' + aName(bname(mk));
      return { id: g.id + '~' + mt + ':' + mk, town: g.town, text: 'Tap Map, ' + tn + ', then ' + act + '. The ' + bname(id) + ' needs more ' + GOODS[s.good].name.toLowerCase(), done: g.done, step: true, stall: id, feeds: { town: town.id, id, good: s.good }, there: [mt, mk], at: c => ({ el: c.back === mt ? '#backBtn' : '#mapBtn', go: mt }) };
    }
    const why = ' The ' + bname(id) + ' needs more ' + GOODS[s.good].name.toLowerCase();
    const text = (s.maker.built ? 'Tap the ' + bname(mk) + ' and upgrade it.' : 'Tap the ' + bname(mk) + ' lot, then tap Build.') + why;
    return stepFor(game, town, { id: g.id + '~' + mk, town: g.town, text, done: g.done, step: true, stall: id, at: () => ({ plot: mk }) }, depth + 1);
  }
  return null;
}

/* The other half of a step that sends the player here to feed another town's stalled workshop: while that town's own
   goal waits on a good this town makes, the strip here asks for the building that makes it ("Tap the Kiln and upgrade
   it. The Boiler Shop in Iron Ridge needs more bricks"). */
function feedStep(game, town) {
  if (isOutpost(town)) return null;
  const sh = game.shared.goals;
  for (const t of Object.values(game.towns)) {
    if (t === town || isOutpost(t) || !t.def) continue;
    let c = null, first = null;
    for (const g of GOALS) {
      if (g.town !== t.id || sh.done[g.id]) continue;
      c = c || goalContext(game, t);
      if (!g.ready || g.ready(c)) { first = g; break; }
    }
    if (!first || typeof first.at !== 'function' || first.away || first.there) continue;
    let at = null; try { at = first.at(c) || {}; } catch (e) { continue; }
    if (!at.plot || !BUILDINGS[at.plot]) continue;
    const st = stallStep(game, t, first, at.plot, 0);
    if (!st || !st.feeds || !st.there || st.there[0] !== town.id) continue;
    const mk = st.there[1], tn = TOWNS[t.id].short || TOWNS[t.id].name;
    const text = (town.level(mk) > 0 ? 'Tap the ' + bname(mk) + ' and upgrade it.' : 'Tap the ' + bname(mk) + ' lot, then tap Build.') + ' ' + tn + ' needs more ' + GOODS[st.feeds.good].name.toLowerCase();
    return stepFor(game, town, { id: 'feed:' + t.id + ':' + mk, town: town.id, text, done: () => false, step: true, stall: st.feeds.id, at: () => ({ plot: mk }) }, 1);
  }
  return null;
}

/* When the town in play has no goal left, the strip shows the empire's next step: the next town or the Capital, the
   one that takes the lowest wave, with what it still needs (a wave, deeds, coins) counted as have / need by meter(game).
   These are never marked done; they change as each need is met. */
/* The charter, guided (clarity fix 9, PLAN.md M6a): the newcomer was offered the charter at 75-81 minutes on every seed
   and never signed, since no step asked, so Silver Falls (5 deeds) never opened. Once the charter is out, a town whose
   charter pays is asked for when:
     - it never signed before and it is not the town the next place needs to climb (the Gulch while the Ridge climbs
       for the Capital: its deeds are free, and each one adds coins in every town), or
     - its deeds make up all the deeds the next place still needs (the Ridge for Silver Falls), the way the careful
       bots sign (tools/balance.js, signAt).
   A town that signed once is not asked again for one more deed, so no town is reset in a loop. In the town that pays,
   the step points at Perks; elsewhere it sends the player there. target is nextStep's next place (or null). */
const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
export function charterAsk(game, target) {
  if (!charterOffered(game)) return null;
  const short = target && target.f.deeds ? Math.max(0, target.f.deeds - deedsOf(game)) : 0;
  let pick = null;
  for (const id of TOWN_ORDER) {
    const t = game.towns[id];
    if (!t || isOutpost(t)) continue;
    const n = deedsFor(t);
    if (n < 1) continue;
    const free = !t.charters && !(target && target.f.from === id);
    if (!free && !(short > 0 && n >= short)) continue;
    if (!pick || n > pick.n || (n === pick.n && id === game.active)) pick = { town: t, n };
  }
  return pick;
}
/* With a place to open (target), the line says what the deeds in its meter are for and where they come from (clarity
   fix 8g: "2 / 5 deeds" beside "Tap Perks, then tap Sign the charter", and nothing on screen said what a deed is). */
export function charterStep(game, target) {
  const p = charterAsk(game, target);
  if (!p) return null;
  const id = p.town.id, name = TOWNS[id].name, meter = target && target.f.deeds ? { meter: g2 => [deedsOf(g2), target.f.deeds], post: ' deeds' } : {};
  if (game.active === id) return { id: 'charter:' + id + ':' + p.n, charter: id, town: id, text: target && target.f.deeds ? 'Tap Perks, then tap Sign the charter to get deeds for ' + target.name : 'Tap Perks, then tap Sign the charter to get ' + plural(p.n, 'deed'), at: () => ({ el: '#perksBtn' }), done: () => false, ...meter };
  return { id: 'charter:' + id + ':there', charter: id, away: true, text: 'Tap Map, ' + name + ', then sign its charter in Perks', at: () => ({ el: game.back === id ? '#backBtn' : '#mapBtn', go: id }), done: () => false };
}
/* The strip's count for a goal with a meter: "wave 9 / 30", "2 / 5 deeds". */
/* A wave count shows only in the town that must climb, beside its own wave bar: in another town "9 / 30" and then
   "wave 9 / 30" were both read as that town's wave (two reviews of 2026.11.23-2), so there the line alone says it. */
/* A wave count says the wave bar's own number, the wave coming or being fought, as the map card does; the step is
   still done by the best wave beaten, and the bots read that from g.meter (clarity fix 8q: "Wave 1" on the bar beside
   "Wave 0 / 10" on the strip, one label for two numbers). */
export const meterWords = (g, game) => {
  if (g.meterTown && g.meterTown !== game.active) return '';
  let [a, b] = g.meter(game);
  const t = g.pre === 'wave ' && g.meterTown && game.towns[g.meterTown];
  if (t && !t.won) a = Math.min(b, t.wave);
  return (g.pre || '') + Math.floor(a) + ' / ' + b + (g.post || '');
};
export function nextStep(game) {
  const out = [];
  for (const id of TOWN_ORDER) {
    const f = TOWNS[id] && TOWNS[id].found;
    if (!f || game.towns[id] || !game.towns[f.from]) continue;
    out.push({ id, name: TOWNS[id].name, f });
  }
  const cf = CAPITAL_DEF.found;
  if (!capitalOpen(game) && game.towns[cf.from]) out.push({ id: 'capital', name: 'the ' + CAPITAL_DEF.name, f: cf });
  if (!out.length) return null;
  const s = out.sort((a, b) => a.f.wave - b.f.wave)[0], from = game.towns[s.f.from], fromName = TOWNS[s.f.from].name;
  const best = () => (game.towns[s.f.from] || from).bestWave || 0;
  // the Capital's card says Build the Capital and a town's card says Start, so the strip uses the same word (fresh-eyes read of 2026.11.23-4)
  const verb = s.id === 'capital' ? 'build' : 'open';
  // a charter that pays comes before a climb the player only waits for (clarity fix 9)
  const ch = charterStep(game, s);
  if (ch && !(best() >= s.f.wave && !(s.f.deeds && deedsOf(game) < s.f.deeds))) return ch;
  // the count names what it counts ("wave 9 / 30"): a bare "9 / 30" in another town read as that town's wave (review of 2026.11.23-2)
  // in another town the step sends the player to the town that must climb (clarity fix 3: the newcomer of seed 1 sat
  // in the Gulch for 2 hours under "Reach wave 30 in Iron Ridge" while the Ridge climbed slowly in the background)
  if (best() < s.f.wave && game.active !== s.f.from) return { id: 'next:' + s.id + ':there', next: s.id, away: true, text: 'Tap Map, ' + fromName + ', then reach wave ' + s.f.wave + ' there to ' + verb + ' ' + s.name, at: () => ({ el: game.back === s.f.from ? '#backBtn' : '#mapBtn', go: s.f.from }), done: () => false };
  if (best() < s.f.wave) return { id: 'next:' + s.id + ':wave', next: s.id, text: 'Reach wave ' + s.f.wave + ' in ' + fromName + ' to ' + verb + ' ' + s.name, meter: () => [best(), s.f.wave], pre: 'wave ', meterTown: s.f.from, done: () => false };
  if (s.f.deeds && deedsOf(game) < s.f.deeds) return { id: 'next:' + s.id + ':deeds', next: s.id, text: 'Sign a charter in Perks for the deeds to ' + verb + ' ' + s.name, meter: g2 => [deedsOf(g2), s.f.deeds], post: ' deeds', done: () => false };
  // the Empire tree upgrades a town needs (Thunder Mesa's 3 Rail Office upgrades, M6b part 1b) come before its save:
  // the coins would wait on them, and the Influence for them comes from contracts, not from the purse
  const ns = Object.entries(s.f.nodes || {}).find(([inst, n]) => nodesHeld(game, inst) < n);
  if (ns) {
    const [inst, n] = ns, iname = INSTITUTIONS.find(i => i.id === inst).name, built = capitalOpen(game) && instFounded(game, inst);
    if (!built) return { id: 'next:' + s.id + ':inst', next: s.id, inst, text: INST_WORDS.build(iname, verb, s.name), at: () => ({ el: '#mapBtn' }), done: () => false };
    return { id: 'next:' + s.id + ':nodes', next: s.id, inst, text: INST_WORDS.up(iname, verb, s.name), meter: g2 => [nodesHeld(g2, inst), n], post: ' upgrades', at: () => ({ el: '#mapBtn' }), done: () => false };
  }
  if (from.coins + 1e-9 < s.f.coins) return { id: 'next:' + s.id + ':coins', next: s.id, text: 'Save coins to ' + verb + ' ' + s.name, need: s.f.coins, at: () => ({ el: '#coins' }), done: () => false };
  return { id: 'next:' + s.id + ':go', next: s.id, text: 'Tap Map, then tap ' + (s.id === 'capital' ? 'the Capital' : s.name) + (s.id === 'capital' ? ' to build it' : ' to start it'), at: () => ({ el: '#mapBtn' }), done: () => false };
}

/* Saving for a coin goal (clarity fix 2, PLAN.md M6a): a newcomer saw "136 / 500" for 20 minutes and spent every coin
   as it came, since nothing said the goal was near if they saved. The strip adds how long is left at the empire's income
   over the last minute, and the newcomer bot saves the same way. One rate for both: earnRate. */
export const EARN_WINDOW = 60, READY_MAX = 36000;
/* Coins a second the empire earned over the last EARN_WINDOW seconds of play; hist is the caller's own list. */
export function earnRate(game, hist, span = EARN_WINDOW) {
  const t = game.stats.steps * .25, e = game.earned;
  if (hist.length && (e < hist[hist.length - 1][1] || t < hist[hist.length - 1][0])) hist.length = 0; // a charter or a load starts it over
  hist.push([t, e]);
  while (hist.length > 2 && t - hist[1][0] >= span) hist.shift();
  const [t0, e0] = hist[0];
  return t - t0 >= 5 ? Math.max(0, (e - e0) / (t - t0)) : 0;
}
/* Seconds until have reaches need at perSec, or null (ready already, or nothing comes in). */
export const readyIn = (have, need, perSec) => need > have + 1e-9 && perSec > 0 ? (need - have) / perSec : null;
/* "about 4 min to go": the time left to the goal's count. Whole minutes (it changes at most once a minute), hours and
   minutes past an hour in steps of 5 minutes, "over 10 hours to go" past that; "" when there is no time to show. The
   first words, "ready in about 1:20", were read as having no subject and "over an hour" as too vague to act on (review
   of 2026.11.23-3), so the time counts down to the coins the strip just showed. */
export function readyWords(s) {
  if (s == null) return '';
  if (s < 60) return 'under a minute to go';
  if (s < 3600) return 'about ' + Math.ceil(s / 60) + ' min to go';
  if (s > READY_MAX) return 'over 10 hours to go';
  const m = Math.ceil(s / 300) * 5, h = Math.floor(m / 60), r = m % 60;
  return 'about ' + h + ' h' + (r ? ' ' + r + ' min' : '') + ' to go';
}

/* The words the strip shows for a goal: its text, or, for a goal with wait: kind while that tower can't be paid yet,
   what is still missing ("Wait for 5 more coins and 3 more timber, then tap a stone pad"), counting down as it comes. */
/* heldText: the words once the waves are held. need: coins the goal saves for; the screen adds have / need. */
export function goalText(game, town, g) {
  if (g.heldText && town.waves && town.waves.hold) return g.heldText;
  if (!g.wait) return viaBack(game, town, g);
  const c = goalContext(game, town);
  return c.canBuild(g.wait) ? g.text : 'Wait for ' + c.shortText(g.wait) + ', then tap a stone pad';
}

/* A goal that sends the player to the place the back button goes to names that button, so the strip and the lit
   button agree (review of 2026.11.20-11: "Tap Map, Copper Gulch, then build a Smelter" beside a lit ◂ Copper Gulch).
   The back button plays there at once, so "then Play Copper Gulch" drops out. */
function viaBack(game, town, g) {
  // "Tap Map, then tap Pine Hollow": the map card's Play button is the last step, so the strip never repeats it
  // (review of 2026.11.23-6: "then Play Pine Hollow" above a card with Play)
  const short = /^Tap Map, then tap ([^,]+)$/.exec(g.text || '');
  if (short && typeof g.at === 'function') {
    const at = g.at(goalContext(game, town)), t = at && TOWNS[at.go];
    return at && at.el === '#backBtn' ? 'Tap ◂ ' + ((t && (t.short || t.name)) || short[1]) : g.text;
  }
  const m = /^Tap Map, ([^,]+), then (.+)$/.exec(g.text || '');
  if (!m || typeof g.at !== 'function') return g.text;
  const at = g.at(goalContext(game, town));
  if (!at || at.el !== '#backBtn') return g.text;
  const t = TOWNS[at.go], label = '◂ ' + ((t && (t.short || t.name)) || m[1]);
  return /^Play /.test(m[2]) ? 'Tap ' + label : 'Tap ' + label + ', then ' + m[2];
}

/* The coins the strip's step needs before it can be taken, or null when it needs none (clarity fix 4, review 3): its
   need, a tower to build or raise, a building to build or upgrade, or the cheapest research. */
export function goalCoins(game, town, g) {
  if (!g || g.away || g.there || g.resume) return null;
  if (g.need) return g.need;
  if (typeof g.at !== 'function') return null;
  const c = goalContext(game, town);
  let at = null; try { at = g.at(c) || {}; } catch (e) { return null; }
  if (g.kind && at.spot != null) return towerCost(town, g.kind, 0).coins;
  // a swap shows only once the sale and the purse pay for it, so it counts no coins
  if (g.swap) return null;
  if (at.tower != null) { const t = towerAt(town, at.tower); return t ? towerCost(town, t.kind, t.level).coins : null; }
  if (at.plot && BUILDINGS[at.plot]) return unlocked(town, at.plot) ? cost(town, at.plot) : null;
  if (at.el === '#researchBtn' && researchOpen(town) && !town.lab) { const n = cheapResearch(town); return n === null ? null : n; }
  return null;
}
const cheapResearch = town => { let b = null; for (const id of itemsOf(town)) { const blk = researchBlock(town, id); if (blk === null || blk === 'coins') { const n = researchCost(town, id); if (b === null || n < b) b = n; } } return b; };

/* The gate of clarity fix 4: the strip never asks for coins the purse lacks for longer than BROKE_LIMIT seconds while
   the empire earns nothing (earnRate over its minute). brokeWatch() reads the strip once a second of play, the way
   tools/broke-probe.js and test/broke.test.js drive it: step(game, seconds). */
export const BROKE_LIMIT = 30;
export function brokeWatch() {
  const hist = [], w = { stretches: [], longest: 0, cur: null, last: -1 };
  w.step = (game, at) => {
    if (Math.floor(at) === w.last) return; w.last = Math.floor(at);
    const per = earnRate(game, hist), town = game.town, g = goalNow(game), need = g ? goalCoins(game, town, g) : null;
    const broke = need !== null && town.coins + 1e-9 < need && per <= 1e-9 && game.stats.steps * .25 > EARN_WINDOW / 4;
    if (broke) {
      if (!w.cur) { w.cur = { from: at, len: 0, town: town.id, goal: goalText(game, town, g), need: Math.ceil(need) }; w.stretches.push(w.cur); }
      w.cur.len = at - w.cur.from; w.longest = Math.max(w.longest, w.cur.len);
    } else w.cur = null;
  };
  return w;
}

/* Mark every goal done (for players already past the start; the save migration uses the list too). */
export const ALL_GOALS = () => GOALS.map(g => g.id);

export const goals = {
  id: 'goals',
  setup(game) { game.shared.goals = { done: {}, visited: {}, off: false }; },
  tick(dt, game) {
    const sh = game.shared.goals;
    if (!sh || sh.off) return;
    if (game.active && !sh.visited[game.active]) sh.visited[game.active] = true;
    for (const town of Object.values(game.towns)) {
      let c = null;
      for (const g of GOALS) {
        if (g.town !== town.id || sh.done[g.id]) continue;
        c = c || goalContext(game, town);
        if (g.done(c)) { sh.done[g.id] = true; game.bus.emit('goal:done', { id: g.id, town: town.id }); }
      }
    }
  },
};
