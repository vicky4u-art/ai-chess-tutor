import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

// Real headless Chromium with mobile touch/viewport emulation, not iOS Safari.
const URL = process.env.UI_TEST_URL ?? 'http://127.0.0.1:3101';
const TOKEN = process.env.UI_TEST_TOKEN ?? 'ui-smoke-test-token';
mkdirSync('ui-artifacts', { recursive: true });
const browser = await chromium.launch({ headless: true });
let page, context;
const results = [];
async function shot(name) {
  if (page) await page.screenshot({ path: 'ui-artifacts/' + name + '.png', fullPage: true }).catch(() => {});
}
async function test(name, fn) {
  try {
    await fn();
    results.push({ name, status: 'PASS' });
    console.log('PASS: ' + name);
  } catch (e) {
    results.push({ name, status: 'FAIL', reason: String(e) });
    console.error('FAIL: ' + name, e);
    await shot('failure-' + name.replaceAll(/[^a-z0-9]+/gi, '-'));
    throw e;
  }
}
async function noOverflow(label) {
  const sizes = await page.evaluate(() => ({ width: window.innerWidth, scroll: document.documentElement.scrollWidth }));
  assert.ok(sizes.scroll <= sizes.width + 3, label + ' horizontal overflow: ' + JSON.stringify(sizes));
}
async function nav(route) { await page.goto(URL + '/#/' + route, { waitUntil: 'domcontentloaded' }); }
async function login() {
  await page.getByLabel('Access token').fill(TOKEN);
  await page.getByRole('button', { name: 'Unlock tutor' }).click();
  await page.getByText('Daily lesson', { exact: true }).waitFor({ timeout: 15000 });
}
try {
  context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  page = await context.newPage();
  const jsErrors = [];
  page.on('pageerror', e => jsErrors.push(String(e)));

  await test('Mobile login and dashboard', async () => {
    await page.goto(URL);
    await page.getByLabel('Access token').waitFor();
    await login();
    await noOverflow('dashboard');
    await shot('mobile-dashboard');
    await page.reload();
    await page.getByText('Daily lesson', { exact: true }).waitFor();
  });

  await test('Full 15-position assessment and mastery profile', async () => {
    await nav('assessment');
    await page.getByRole('button', { name: 'Start assessment' }).click();
    for (let n = 1; n <= 15; n++) {
      await page.getByText('Position ' + n + ' of 15', { exact: false }).waitFor({ timeout: 15000 });
      if (n === 1) {
        await noOverflow('assessment');
        await shot('mobile-assessment');
      }
      await page.getByRole('button', { name: 'Show solution' }).click();
    }
    await page.getByText('Your skill profile', { exact: true }).waitFor({ timeout: 20000 });
    await shot('mobile-assessment-result');
  });

  await test('Daily lesson navigation and first step completion', async () => {
    await nav('dashboard');
    await page.getByRole('button', { name: 'Start daily lesson' }).click();
    await page.getByText(/Step 1 of [0-9]+/).waitFor({ timeout: 15000 });
    await shot('mobile-session');
    const mark = page.getByRole('button', { name: 'Mark step done' });
    if (await mark.isVisible()) {
      await mark.click();
    } else {
      const show = page.getByRole('button', { name: 'Show solution' });
      if (!await show.isVisible()) throw new Error('First daily step is not actionable');
      await show.click();
    }
    await page.getByText(/Step 2 of [0-9]+/).waitFor({ timeout: 15000 });
  });

  await test('Puzzle practice and next puzzle', async () => {
    await nav('puzzles');
    await page.getByText('Find the best continuation.', { exact: true }).waitFor();
    await noOverflow('puzzles');
    await shot('mobile-puzzles');
    await page.getByRole('button', { name: 'Show solution' }).click();
    await page.getByText('Puzzle missed.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Next puzzle' }).click();
    await page.getByText('Find the best continuation.', { exact: true }).waitFor();
  });

  await test('Tutor chat without AI API key', async () => {
    await nav('tutor');
    await page.getByText('Conversational AI is not configured.', { exact: false }).waitFor();
    await page.getByPlaceholder('Ask the basic chess coach…').fill('How should I develop my pieces?');
    await page.getByRole('button', { name: 'Send' }).click();
    await page.locator('.whitespace-pre-wrap').nth(1).waitFor({ timeout: 20000 });
    assert.ok((await page.locator('.whitespace-pre-wrap').nth(1).innerText()).length >= 30);
    await noOverflow('tutor');
    await shot('mobile-tutor');
  });

  await test('PGN game import and analysis board', async () => {
    await nav('analyze');
    const pgn = '[White "Student"]\n[Black "Coach"]\n[Result "1-0"]\n\n1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0';
    await page.getByPlaceholder('1. e4 e5 2. Nf3 …').fill(pgn);
    await page.getByRole('button', { name: 'Import game', exact: true }).click();
    await page.getByText('Student vs Coach', { exact: true }).waitFor({ timeout: 15000 });
    await page.getByText('Engine analysis', { exact: true }).waitFor();
    await noOverflow('game analysis');
    await shot('mobile-analyze');
  });

  await test('Stockfish WebAssembly worker starts in Chromium', async () => {
    await nav('diagnostics');
    await page.getByRole('button', { name: 'Probe engine' }).click();
    try { await page.getByText('Available', { exact: true }).waitFor({ timeout: 30000 }); }
    catch { throw new Error('Stockfish unavailable: ' + (await page.locator('main').innerText()).slice(0, 1600)); }
    await shot('mobile-stockfish');
  });

  await test('No uncaught mobile JavaScript errors', async () => {
    assert.equal(jsErrors.length, 0, 'JavaScript exceptions: ' + jsErrors.join(' | '));
  });

  await context.close();
  context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  page = await context.newPage();
  await test('Desktop login and responsive layouts', async () => {
    await page.goto(URL);
    await login();
    await noOverflow('desktop dashboard');
    await shot('desktop-dashboard');
    await nav('puzzles');
    await page.getByText('Find the best continuation.', { exact: true }).waitFor();
    await noOverflow('desktop puzzles');
    await shot('desktop-puzzles');
  });
} finally {
  console.log('UI smoke test results: ' + JSON.stringify(results));
  await context?.close().catch(() => {});
  await browser.close();
}
