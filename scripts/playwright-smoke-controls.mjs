import { chromium } from 'playwright';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
const SMOKE_PATH = '/controls-smoke';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Seed saved settings first.
    await page.goto(`${BASE_URL}${SMOKE_PATH}`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      const storageKey = 'sigma-water-controls-v1';
      const savedSettings = {
        waveAmplitude: 1.8,
      };
      window.localStorage.setItem(storageKey, JSON.stringify(savedSettings));
    });

    // Open with conflicting URL values to trigger modal.
    const conflictUrl = new URL(`${BASE_URL}${SMOKE_PATH}`);
    conflictUrl.searchParams.set('wa', '3.6');
    await page.goto(conflictUrl.toString(), { waitUntil: 'domcontentloaded' });

    const modalTitle = page.locator('text=Link Settings Detected');
    await modalTitle.waitFor({ state: 'visible', timeout: 10000 });

    const choiceSummary = page.locator('text=Current choice: Keep My Saved Settings (default)');
    await choiceSummary.waitFor({ state: 'visible', timeout: 10000 });

    await page.locator('button:has-text("Keep My Saved Settings")').click();
    await modalTitle.waitFor({ state: 'hidden', timeout: 10000 });

    const currentWaveAmplitude = await page.evaluate(() => new URLSearchParams(window.location.search).get('wa'));
    assert(currentWaveAmplitude === '1.8', `Expected URL wa=1.8 after keeping saved settings, got ${currentWaveAmplitude}`);

    // Smoke test collapse -> compact chip -> reopen flow.
    const closeControlsButton = page.locator('button[title="Close controls"]');
    await closeControlsButton.waitFor({ state: 'visible', timeout: 10000 });
    await closeControlsButton.click();

    const openControlsChip = page.locator('button[aria-label="Open controls"]');
    await openControlsChip.waitFor({ state: 'visible', timeout: 10000 });
    await openControlsChip.click();

    await closeControlsButton.waitFor({ state: 'visible', timeout: 10000 });

    console.log('Playwright smoke test passed: conflict modal and controls collapse/reopen behavior verified.');
  } finally {
    await context.close();
    await browser.close();
  }
}

run().catch((error) => {
  console.error('Playwright smoke test failed:', error);
  process.exitCode = 1;
});
