/* The event bus: the core announces what happened (a building leveled, a wave started, the vault fell) and the
   interface, sound and effects listen. Handlers run in the order they were added. The core never waits on them. */
export class Bus {
  constructor() { this.subs = new Map(); this.log = null; }
  /* Listen; returns a function that stops listening. Use '*' to hear every event as (name, data). */
  on(name, fn) {
    if (!this.subs.has(name)) this.subs.set(name, []);
    this.subs.get(name).push(fn);
    return () => this.off(name, fn);
  }
  once(name, fn) { const off = this.on(name, (...a) => { off(); fn(...a); }); return off; }
  off(name, fn) { const l = this.subs.get(name); if (l) { const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); } }
  emit(name, data) {
    if (this.log) this.log.push([name, data]);
    for (const fn of (this.subs.get(name) || []).slice()) fn(data);
    for (const fn of (this.subs.get('*') || []).slice()) fn(name, data);
  }
  /* Record every event into an array (tests and bots read it). */
  record() { this.log = []; return this.log; }
}
