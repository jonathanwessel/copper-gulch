// node tools/card-probe.js [--seeds 6] [--minutes 12]: the tip cards a newcomer sees early, on the core alone
// (clarity fix 7, review 7: 18 cards in the first 5 minutes). Prints each seed's cards with their times, the count
// before 5:00, the shortest gap between two cards in the first 10 minutes, and any card shown twice.
import { record } from './playthrough.js';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? +process.argv[i + 1] : d; };
const SEEDS = arg('seeds', 6), MINUTES = arg('minutes', 12);
const mm = x => { const s = Math.round(x); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

/* The cards of one newcomer run: [{ at, id }], in order. */
export function cardsOf(moments) {
  return moments.flatMap(m => m.cards || []);
}
export function cardStats(cards) {
  const early = cards.filter(c => c.at < 300).length, ten = cards.filter(c => c.at < 600);
  let gap = Infinity; for (let i = 1; i < ten.length; i++) gap = Math.min(gap, ten[i].at - ten[i - 1].at);
  const seen = {}, twice = []; for (const c of cards) { if (seen[c.id]) twice.push(c.id); seen[c.id] = 1; }
  return { early, gap: ten.length > 1 ? gap : null, twice };
}

if (process.argv[1] && process.argv[1].split(String.fromCharCode(92)).join('/').endsWith('tools/card-probe.js')) {
  let bad = 0;
  for (let s = 1; s <= SEEDS; s++) {
    const { moments } = record(s, MINUTES), cards = cardsOf(moments), st = cardStats(cards);
    console.log(`seed ${s}: ${st.early} cards before 5:00, shortest gap in 10 min ${st.gap === null ? '-' : st.gap.toFixed(1) + ' s'}${st.twice.length ? ', twice ' + st.twice.join(' ') : ''}`);
    console.log('  ' + cards.filter(c => c.at < 600).map(c => mm(c.at) + ' ' + c.id).join(', '));
    if (st.early > 8 || st.twice.length) bad++;
  }
  console.log(bad ? `card-probe: ${bad} seeds over` : 'card-probe ok');
}
