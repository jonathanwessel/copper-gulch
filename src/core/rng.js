/* Seeded random numbers. Every town owns its own stream, so one town's luck never shifts another's, and a game that
   is replayed from the same seed and inputs comes out the same. The generator is sfc32: small, fast, and its whole
   state is four 32-bit numbers that go into the save. */

/* Hash a string (or number) into a 32-bit seed. */
export function hashSeed(x) {
  const s = String(x);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  // a final avalanche so similar names give unrelated seeds
  h ^= h >>> 16; h = Math.imul(h, 2246822507) >>> 0; h ^= h >>> 13; h = Math.imul(h, 3266489909) >>> 0; h ^= h >>> 16;
  return h >>> 0;
}

export class Rng {
  /* seed: any string or number; or pass a saved state ([a, b, c, d]) with Rng.from(). */
  constructor(seed = 1) {
    const h = hashSeed(seed);
    this.s = [h, hashSeed(h + ':b'), hashSeed(h + ':c'), 1];
    for (let i = 0; i < 12; i++) this.u32(); // warm up
  }
  static from(state) { const r = new Rng(0); r.s = state.slice(0, 4).map(v => v >>> 0); return r; }
  get state() { return this.s.slice(); }
  /* A raw 32-bit unsigned integer. */
  u32() {
    let [a, b, c, d] = this.s;
    const t = (((a + b) >>> 0) + d) >>> 0;
    d = (d + 1) >>> 0; a = b ^ (b >>> 9); b = (c + (c << 3)) >>> 0; c = ((c << 21) | (c >>> 11)) >>> 0; c = (c + t) >>> 0;
    this.s = [a >>> 0, b, c, d];
    return t;
  }
  /* A float in [0, 1). */
  next() { return this.u32() / 4294967296; }
  /* A float in [a, b). */
  range(a, b) { return a + (b - a) * this.next(); }
  /* An integer in [0, n). */
  int(n) { return Math.floor(this.next() * n); }
  /* True with probability p. */
  chance(p) { return this.next() < p; }
  pick(list) { return list[this.int(list.length)]; }
  /* Pick a key of {key: weight} in proportion to its weight. */
  weighted(table) {
    const keys = Object.keys(table), total = keys.reduce((s, k) => s + Math.max(0, table[k]), 0);
    let x = this.next() * total;
    for (const k of keys) { x -= Math.max(0, table[k]); if (x < 0) return k; }
    return keys[keys.length - 1];
  }
  /* A new independent stream named after this one, e.g. rng.fork('waves'). Does not move this stream. */
  fork(name) { return new Rng(this.s.join(',') + '/' + name); }
}
