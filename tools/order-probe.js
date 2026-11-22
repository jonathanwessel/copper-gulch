// node tools/order-probe.js <seed> [--noorders]: one active empire run (the Capital and Silver Falls) for town orders,
// to compare with orders off on the same seed before anything is tuned (PLAN.md, a new system is probed on and off).
// Prints the orders the bot took and what came of them, and the times the pacing targets check.
import { empire } from './balance.js';
const seed = +process.argv[2] || 1, t0 = Date.now();
const e = empire(seed, 'active', { capital: true, falls: true });
const h = v => v == null ? 'never' : (v / 3600).toFixed(2) + ' h', m = v => v == null ? 'never' : (v / 60).toFixed(1) + ' min';
const b = e.game.botOrders || {};
console.log(JSON.stringify({ seed, orders: !process.argv.includes('--noorders'), ridgeW10: m(e.ridge && e.ridge.w10), capital: h(e.capital), treeGap: e.tree && e.tree.gap ? m(e.tree.gap) : null, fallsFound: h(e.fallsFound), fallsW10: m(e.falls && e.falls.w10), took: b.took, filled: b.filled, rush: b.rush, missed: b.missed, coins: b.coins, top: b.top, secs: Math.round((Date.now() - t0) / 1000) }));
