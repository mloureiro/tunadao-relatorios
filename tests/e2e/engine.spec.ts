import { expect, test } from '@playwright/test';

declare global {
  interface Window {
    __workerUrls: string[];
  }
}

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
