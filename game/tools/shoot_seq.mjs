// Sequence of screenshots during a run: node tools/shoot_seq.mjs prefix "query" count intervalFrames
import { createRequire } from 'node:module';
import path from 'node:path';
import { serve } from './serve.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.NODE_PATH ?? '/opt/node22/lib/node_modules', 'playwright'));
const [prefix, qs, count = '6', every = '3', w = '960', h = '540'] = process.argv.slice(2);
const srv = await serve(path.resolve('dist'));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`http://127.0.0.1:${srv.address().port}/?${qs}`);
await page.waitForFunction(() => window.__mc && window.__mc.timings.interactive, null, { timeout: 120000 });
for (let i = 0; i < Number(count); i++) {
  const n0 = await page.evaluate(() => window.__mc.metrics.total);
  await page.waitForFunction((n) => window.__mc.metrics.total >= n, n0 + Number(every), { timeout: 120000 });
  await page.screenshot({ path: `${prefix}_${i}.png` });
}
console.log(JSON.stringify({ errors }));
await browser.close();
srv.close();
