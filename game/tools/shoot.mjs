// Screenshot helper: node tools/shoot.mjs out.png "query-string" [waitFrames] [width] [height]
import { createRequire } from 'node:module';
import path from 'node:path';
import { serve } from './serve.mjs';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require(path.join(process.env.NODE_PATH ?? '/opt/node22/lib/node_modules', 'playwright')));
}

const [out, qs = '', waitFrames = '40', w = '1280', h = '720'] = process.argv.slice(2);
const srv = await serve(path.resolve('dist'));
const port = srv.address().port;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(`http://127.0.0.1:${port}/?${qs}`);
await page.waitForFunction(() => window.__mc && window.__mc.timings.interactive, null, { timeout: 120000 });
await page.waitForFunction((n) => window.__mc.metrics.total >= n, Number(waitFrames), { timeout: 240000 }).catch(() => {});
await page.screenshot({ path: out });
const info = await page.evaluate(() => ({ t: window.__mc.timings, frames: window.__mc.metrics.total, leon: { x: window.__mc.sim().leon.x, y: window.__mc.sim().leon.y, mode: window.__mc.sim().leon.mode } }));
console.log(JSON.stringify({ out, errors, ...info }));
await browser.close();
srv.close();
