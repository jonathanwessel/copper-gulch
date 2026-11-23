/* Music and sound: Web Audio made on the fly, no sound files and no other hosts.
   One AudioContext, made on the first tap or key (browsers allow sound only after one), with two volumes:
     music: the tunes from src/audio/tunes.js, scheduled half a second ahead of the audio clock;
     sound: short effects for building, shots, coins and the boss.
   Both are kept under cg-audio ({ v, music, sound, voice, read }: volumes 0 to 1, 0 is off; voice is the volume the
   explainer cards are read aloud at and read is 1 when each new card reads itself, src/audio/speech.js). Version 1
   had only music and sound; readAudio fills in the rest (migrateAudio). The app going to the background suspends the
   context, so nothing plays while it is hidden, and coming back wakes it. A failed note never stops the game. */
import { musicBar, midiHz, mrng, MOODS } from './tunes.js';

export const AUDIO_KEY = 'cg-audio';
export const AUDIO_DEFAULT = { music: .5, sound: .6, voice: .9, read: 0 };
export const AUDIO_V = 2;
/* An older kept shape brought up to this one: version 1 ({ music, sound }) gets the voice volume and Read cards
   aloud off. */
export function migrateAudio(o) {
  if (!o || typeof o !== 'object') return null;
  const out = { ...o };
  if (!(out.v >= 2)) { if (out.voice === undefined) out.voice = AUDIO_DEFAULT.voice; if (out.read === undefined) out.read = 0; out.v = 2; }
  return out;
}
const ls = () => { try { return globalThis.localStorage || null; } catch (e) { return null; } };
const clamp01 = v => Math.max(0, Math.min(1, Number.isFinite(+v) ? +v : 0));

/* The volumes kept on this device (the defaults when none are kept or the text is damaged). */
export function readAudio(store = ls()) {
  let o = null;
  try { o = migrateAudio(JSON.parse(store && store.getItem(AUDIO_KEY))); } catch (e) { o = null; }
  const out = { ...AUDIO_DEFAULT };
  if (o && typeof o === 'object') for (const k of Object.keys(AUDIO_DEFAULT)) if (o[k] !== undefined) out[k] = clamp01(o[k]);
  out.read = out.read ? 1 : 0;
  return out;
}
export function writeAudio(v, store = ls()) {
  try { store.setItem(AUDIO_KEY, JSON.stringify({ v: AUDIO_V, music: clamp01(v.music), sound: clamp01(v.sound), voice: clamp01(v.voice ?? AUDIO_DEFAULT.voice), read: v.read ? 1 : 0 })); return true; } catch (e) { return false; }
}

/* How often each effect may sound at most (seconds), so a wave of shots stays a patter, not a roar. */
const GAP = { crossbow: .07, cannon: .12, frost: .1, still: .16, mortar: .2, boom: .1, coin: .09, build: .05, boss: 1, leak: .25 };
const MAX_PER_SEC = 14;

export function createAudio({ store = ls(), win = globalThis.window } = {}) {
  const vol = readAudio(store);
  const S = { ctx: null, out: null, mus: null, lead: null, fx: null, mood: null, want: 'title', n: 0, seed: 1, t: 0, noise: null, bufs: {},
    bars: 0, sounds: 0, last: {}, recent: [], asleep: false, ducked: false, rnd: mrng(Date.now() & 0xffff) };
  const now = () => (S.ctx ? S.ctx.currentTime : 0);
  const musicGain = () => vol.music * .5 * (S.ducked ? .25 : 1);

  /* Create the audio graph once, on the first tap, and wake it on later taps (iOS suspends it now and then). */
  function start() {
    const c0 = S.ctx;
    if (c0) { if (c0.state === 'suspended' && !S.asleep) try { c0.resume().catch(() => {}); } catch (e) { /* no sound */ } return; }
    if (!vol.music && !vol.sound) return;
    const A = win && (win.AudioContext || win.webkitAudioContext); if (!A) return;
    try {
      const c = S.ctx = new A();
      const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.connect(c.destination);
      const out = S.out = c.createGain(); out.gain.value = 1; out.connect(comp);
      S.mus = c.createGain(); S.mus.gain.value = musicGain(); S.mus.connect(out);
      S.fx = c.createGain(); S.fx.gain.value = vol.sound * .6; S.fx.connect(out);
      // the lead also goes through a canyon echo
      const lead = S.lead = c.createGain(), dl = c.createDelay(1), fb = c.createGain(), lp = c.createBiquadFilter(), wet = c.createGain();
      dl.delayTime.value = .36; fb.gain.value = .3; lp.type = 'lowpass'; lp.frequency.value = 2400; wet.gain.value = .3;
      lead.connect(S.mus); lead.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(wet); wet.connect(S.mus);
      S.t = 0;
      if (c.state === 'suspended' && !S.asleep) c.resume().catch(() => {});
    } catch (e) { S.ctx = null; }
  }
  const noise = c => {
    if (S.noise) return S.noise;
    const b = c.createBuffer(1, c.sampleRate, c.sampleRate), d = b.getChannelData(0), r = mrng(7);
    for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1;
    return (S.noise = b);
  };
  /* A plucked string (Karplus-Strong), made once per pitch. */
  const pluckBuf = (c, n) => {
    if (S.bufs[n]) return S.bufs[n];
    const sr = c.sampleRate, len = Math.floor(sr * 1.6), b = c.createBuffer(1, len, sr), d = b.getChannelData(0), p = Math.max(2, Math.round(sr / midiHz(n))), ring = new Float32Array(p), r = mrng(n);
    for (let i = 0; i < p; i++) ring[i] = r() * 2 - 1;
    for (let i = 0, k = 0; i < len; i++) { const nx = (k + 1) % p, v = ring[k]; d[i] = v * .5; ring[k] = (v + ring[nx]) * .4985; k = nx; }
    return (S.bufs[n] = b);
  };

  /* One note of the music: an instrument at time t (seconds on the audio clock), lasting d seconds. */
  function note(c, e, t, d) {
    if (e.s) t += e.s * .013; // a strum sounds string by string
    const g = c.createGain(), v = e.v * (.9 + S.rnd() * .2), env = g.gain, end = t + d;
    const osc = (type, f) => { const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); return o; };
    const vib = (o, rate, depth, delay) => { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = rate; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(depth, t + delay); l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(end + .3); };
    let src = [], tail = .1, dest = S.mus;
    switch (e.i) {
      case 'bass': { const o = osc('triangle', midiHz(e.n)); env.setValueAtTime(0, t); env.linearRampToValueAtTime(v, t + .01); env.exponentialRampToValueAtTime(.001, end); o.connect(g); src = [o]; break; }
      case 'pluck': case 'strum': {
        const s = c.createBufferSource(); s.buffer = pluckBuf(c, e.n); env.setValueAtTime(v, t); env.setValueAtTime(v, end); env.exponentialRampToValueAtTime(.001, end + (e.i === 'strum' ? .08 : .4)); s.connect(g); src = [s]; tail = .45;
        break;
      }
      case 'whistle': { const f = midiHz(e.n), o = osc('sine', f); vib(o, 5.2, f * .006, .25); env.setValueAtTime(0, t); env.linearRampToValueAtTime(v * .55, t + .07); env.setValueAtTime(v * .5, Math.max(t + .08, end - .1)); env.linearRampToValueAtTime(0, end + .05); o.connect(g); src = [o]; dest = S.lead; break; }
      case 'harp': case 'fiddle': {
        const f = midiHz(e.n), a = osc('sawtooth', f), b = osc('sawtooth', f * (e.i === 'harp' ? 1.004 : .997)), lp = c.createBiquadFilter(), h = e.i === 'harp';
        lp.type = 'lowpass'; lp.frequency.value = h ? 1500 : 2300; lp.Q.value = h ? 1.5 : 3;
        vib(a, h ? 6 : 5.6, f * (h ? .004 : .008), h ? .15 : .2); vib(b, 5.8, f * .005, .2);
        const k = h ? .2 : .16;
        env.setValueAtTime(0, t); env.linearRampToValueAtTime(v * k, t + (h ? .03 : .05)); env.setValueAtTime(v * k * .85, Math.max(t + .06, end - .06)); env.linearRampToValueAtTime(0, end + .04);
        a.connect(lp); b.connect(lp); lp.connect(g); src = [a, b]; dest = S.lead; break;
      }
      case 'block': { const o = osc('triangle', e.n ? 760 : 1050); o.frequency.exponentialRampToValueAtTime(e.n ? 520 : 720, t + .03); env.setValueAtTime(v, t); env.exponentialRampToValueAtTime(.001, t + .06); o.connect(g); src = [o]; tail = .02; break; }
      case 'tom': { const o = osc('sine', 150); o.frequency.exponentialRampToValueAtTime(55, t + .25); env.setValueAtTime(v, t); env.exponentialRampToValueAtTime(.001, t + .32); o.connect(g); src = [o]; tail = .05; break; }
      case 'snare': case 'hat': {
        const s = c.createBufferSource(), f = c.createBiquadFilter(); s.buffer = noise(c); f.type = e.i === 'hat' ? 'highpass' : 'bandpass'; f.frequency.value = e.i === 'hat' ? 7000 : 1800;
        env.setValueAtTime(v, t); env.exponentialRampToValueAtTime(.001, t + (e.i === 'hat' ? .04 : .14)); s.connect(f); f.connect(g); src = [s]; tail = .05; break;
      }
      default: return;
    }
    g.connect(dest);
    for (const s of src) { s.start(t); s.stop(end + tail + .05); }
  }

  /* Keep about half a second of music scheduled; a new mood starts on the next bar. Called every frame. */
  function tick() {
    const c = S.ctx; if (!c || c.state !== 'running' || !vol.music) { if (S.ctx) S.t = 0; return 0; }
    if (S.t < c.currentTime + .03) S.t = c.currentTime + .1; // just switched on, or the page was asleep
    let made = 0;
    while (S.t < c.currentTime + .5 && made < 4) {
      if (S.want !== S.mood) { S.mood = S.want; S.n = 0; S.seed = 1 + Math.floor(S.rnd() * 1e6); }
      const bar = musicBar(S.mood, S.seed, S.n++), spb = bar.spb, t0 = S.t;
      for (const e of bar.ev) try { note(c, e, Math.max(c.currentTime, t0 + e.at * spb + (S.rnd() - .5) * .008), e.d * spb); } catch (er) { /* a bad note never stops the game */ }
      S.t = t0 + bar.beats * spb; S.bars++; made++;
    }
    return made;
  }

  /* --- sound effects ------------------------------------------------------------------------------------- */
  // a short tone with a pitch slide and a quick fade
  function tone(c, t, { type = 'sine', f, to, d, v, q }) {
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + d);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .005); g.gain.exponentialRampToValueAtTime(.001, t + d);
    if (q) { const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = q; o.connect(lp); lp.connect(g); } else o.connect(g);
    g.connect(S.fx); o.start(t); o.stop(t + d + .05);
  }
  // a burst of filtered noise
  function hiss(c, t, { type = 'bandpass', f, d, v, to }) {
    const s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = noise(c); fl.type = type; fl.frequency.setValueAtTime(f, t); if (to) fl.frequency.exponentialRampToValueAtTime(to, t + d);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
    s.connect(fl); fl.connect(g); g.connect(S.fx); s.start(t, S.rnd() * .5); s.stop(t + d + .05);
  }
  const SFX = {
    crossbow: (c, t) => { hiss(c, t, { type: 'highpass', f: 3000, d: .05, v: .22 }); tone(c, t, { type: 'triangle', f: 900, to: 260, d: .08, v: .12 }); },
    cannon: (c, t) => { tone(c, t, { f: 130, to: 38, d: .32, v: .55 }); hiss(c, t, { type: 'lowpass', f: 900, to: 120, d: .25, v: .35 }); },
    frost: (c, t) => { tone(c, t, { f: 1900, to: 1500, d: .18, v: .08 }); tone(c, t + .02, { f: 2850, to: 2600, d: .14, v: .05 }); },
    still: (c, t) => { tone(c, t, { f: 260, to: 620, d: .12, v: .12 }); tone(c, t + .07, { f: 330, to: 760, d: .1, v: .08 }); },
    mortar: (c, t) => { tone(c, t, { f: 90, to: 45, d: .4, v: .5 }); hiss(c, t, { type: 'lowpass', f: 500, d: .2, v: .25 }); },
    boom: (c, t) => { tone(c, t, { f: 110, to: 30, d: .45, v: .5 }); hiss(c, t, { type: 'lowpass', f: 1400, to: 100, d: .4, v: .4 }); },
    coin: (c, t) => { tone(c, t, { type: 'square', f: 1320, d: .06, v: .05, q: 4000 }); tone(c, t + .05, { type: 'square', f: 1760, d: .1, v: .05, q: 4000 }); },
    build: (c, t) => { for (const k of [0, .11]) { tone(c, t + k, { type: 'triangle', f: 230, to: 120, d: .07, v: .3 }); hiss(c, t + k, { f: 1600, d: .04, v: .15 }); } },
    leak: (c, t) => { tone(c, t, { f: 90, to: 50, d: .25, v: .35 }); },
    boss: (c, t) => { // a low horn swelling, and a drum
      for (const [f, dt] of [[110, 1], [110.8, .998], [165, 1.002]]) {
        const o = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain();
        o.type = 'sawtooth'; o.frequency.setValueAtTime(f * .97 * dt, t); o.frequency.linearRampToValueAtTime(f * dt, t + .3);
        lp.type = 'lowpass'; lp.frequency.setValueAtTime(300, t); lp.frequency.linearRampToValueAtTime(1100, t + .6);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.09, t + .35); g.gain.setValueAtTime(.09, t + .9); g.gain.linearRampToValueAtTime(0, t + 1.4);
        o.connect(lp); lp.connect(g); g.connect(S.fx); o.start(t); o.stop(t + 1.5);
      }
      tone(c, t, { f: 150, to: 50, d: .5, v: .5 });
    },
  };
  /* Play an effect now (when sound is on, the context runs, and it is not too soon after the last one). */
  function play(name) {
    const c = S.ctx; if (!c || c.state !== 'running' || !vol.sound || !SFX[name]) return false;
    const t = c.currentTime;
    if (t - (S.last[name] ?? -9) < (GAP[name] ?? .05)) return false;
    while (S.recent.length && S.recent[0] < t - 1) S.recent.shift();
    if (S.recent.length >= MAX_PER_SEC && name !== 'boss') return false;
    S.last[name] = t; S.recent.push(t);
    try { SFX[name](c, t + .01); S.sounds++; } catch (e) { return false; }
    return true;
  }

  /* The volumes: set one (0 to 1), kept on this device at once. voice and read only keep the value (speech.js reads
     them). */
  function set(k, v) {
    if (!(k in AUDIO_DEFAULT)) return;
    vol[k] = k === 'read' ? (v ? 1 : 0) : clamp01(v); writeAudio(vol, store);
    if (k !== 'music' && k !== 'sound') return;
    if (!S.ctx) { if (vol[k]) start(); return; }
    const g = k === 'music' ? S.mus : S.fx;
    try { g.gain.setTargetAtTime(k === 'music' ? musicGain() : vol[k] * .6, now(), .08); } catch (e) { /* no sound */ }
    if (k === 'music' && !vol.music) S.t = 0;
  }
  /* The app hidden or shown: hidden suspends everything, shown wakes it. */
  function sleep(on) {
    S.asleep = !!on;
    const c = S.ctx; if (!c) return;
    try { (on ? c.suspend() : c.resume()).catch(() => {}); } catch (e) { /* no sound */ }
  }
  /* The music dips while a card is read aloud, and comes back after. */
  function duck(on) {
    S.ducked = !!on;
    if (!S.ctx || !S.mus) return;
    try { S.mus.gain.setTargetAtTime(musicGain(), now(), on ? .12 : .4); } catch (e) { /* no sound */ }
  }
  return {
    start, tick, play, set, sleep, duck,
    get: k => vol[k],
    mood: m => { if (MOODS.includes(m)) S.want = m; },
    state: () => ({ ctx: S.ctx ? S.ctx.state : 'none', mood: S.mood, want: S.want, bars: S.bars, sounds: S.sounds, music: vol.music, sound: vol.sound, asleep: S.asleep, ducked: S.ducked }),
  };
}

/* Hook the effects to the game's events: only for the town in play, and never while time away is caught up. */
export function soundsFor(game, audio) {
  const here = e => e && e.town === game.active && !game.catching;
  const SHOT = { crossbow: 'crossbow', cannon: 'cannon', frost: 'frost', still: 'still', mortar: 'mortar' };
  let milStep = -1;
  const offs = [
    game.bus.on('shot', e => { if (here(e) && !(e.rocket > 0) && !(e.kind === 'militia' && game.stats.steps === milStep)) { if (e.kind === 'militia') milStep = game.stats.steps; audio.play(e.rocket === 0 ? 'mortar' : SHOT[e.kind] || 'crossbow'); } }), // a rocket volley is one launch, and so is the militia's (all its shots come in one step)
    game.bus.on('arms:call', e => { if (here(e)) audio.play('boss'); }),
    game.bus.on('land', e => { if (here(e)) audio.play('boom'); }),
    game.bus.on('kill', e => { if (here(e) && e.coins) audio.play('coin'); }),
    game.bus.on('build', e => { if (here(e)) audio.play('build'); }),
    game.bus.on('tower:build', e => { if (here(e)) audio.play('build'); }),
    game.bus.on('tower:upgrade', e => { if (here(e)) audio.play('build'); }),
    game.bus.on('leak', e => { if (here(e)) audio.play('leak'); }),
    game.bus.on('wave:start', e => { if (here(e) && e.boss) audio.play('boss'); }),
  ];
  return () => { for (const f of offs) f(); };
}
