import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WebRenderer } from '@/engine/typst-web';

const created: WebRenderer[] = [];
let failNext = true;

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
        Promise.resolve({
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
});

describe('renderReport()', () => {
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
});
