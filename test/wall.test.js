// The Gulch's loss loop (PLAN.md M6a): during the Ridge's climb the newcomer's Gulch fell 32-63 times at waves 30-33,
// since the strip sent the player back to resume it after each loss, a few upgrades went in, and it fell again. A town
// that lost twice with no new best wave between is at its wall (atWall): the strip no longer sends the player to resume
// it, its map label has no red dot, and there the strip asks for upgrades first. Also: a goal held back by its locked
// lot asks for the level that opens it, so the strip is never blank while a place still has goals (it was blank for
// 6-9 minutes at a time once Silver Falls stood).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../src/core/setup.js';
import { goalNow, RESUME_WALL, RESUME_LOST } from '../src/core/goals.js';
import { fall, atWall, setHold } from '../src/core/defense.js';
import { unlocked } from '../src/core/economy.js';
import { needsYou } from '../src/core/map.js';
import { migrate, SAVE_VERSION } from '../src/core/save.js';
import { GOALS } from '../src/data/goals.js';
import { TOWN_ORDER } from '../src/data/towns/index.js';
import { lostLine } from '../src/ui/lost.js';
import { buildFirst, choices } from '../tools/firstplay.js';
import { Rng } from '../src/core/rng.js';

// every place open, the Capital built with one building, every goal done but the Falls' from the Glassworks on
function empire(seed) {
  const g = newGame(seed, 'gulch');
  for (const id of TOWN_ORDER) if (!g.towns[id]) g.addTown(id);
  g.shared.capital.open = true;
  g.shared.tree.founded.push('market');
  const keep = ['f-glass', 'f-wheel5', 'f-wire', 'f-copper', 'f-bulbs', 'f-dynamo', 'f-steel', 'f-rails', 'f-telegraph'];
  for (const x of GOALS) if (!keep.includes(x.id)) g.shared.goals.done[x.id] = true;
  for (const t of Object.values(g.towns)) if (t.def.kind === 'outpost') t.won = true;
  g.go('ridge');
  return g;
}
// the Gulch loses a wave while the player is in the Ridge
function lose(g, wave) { const t = g.towns.gulch; t.wave = wave; t.bestWave = Math.max(t.bestWave || 0, wave); fall(g, t, 'vault'); return t; }

test('a town that loses twice with no new best wave between is at its wall, and the strip leaves it', () => {
  const g = empire('w1');
  const t = lose(g, 31);
  assert.equal(atWall(t), false, 'one loss is not a wall');
  assert.equal(needsYou(g, 'gulch'), 'lost');
  assert.equal(goalNow(g).id, 'resume-gulch', 'the first loss: the strip sends you there');
  setHold(g, t, false);
  lose(g, 31);
  assert.equal(t.lost.n, 2);
  assert.equal(atWall(t), true);
  assert.equal(needsYou(g, 'gulch'), null, 'no red dot on the map');
  assert.notEqual(goalNow(g).id, 'resume-gulch', 'the strip no longer sends you there');
  assert.match(lostLine(t), /again\. Tap Play Copper Gulch, upgrade its towers, then tap Resume waves\.$/);
  g.go('gulch');
  assert.equal(goalNow(g), RESUME_WALL, 'there it asks for upgrades');
});

test('a new best wave starts the count again', () => {
  const g = empire('w2');
  const t = lose(g, 31); setHold(g, t, false); lose(g, 31);
  assert.equal(atWall(t), true);
  setHold(g, t, false);
  lose(g, 33);
  assert.equal(t.lost.n, 1);
  assert.equal(atWall(t), false);
  assert.equal(goalNow(g).id, 'resume-gulch');
  g.go('gulch');
  assert.equal(goalNow(g), RESUME_LOST);
});

test('at its wall the newcomer counts only upgrades before it resumes', () => {
  const g = empire('w3');
  const t = lose(g, 31); setHold(g, t, false); lose(g, 31);
  g.go('gulch');
  t.coins = 1e9; for (const k of Object.keys(t.goods)) t.goods[k] = 1e6;
  const rng = new Rng('w3');
  const ups = choices(g, t, rng).filter(c => c.what === 'upgrade');
  assert.equal(buildFirst(g, t, rng, 0), ups.length > 0, 'builds first while an upgrade can be paid');
  assert.equal(buildFirst(g, t, rng, 3), false, 'then it resumes');
});

test('a goal held back by its locked lot asks for the level that opens it, in its town and from the others', () => {
  const g = empire('w4'), f = g.towns.falls;
  assert.equal(unlocked(f, 'glassworks'), false);
  g.go('falls');
  const s = goalNow(g);
  assert.ok(s, 'the strip is not blank in Silver Falls');
  assert.match(s.id, /^f-glass>/);
  assert.match(s.text, /to open the Glassworks$/);
  g.go('gulch');
  assert.equal(goalNow(g).id, 'play:falls', 'from the Gulch it sends you to Silver Falls');
});

test('with nothing else on the strip, a town at its wall is the next place to go', () => {
  const g = empire('w5');
  for (const x of GOALS) g.shared.goals.done[x.id] = true;
  const t = lose(g, 31); setHold(g, t, false); lose(g, 31);
  const s = goalNow(g);
  assert.equal(s.id, 'wall:gulch');
  assert.equal(s.text, 'Tap Map, Copper Gulch, then upgrade its towers');
  assert.equal(s.at({ back: null }).go, 'gulch');
});

test('a loss saved before v30 counts as the first', () => {
  const save = { v: 29, game: { shared: {}, towns: { gulch: { bestWave: 31, lost: { why: 'vault', wave: 31, back: 29, coins: 10, away: true } } } } };
  const m = migrate(save);
  assert.equal(m.v, SAVE_VERSION);
  assert.equal(m.game.towns.gulch.lost.n, 1);
  assert.equal(m.game.towns.gulch.lost.best, 31);
});

test('in play a fallen vault holds the waves only at the wall, and its card asks for upgrades', async () => {
  const { lostCard } = await import('../src/ui/lost.js');
  const g = empire('w6'), r = g.towns.ridge; // the Ridge is in play
  r.wave = 45; r.bestWave = 45; fall(g, r, 'vault');
  assert.equal(r.waves.hold, false, 'the first fall in play does not hold');
  r.wave = 45; fall(g, r, 'vault');
  assert.equal(r.waves.hold, true, 'the second with no new best wave holds');
  assert.equal(atWall(r), true);
  assert.equal(goalNow(g), RESUME_WALL);
  const c = lostCard(r, g);
  assert.match(c.lines[0], /^Your vault fell again\. You dropped back to wave 43/);
  assert.equal(c.lines[1], 'Your waves are on hold. Tap a tower and upgrade it, then tap Resume waves.');
});

test('with every goal done and no place left to open, the strip names the next mark of ten waves', () => {
  const g = empire('w7');
  for (const x of GOALS) g.shared.goals.done[x.id] = true;
  g.go('falls'); g.towns.falls.bestWave = 53;
  const s = goalNow(g);
  assert.equal(s.text, 'Reach wave 60 in Silver Falls');
  assert.deepEqual(s.meter(g), [53, 60]);
  g.go('drycreek');
  assert.equal(goalNow(g).text, 'Tap Map, then tap Silver Falls', 'a won outpost sends you to the newest town');
});
