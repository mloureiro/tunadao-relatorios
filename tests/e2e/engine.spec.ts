import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { trackForeignRequests } from './same-origin';

declare global {
  interface Window {
    __workerUrls: string[];
  }
}

test('the test button downloads a PDF composed in the browser without leaving the origin', async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(120_000);
  const foreign = trackForeignRequests(context, baseURL);
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(message.text());
  });

  await page.goto('./');
  const button = page.getByRole('button', { name: 'Gerar PDF de teste' });
  await expect(button).toBeEnabled({ timeout: 90_000 });

  const downloadPromise = page.waitForEvent('download');
  await button.click();
  const download = await downloadPromise;

  const path = await download.path();
  const bytes = await readFile(path);
  expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  expect(bytes.toString('latin1')).toContain('/EmbeddedFile');
  expect(foreign).toEqual([]);
  expect(problems).toEqual([]);
});

test('the render worker runs under the page CSP, where dynamic code is blocked', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    window.__workerUrls = [];
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        window.__workerUrls.push(String(url));
        super(url, options);
      }
    };
  });

  await page.goto('./');
  await page
    .locator('input[type="file"]')
    .setInputFiles('fixtures/generated/tesouraria.xlsx');
  await expect
    .poll(() => page.evaluate(() => window.__workerUrls.length))
    .toBe(1);

  const workerUrls = await page.evaluate(() => window.__workerUrls);
  expect(workerUrls[0]).toMatch(/^blob:/);

  await page.route('**/csp-probe.js', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: `
        const outcome = {};
        for (const [name, run] of [
          ['Function', () => new Function('return 1')()],
          ['eval', () => (0, eval)('1')],
        ]) {
          try { run(); outcome[name] = 'allowed'; } catch { outcome[name] = 'blocked'; }
        }
        postMessage(outcome);
      `,
    }),
  );

  const outcome = await page.evaluate(async () => {
    const entry = new URL('csp-probe.js', location.href).href;
    const loader = URL.createObjectURL(
      new Blob([`import ${JSON.stringify(entry)};`], {
        type: 'text/javascript',
      }),
    );
    const worker = new Worker(loader, { type: 'module' });
    return new Promise<Record<string, string>>((resolve) => {
      worker.onmessage = (event: MessageEvent<Record<string, string>>) => {
        resolve(event.data);
      };
    });
  });
  expect(outcome).toEqual({ Function: 'blocked', eval: 'blocked' });
});
