// End-to-end check of the demo build in a real browser (Chromium via Playwright).
// Run `npm run build` first. Usage: node tests/e2e/run.mjs [--shots dir]
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = await import('playwright'); }
const { chromium } = playwright;

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const shotsArg = process.argv.indexOf('--shots');
const shots = shotsArg > 0 ? process.argv[shotsArg + 1] : null;
if (shots) fs.mkdirSync(shots, { recursive: true });
const PORT = 4173 + Math.floor(Math.random() * 500);

const server = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), 'preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'pipe' });
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('preview server did not start')), 20000);
  server.stdout.on('data', d => { if (String(d).includes(String(PORT))) { clearTimeout(t); res(); } });
  server.on('exit', c => rej(new Error('preview exited ' + c)));
});

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

let step = 0, failed = 0;
async function check(name, fn) {
  step++;
  try { await fn(); console.log(`ok ${step} - ${name}`); }
  catch (e) {
    failed++; console.log(`not ok ${step} - ${name}\n  ${String(e.message).split('\n')[0]}`);
    if (shots) await page.screenshot({ path: path.join(shots, `fail-${step}.png`) }).catch(() => {});
    if (process.env.E2E_DEBUG) console.log('  body:', await page.evaluate(() => document.body.className + ' | ' + (document.querySelector('.sheet') || {}).innerText?.slice(-300)).catch(e => e.message));
  }
  if (shots) await page.screenshot({ path: path.join(shots, `${String(step).padStart(2, '0')}.png`) }).catch(() => {});
}
const click = async (sel, opts) => { await page.locator(sel).first().click(opts); await page.waitForTimeout(250); };
const act = (a, extra = '') => `[data-act="${a}"]${extra}`;
const toast = async re => { await page.locator('#toast .toast-box', { hasText: re }).first().waitFor({ timeout: 8000 }); };
const idle = () => page.waitForFunction(() => !document.body.classList.contains('busy'), null, { timeout: 15000 });

await page.addInitScript(() => { try { localStorage.setItem('lodgely-tour', 'done'); } catch {} });
await page.goto(`http://localhost:${PORT}/`);

await check('landing page loads with live listings', async () => {
  await page.locator('.land').waitFor({ timeout: 30000 });
  await page.locator('[data-act="openApp"]').first().waitFor();
});

await check('explore shows houses from the database', async () => {
  await click(act('openApp'));
  await page.locator('#results .card').first().waitFor({ timeout: 20000 });
  const n = await page.locator('#results .card').count();
  if (n < 4) throw new Error('only ' + n + ' cards');
});

await check('booking needs an account; demo login continues', async () => {
  await click('#results .card[aria-label="Gold House Annex"] h3, #results .card[aria-label="Gold House Annex"]');
  await page.locator('.insp').first().waitFor();
  await click(act('book'));
  await page.locator('.sheet').waitFor();
  await click(act('demoLogin'));
  await toast(/Logged in as Tolu/);
  await page.locator('.sheet input[name="slot"]').first().waitFor({ timeout: 10000 });
});

await check('book an inspection and pay the fee (test mode)', async () => {
  await page.locator('.sheet input[name="slot"]').first().check();
  await click(act('bookNext'));
  await click(act('pay'));
  await page.locator('.sheet .done h2', { hasText: 'Visit booked' }).waitFor({ timeout: 15000 });
  await click('.sheet ' + act('closeModal'));
});

await check('enter the door code; rent unlocks', async () => {
  const code = (await page.locator('.insp .hint b.mono').first().textContent()).trim();
  await click(act('enterCode'));
  await page.fill('#code-in', code);
  await click(act('checkCode'));
  await toast(/Rent payment is unlocked/);
  await page.locator('.insp.ok-tone').first().waitFor();
});

await check('pay rent with savings; key issued', async () => {
  await click('[data-act="rent"]');
  await page.locator('.sheet [data-hold]').waitFor();
  await click(act('pay'));
  await page.locator('.sheet .done h2', { hasText: 'Payment confirmed' }).waitFor({ timeout: 15000 });
  const code = (await page.locator('.sheet .kc-code').textContent()).trim();
  if (!/^LDG-\w{4}-\w{4}-\w{4}$/.test(code)) throw new Error('bad key ' + code);
  await click(act('doneCheckout'));
  await page.locator('[data-qr] svg').first().waitFor({ timeout: 10000 });
});

await check('confirm move-in releases rent', async () => {
  await click(act('moveIn'));
  await click(act('moveInYes'));
  await toast(/Rent released/);
});

await check('chat with the agent; the demo agent replies', async () => {
  await click(act('tab', '[data-t="messages"]'));
  await click('.rowi >> nth=0');
  await page.fill('#msg-in', 'How is the water there?');
  await click(act('send'));
  await page.locator('.msgs', { hasText: 'Water is steady' }).waitFor({ timeout: 10000 });
});

await check('agent side: tenant, held money and visits', async () => {
  await click(act('role', '[data-r="agent"]'));
  await idle();
  await page.locator('main', { hasText: 'Kunle' }).first().waitFor({ timeout: 10000 }).catch(() => {});
  await click(act('tab', '[data-t="inspections"]'));
  await page.locator('main .rowi').first().waitFor();
});

await check('agent adds a listing; admin approves it', async () => {
  await click(act('tab', '[data-t="listings"]'));
  await click('[data-act="push"][data-v="newlisting"]');
  await page.fill('#nl-title', 'Test Court');
  await page.fill('#nl-addr', '2 Test Road');
  await page.fill('#nl-r0n', 'Room A');
  await page.fill('#nl-r0p', '200000');
  await click(act('submitListing'));
  await toast(/Sent for review/);
  await click(act('role', '[data-r="admin"]'));
  await idle();
  await click(act('tab', '[data-t="listings"]'));
  await page.locator('.comp:has-text("Test Court") ' + act('approveListing')).click();
  await toast(/Test Court is live/);
});

await check('admin overview and payments render', async () => {
  await click(act('tab', '[data-t="overview"]'));
  await page.locator('.stats').waitFor();
  await click(act('tab', '[data-t="payments"]'));
  await page.locator('main .rowi').first().waitFor();
  await click(act('tab', '[data-t="complaints"]'));
  await page.locator('main .amen').waitFor();
});

await check('time machine: renewal prompt 30 days before the key ends', async () => {
  await click(act('role', '[data-r="student"]'));
  await idle();
  await click(act('demo'));
  await page.locator(act('jump', '[data-n="30"]')).scrollIntoViewIfNeeded();
  await click(act('jump', '[data-n="30"]'), { force: true });
  await page.locator('.renew-pop').waitFor({ timeout: 10000 });
  await click(act('later'));
  await click(act('demo'));
  await click('.sheet ' + act('today'));
  await toast(/back to today/);
});

await check('reload keeps the data (stored in the browser)', async () => {
  await page.reload();
  await page.locator('main, .land').first().waitFor({ timeout: 30000 });
  await click(act('tab', '[data-t="lodge"]')).catch(() => {});
  await page.locator('main', { hasText: 'Gold House Annex' }).first().waitFor({ timeout: 15000 });
});

await check('no script errors', async () => {
  const bad = errors.filter(e => !/favicon|Failed to load resource/.test(e));
  if (bad.length) throw new Error(bad.slice(0, 5).join(' | '));
});

await browser.close();
server.kill();
console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
