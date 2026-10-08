import type { TemplateId } from '@/engine/renderer';
import { createWebRenderer, type WebRenderer } from '@/engine/typst-web';
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

let renderer: WebRenderer | null = null;
let warmUp: Promise<void> | null = null;

function setEngine(patch: Partial<ReturnType<typeof getState>['engine']>) {
  setState({ engine: { ...getState().engine, ...patch } });
}

export function startEngine(): Promise<WebRenderer> {
  renderer ??= createWebRenderer({
    onProgress: (progress) => {
      setEngine({ progress });
    },
  });
  const active = renderer;
  if (warmUp === null) {
    setEngine({ status: 'loading', message: '' });
    warmUp = active.warmUp().then(
      () => {
        setEngine({ status: 'ready' });
      },
      () => {
        warmUp = null;
        renderer = null;
        setEngine({ status: 'error', message: LOAD_FAILURE });
        throw new EngineLoadError();
      },
    );
  }
  return warmUp.then(() => active);
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
      setEngine({ status: 'error', message: RENDER_FAILURE });
    }
    throw error;
  }
}
