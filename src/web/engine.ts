import type { TemplateId } from '@/engine/renderer';
import { createWebRenderer, type WebRenderer } from '@/engine/typst-web';
import { serviceWorkerSettled } from './service-worker';
import { getState, setState } from './state';

const LOAD_FAILURE =
  'Não foi possível carregar o motor de PDF. Verifique a ligação e tente de novo.';

export class EngineLoadError extends Error {
  constructor() {
    super(LOAD_FAILURE);
    this.name = 'EngineLoadError';
  }
}

const RENDER_FAILURE = 'Erro interno ao gerar o relatório.';

let starting: Promise<WebRenderer> | null = null;

function setEngine(patch: Partial<ReturnType<typeof getState>['engine']>) {
  setState({ engine: { ...getState().engine, ...patch } });
}

async function createAndWarmUp(): Promise<WebRenderer> {
  await serviceWorkerSettled();
  const active = createWebRenderer({
    onProgress: (progress) => {
      setEngine({ progress });
    },
  });
  try {
    await active.warmUp();
  } catch {
    starting = null;
    setEngine({ status: 'error', message: LOAD_FAILURE });
    throw new EngineLoadError();
  }
  setEngine({ status: 'ready' });
  return active;
}

export function startEngine(): Promise<WebRenderer> {
  if (starting === null) {
    setEngine({ status: 'loading', message: '' });
    starting = createAndWarmUp();
  }
  return starting;
}

export async function renderReport(
  templateId: TemplateId,
  report: unknown,
): Promise<Uint8Array> {
  try {
    const active = await startEngine();
    setEngine({ status: 'busy' });
    const { pdf } = await active.render(templateId, report);
    setEngine({ status: 'ready' });
    return pdf;
  } catch (error) {
    if (!(error instanceof EngineLoadError)) {
      console.error('Falha ao gerar o PDF:', error);
      setEngine({ status: 'error', message: RENDER_FAILURE });
    }
    throw error;
  }
}

export function warmUpWhenIdle(): void {
  const start = () => {
    void startEngine().catch(() => undefined);
  };
  void serviceWorkerSettled().then(() => {
    if ('requestIdleCallback' in window) window.requestIdleCallback(start);
    else setTimeout(start, 200);
  });
}
