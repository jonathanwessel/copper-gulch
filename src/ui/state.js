/* A town's wave state in words and a small pixel mark, the same in every town and outpost (owner, 2026-11-20: "In map
   view it's hard to see the status of the waves in each city"). The map labels show the mark, a short fixed-width word
   and a thin bar; the town's map card says it in a sentence. The state comes from siteState (src/core/map.js).
   Words follow the writing rule in PLAN.md. */

/* "0:24", "2:00": minutes and seconds, at most 4 characters (a break past 10 minutes shows 9:59; breaks are a few minutes). */
export function clock(secs) {
  const s = Math.min(9 * 60 + 59, Math.max(0, Math.ceil(secs || 0)));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}
/* "24 sec", "2 min", "1 min 30 sec": a time in words for a card. */
export function timeWords(secs) {
  const s = Math.max(0, Math.ceil(secs || 0));
  if (s < 60) return s + ' sec';
  const m = Math.floor(s / 60), r = s % 60;
  return m + ' min' + (r ? ' ' + r + ' sec' : '');
}
const raiders = n => n + (n === 1 ? ' raider' : ' raiders');

/* The label's word, at most 12 characters so it fits its fixed cell: Fighting, Wave in 0:24, On hold, Retry soon (Keep
   trying the boss waits for Auto-towers), Raid in 1:56, No towers (review of 2026.11.20-18: "Raids 1:56" read as a
   score, and one "On hold" meant both "go there" and "it tries again by itself"). */
export function stateWord(s) {
  if (!s) return '';
  if (s.state === 'fight') return 'Fighting';
  if (s.state === 'hold') return s.retry ? 'Retry soon' : 'On hold';
  if (s.state === 'wait') return 'No towers';
  return (s.state === 'raids' ? 'Raid in ' : 'Wave in ') + clock(s.timer); // a noun, like Raid in (clarity fix 8a: "Next in 0:43" named nothing)
}
/* The mark beside the word: swords for a fight, a clock for a countdown, a pause sign for a hold (red when the player
   must go there), a flag for a won outpost's raids. */
export const stateMark = s => (!s ? null : s.state === 'fight' ? 'swords' : s.state === 'hold' ? 'pause' : s.state === 'raids' ? 'flag' : 'clock');
/* Red: the town needs the player (needsYou in src/core/map.js: its waves hold after a loss or by the player with no
   goal saving there, or wait for a tower). A hold that saves for the next town is On hold in the plain color. */
export const stateNeeds = s => !!s && (s.state === 'hold' || s.state === 'wait') && !!s.needs;

/* The thin bar under a label, 0 to 1: raiders beaten in a fight, or the time gone in a countdown of span seconds.
   null for a hold or a wait, where the bar is empty. */
export function stateBar(s, span) {
  if (!s) return null;
  if (s.state === 'fight') return s.size > 0 ? Math.max(0, Math.min(1, 1 - s.left / s.size)) : 0;
  if (s.state === 'next' || s.state === 'raids') return span > 0 ? Math.max(0, Math.min(1, 1 - s.timer / span)) : 0;
  return null;
}

/* A won outpost's first line on its map card and wave card (clarity fix 8d: "and your towers hold them" read as a narrator). */
export const WON_LINE = 'Won. Small raids still come here.';
/* The map card's sentences: what the waves do now, with the wave number (the card shows it nowhere else). A loss has
   its own line on the card (src/ui/lost.js) that says why and what to tap, so a hold after a loss adds nothing here. A won outpost says its raids keep coming. */
export function stateLines(s, { lost = false } = {}) {
  if (!s) return [];
  const out = [];
  if (s.won) out.push(WON_LINE); // the next line gives the time (fresh-eyes read of 2026.11.24-11: the timing twice)
  if (s.state === 'fight') out.push(s.won ? 'A raid is on now, ' + raiders(s.left) + ' left.' : 'Fighting wave ' + s.wave + ', ' + raiders(s.left) + ' left.');
  else if (s.state === 'next') out.push('Wave ' + s.wave + ' comes in ' + clock(s.timer) + '.'); // the label's clock, one format for one timer (clarity fix 8a)
  else if (s.state === 'raids') out.push('Next raid in ' + clock(s.timer) + '.');
  else if (s.state === 'wait') out.push('Wave ' + s.wave + ' waits until you build a tower here.');
  else if (s.state === 'hold' && !lost) out.push('Wave ' + s.wave + ' is on hold. Tap Play, then tap Resume waves.'); // the card has Play, the town has Resume waves (clarity fix 8a)
  return out;
}

// the marks, 7 by 7 pixels each
const PIX = {
  swords: ['#.....#', '.#...#.', '..#.#..', '...#...', '..#.#..', '##...##', '##...##'],
  clock: ['.#####.', '#..#..#', '#..#..#', '#..##.#', '#.....#', '#.....#', '.#####.'],
  pause: ['.##.##.', '.##.##.', '.##.##.', '.##.##.', '.##.##.', '.##.##.', '.##.##.'],
  flag: ['#####..', '######.', '#####..', '#......', '#......', '#......', '#......'],
};
const PATHS = Object.fromEntries(Object.entries(PIX).map(([k, rows]) => [k, rows.map((row, y) => [...row].map((c, x) => (c === '#' ? `M${x} ${y}h1v1h-1z` : '')).join('')).join('')]));
/* An <i> holding the mark's svg; setMark swaps it in place. */
export function markEl(cls = 'smark') {
  const i = document.createElement('i'); i.className = cls; i.setAttribute('aria-hidden', 'true');
  i.innerHTML = '<svg viewBox="0 0 7 7" shape-rendering="crispEdges"><path d=""/></svg>';
  return i;
}
export function setMark(i, mark) {
  if (i.dataset.mark === (mark || '')) return;
  i.dataset.mark = mark || ''; i.querySelector('path').setAttribute('d', mark ? PATHS[mark] : '');
}
