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
const ctx = await browser.newContext({ viewport: { width: 1440, height: 810 }, permissions: ['clipboard-read', 'clipboard-write'] });
const page = await ctx.newPage();
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
await page.click('[data-a=stopWick]');
await page.click('[data-sm=capital]');
await page.fill('[data-in=size]', '20');
await page.dispatchEvent('[data-in=size]', 'input');
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
// Chronology: Dave's recording plays once; the in-world terminal now opens the training simulator.
await page.evaluate(() => window.__openTerminal());
await page.waitForSelector('#b12.open');
const reopened = await page.evaluate(() => ({ mode: document.querySelector('#b12 [data-k=mode]').textContent, journal: !!document.querySelector('#b12 .journal') }));
if (reopened.mode !== 'TRENING' || reopened.journal) fail('story replayed after completion: ' + JSON.stringify(reopened));
await page.keyboard.press('Escape');
// End card + playtest panel: ratings, local save, copy report.
await page.waitForSelector('#playtest .pt-r', { state: 'visible', timeout: 30000 }).catch(() => fail('no playtest panel on the end card'));
await page.click('#playtest .pt-r[data-q=tension] button[data-v="4"]');
await page.click('#playtest .pt-r[data-q=terminal] button[data-v="5"]');
await page.fill('#ptNotes', 'e2e');
await page.click('#ptCopy');
await page.waitForTimeout(300);
await page.screenshot({ path: `${prefix}_6_endcard.png` });
const pt = await page.evaluate(async () => {
  const stored = JSON.parse(localStorage.getItem('mc.playtests.v1') ?? '[]');
  let clip = '';
  try {
    clip = await navigator.clipboard.readText();
  } catch {}
  return { stored: stored.length, ratings: stored.at(-1)?.ratings, terminal: !!stored.at(-1)?.terminal?.decision, finished: stored.at(-1)?.finished, notes: stored.at(-1)?.notes, clipOk: clip.startsWith('MARGIN CITY playtest'), msg: document.querySelector('#ptMsg')?.textContent };
});
const ptOk = pt.stored >= 1 && pt.ratings?.tension === 4 && pt.ratings?.terminal === 5 && pt.terminal && pt.finished && pt.notes === 'e2e' && pt.clipOk;
// Training simulator straight from the menu URL (outside the story).
const tp = await ctx.newPage();
tp.on('pageerror', (e) => errors.push(String(e)));
await tp.goto(`http://127.0.0.1:${srv.address().port}/?replay=panic-6637&q=low`);
await tp.waitForSelector('#b12.open', { timeout: 120000 }).catch(() => fail('training did not open'));
const sid = await tp.evaluate(() => document.querySelector('#b12 [data-k=sid]').textContent);
await tp.click('[data-th=no_edge]');
await tp.click('[data-sd=skip]');
await tp.click('[data-a=submit]');
await tp.click('[data-a=end]');
await tp.waitForSelector('#b12 .overlay:not([hidden]) .grade', { timeout: 20000 }).catch(() => fail('no training review'));
const tr = await tp.evaluate(() => ({ cards: document.querySelectorAll('#b12 .overlay:not([hidden]) .card').length, rec: !!document.querySelector('#b12 [data-a=rec]'), grade: document.querySelector('#b12 .grade .big').textContent, hist: JSON.parse(localStorage.getItem('mc.b12.history.v1') ?? '[]').length }));
await tp.screenshot({ path: `${prefix}_7_training_review.png` });
await tp.click('[data-a=lib2]');
await tp.waitForSelector('#b12 .overlay.lib:not([hidden]) [data-fam]');
await tp.screenshot({ path: `${prefix}_8_library.png` });
await tp.click('[data-a=random]');
await tp.waitForSelector('#b12 [data-a=submit]');
const trOk = sid === 'panic-6637' && tr.cards === 3 && !tr.rec && tr.hist >= 1;
console.log(JSON.stringify({ ok: errors.length === 0 && closed && ptOk && trOk, review, terminalClosed: closed, storyComplete: true, reopened, training: { sid, ...tr }, playtest: pt, errors }));
await browser.close();
srv.close();
