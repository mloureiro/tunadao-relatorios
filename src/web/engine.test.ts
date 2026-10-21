import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WebRenderer } from '@/engine/typst-web';

const created: WebRenderer[] = [];
let failNext = true;
let renderFailure: Error | null = null;
let settle: () => void = () => undefined;
let settled = Promise.resolve();

vi.mock('./service-worker', () => ({
  serviceWorkerSettled: () => settled,
}));

vi.mock('@/engine/typst-web', () => ({
  createWebRenderer: (): WebRenderer => {
    const shouldFail = failNext;
    failNext = false;
    const renderer: WebRenderer = {
      warmUp: () =>
        shouldFail
          ? Promise.reject(new Error('Failed to fetch'))
          : Promise.resolve(),
      render: () =>
        renderFailure
          ? Promise.reject(renderFailure)
          : Promise.resolve({
              pdf: new Uint8Array([37, 80, 68, 70]),
              warnings: [],
            }),
    };
    created.push(renderer);
    return renderer;
  },
}));

const { EngineLoadError, renderReport } = await import('./engine');
const { getState } = await import('./state');

beforeEach(() => {
  created.length = 0;
  failNext = true;
  renderFailure = null;
  settled = Promise.resolve();
});

describe('renderReport()', () => {
  it('creates the renderer only once the service worker has settled, so the engine is fetched a single time', async () => {
    vi.resetModules();
    const fresh = await import('./engine');
    failNext = false;
    settled = new Promise<void>((resolve) => {
      settle = resolve;
    });

    const rendering = fresh.renderReport('fiscal', {});
    await Promise.resolve();
    expect(created).toHaveLength(0);

    settle();
    await rendering;
    expect(created).toHaveLength(1);
  });

  it('reports a failed engine load in Portuguese, then recovers with a new renderer', async () => {
    await expect(renderReport('fiscal', {})).rejects.toBeInstanceOf(
      EngineLoadError,
    );
    expect(getState().engine.message).toBe(
      'Não foi possível carregar o motor de PDF. Verifique a ligação e tente de novo.',
    );

    const pdf = await renderReport('fiscal', {});

    expect(created).toHaveLength(2);
    expect([...pdf]).toEqual([37, 80, 68, 70]);
  });

  it('logs the underlying compiler diagnostic when rendering fails after the engine loaded', async () => {
    failNext = false;
    renderFailure = new Error('error: unknown variable: foo');
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(renderReport('fiscal', {})).rejects.toBe(renderFailure);

    expect(log).toHaveBeenCalledWith(expect.any(String), renderFailure);
    expect(getState().engine.message).toBe(
      'Erro interno ao gerar o relatório.',
    );
    log.mockRestore();
  });
});
