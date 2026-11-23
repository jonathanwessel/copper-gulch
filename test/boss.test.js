// Boss stages and the boss bar (owner, 2026-11-22: "when a war wagon came, there was an indicator at the top of the
// screen that showed the health of that boss as well as the stage the boss was in, for example when the crew got off
// the war wagon"). Each boss changes once as it is hurt (src/data/foes.js, stages); the bar reads foeStatus through
// foeView, like the raider card.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../src/core/setup.js';
import { startWave, fight, foeStatus, speedOf, armorOf, stageOf, waveRun } from '../src/core/defense.js';
import { FOES, STAGE_WORDS } from '../src/data/foes.js';
import { bossOn, bossView, bossLines } from '../src/ui/boss.js';
import { textIssues } from '../tools/audit.js';

/* A town on its boss wave with the boss alone on the road (no towers, so nothing hurts it but the test). */
function onRoad(id) {
  const g = newGame('boss-' + id, id === 'drycreek' ? undefined : 'gulch');
  if (id !== 'drycreek' && id !== 'gulch') { g.addTown(id); g.active = id; }
  const t = g.towns[id];
  t.towers = []; t.wave = 10; t.waves.hold = false; t.waves.phase = 'break'; t.waves.timer = 0;
  assert.ok(startWave(g, t));
  t.waves.queue = [t.waves.queue[t.waves.queue.length - 1]]; // the boss only
  for (let i = 0; i < 20 && !bossOn(t); i++) fight(g, t, .25);
  const f = bossOn(t);
  assert.ok(f && FOES[f.kind].boss, 'the boss is on the road in ' + id);
  return { g, t, f };
}
const STAGED = [['drycreek', 'bandits'], ['gulch', 'wagon'], ['ridge', 'train'], ['falls', 'steamer']];

test('every boss has a stage with its words, and every drop is a raider that only rides off a boss or a wave raider', () => {
  for (const [k, F] of Object.entries(FOES)) if (F.boss) {
    assert.ok(F.stages && F.stages.length, k + ' has a stage');
    for (const st of F.stages) {
      assert.ok(st.at > 0 && st.at < 1, k + ' stage health share');
      assert.ok(STAGE_WORDS[st.key], k + ' stage words');
      assert.deepEqual(textIssues(STAGE_WORDS[st.key]), []);
      assert.ok(STAGE_WORDS[st.key].split(' ').length <= 3, 'a few words');
      if (st.drop) assert.ok(FOES[st.drop] && !FOES[st.drop].boss, k + ' drops a raider');
    }
  }
});

for (const [id, kind] of STAGED) test('the ' + FOES[kind].name.toLowerCase() + ' reaches its stage once its health falls past it, once', () => {
  const { g, t, f } = onRoad(id), st = FOES[kind].stages[0];
  assert.equal(f.kind, kind);
  const n0 = t.waves.foes.length, size0 = t.waves.size;
  f.hp = f.max * (st.at + .02); fight(g, t, .25);
  assert.equal(stageOf(f), null, 'not yet above its mark');
  assert.equal(foeStatus(t, f).stage, null);
  assert.equal(speedOf(f), FOES[kind].speed);
  let seen = 0; const off = g.bus.on('stage', e => { if (e.foe === f.id) seen++; });
  f.hp = f.max * (st.at - .01); fight(g, t, .25);
  assert.equal(stageOf(f), st); assert.equal(foeStatus(t, f).stage, st.key);
  assert.ok(Math.abs(speedOf(f) - FOES[kind].speed * st.speed) < 1e-9, 'its pace changes');
  if (st.armor !== undefined) { assert.equal(armorOf(f), st.armor); assert.equal(foeStatus(t, f).armorFull, st.armor); }
  else assert.equal(armorOf(f), FOES[kind].armor);
  const drops = t.waves.foes.filter(x => x !== f && x.kind === st.drop);
  assert.equal(drops.length, st.n || 0, 'its riders jump off');
  assert.equal(t.waves.foes.length, n0 + (st.n || 0));
  assert.equal(t.waves.size, size0 + (st.n || 0), 'they count toward the wave');
  for (const d of drops) { assert.ok(d.s <= f.s && d.s >= f.s - 1, 'beside it, a little behind'); assert.equal(d.lane, f.lane); assert.ok(d.hp > 0 && !FOES[d.kind].boss); }
  f.hp = f.max * .05; for (let i = 0; i < 4; i++) fight(g, t, .25);
  assert.equal(seen, 1, 'a stage happens once');
  assert.equal(t.waves.foes.filter(x => x.kind === st.drop && x !== f).length <= (st.n || 0), true);
  off();
  // the bar says the stage in a few words, and its lines pass the words check
  const v = bossView(t, f);
  assert.equal(v.stage, STAGE_WORDS[st.key]);
  assert.equal(v.name, FOES[kind].name);
  for (const line of bossLines(t, f)) assert.deepEqual(textIssues(line), [], line);
});

test('the bar names the boss, never its crew, and says it is down for a moment once it falls', () => {
  const { g, t, f } = onRoad('gulch');
  f.hp = f.max * .4; fight(g, t, .25);
  assert.equal(bossOn(t), f, 'the crew on the road is not the boss');
  const v = bossView(t, f);
  assert.ok(Math.abs(v.health.share - .4) < 1e-9);
  assert.match(v.health.text, /^\S+ \/ \S+$/);
  assert.equal(v.armor, Math.round(FOES.wagon.armor * 100) + '%');
  f.hp = 0; fight(g, t, .25);
  assert.equal(bossOn(t), null);
  const gone = bossView(t, f);
  assert.equal(gone.name, 'War wagon down!');
  assert.equal(gone.stage, '');
  assert.ok(gone.gone);
});

test('a boss below its first stage on the bar says nothing for the stage, and a saved boss keeps its stage', () => {
  const { g, t, f } = onRoad('ridge');
  assert.equal(bossView(t, f).stage, '');
  f.hp = f.max * .3; fight(g, t, .25);
  const back = JSON.parse(JSON.stringify(t.waves.foes.find(x => x.id === f.id)));
  assert.equal(back.stage, 1); assert.equal(armorOf(back), FOES.train.stages[0].armor); assert.equal(stageOf(back), FOES.train.stages[0]);
  const old = { ...back }; delete old.stage; delete old.pace; delete old.armor; // a boss saved before stages
  assert.equal(stageOf(old), null); assert.equal(armorOf(old), FOES.train.armor); assert.equal(speedOf(old), FOES.train.speed);
});

test('the background battle plays the stages: the war wagon\'s crew falls in a wave played from its run', () => {
  const g = newGame('boss-run', 'gulch'), t = g.town;
  t.wave = 10; t.waves.hold = false; t.waves.phase = 'break'; t.waves.timer = 0;
  for (const s of [2, 3, 8, 9, 10, 11]) t.towers.push({ spot: s, kind: 'cannon', level: 12, path: 'a', fork: null, cd: 0, spent: 0, pulses: 0 });
  assert.ok(startWave(g, t));
  const run = waveRun(t);
  const crew = run.ev.filter(e => e[1] === 'k' && e[2] === 'crew').length, leaks = run.ev.filter(e => e[1] === 'l').length;
  assert.equal(crew + leaks >= FOES.wagon.stages[0].n, true, 'the crew rode in the run');
  assert.ok(crew > 0, 'and the towers shot some of them');
  assert.ok(run.ev.some(e => e[1] === 'k' && e[2] === 'wagon'), 'the wagon fell');
});

test('one state, one source: the boss card shows the same stage as the bar, and the bar says only that it is down once it falls', async () => {
  const { foeView } = await import('../src/ui/foe.js');
  for (const [id, kind] of STAGED) {
    const { g, t, f } = onRoad(id), st = FOES[kind].stages[0];
    assert.equal(foeView(t, f).effects.some(e => e.key === 'stage'), false);
    f.hp = f.max * (st.at - .01); fight(g, t, .25);
    const chip = foeView(t, f).effects.find(e => e.key === 'stage');
    assert.ok(chip, kind + ': the card has the stage');
    assert.equal(chip.word, bossView(t, f).stage);
    f.hp = 0; fight(g, t, .25);
    const v = bossView(t, f);
    assert.equal(v.armor, ''); assert.equal(v.stage, '');
    assert.deepEqual(bossLines(t, f), [FOES[kind].name + ' down!']);
  }
});

test('a fever carrier that falls as the war wagon drops its crew passes its poison to the crew, with no crash', () => {
  // 2026.11.23-3: a 6-hour newcomer run crashed here, since the crew had no place on the road yet that step
  const { g, t, f } = onRoad('gulch'), st = FOES.wagon.stages[0];
  const carrier = { ...f, id: 987654, kind: 'raider', hp: 0, max: 10, armor: 0, stage: 0, spread: true, poison: 6, poisonT: 4, rot: 0, dead: false, leaked: false };
  t.waves.foes.push(carrier);
  f.hp = f.max * (st.at - .01);
  assert.doesNotThrow(() => fight(g, t, .25));
  const crew = t.waves.foes.filter(x => x.kind === st.drop);
  assert.equal(crew.length, st.n);
  assert.ok(crew.some(x => x.poisonT > 0), 'a crew member beside the carrier caught its poison');
});
