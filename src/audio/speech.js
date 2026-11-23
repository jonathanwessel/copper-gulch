/* Reading the explainer cards aloud (owner, 2026-11-22: "A little speaker button for tutorial dialog boxes").
   Free forever: only the browser's own speech engine, and only voices that run on the device (localService true),
   American English first. With no such voice the speaker button is hidden. Nothing is fetched and the text never
   leaves the device.
     sayable(title, text): the card's words as they should be said ("x3" as "3 times", no "·", no emoji).
     pickVoice(voices): the on-device English voice to use, or null.
     createSpeech({ win, audio, volume }): { available(), speaking(), speak(text), stop(), onChange(fn) }.
   The music dips while a card is read (audio.duck), and comes back when it ends or stops. */

/* Symbols a card may show, and what to say for each. Anything else outside plain text is dropped. */
export const SAY_SYMBOLS = { '◂': 'the back button', '·': ',', '×': ' times ', '—': ',', '–': ' to ', '’': "'", '‘': "'", '“': '"', '”': '"', '…': '.' };

export function sayable(title, text) {
  let s = [title, text].filter(Boolean).map(x => String(x).trim()).map(x => (/[.!?]$/.test(x) ? x : x + '.')).join(' ');
  s = s.replace(/\bx\s?(\d+(?:\.\d+)?)\b/g, '$1 times').replace(/\b(\d+(?:\.\d+)?)x\b/g, '$1 times'); // x3, 3x
  s = s.replace(/(\d+(?:\.\d+)?)K\b/g, '$1 thousand').replace(/(\d+(?:\.\d+)?)M\b/g, '$1 million'); // 4.8K, 2M
  s = s.replace(/(\d+(?:\.\d+)?)\/s\b/g, '$1 a second').replace(/(\d+)\s?\/\s?(\d+)/g, '$1 of $2'); // 3/s, 12 / 40
  s = s.replace(/\+(\d)/g, 'plus $1');
  s = s.replace(/\{[^}]*\}/g, ''); // a name that was never filled in is left out, never read as code
  s = [...s].map(ch => (SAY_SYMBOLS[ch] !== undefined ? SAY_SYMBOLS[ch] : /[\x20-\x7e]/.test(ch) ? ch : ' ')).join('');
  return s.replace(/\s+([,.!?])/g, '$1').replace(/([,.])\1+/g, '$1').replace(/,\s*\./g, '.').replace(/\s+/g, ' ').trim();
}

/* The voice to read with: on the device only, English only (the cards are English), American English first, then
   the device's default among those. */
export function pickVoice(voices) {
  const ok = (voices || []).filter(v => v && v.localService === true && /^en([-_]|$)/i.test(v.lang || ''));
  const us = ok.filter(v => /^en[-_]us$/i.test(v.lang || ''));
  const pool = us.length ? us : ok;
  return pool.find(v => v.default) || pool[0] || null;
}

export function createSpeech({ win = globalThis.window, audio = null, volume = () => 1 } = {}) {
  const syn = win && win.speechSynthesis, Utt = win && win.SpeechSynthesisUtterance;
  let voice = null, cur = null; const subs = new Set();
  const tell = () => { for (const f of subs) try { f(); } catch (e) { /* a listener never stops speech */ } };
  const look = () => { try { voice = syn && Utt ? pickVoice(syn.getVoices()) : null; } catch (e) { voice = null; } tell(); };
  if (syn && Utt) {
    look();
    try { if (syn.addEventListener) syn.addEventListener('voiceschanged', look); else syn.onvoiceschanged = look; } catch (e) { /* no voices */ }
  }
  const done = u => { if (cur !== u) return; cur = null; if (audio && audio.duck) audio.duck(false); tell(); };
  const api = {
    available: () => !!voice,
    speaking: () => !!cur,
    /* Read the text, or nothing when no on-device voice exists. A new text stops the one before. */
    speak(text) {
      api.stop();
      if (!voice || !text) return false;
      try {
        const u = new Utt(text);
        u.voice = voice; u.lang = voice.lang; u.volume = Math.max(0, Math.min(1, +volume() || 0)); u.rate = 1; u.pitch = 1;
        u.onend = () => done(u); u.onerror = () => done(u);
        cur = u; if (audio && audio.duck) audio.duck(true); tell();
        syn.speak(u);
        return true;
      } catch (e) { cur = null; if (audio && audio.duck) audio.duck(false); tell(); return false; }
    },
    stop() {
      const u = cur; if (!u) return;
      cur = null;
      try { syn.cancel(); } catch (e) { /* nothing to stop */ }
      if (audio && audio.duck) audio.duck(false); tell();
    },
    onChange(f) { subs.add(f); return () => subs.delete(f); },
    voice: () => (voice ? { name: voice.name, lang: voice.lang } : null),
  };
  return api;
}
