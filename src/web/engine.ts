import helloSample from '@/engine/hello-sample.json';
import { createWebRenderer, type WebRenderer } from '@/engine/typst-web';
import { getState, setState } from './state';

let renderer: WebRenderer | null = null;
let warmUp: Promise<void> | null = null;

function failure(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

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
      (error: unknown) => {
        warmUp = null;
        setEngine({ status: 'error', message: failure(error) });
        throw error;
      },
    );
  }
  return warmUp.then(() => active);
}

export async function renderTestPdf(): Promise<Uint8Array | null> {
  try {
    const active = await startEngine();
    setEngine({ status: 'busy' });
    const { pdf } = await active.render('hello', helloSample);
    setEngine({ status: 'ready' });
    return pdf;
  } catch (error) {
    setEngine({ status: 'error', message: failure(error) });
    return null;
  }
}
