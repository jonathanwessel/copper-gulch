/* Start a view at the saved (or the device's) quality, and let Auto move it along RUNGS (src/render/quality.js): down a
   step when frames stay slow, up a step when they have room, never back onto a rung it had to leave. Returns a function
   to call every frame with the frame's seconds. */
import { loadQuality, saveQuality, FrameWatch, RUNGS, rungOf, nextRung } from './quality.js';

export function startQuality() { return loadQuality(); }
export function autoStep(view, q) {
  const watch = new FrameWatch();
  return dt => {
    if (!q.auto) return;
    const move = watch.push(dt);
    if (!move) return;
    const go = nextRung(rungOf(view.tier, view.ratio), move, q.ceil);
    if (!go) return;
    const r = RUNGS[go.rung];
    view.setQuality(r.tier, r.ratio); Object.assign(q, { tier: r.tier, ratio: r.ratio, ceil: go.ceil }); saveQuality(q);
    console.info('Graphics stepped ' + move + ' to ' + r.tier + ' at ratio ' + r.ratio + '.');
  };
}
