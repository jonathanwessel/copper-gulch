/* Start a view at the saved (or the device's) quality tier, and step down a tier when frames stay slow, if the tier
   is on "auto". Returns a function to call every frame with the frame's seconds. */
import { loadQuality, saveQuality, FrameWatch, lower } from './quality.js';

export function startQuality() { return loadQuality(); }
export function autoStep(view, q) {
  const watch = new FrameWatch();
  return dt => {
    if (!q.auto || view.tier === 'low' || !watch.push(dt)) return;
    const next = lower(view.tier);
    view.setQuality(next); q.tier = next; saveQuality(q);
    console.info('Graphics stepped down to ' + next + ' to keep the frame rate up.');
  };
}
