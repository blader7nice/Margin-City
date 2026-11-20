// End-to-end UI test of Terminal B-12 in a real browser: journal → order → reveal → review → recording → story complete.
// node tools/e2e_terminal.mjs [outPrefix]
import { createRequire } from 'node:module';
import path from 'node:path';
import { serve } from './serve.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.NODE_PATH ?? '/opt/node22/lib/node_modules', 'playwright'));
const prefix = process.argv[2] ?? 'measurements/term';
const srv = await serve(path.resolve('dist'));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const fail = (m) => {
  console.log(JSON.stringify({ ok: false, step: m, errors }));
  process.exit(1);
};
await page.goto(`http://127.0.0.1:${srv.address().port}/?terminal=1&nointro=1&q=low`);
await page.waitForSelector('#b12.open', { timeout: 120000 }).catch(() => fail('terminal did not open'));
await page.screenshot({ path: `${prefix}_1_journal.png` });
await page.click('[data-a=toTicket]');
await page.click('[data-th=capitulation_reversal]');
await page.click('[data-sd=long]');
await page.fill('[data-in=size]', '20');
await page.dispatchEvent('[data-in=size]', 'input');
await page.click('[data-a=stopWick]');
await page.check('[data-in=useTp]');
await page.mouse.move(520, 360);
await page.screenshot({ path: `${prefix}_2_ticket.png` });
const before = await page.evaluate(() => document.querySelectorAll('#b12 .kv span').length);
if (before < 6) fail('ticket preview missing');
await page.click('[data-a=submit]');
await page.waitForTimeout(1500);
await page.screenshot({ path: `${prefix}_3_reveal.png` });
await page.click('[data-a=end]');
await page.waitForSelector('#b12 .overlay:not([hidden]) .grade', { timeout: 20000 }).catch(() => fail('no review'));
await page.screenshot({ path: `${prefix}_4_review.png` });
const review = await page.evaluate(() => ({ grade: document.querySelector('#b12 .grade .big')?.textContent, replay: window.__replay }));
await page.click('[data-a=rec]');
await page.waitForTimeout(600);
await page.screenshot({ path: `${prefix}_5_recording.png` });
for (let i = 0; i < 7; i++) {
  const btn = await page.$('#b12 .rec [data-a=next]');
  if (!btn) break;
  await btn.click();
  await page.waitForTimeout(150);
}
await page.waitForFunction(() => window.__mc.sim().finished === true, null, { timeout: 10000 }).catch(() => fail('story did not complete'));
const closed = await page.evaluate(() => !document.querySelector('#b12').classList.contains('open'));
console.log(JSON.stringify({ ok: errors.length === 0 && closed, review, terminalClosed: closed, storyComplete: true, errors }));
await browser.close();
srv.close();
