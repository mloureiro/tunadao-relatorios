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
  await expect(
    page.getByRole('button', { name: 'Gerar PDF de teste' }),
  ).toBeEnabled({ timeout: 90_000 });

  const workerUrls = await page.evaluate(() => window.__workerUrls);
  expect(workerUrls).toHaveLength(1);
  expect(workerUrls[0]).toMatch(/^blob:/);

  const evalBlockedIn = await page.evaluate(async () => {
    const attempt =
      'try { new Function("return 1")(); postMessage(false); } catch { postMessage(true); }';
    const url = URL.createObjectURL(
      new Blob([attempt], { type: 'text/javascript' }),
    );
    const worker = new Worker(url, { type: 'module' });
    const inWorker = await new Promise<boolean>((resolve) => {
      worker.onmessage = (event: MessageEvent<boolean>) => {
        resolve(event.data);
      };
    });
    let inPage = false;
    try {
      Reflect.construct(Function, ['return 1']);
    } catch {
      inPage = true;
    }
    return { inWorker, inPage };
  });
  expect(evalBlockedIn).toEqual({ inWorker: true, inPage: true });
});
