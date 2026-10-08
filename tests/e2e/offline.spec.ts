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
    'Playwright WebKit cannot emulate offline for pages a service worker answers; verified manually in Safari.',
  );
  test.setTimeout(180_000);

  await visitAndWaitForServiceWorker(page);
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Gerador de relatórios financeiros' }),
  ).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles(VALID);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByText('Relatório de evento', { exact: true }).click();

  const form = page.locator('form.report-form');
  await form
    .getByLabel('Atividade', { exact: true })
    .selectOption('20º CITADÃO');
  await form.getByLabel('Início do evento').fill('30/04/2026');
  await form.getByLabel('Fim do evento').fill('03/05/2026');
  await form.getByLabel('Contar movimentos até').fill('15/06/2026');
  await form.getByLabel('Data de referência dos pendentes').fill('2026-06-15');

  const generate = page.getByRole('button', { name: 'Gerar PDF' });
  await expect(generate).toBeEnabled();
  await generate.click();
  await expect(
    page.getByRole('heading', { name: 'Relatório gerado' }),
  ).toBeVisible({ timeout: 90_000 });

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descarregar PDF' }).click();
  expect((await download).suggestedFilename()).toBe(
    'relatorio-evento-20o-citadao-2026-05-03.pdf',
  );
});
