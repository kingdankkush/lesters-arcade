export async function gotoWithRetry(page, url, { attempts = 3, timeout = 30_000 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await page.waitForTimeout(250 * attempt);
    }
  }
  throw lastError;
}

export async function readCanvasDataset(page, selector = '#hmhRebootStage') {
  return page.locator(selector).evaluate((stage) => Object.fromEntries(Object.entries(stage.dataset)));
}

export async function waitForCanvasDataset(page, predicate, { selector = '#hmhRebootStage', timeout = 10_000, interval = 50 } = {}) {
  const deadline = Date.now() + timeout;
  let latest = {};
  while (Date.now() <= deadline) {
    latest = await readCanvasDataset(page, selector);
    if (predicate(latest)) return latest;
    await page.waitForTimeout(interval);
  }
  throw new Error(`Timed out waiting for canvas dataset after ${timeout}ms: ${JSON.stringify(latest)}`);
}
