import type { BrowserContext } from '@playwright/test';

export function trackForeignRequests(
  context: BrowserContext,
  baseURL: string | undefined,
): string[] {
  const origin = new URL(baseURL ?? '').origin;
  const foreign: string[] = [];
  context.on('request', (request) => {
    const url = new URL(request.url());
    const isNetwork = url.protocol === 'http:' || url.protocol === 'https:';
    if (isNetwork && url.origin !== origin) foreign.push(request.url());
  });
  return foreign;
}
