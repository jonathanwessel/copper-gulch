/* Which tip card shows next (clarity fix 7, review 7: 18 cards in the first 5 minutes, some a second apart).
   One function for the coach (src/ui/coach.js) and the tools (tools/playthrough.js, tools/card-probe.js), so the
   game and the bots space the cards the same way.
   - Of the cards due, one marked `now` (it is about what the player has to do right now: the first tower, Call now,
     a new building, the boss) goes before a tip.
   - A card waits until CARD_GAP seconds of play have passed since the last one, so two never come back to back
     (at minute 10 the held tips came a second apart, and the Gulch opened with ten cards in a minute).
   - In a town's own first CARD_EARLY seconds (h.t), a tip waits TIP_GAP, so a new place teaches a little at a time.
   `last` is the play time the last card showed (null when none has shown since the game loaded). */
export const CARD_EARLY = 600, CARD_GAP = 20, TIP_GAP = 60;

/* Play time in seconds: the game's own clock, which stops while paused or a card is open. */
export const playTime = game => (game && game.stats ? game.stats.steps * .25 : 0);

export function cardDue(list, h, seen, play, last = null) {
  const due = list.filter(e => !seen[e.id] && (!e.town || e.town === h.id) && e.when(h));
  if (!due.length) return null;
  // `now` is true or a rank (1 goes first); the rest keep the list's order
  const rank = e => (e.now === true ? 2 : e.now || 9);
  const pick = due.reduce((a, b) => (rank(b) < rank(a) ? b : a));
  const gap = pick.now || (h.t || 0) >= CARD_EARLY ? CARD_GAP : TIP_GAP;
  if (last !== null && play - last < gap) return null;
  return pick;
}
