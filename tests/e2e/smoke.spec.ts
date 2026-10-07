import { expect, test } from '@playwright/test';

test('page loads and only talks to its own origin', async ({
  page,
  baseURL,
}) => {
  const origin = new URL(baseURL ?? '').origin;
  const foreign: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    const isNetwork = url.protocol === 'http:' || url.protocol === 'https:';
    if (isNetwork && url.origin !== origin) foreign.push(request.url());
  });

  await page.goto('./');
  await expect(
    page.getByRole('heading', { name: 'Gerador de relatórios financeiros' }),
  ).toBeVisible();
  await page.waitForLoadState('networkidle');

  expect(foreign).toEqual([]);
});
