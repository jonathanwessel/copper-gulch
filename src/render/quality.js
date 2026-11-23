/* Graphics quality. Profiled on a software GPU at phone size (2026-11-16): post-processing (bloom, a 4x-multisampled
   half-float target, the grade) cost about 80% of the frame, the pixel count most of the rest; lamps and shadows
   were small, and merging the static scenery halved the draw calls. So the tiers are:
     low:  pixel ratio 1 at 85% scale, drawn straight to the screen, no shadows, no antialiasing;
     med:  pixel ratio 1.5 with an FXAA edge pass, 1024 shadows (the phone default);
     high: pixel ratio up to 2, bloom and the color grade, 2048 soft shadows, lamps (the desktop default).
   The chosen tier is kept under cg-gfx. "auto" (the default) starts from the device's tier and moves along RUNGS:
   down a step when frames stay slow, up a step when they have room. A tier picked by hand stays put.
   M3 target (2026-11-17): the software GPU in tools/perf.js runs the fragment shader for every sample of a
   multisampled screen, so 4x antialiasing cost a third of a phone frame (26.8 ms with it at ratio 1.25, 18.1 ms without
   it at 1.35). Med drew a few more pixels instead.
   Sharper models (owner, 2026-11-22: a phone drew the world at under half its screen's sharpness). tools/perf.js, the
   Gulch at phone size: ratio 1.35 20.3 ms; 1.5 22.5; 1.5 with FXAA 27.7; 1.75 with FXAA 36.6; 2 without FXAA 38.8;
   2 with FXAA 45.6. Silver Falls with every town behind it: 1.35 22.7; 1.5 24.4; 1.5 with FXAA 31.8-32.7 (limit 33).
   So 1.5 with FXAA is the highest start that fits the software GPU, and Auto climbs from there on a phone whose frames
   have room (a phone's GPU fills pixels far faster than the software one, so the gate is the cautious case). */

export const TIERS = {
  low:  { ratio: 1, scale: .85, post: false, shadow: 0, aa: false, lamps: false },
  med:  { ratio: 1.5, scale: 1, post: false, shadow: 1024, aa: false, fxaa: true, lamps: false },
  high: { ratio: 2, scale: 1, post: true, shadow: 2048, aa: true, lamps: true },
};
export const ORDER = ['low', 'med', 'high'];
/* The steps Auto moves along, cheapest first: a tier and its pixel ratio (still capped by the screen's own). */
export const RUNGS = [
  { tier: 'low', ratio: 1 }, { tier: 'med', ratio: 1.5 }, { tier: 'med', ratio: 1.75 }, { tier: 'med', ratio: 2 }, { tier: 'high', ratio: 2 },
];
const TOP = RUNGS.length - 1;
const KEY = 'cg-gfx';

const phone = () => (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) || Math.min(screen.width, screen.height) < 600;
export const deviceTier = () => (phone() ? 'med' : 'high');

/* The rung a tier and ratio stand on: that tier's highest rung at or under the ratio (its lowest when none is). */
export function rungOf(tier, ratio) {
  let best = -1;
  RUNGS.forEach((r, k) => { if (r.tier === tier && (best < 0 || r.ratio <= (ratio || TIERS[tier].ratio) + 1e-6)) best = k; });
  return Math.max(0, best);
}

/* { tier, auto, ratio, ceil }: the tier to draw at, whether Auto may move it, its pixel ratio, and the highest rung
   Auto may climb to on this device (a rung it had to step down from is not tried again until the player picks Auto). */
export function loadQuality() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { /* none */ }
  if (saved && TIERS[saved.tier]) {
    const auto = saved.auto !== false;
    const ratio = auto && saved.ratio > 0 ? RUNGS[rungOf(saved.tier, saved.ratio)].ratio : TIERS[saved.tier].ratio;
    const ceil = Number.isInteger(saved.ceil) ? Math.max(0, Math.min(TOP, saved.ceil)) : TOP;
    return { tier: saved.tier, auto, ratio, ceil };
  }
  return autoQuality();
}
/* What picking Auto starts from: the device's tier at its own ratio, free to climb to the top. */
export function autoQuality() { const tier = deviceTier(); return { tier, auto: true, ratio: TIERS[tier].ratio, ceil: TOP }; }
export function saveQuality(q) { try { localStorage.setItem(KEY, JSON.stringify(q)); } catch (e) { /* private mode */ } }

/* Watches frame times in checks of 2 seconds (the median frame of each) and says when to move: 'down' when the median
   is over 40 ms (under 25 fps) for 3 checks in a row, or in the 12 seconds after a step up over 28 ms for 2 checks;
   'up' when it is at or under 20 ms (50 fps or more) for 5 checks in a row (10 seconds). It settles for 2 seconds
   at the start and after every move. */
export class FrameWatch {
  constructor({ limit = 40, fast = 20, trialLimit = 28, settle = 2 } = {}) {
    Object.assign(this, { limit, fast, trialLimit, settle }); this.reset(false);
  }
  /* Start over after a move; trial: the move was a step up, so watch the next checks more closely. */
  reset(trial) { this.times = []; this.acc = 0; this.slow = 0; this.quick = 0; this.age = 0; this.trial = trial ? 6 : 0; }
  push(dt) {
    this.age += dt;
    if (this.age < this.settle) return false;
    this.times.push(dt * 1000); this.acc += dt;
    if (this.acc < 2) return false;
    const t = this.times.slice().sort((a, b) => a - b), med = t[t.length >> 1];
    this.times = []; this.acc = 0;
    const trial = this.trial > 0; if (trial) this.trial--;
    this.slow = med > (trial ? this.trialLimit : this.limit) ? this.slow + 1 : 0;
    this.quick = med <= this.fast ? this.quick + 1 : 0;
    if (this.slow >= (trial ? 2 : 3)) { this.reset(false); return 'down'; }
    if (this.quick >= 5) { this.reset(true); return 'up'; }
    return false;
  }
}
/* Where Auto goes from rung k on a move ('up' or 'down'), and the new ceiling: a step down puts the ceiling under the
   rung it left, so a device never bounces between two rungs. null when there is nowhere to go. */
export function nextRung(k, move, ceil) {
  if (move === 'down') return k > 0 ? { rung: k - 1, ceil: k - 1 } : null;
  if (move === 'up') return k < Math.min(ceil, TOP) ? { rung: k + 1, ceil } : null;
  return null;
}
