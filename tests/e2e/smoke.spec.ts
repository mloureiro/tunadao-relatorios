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
    page.getByRole('heading', {
      name: 'Relatórios financeiros do TUNADÃO 1998',
    }),
  ).toBeVisible();
  await page.waitForLoadState('networkidle');

  expect(foreign).toEqual([]);
});
