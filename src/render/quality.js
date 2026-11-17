/* Graphics quality. Profiled on a software GPU at phone size (2026-11-16): post-processing (bloom, a 4x-multisampled
   half-float target, the grade) cost about 80% of the frame, the pixel count most of the rest; lamps and shadows
   were small, and merging the static scenery halved the draw calls. So the tiers are:
     low:  pixel ratio 1 at 85% scale, drawn straight to the screen, no shadows, no antialiasing;
     med:  pixel ratio up to 1.25, drawn straight to the screen with antialiasing, 1024 shadows (the phone default);
     high: pixel ratio up to 2, bloom and the color grade, 2048 soft shadows, lamps (the desktop default).
   The chosen tier is kept under cg-gfx. "auto" (the default) starts from the device's tier and steps down one tier
   when frames stay slow; a tier picked by hand stays put. */

export const TIERS = {
  low:  { ratio: 1, scale: .85, post: false, shadow: 0, aa: false, lamps: false },
  med:  { ratio: 1.25, scale: 1, post: false, shadow: 1024, aa: true, lamps: false },
  high: { ratio: 2, scale: 1, post: true, shadow: 2048, aa: true, lamps: true },
};
export const ORDER = ['low', 'med', 'high'];
const KEY = 'cg-gfx';

const phone = () => (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) || Math.min(screen.width, screen.height) < 600;
export const deviceTier = () => (phone() ? 'med' : 'high');

/* { tier, auto }: the tier to draw at, and whether it may step down by itself. */
export function loadQuality() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { /* none */ }
  if (saved && TIERS[saved.tier]) return { tier: saved.tier, auto: saved.auto !== false };
  return { tier: deviceTier(), auto: true };
}
export function saveQuality(q) { try { localStorage.setItem(KEY, JSON.stringify(q)); } catch (e) { /* private mode */ } }

/* Watches frame times; says when to step down: the median of the last 2 seconds of frames over 40 ms (under 25 fps)
   for 3 checks in a row. Starts watching after a short settling time. */
export class FrameWatch {
  constructor({ limit = 40, settle = 2 } = {}) { this.limit = limit; this.settle = settle; this.times = []; this.acc = 0; this.slow = 0; this.age = 0; }
  push(dt) {
    this.age += dt;
    if (this.age < this.settle) return false;
    this.times.push(dt * 1000); this.acc += dt;
    if (this.acc < 2) return false;
    const t = this.times.slice().sort((a, b) => a - b), med = t[t.length >> 1];
    this.times = []; this.acc = 0;
    this.slow = med > this.limit ? this.slow + 1 : 0;
    if (this.slow >= 3) { this.slow = 0; return true; }
    return false;
  }
}
export const lower = tier => ORDER[Math.max(0, ORDER.indexOf(tier) - 1)];
