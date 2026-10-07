import { expect, test } from '@playwright/test';
import { trackForeignRequests } from './same-origin';

test('page loads and only talks to its own origin', async ({
  page,
  context,
  baseURL,
}) => {
  const foreign = trackForeignRequests(context, baseURL);

  await page.goto('./');
  await expect(
    page.getByRole('heading', { name: 'Gerador de relatórios financeiros' }),
  ).toBeVisible();
  await page.waitForLoadState('networkidle');

  expect(foreign).toEqual([]);
});
