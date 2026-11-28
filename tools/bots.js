// node tools/bots.js <dir> [balance firstplay idle climb-probe]: runs the release bots side by side, each into <dir>/<name>.txt,
// and prints one line per bot with its last verdict line and exit code. Exits 1 when any bot fails.
// (2026.11.21-8: a hand-written shell line put two of three bots in the background with no output folder, and the run
// waited ten minutes for files that were never written. How the task works, step 6, starts the bots with this.)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { root } from './serve.js';

const [dir, ...pick] = process.argv.slice(2);
if (!dir) { console.error('usage: node tools/bots.js <dir> [balance firstplay idle]'); process.exit(2); }
fs.mkdirSync(dir, { recursive: true });
const names = pick.length ? pick : ['balance', 'firstplay', 'idle', 'climb-probe', 'strategy-empire', 'mesa-road', 'mesa-newcomer'];
/* A bot that reads what another writes starts once that one ends (2026.11.27-9: mesa-newcomer reads the Falls-era
   games mesa-road keeps in .checks/mesa-snap-N.json, and started beside it, so it judged the last run's build). */
const AFTER = { 'mesa-newcomer': 'mesa-road' };
const started = {};
const run1 = name => new Promise(done => {
  const file = path.join(dir, name + '.txt'), out = fs.openSync(file, 'w'), t0 = Date.now();
  const p = spawn(process.execPath, [path.join(root, 'tools', name + '.js')], { cwd: root, stdio: ['ignore', out, out] });
  p.on('exit', code => {
    fs.closeSync(out);
    const lines = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/), verdict = lines.filter(l => /^(ok|FAIL)/.test(l));
    done({ name, code, min: ((Date.now() - t0) / 60000).toFixed(1), verdict: verdict.length ? verdict.join(' | ') : lines[lines.length - 1] });
  });
});
const runs = [];
for (const name of names) {
  const dep = AFTER[name] && names.includes(AFTER[name]) ? started[AFTER[name]] : null;
  started[name] = dep ? dep.then(() => run1(name)) : run1(name);
  runs.push(started[name]);
}
const res = await Promise.all(runs);
for (const r of res) console.log(`${r.name}: exit ${r.code} in ${r.min} min | ${r.verdict}`);
process.exitCode = res.some(r => r.code) ? 1 : 0;
