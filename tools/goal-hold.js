// node tools/goal-hold.js [--seeds 6] [--minutes 140] [--goals g-smelter,g-tools]: how long each goal sits on the
// strip in the newcomer bot's runs (tools/firstplay.js), median and worst over the seeds, in minutes. Clarity fix 2
// (PLAN.md M6a) gates on the Smelter and the Toolsmith.
import { newcomer } from './firstplay.js';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const SEEDS = +arg('seeds', 6), MIN = +arg('minutes', 140), pick = arg('goals', '').split(',').filter(Boolean);
const med = a => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
const runs = []; for (let s = 1; s <= SEEDS; s++) runs.push(newcomer(s, MIN));
const ids = pick.length ? pick : [...new Set(runs.flatMap(r => Object.keys(r.goalHeld)))];
console.log('goal | median min | worst min | per seed');
for (const id of ids) {
  const v = runs.map(r => (r.goalHeld[id] || 0) / 60);
  console.log(`${id} | ${med(v).toFixed(1)} | ${Math.max(...v).toFixed(1)} | ${v.map(x => x.toFixed(1)).join(' ')}`);
}
console.log('Dry Creek won ' + runs.map(r => r.dcWon == null ? 'never' : (r.dcWon / 60).toFixed(1)).join(' ') + ' | Gulch wave 10 ' + runs.map(r => r.wave10 == null ? 'never' : (r.wave10 / 60).toFixed(1)).join(' ') + ' | Ridge ' + runs.map(r => r.ridgeAt == null ? 'never' : (r.ridgeAt / 60).toFixed(0)).join(' '));
