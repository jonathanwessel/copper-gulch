/* Where the raiders' health bars go (src/render/battle.js drawBars), pure, so the tests can run it without three.js. */
/* Two health bars that would touch on screen are stacked: the nearer one rises over the farther by its height and this
   gap (in a raider's size), easing there so it never hops (clarity fix 8y: two pirates side by side read as one long
   bar). */
export const BAR_GAP = .05;
/* A crowd (raiders bunched out of an entrance) stacks at most this many bars high, so no tower of bars rises over it. */
export const BAR_STACK = 3;
/* How far a bar at screen-plane x, y (width w, height h) must rise along the screen's up to clear the bars placed
   before it this frame, 0..n-1 of px, py, pw, ph. */
export function barLift(x, y, w, h, n, px, py, pw, ph) {
  let lift = 0;
  const most = (BAR_STACK - 1) * (h + BAR_GAP) * 1.5;
  for (let pass = 0, moved = true; moved && pass < 6; pass++) {
    moved = false;
    for (let j = 0; j < n; j++) {
      const yy = y + lift;
      if (Math.abs(x - px[j]) < (w + pw[j]) / 2 + BAR_GAP && Math.abs(yy - py[j]) < (h + ph[j]) / 2 + BAR_GAP) { lift = py[j] + (ph[j] + h) / 2 + BAR_GAP - y; moved = true; }
    }
  }
  return Math.min(lift, most);
}

/* Clarity fix 8aa: lifted bars beside each other made a stair up and to the side, and which bar was whose was unclear
   (fresh-eyes read of 2026.11.27-8, mesa-pirate-low). Bars that sit side by side now narrow, each over its own raider,
   down to this share of their width; only bars nearer than that (raiders almost on top of each other) still rise. */
export const BAR_NARROW = .3; // .45 at first: crew bunched by an airship still stacked in a stair (fresh-eyes read of 2026.11.28-1's shots)
/* Every bar's place, far ones first: bars is a list of [x, y, w, h] in the screen plane; out (reused) gets
   { s, lift } for each, the share of its width it keeps and how far it rises. */
export function barPlan(bars, out = []) {
  const n = bars.length;
  out.length = n;
  for (let i = 0; i < n; i++) out[i] = out[i] || { s: 1, lift: 0 }, out[i].s = 1, out[i].lift = 0;
  // two bars in one band of height that would touch narrow together until they clear, never under BAR_NARROW
  for (let i = 0; i < n; i++) {
    const [x, y, w, h] = bars[i];
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const [x2, y2, w2, h2] = bars[j];
      if (Math.abs(y - y2) >= (h + h2) / 2 + BAR_GAP) continue;
      const dx = Math.abs(x - x2), fit = 2 * (dx - BAR_GAP) / (w + w2) * .999;
      if (fit >= 1) continue;
      if (fit >= BAR_NARROW) out[i].s = Math.min(out[i].s, fit);
    }
  }
  // the rest (too close to narrow) rise over the bars placed before them, with their narrowed widths
  const px = [], py = [], pw = [], ph = [];
  for (let i = 0; i < n; i++) {
    const [x, y, w, h] = bars[i], ww = w * out[i].s;
    out[i].lift = barLift(x, y, ww, h, i, px, py, pw, ph);
    px.push(x); py.push(y + out[i].lift); pw.push(ww); ph.push(h);
  }
  return out;
}
