// Photo session: load the game once, then take many shots from a JSON script.
//   node tools/photo.mjs <outDir> <shots.json> [query] [width] [height]
// shots.json: [{ name, leon?: [x, y, facing], guard?: [x, y, facing], follow?: [dx, dy, z, fov, lookY], target?: 'leon'|'mm',
//               cam?: [px, py, pz, tx, ty, tz, fov], wait?: frames, eval?: "js expression run in the page",
//               keys?: ['ArrowRight', 'ShiftLeft'] held during the wait, untilEval?: "js condition to wait for instead of frames" }]
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { serve } from './serve.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.NODE_PATH ?? '/opt/node22/lib/node_modules', 'playwright'));
const [outDir, script, qs = 'autostart=1&nointro=1&hud=0&q=high', w = '1280', h = '720'] = process.argv.slice(2);
const shots = JSON.parse(fs.readFileSync(script, 'utf8'));
fs.mkdirSync(outDir, { recursive: true });
const srv = await serve(path.resolve('dist'));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(`http://127.0.0.1:${srv.address().port}/?${qs}`);
await page.waitForFunction(() => window.__mc && window.__mc.timings.interactive, null, { timeout: 120000 });
for (const s of shots) {
  await page.evaluate((s) => {
    const mc = window.__mc;
    const sim = mc.sim();
    if (s.leon) Object.assign(sim.leon, { x: s.leon[0], y: s.leon[1], vx: 0, vy: 0, facing: s.leon[2] ?? 1 });
    if (s.guard) Object.assign(sim.guard, { x: s.guard[0], y: s.guard[1], facing: s.guard[2] ?? -1 });
    mc.photo.follow = s.follow ?? null;
    mc.photo.cam = s.cam ?? null;
    mc.photo.target = s.target ?? 'leon';
    if (s.eval) (0, eval)(s.eval);
  }, s);
  for (const k of s.keys ?? []) await page.keyboard.down(k);
  if (s.untilEval) await page.waitForFunction(s.untilEval, null, { timeout: 180000, polling: 50 }).catch(() => process.stdout.write('(until timeout) '));
  const n0 = await page.evaluate(() => window.__mc.metrics.total);
  await page.waitForFunction((n) => window.__mc.metrics.total >= n, n0 + (s.wait ?? 12), { timeout: 180000 });
  if (s.holdKeys !== true) for (const k of s.keys ?? []) await page.keyboard.up(k);
  await page.screenshot({ path: path.join(outDir, `${s.name}.png`) });
  process.stdout.write(`${s.name} `);
}
console.log(JSON.stringify({ errors }));
await browser.close();
srv.close();
