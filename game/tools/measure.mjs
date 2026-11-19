// Measurement harness (headless Chromium). Usage: node tools/measure.mjs [outfile.json]
// NOTE: headless Chromium here renders with SwiftShader (CPU). Load/size/memory numbers are meaningful;
// FPS/frame times are NOT representative of a real GPU — run ?bench=1 on target hardware for those.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { serve } from './serve.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.NODE_PATH ?? '/opt/node22/lib/node_modules', 'playwright'));
const out = process.argv[2] ?? 'measurements/report.json';

const dist = path.resolve('dist');
const files = [];
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : files.push(path.join(d, e.name))));
walk(dist);
const size = (f) => fs.statSync(f).size;
const zlib = await import('node:zlib');
const gz = (f) => zlib.gzipSync(fs.readFileSync(f), { level: 9 }).length;
const br = (f) => zlib.brotliCompressSync(fs.readFileSync(f)).length;
const js = files.filter((f) => f.endsWith('.js'));
const tex = files.filter((f) => f.includes(`${path.sep}tex${path.sep}`));
const build = {
  jsRawKB: +(js.reduce((a, f) => a + size(f), 0) / 1024).toFixed(1),
  jsGzipKB: +(js.reduce((a, f) => a + gz(f), 0) / 1024).toFixed(1),
  jsBrotliKB: +(js.reduce((a, f) => a + br(f), 0) / 1024).toFixed(1),
  htmlKB: +(size(path.join(dist, 'index.html')) / 1024).toFixed(1),
  texturesKB: +(tex.reduce((a, f) => a + size(f), 0) / 1024).toFixed(1),
  textureFiles: tex.length,
};

const srv = await serve(dist);
const base = `http://127.0.0.1:${srv.address().port}/`;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

async function load(page, url) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const t0 = Date.now();
  await page.goto(url);
  await page.waitForFunction(() => window.__mc && window.__mc.timings.interactive, null, { timeout: 180000 });
  const wall = Date.now() - t0;
  const r = await page.evaluate(() => {
    const res = performance.getEntriesByType('resource');
    const nav = performance.getEntriesByType('navigation')[0];
    const sum = (f) => res.filter(f).reduce((a, x) => a + (x.transferSize || 0), 0);
    return {
      tti: Math.round(window.__mc.timings.interactive),
      firstFrame: Math.round(window.__mc.timings.firstFrame),
      assetsLoaded: Math.round(window.__mc.timings.assetsLoaded),
      sceneBuilt: Math.round(window.__mc.timings.sceneBuilt),
      transfer: { html: nav.transferSize, js: sum((x) => x.name.endsWith('.js')), textures: sum((x) => x.name.includes('/tex/')) },
      gpuTextureEstimateMB: window.__mc.gpuTextureEstimateMB,
      webgl2: window.__mc.isWebGL2,
      gpu: (() => { const gl = window.__mc.renderer.getContext(); const e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'n/a'; })(),
    };
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  const m = await cdp.send('Performance.getMetrics');
  const metric = (n) => m.metrics.find((x) => x.name === n)?.value ?? 0;
  r.jsHeapUsedMB = +(metric('JSHeapUsedSize') / 1048576).toFixed(1);
  r.wallMs = wall;
  r.errors = errors;
  return r;
}

const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const cold = await load(page, `${base}?q=medium`);
const warm = await load(page, `${base}?q=medium`); // same context → HTTP cache
await ctx.close();

// Full-route benchmark with autopilot (godMode). Small viewport to keep SwiftShader time reasonable.
const bctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
const bpage = await bctx.newPage();
const berr = [];
bpage.on('pageerror', (e) => berr.push(String(e)));
await bpage.goto(`${base}?bench=1&q=low`);
await bpage.waitForFunction(() => window.__bench, null, { timeout: 900000, polling: 2000 });
const benchReport = await bpage.evaluate(() => window.__bench);
await bpage.screenshot({ path: 'measurements/bench_end.png' });
await bctx.close();
await browser.close();
srv.close();

const report = { date: new Date().toISOString(), environment: 'headless Chromium + SwiftShader (CPU rendering) — frame times NOT representative of GPU hardware', build, coldLoad: cold, warmLoad: warm, benchLowQuality: { ...benchReport, errors: berr } };
fs.writeFileSync(out, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
