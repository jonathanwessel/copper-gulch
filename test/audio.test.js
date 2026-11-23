// Music and sound: the tunes are seeded notes, the volumes are kept under cg-audio, effects play only for the town in
// play, and the whole player runs on a stand-in audio context without throwing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { musicBar, moodOf, MOODS, TUNES } from '../src/audio/tunes.js';
import { createAudio, soundsFor, readAudio, writeAudio, AUDIO_KEY, AUDIO_DEFAULT } from '../src/audio/audio.js';
import { Bus } from '../src/core/events.js';

const store = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m }; };

/* A stand-in Web Audio context: every node takes any call, and the test counts what was started. */
function fakeWindow() {
  const log = { started: 0, made: 0 };
  const param = () => new Proxy({ value: 0 }, { get: (o, k) => (k in o ? o[k] : () => {}), set: (o, k, v) => { o[k] = v; return true; } });
  const node = () => new Proxy({}, {
    get(o, k) {
      if (k in o) return o[k];
      if (k === 'start') return () => { log.started++; };
      if (['gain', 'frequency', 'Q', 'delayTime', 'threshold', 'ratio', 'detune'].includes(k)) return (o[k] = param());
      return () => {};
    },
    set(o, k, v) { o[k] = v; return true; },
  });
  class Ctx {
    constructor() { this.state = 'running'; this.currentTime = 1; this.sampleRate = 8000; this.destination = node(); log.ctx = this; }
    createBuffer(ch, len) { const d = new Float32Array(len); return { getChannelData: () => d }; }
    resume() { this.state = 'running'; return Promise.resolve(); }
    suspend() { this.state = 'suspended'; return Promise.resolve(); }
  }
  for (const m of ['createGain', 'createOscillator', 'createBiquadFilter', 'createDelay', 'createDynamicsCompressor', 'createBufferSource'])
    Ctx.prototype[m] = function () { log.made++; return node(); };
  return { win: { AudioContext: Ctx }, log };
}

test('every mood writes the same bars for the same seed, with notes a person can hear', () => {
  for (const mood of MOODS) {
    for (let n = 0; n < 32; n++) {
      const a = musicBar(mood, 5, n), b = musicBar(mood, 5, n);
      assert.deepEqual(a, b);
      assert.equal(a.beats, 4);
      assert.ok(Math.abs(a.spb - 60 / TUNES[mood].bpm) < 1e-9);
      assert.ok(a.ev.length > 0);
      for (const e of a.ev) {
        assert.ok(e.at >= 0 && e.at < 4.2, mood + ' note inside its bar');
        assert.ok(e.d > 0 && e.v > 0 && e.v <= 1);
        if (!['hat', 'snare', 'tom', 'block'].includes(e.i)) assert.ok(e.n >= 28 && e.n <= 96, mood + ' pitch ' + e.n);
      }
    }
    assert.notDeepEqual(musicBar(mood, 5, 5).ev, musicBar(mood, 6, 5).ev, 'a new seed is a new melody');
  }
});

test('the wave and boss tunes are faster than the calm build theme', () => {
  assert.ok(TUNES.wave.bpm > TUNES.town.bpm && TUNES.boss.bpm > TUNES.wave.bpm);
  assert.equal(moodOf({ title: true }), 'title');
  assert.equal(moodOf({ phase: 'break' }), 'town');
  assert.equal(moodOf({ phase: 'wave' }), 'wave');
  assert.equal(moodOf({ phase: 'wave', boss: true }), 'boss');
  assert.equal(moodOf({ map: true, phase: 'wave', boss: true }), 'town');
});

test('the volumes are kept under cg-audio and a damaged entry falls back to the defaults', () => {
  const s = store();
  assert.deepEqual(readAudio(s), AUDIO_DEFAULT);
  writeAudio({ music: .3, sound: 2 }, s);
  assert.deepEqual(readAudio(s), { music: .3, sound: 1, voice: .9, read: 0 });
  s.setItem(AUDIO_KEY, '{oops');
  assert.deepEqual(readAudio(s), AUDIO_DEFAULT);
  const a = createAudio({ store: s, win: {} });
  a.set('music', 0); a.set('sound', .45);
  assert.deepEqual(readAudio(s), { music: 0, sound: .45, voice: .9, read: 0 });
  a.set('voice', .4); a.set('read', true);
  assert.deepEqual(readAudio(s), { music: 0, sound: .45, voice: .4, read: 1 });
  assert.equal(JSON.parse(s.getItem(AUDIO_KEY)).v, 2);
  assert.ok([...s.m.keys()].every(k => k.startsWith('cg-')));
});

test('with no Web Audio nothing breaks and nothing plays', () => {
  const a = createAudio({ store: store(), win: {} });
  a.start(); assert.equal(a.tick(), 0); assert.equal(a.play('coin'), false); a.sleep(true); a.sleep(false);
  assert.equal(a.state().ctx, 'none');
});

test('music schedules bars ahead, switches mood, and goes quiet when hidden or off', () => {
  const { win, log } = fakeWindow(), a = createAudio({ store: store(), win });
  assert.equal(a.tick(), 0, 'nothing before the first tap');
  a.start();
  assert.equal(a.state().ctx, 'running');
  a.mood('town'); assert.ok(a.tick() >= 1); assert.equal(a.state().mood, 'town');
  assert.ok(log.started > 10);
  log.ctx.currentTime += 3; a.mood('boss'); a.tick(); assert.equal(a.state().mood, 'boss');
  a.sleep(true); assert.equal(a.state().ctx, 'suspended');
  const bars = a.state().bars; log.ctx.currentTime += 3; a.tick(); assert.equal(a.state().bars, bars, 'hidden, no music');
  a.start(); assert.equal(a.state().ctx, 'suspended', 'a tap while hidden does not wake it');
  a.sleep(false); assert.equal(a.state().ctx, 'running');
  a.set('music', 0); log.ctx.currentTime += 3; assert.equal(a.tick(), 0, 'Music off schedules nothing');
});

test('every effect plays, and a burst of shots is thinned out', () => {
  const { win, log } = fakeWindow(), a = createAudio({ store: store(), win });
  a.start();
  for (const k of ['crossbow', 'cannon', 'frost', 'still', 'mortar', 'boom', 'coin', 'build', 'leak', 'boss']) {
    log.ctx.currentTime += 2; assert.equal(a.play(k), true, k);
  }
  log.ctx.currentTime += 2;
  let n = 0; for (let i = 0; i < 50; i++) if (a.play('crossbow')) n++;
  assert.equal(n, 1, 'the same moment plays one shot');
  let m = 0; for (let i = 0; i < 100; i++) { log.ctx.currentTime += .01; if (a.play(['crossbow', 'cannon', 'coin', 'frost'][i % 4])) m++; }
  assert.ok(m <= 14 + 1, 'at most 14 effects a second, got ' + m);
  a.set('sound', 0); log.ctx.currentTime += 2; assert.equal(a.play('coin'), false, 'Sound off plays nothing');
});

test('effects follow the town in play and stay quiet while time away is caught up', () => {
  const played = [], audio = { play: k => played.push(k) }, game = { bus: new Bus(), active: 'gulch', catching: false };
  const off = soundsFor(game, audio);
  game.bus.emit('shot', { town: 'gulch', kind: 'cannon' });
  game.bus.emit('shot', { town: 'ridge', kind: 'cannon' });
  game.bus.emit('kill', { town: 'gulch', coins: 3 });
  game.bus.emit('build', { town: 'gulch', id: 'saw' });
  game.bus.emit('tower:upgrade', { town: 'gulch', spot: 1 });
  game.bus.emit('wave:start', { town: 'gulch', wave: 9, boss: false });
  game.bus.emit('wave:start', { town: 'gulch', wave: 10, boss: true });
  game.bus.emit('land', { town: 'gulch' });
  assert.deepEqual(played, ['cannon', 'coin', 'build', 'build', 'boss', 'boom']);
  game.catching = true; game.bus.emit('shot', { town: 'gulch', kind: 'cannon' }); game.catching = false;
  off(); game.bus.emit('shot', { town: 'gulch', kind: 'cannon' });
  assert.equal(played.length, 6);
});
