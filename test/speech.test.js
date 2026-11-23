// Reading the explainer cards aloud (src/audio/speech.js): on-device voices only, the card's words as they are said,
// the music dipping while it reads, and the volume and Read cards aloud kept with a migration from the old shape.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sayable, pickVoice, createSpeech, SAY_SYMBOLS } from '../src/audio/speech.js';
import { readAudio, migrateAudio, AUDIO_KEY, AUDIO_DEFAULT, createAudio } from '../src/audio/audio.js';
import { EXPLAINERS } from '../src/data/explainers.js';

const store = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };
// a speech engine like the browser's, that records what it was asked to say
function fakeWin(voices) {
  const listeners = [];
  const syn = {
    said: [], cancels: 0, current: null,
    getVoices: () => voices,
    speak(u) { this.said.push(u); this.current = u; },
    cancel() { this.cancels++; const u = this.current; this.current = null; if (u && u.onend) u.onend(); },
    addEventListener: (ev, f) => { if (ev === 'voiceschanged') listeners.push(f); },
    fire: () => listeners.forEach(f => f()),
    finish() { const u = this.current; this.current = null; if (u && u.onend) u.onend(); },
  };
  return { speechSynthesis: syn, SpeechSynthesisUtterance: class { constructor(t) { this.text = t; } } };
}
const LOCAL_US = { name: 'Device US', lang: 'en-US', localService: true }, ONLINE_US = { name: 'Online US', lang: 'en-US', localService: false };

test('the card reads as it is said: numbers and symbols in words, no emoji, no braces', () => {
  assert.equal(sayable('Big Shell', 'Hits x3 as hard · 2x slower'), 'Big Shell. Hits 3 times as hard, 2 times slower.');
  assert.equal(sayable('Coins', 'You have 4.8K coins and make 3/s. Kept 12 / 40.'), 'Coins. You have 4.8 thousand coins and make 3 a second. Kept 12 of 40.');
  assert.equal(sayable('Back', 'Tap ◂ to go to the place you played last.'), 'Back. Tap the back button to go to the place you played last.');
  assert.equal(sayable('Boss', 'The {boss} is here 🤠!'), 'Boss. The is here!');
  assert.equal(sayable('Bonus', 'Gets +20% more.'), 'Bonus. Gets plus 20% more.');
});

test('every explainer reads aloud as plain text', () => {
  for (const e of EXPLAINERS) {
    const s = sayable(e.title, e.text);
    assert.match(s, /^[\x20-\x7e]+$/, e.id + ' has a symbol the voice cannot say');
    assert.ok(!/[{}·]|\bx\d/.test(s), e.id);
    assert.ok(s.startsWith(e.title.trim()), e.id + ' starts with its title');
  }
  for (const k of Object.keys(SAY_SYMBOLS)) assert.ok(!/[\x20-\x7e]/.test(k), 'only symbols in the table');
});

test('only an on-device English voice is used, American English first', () => {
  assert.equal(pickVoice([ONLINE_US]), null);
  assert.equal(pickVoice([{ name: 'De', lang: 'de-DE', localService: true }]), null);
  const gb = { name: 'GB', lang: 'en-GB', localService: true };
  assert.equal(pickVoice([gb, ONLINE_US]), gb);
  assert.equal(pickVoice([gb, LOCAL_US, ONLINE_US]), LOCAL_US);
  assert.equal(pickVoice([]), null); assert.equal(pickVoice(undefined), null);
});

test('speaking reads exactly the text, dips the music, and stops on stop()', () => {
  const win = fakeWin([ONLINE_US, LOCAL_US]), ducks = [];
  const sp = createSpeech({ win, audio: { duck: on => ducks.push(on) }, volume: () => .5 });
  assert.equal(sp.available(), true);
  assert.equal(sp.speak('Hello there.'), true);
  const u = win.speechSynthesis.said[0];
  assert.equal(u.text, 'Hello there.'); assert.equal(u.voice, LOCAL_US); assert.equal(u.volume, .5);
  assert.equal(sp.speaking(), true); assert.deepEqual(ducks, [true]);
  sp.stop();
  assert.equal(sp.speaking(), false); assert.equal(win.speechSynthesis.cancels, 1); assert.deepEqual(ducks, [true, false]);
  sp.stop(); assert.equal(win.speechSynthesis.cancels, 1, 'nothing to stop');
  sp.speak('Again.'); win.speechSynthesis.finish();
  assert.equal(sp.speaking(), false, 'the end of the text ends it'); assert.equal(ducks.at(-1), false);
});

test('with no on-device voice there is nothing to press and nothing is said', () => {
  const win = fakeWin([ONLINE_US]), sp = createSpeech({ win });
  assert.equal(sp.available(), false);
  assert.equal(sp.speak('Hi.'), false);
  assert.equal(win.speechSynthesis.said.length, 0);
  // voices often load late: the button appears once a local one arrives
  let told = 0; sp.onChange(() => told++);
  win.speechSynthesis.getVoices = () => [LOCAL_US]; win.speechSynthesis.fire();
  assert.equal(sp.available(), true); assert.ok(told >= 1);
  assert.equal(createSpeech({ win: {} }).available(), false, 'no speech engine at all');
});

test('the old sound save gets the voice volume and Read cards aloud off', () => {
  const s = store();
  s.setItem(AUDIO_KEY, JSON.stringify({ music: .2, sound: .3 }));
  assert.deepEqual(readAudio(s), { music: .2, sound: .3, voice: AUDIO_DEFAULT.voice, read: 0 });
  assert.deepEqual(migrateAudio({ music: 1, sound: 1 }), { music: 1, sound: 1, voice: .9, read: 0, v: 2 });
  assert.equal(AUDIO_DEFAULT.read, 0, 'off by default');
  const a = createAudio({ store: s, win: {} }); a.duck(true); assert.equal(a.state().ducked, true); a.duck(false);
});
