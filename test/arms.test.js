// Call to arms (M6a, owner idea 2026-11-20): the War Office's Armory opens it in every town; a call stops the town's
// production and sends each built building's workers onto the road for ARMS.seconds, then the town waits until
// ARMS.cooldown has passed. The militia helps at a boss gate, but a town can never hold with it alone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, loadGame } from '../src/core/setup.js';
import { encode, decode, migrate, SAVE_VERSION } from '../src/core/save.js';
import { foundTown } from '../src/core/empire.js';
import { foundCapital, capitalOf } from '../src/core/capital.js';
import { foundInstitution, buyNode } from '../src/core/tree.js';
import { startWave, buildTower, upgradeTower, towerCost, armsPosts, lanesOf, waveRun, wavesOf } from '../src/core/defense.js';
import { armsOpen, armsBlock, callToArms, armsLoss, militia, armsFighting, armsWait } from '../src/core/arms.js';
import { autoOn, setAuto, autoOf } from '../src/core/automation.js';
import { boughtText, INSTITUTION } from '../src/data/institutions.js';
import { ARMS } from '../src/data/arms.js';
import { CAPITAL_DEF } from '../src/data/capital.js';
import { PATH_LEVEL } from '../src/data/towers.js';
import { dist } from '../src/core/path.js';

/* The Gulch with the Capital and the War Office built; `ups` War Office upgrades bought. Waves held. */
function empire(seed, ups = ARMS.opens) {
  const g = newGame(seed, 'gulch'), gu = g.town;
  gu.bestWave = 20; gu.coins = 1e12;
  foundTown(g, 'ridge'); g.active = 'gulch';
  for (const t of Object.values(g.towns)) if (t.waves) t.waves.hold = true;
  g.towns.ridge.bestWave = CAPITAL_DEF.found.wave;
  foundCapital(g); foundInstitution(g, 'war');
  capitalOf(g).influence = 1e6;
  for (let i = 0; i < ups; i++) buyNode(g, 'war');
  return g;
}
const build = (t, L) => { for (const id of t.def.buildings) t.buildings[id] = L; };
/* Play the wave the town is on now, step by step, with a vault that never falls, and say what happened: raiders that
   got through and fell. arms: call to arms at the wave's start, or 'boss' once the boss is on the road. */
function playWave(g, t, { arms = false } = {}) {
  t.waves.hold = false; t.waves.phase = 'break'; t.waves.timer = 0;
  let leaked = 0, killed = 0, bossLeaked = false;
  const offs = [g.bus.on('leak', e => { if (e.town === t.id) { leaked++; if (e.boss) bossLeaked = true; } }), g.bus.on('kill', e => { if (e.town === t.id) killed++; })];
  startWave(g, t);
  const w = t.wave;
  for (let n = 0; n < 4000 && t.wave === w && t.waves.phase === 'wave'; n++) {
    t.vault.hp = 1e9;
    if (arms && (arms !== 'boss' || t.waves.foes.some(f => f.kind === (t.def.boss || 'wagon'))) && !armsFighting(t) && armsWait(t) <= 0) callToArms(g, t);
    g.step(.25);
  }
  for (const off of offs) off();
  return { leaked, killed, bossLeaked };
}

test('Call to arms opens with the War Office\'s Armory, in every town', () => {
  const g = empire('arms-open', ARMS.opens - 1), t = g.town;
  build(t, 10);
  assert.equal(armsOpen(g), false); assert.equal(armsBlock(g, t), 'closed'); assert.equal(callToArms(g, t), false);
  assert.equal(INSTITUTION.war.nodes[ARMS.opens - 1].opens, 'arms', 'the Armory opens it');
  buyNode(g, 'war');
  assert.equal(armsOpen(g), true); assert.equal(armsBlock(g, t), null);
  g.towns.ridge.buildings = {};
  assert.equal(armsBlock(g, g.towns.ridge), "none", "a town with no building has no workers to call");
  assert.match(boughtText(INSTITUTION.war, ARMS.opens), /call its workers to arms/);
  assert.doesNotMatch(boughtText(INSTITUTION.war, ARMS.opens - 1), /arms/);
});

test('every plot has a post by the road, on its side, and the militia counts only built buildings', () => {
  for (const id of ['gulch', 'ridge']) {
    const g = empire('posts-' + id), t = g.towns[id], road = lanesOf(t)[0], posts = armsPosts(t);
    assert.equal(posts.length, Object.keys(t.def.board.plots).length);
    for (const p of posts) {
      const plot = t.def.board.plots[p.id];
      assert.ok(p.s >= 0 && p.s <= road.length);
      assert.ok(dist(p.at, plot) < dist(road.points[0], plot) + 1e-9 || dist(p.at, plot) < 4, p.id + ' stands near its plot');
      assert.ok(dist(p.at, plot) <= Math.hypot(...[0, 1].map(i => plot[i] - p.at[i])) + 1e-9);
    }
    t.buildings = {};
    assert.equal(militia(t).length, 0);
    t.buildings[t.def.buildings[0]] = 5;
    assert.equal(militia(t).length, 1);
  }
});

test('a call stops production for its time, then the town waits for the cooldown', () => {
  const g = empire('arms-call'), t = g.town;
  build(t, 20); for (const k of Object.keys(t.sell || {})) t.sell[k] = false;
  g.step(.25);
  const before = { ...t.goods };
  assert.equal(callToArms(g, t), true);
  assert.equal(armsFighting(t), true); assert.equal(armsBlock(g, t), 'fighting'); assert.equal(callToArms(g, t), false);
  const made0 = JSON.stringify(t.made);
  for (let i = 0; i < 20; i++) g.step(.25);
  assert.equal(JSON.stringify(t.made), made0, 'nothing is made while the workers fight');
  for (const [k, n] of Object.entries(t.goods)) assert.ok(n <= (before[k] || 0) + 1e-6, k + ' did not grow');
  for (let i = 0; i < ARMS.seconds * 4; i++) g.step(.25);
  assert.equal(armsFighting(t), false); assert.equal(armsBlock(g, t), 'wait');
  const made1 = Object.values(t.made).reduce((a, b) => a + b, 0);
  g.step(.25);
  assert.ok(Object.values(t.made).reduce((a, b) => a + b, 0) > made1, 'the buildings work again');
  for (let i = 0; i < (ARMS.cooldown - ARMS.seconds) * 4; i++) g.step(.25);
  assert.equal(armsBlock(g, t), null, 'callable again once the cooldown is over');
});

test('the lost production is shown before the tap: every building\'s goods, and coins for what would be sold', () => {
  const g = empire('arms-loss'), t = g.town;
  t.buildings = {};
  assert.equal(armsLoss(g, t).coins, 0);
  build(t, 20);
  const l = armsLoss(g, t);
  assert.ok(l.coins > 0); assert.ok(Object.keys(l.goods).length >= t.def.buildings.length - 1);
  assert.ok(armsLoss(g, t, ARMS.seconds * 2).coins > l.coins * 1.9);
});

test('the militia shoots raiders in reach, and grows with its buildings\' levels', () => {
  const dealt = L => {
    const g = empire('arms-shoot-' + L), t = g.town;
    build(t, L); t.wave = 12;
    playWave(g, t, { arms: true });
    return ((g.armsDealt || {})[t.id] || {}).militia || 0;
  };
  const low = dealt(10), high = dealt(60);
  assert.ok(low > 0, 'it hits'); assert.ok(high > low * 1.5, 'bigger buildings, a stronger militia');
});

test('a town can never hold with the militia alone', () => {
  // buildings at about the levels a town has at that wave by the time the War Office opens it, three seeds each (the
  // seed picks the kind of wave)
  for (const [id, w, L] of [['gulch', 10, 20], ['gulch', 20, 50], ['gulch', 40, 120], ['ridge', 20, 50], ['ridge', 40, 120]]) for (const seed of [1, 2, 3]) {
    const g = empire('alone-' + id + w + '-' + seed), t = g.towns[id];
    g.active = id; build(t, L); t.wave = w; t.towers = [];
    const r = playWave(g, t, { arms: true });
    assert.ok(r.leaked > r.killed, `${id} wave ${w} seed ${seed}: ${r.killed} fell to the militia, ${r.leaked} got through`);
  }
});

test('at a boss gate the militia, called when the boss is on the road, can turn a loss into a win', () => {
  // the Gulch's wave 20 against four level-10 Cannons, with raiders a little tougher each try, from where the war
  // wagon is stopped to where it gets through
  let turned = 0;
  for (const m of [1, 1.1, 1.2, 1.4, 1.6, 2]) {
    const run = arms => {
      const g = empire('gate'), t = g.town;
      build(t, 40); t.wave = 20; t.bestWave = 19; t.mods.set('foeHp', 'test', { mul: m });
      for (const s of [2, 3, 8, 9]) t.towers.push({ spot: s, kind: 'cannon', level: 10, path: 'a', fork: null, cd: 0, spent: 0, pulses: 0 });
      return playWave(g, t, { arms });
    };
    const off = run(false), on = run('boss');
    if (off.bossLeaked && !on.bossLeaked) turned++;
    assert.ok(!(on.bossLeaked && !off.bossLeaked), 'the militia never makes it worse (raiders x' + m + ')');
    assert.ok(on.leaked <= off.leaked);
  }
  assert.ok(turned >= 2, 'the militia stops a war wagon that got through without it');
});

test('a wave played away is never helped by a militia called earlier', () => {
  const g = empire('arms-run'), t = g.town;
  build(t, 40); t.wave = 12; t.towers.push({ spot: 2, kind: 'crossbow', level: 6, path: 'a', fork: null, cd: 0, spent: 0, pulses: 0 });
  callToArms(g, t); t.waves.hold = false; t.waves.timer = 0; startWave(g, t);
  const run = waveRun(t);
  assert.equal(((g.armsDealt || {})[t.id] || {}).militia || 0, 0);
  assert.ok(run.ev.length > 0);
});

test('Auto calls to arms only with its own switch on, and only when a strong boss is well down the road or the vault is low', () => {
  const g = empire('arms-auto'), t = g.town;
  build(t, 30); t.wave = 10; t.bestWave = 9;
  assert.equal(autoOn(g, t, 'arms'), false, 'Off by default');
  t.waves.hold = false; t.waves.timer = 0; startWave(g, t);
  for (let i = 0; i < 400 && t.waves.phase === 'wave'; i++) g.step(.25);
  assert.equal(t.flags.armed || 0, 0, 'never called with the switch off');
  assert.equal(setAuto(g, t, 'arms', true), true);
  const g2 = empire('arms-auto2'), t2 = g2.town, calls = [];
  build(t2, 30); setAuto(g2, t2, 'arms', true);
  const len = lanesOf(t2)[0].length;
  g2.bus.on('arms:call', () => calls.push({ wave: t2.wave, boss: t2.waves.foes.some(f => f.kind === (t2.def.boss || 'wagon') && f.s > .4 * len && f.hp > .3 * f.max), low: t2.vault.hp < .5 * t2.vault.max }));
  // Cannons that stop the plain raiders but let the war wagon ride on past the middle of the road
  for (const s of [2, 3, 8, 9]) t2.towers.push({ spot: s, kind: 'cannon', level: 3, path: null, fork: null, cd: 0, spent: 0, pulses: 0 });
  for (const w of [9, 10]) {
    t2.wave = w; t2.waves.hold = false; t2.waves.phase = 'break'; t2.waves.timer = 0; startWave(g2, t2);
    for (let i = 0; i < 1200 && t2.waves.phase === 'wave' && t2.wave === w; i++) g2.step(.25);
  }
  assert.ok(calls.length >= 1, 'it called');
  for (const c of calls) assert.ok(c.boss || c.low, 'only with a strong boss past the middle of the road or a low vault');
  assert.ok(calls.some(c => c.wave === 10 && c.boss), 'called once the war wagon was on the road');
});

test('a save keeps the militia and its wait, and an old save migrates with nobody called', () => {
  const g = empire('arms-save'), t = g.town;
  build(t, 10); callToArms(g, t); g.step(.25);
  const back = loadGame(decode(encode(g, 1)).game);
  assert.ok(back.town.arms.t > 0 && back.town.arms.cd > 0);
  const old = JSON.parse(encode(g, 1)); old.v = 23; for (const x of Object.values(old.game.towns)) delete x.arms;
  const m = migrate(old);
  assert.equal(m.v, SAVE_VERSION);
  for (const x of Object.values(m.game.towns)) assert.deepEqual(x.arms, { t: 0, cd: 0, clock: 0 });
  assert.equal(loadGame(m.game).town.arms.t, 0);
});
