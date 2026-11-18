/* The music as notes: Old West tunes written on the fly, adapted from the old game (../tycoon/src/music.js).
   Pure and seeded, so the tests can play it without a sound card. src/audio/audio.js turns the notes into sound.
   Four moods:
     title: a lonesome whistle over finger-picked guitar.
     town:  the calm build theme, boom-chick bass and guitar with hooves on a wood block.
     wave:  raiders on the road, a galloping bass, a harmonica and a faster beat.
     boss:  the boss rides in, a driving fiddle tune with drums.
   musicBar(mood, seed, n) gives bar n of a mood. A tune is four phrases of four bars (A A B A); every 16 bars the
   seed picks new melodies over the same chords. */

/* Each mood: tempo, key (the bass's MIDI note), lead instrument, the melody's scale (semitones above the key), two
   four-chord phrases (A and B, as [semitones above the key, 'M' major or 'm' minor]) and the melody's rhythms. */
export const TUNES = {
  title: { bpm: 72, key: 40, lead: 'whistle', scale: [0, 3, 5, 7, 10], swing: 0, rest: .25,
    A: [[0, 'm'], [8, 'M'], [3, 'M'], [10, 'M']], B: [[5, 'm'], [0, 'm'], [7, 'M'], [0, 'm']],
    rhythms: [[2, 2], [3, 1], [1.5, .5, 2], [2, 1, 1], [1, 1, 2]] },
  town: { bpm: 96, key: 43, lead: 'harp', scale: [0, 2, 4, 7, 9], swing: .12, rest: .15,
    A: [[0, 'M'], [5, 'M'], [0, 'M'], [7, 'M']], B: [[5, 'M'], [0, 'M'], [2, 'm'], [7, 'M']],
    rhythms: [[1, 1, 1, 1], [1.5, .5, 1, 1], [.5, .5, 1, 2], [1, .5, .5, 2], [2, 1, 1], [1, 1, 2]] },
  wave: { bpm: 118, key: 45, lead: 'harp', scale: [0, 2, 3, 5, 7, 9, 10], swing: .08, rest: .1,
    A: [[0, 'm'], [7, 'm'], [5, 'M'], [7, 'M']], B: [[3, 'M'], [10, 'M'], [5, 'M'], [7, 'M']],
    rhythms: [[1, .5, .5, 1, 1], [.5, .5, 1, 1, 1], [1, 1, .5, .5, 1], [1.5, .5, 1, 1]] },
  boss: { bpm: 132, key: 45, lead: 'fiddle', scale: [0, 2, 3, 5, 7, 8, 11], swing: 0, rest: .05,
    A: [[0, 'm'], [10, 'M'], [8, 'M'], [7, 'M']], B: [[0, 'm'], [5, 'm'], [8, 'M'], [7, 'M']],
    rhythms: [[.5, .5, .5, .5, 1, 1], [1, .5, .5, 1, 1], [.5, .5, 1, .5, .5, 1], [1, 1, .5, .5, 1]] },
};
export const MOODS = Object.keys(TUNES);
const FORM = ['A', 'A', 'B', 'A'];
const ENDINGS = [[2, 2], [1, 1, 2], [3, 1], [4]];

/* A small seeded random source (mulberry32). */
export function mrng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export const midiHz = n => 440 * Math.pow(2, (n - 69) / 12);
/* The pitch classes (0-11) of a chord in a tune. */
const chordPcs = (T, c) => { const r = (T.key + c[0]) % 12; return [r, (r + (c[1] === 'm' ? 3 : 4)) % 12, (r + 7) % 12]; };

/* The melody of one phrase (four bars of notes), the same every time for the same seed and section. */
function phraseMelody(T, seed, sec) {
  const r = mrng(seed * 7919 + (sec === 'B' ? 101 : 13)), chords = T[sec], home = T.key + 24, sc = [];
  for (let o = -1; o <= 1; o++) for (const s of T.scale) sc.push(home + 12 * o + s);
  const lo = sc.findIndex(n => n >= home - 5), hi = sc.length - 1 - [...sc].reverse().findIndex(n => n <= home + 16);
  let i = sc.indexOf(home); const out = [];
  for (let b = 0; b < 4; b++) {
    const last = b === 3, rh = last ? ENDINGS[Math.floor(r() * ENDINGS.length)] : T.rhythms[Math.floor(r() * T.rhythms.length)];
    const pcs = chordPcs(T, chords[b]), bar = []; let at = 0;
    rh.forEach((d, k) => {
      const strong = at % 2 === 0, end = last && k === rh.length - 1;
      if (!strong && !end && r() < T.rest) { at += d; return; } // a breath
      if (end || strong) { // land on a note of the chord (the phrase ends on the root, nearest home)
        const want = end ? [pcs[0]] : pcs; let best = -1, bd = 99;
        for (let j = lo; j <= hi; j++) if (want.includes(sc[j] % 12)) { const dd = Math.abs(j - (end ? sc.indexOf(home) : i)) + r() * .9; if (dd < bd) { bd = dd; best = j; } }
        if (best >= 0) i = best;
      } else {
        let step = r() < .6 ? 1 : 2; if (r() < .5) step = -step;
        if (sc[i] > home + 9) step = -Math.abs(step); else if (sc[i] < home - 2) step = Math.abs(step);
        i = Math.max(lo, Math.min(hi, i + step));
      }
      bar.push({ at, d, n: sc[i], i: T.lead, v: strong ? .3 : .24 }); at += d;
    });
    out.push(bar);
  }
  return out;
}

/* One bar of a mood's tune: { spb (seconds a beat), beats, ev: [{ at, d (beats), n (MIDI note), i (instrument), v, s }] }.
   n counts bars from the start of the mood; s is a strum's string number (it sounds a moment after the one before). */
export function musicBar(mood, seed, n) {
  const T = TUNES[mood] || TUNES.town, tune = Math.floor(n / 16), p = Math.floor(n / 4) % 4, sec = FORM[p], b = n % 4, c = T[sec][b];
  const ev = [], bass = T.key + (c[0] > 6 ? c[0] - 12 : c[0]), third = c[1] === 'm' ? 3 : 4;
  const g = 52 + ((T.key + c[0] - 52) % 12 + 12) % 12, strum = [g, g + 7, g + 12, g + 12 + third]; // an open guitar voicing
  const S8 = x => Math.floor(x) + (x % 1 === .5 ? .5 + T.swing : x % 1); // swung off-beats
  const add = (at, d, n_, i, v, s) => ev.push(s ? { at: S8(at), d, n: n_, i, v, s } : { at: S8(at), d, n: n_, i, v });
  if (mood === 'title') {
    add(0, 2, bass, 'bass', .5); add(2, 2, bass + 7, 'bass', .32);
    [0, 2, 1, 2, 3, 2, 1, 2].forEach((k, j) => add(j / 2, 1.5, strum[k], 'pluck', j % 2 ? .16 : .22)); // finger-picked
  } else if (mood === 'boss') {
    for (let j = 0; j < 8; j++) { add(j / 2, .45, bass + (j % 2 ? 12 : 0), 'bass', j % 2 ? .32 : .45); add(j / 2, .1, 0, 'hat', j % 2 ? .05 : .08); }
    for (const at of [1, 3]) { strum.forEach((s, k) => add(at, .3, s, 'strum', .2, k)); add(at, .2, 0, 'snare', .3); }
    add(0, .3, 0, 'tom', .6); add(2, .3, 0, 'tom', .5);
  } else if (mood === 'wave') { // a gallop: long-short-short in the bass and on the block
    for (const at of [0, 2]) { add(at, .9, bass, 'bass', .5); add(at + 1, .4, bass + 7, 'bass', .36); add(at + 1.5, .4, bass + 7, 'bass', .3); }
    for (const at of [1, 3]) { strum.forEach((s, k) => add(at, .3, s, 'strum', .18, k)); add(at, .15, 0, 'snare', .14); }
    for (const at of [0, .75, 1, 2, 2.75, 3]) add(at, .1, at % 1 ? 1 : 0, 'block', at % 2 === 0 ? .12 : .07);
  } else { // town: boom-chick bass and guitar, hooves on the wood block
    add(0, .9, bass, 'bass', .5); add(2, .9, bass - 5, 'bass', .42);
    for (const at of [1, 3]) strum.forEach((s, k) => add(at, .35, s, 'strum', .15, k));
    for (let j = 0; j < 8; j++) add(j / 2, .1, j % 2 ? 1 : 0, 'block', j % 4 === 0 ? .1 : j % 2 ? .05 : .08);
  }
  const intro = mood === 'town' && n < 4; // the town tune starts with the band alone
  if (!intro) for (const e of phraseMelody(T, seed * 31 + tune, sec)[b]) add(e.at, e.d, e.n, e.i, e.v);
  return { spb: 60 / T.bpm, beats: 4, ev };
}

/* Which mood fits what is on screen: the title, the empire map (calm), or the town in play: calm between waves,
   the wave tune while raiders are on the road and the boss tune for a whole boss wave. */
export function moodOf({ title = false, map = false, phase = 'break', boss = false } = {}) {
  if (title) return 'title';
  if (map || phase !== 'wave') return 'town';
  return boss ? 'boss' : 'wave';
}
