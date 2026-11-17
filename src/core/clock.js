/* Time. The simulation always moves in fixed steps of STEP seconds, whatever the frame rate, so the same inputs give
   the same result on every device. Real time is fed in and banked; whole steps are taken from the bank.
   Offline catch-up runs the time the app was closed: the first stretch step by step, the rest in big coarse chunks
   that the game handles with its steady-state (analytic) formulas. */

export const STEP = 0.25;            // seconds per simulation step
export const MAX_FRAME = 1;          // a frame never feeds more than this (a hitch or a tab in the background)
export const MAX_STEPS = 8;          // and never runs more steps than this, so a slow device cannot spiral
export const OFFLINE_FINE = 10 * 60; // the first 10 minutes away are stepped normally
export const OFFLINE_MAX = 24 * 3600; // at most a day is caught up

export class Clock {
  constructor(state = {}) {
    this.t = state.t || 0;      // simulated seconds since the game began
    this.bank = state.bank || 0; // real seconds not yet stepped
    this.speed = state.speed || 1;
  }
  toJSON() { return { t: this.t, bank: this.bank, speed: this.speed }; }
  /* Feed real seconds; calls step(STEP) for each whole step and returns how many ran. */
  advance(realSeconds, step) {
    this.bank += Math.min(MAX_FRAME, Math.max(0, realSeconds)) * this.speed;
    let n = 0;
    while (this.bank >= STEP - 1e-9 && n < MAX_STEPS) { this.bank -= STEP; this.t += STEP; step(STEP); n++; }
    if (n === MAX_STEPS) this.bank = Math.min(this.bank, STEP); // drop what a slow frame could not run
    return n;
  }
  /* Catch up `seconds` of time away. Fine steps first (step(STEP)), then coarse chunks (coarse(dt), each at most
     `chunk` seconds). Returns { fine, coarse, seconds } for the welcome-back report. */
  catchUp(seconds, step, coarse, chunk = 60) {
    const total = Math.min(OFFLINE_MAX, Math.max(0, seconds));
    const fineSec = Math.min(total, OFFLINE_FINE);
    let fine = 0, chunks = 0;
    for (let s = 0; s + STEP <= fineSec + 1e-9; s += STEP) { this.t += STEP; step(STEP); fine++; }
    let rest = total - fine * STEP;
    while (rest > 1e-9) { const dt = Math.min(chunk, rest); this.t += dt; coarse(dt); rest -= dt; chunks++; }
    return { fine, coarse: chunks, seconds: total };
  }
}
