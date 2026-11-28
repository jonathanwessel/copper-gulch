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
