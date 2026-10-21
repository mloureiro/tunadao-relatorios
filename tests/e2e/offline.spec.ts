import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const VALID = join(
  import.meta.dirname,
  '../../fixtures/generated/tesouraria.xlsx',
);

async function visitAndWaitForServiceWorker(page: Page): Promise<void> {
  await page.goto('./');
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    const worker = registration.active;
    if (worker?.state === 'activated') return;
    await new Promise<void>((resolve) => {
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'activated') resolve();
      });
    });
  });
}

test('the first visit precaches the page and the PDF engine', async ({
  page,
}) => {
  await visitAndWaitForServiceWorker(page);

  const cached = await page.evaluate(async () => {
    const [name] = await caches.keys();
    const cache = await caches.open(name ?? '');
    return (await cache.keys()).map((request) => new URL(request.url).pathname);
  });

  expect(cached).toEqual(
    expect.arrayContaining([
      expect.stringMatching(/\/index\.html$/),
      expect.stringMatching(/\.wasm$/),
      expect.stringMatching(/\/modelo-tesouraria\.xlsx$/),
    ]),
  );
});

test('the page works offline on a later visit and still produces a PDF', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(
    browserName === 'webkit',
    'Playwright WebKit cannot emulate offline for pages a service worker answers; must be verified manually in Safari.',
  );
  test.setTimeout(180_000);

  await visitAndWaitForServiceWorker(page);
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole('heading', {
      name: 'Relatórios financeiros do TUNADÃO 1998',
    }),
  ).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles(VALID);
  const card = page
    .getByRole('listitem')
    .filter({ hasText: 'folha CITADÃO 2026' });

  const download = page.waitForEvent('download', { timeout: 90_000 });
  await card.getByRole('button', { name: 'Descarregar PDF' }).click();
  expect((await download).suggestedFilename().normalize('NFC')).toBe(
    '2026-06-15 Relatório de evento - 20º CITADÃO.pdf',
  );
});

test('a first visit downloads the PDF engine from the network once, even when a PDF is requested at once', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(
    browserName !== 'chromium',
    'Only chromium reports the service worker own requests to the context.',
  );
  test.setTimeout(240_000);
  const fromNetwork: string[] = [];
  context.on('response', (response) => {
    if (response.url().endsWith('.wasm') && !response.fromServiceWorker()) {
      fromNetwork.push(response.url());
    }
  });
  await context.route('**/*.wasm', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });
  await page.goto('./');
  await page.locator('input[type="file"]').setInputFiles(VALID);
  const card = page
    .getByRole('listitem')
    .filter({ hasText: 'folha CITADÃO 2026' });
  const download = page.waitForEvent('download', { timeout: 150_000 });
  await card.getByRole('button', { name: 'Descarregar PDF' }).click();
  await download;
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const [name] = await caches.keys();
        const cache = await caches.open(name ?? '');
        return (await cache.keys()).some(({ url }) => url.endsWith('.wasm'));
      }),
    )
    .toBe(true);

  expect(fromNetwork).toHaveLength(1);
});
