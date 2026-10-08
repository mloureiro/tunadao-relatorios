import type { Renderer } from './renderer';
import { createTypstSession } from './typst-session';
import type {
  WorkerAssets,
  WorkerRequest,
  WorkerResponse,
} from './worker-protocol';

interface WorkerScope {
  postMessage(message: WorkerResponse, transfer?: Transferable[]): void;
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
}

const scope = self as unknown as WorkerScope;

function post(message: WorkerResponse, transfer: Transferable[] = []): void {
  scope.postMessage(message, transfer);
}

async function fetchBytes(
  url: string,
  onChunk?: (loaded: number, total: number | null) => void,
  decodedLength?: number,
): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to load ${url}: HTTP ${String(response.status)}`);
  }
  const length = Number(response.headers.get('content-length'));
  const encoded = response.headers.has('content-encoding');
  const total =
    encoded || !Number.isFinite(length) || length === 0
      ? (decodedLength ?? null)
      : length;

  const chunks: Uint8Array[] = [];
  let loaded = 0;
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    onChunk?.(loaded, total);
  }
  const bytes = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

async function loadRenderer(assets: WorkerAssets): Promise<Renderer> {
  const [wasm, fonts, files] = await Promise.all([
    fetchBytes(
      assets.wasmUrl,
      (loaded, total) => {
        post({ type: 'progress', loaded, total });
      },
      __WASM_BYTES__,
    ),
    Promise.all(assets.fontUrls.map((url) => fetchBytes(url))),
    Promise.all(
      Object.entries(assets.fileUrls).map(
        async ([path, url]) => [path, await fetchBytes(url)] as const,
      ),
    ),
  ]);
  return createTypstSession({ wasm, fonts, files: new Map(files) });
}

let renderer: Promise<Renderer> | undefined;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

scope.onmessage = (event) => {
  const request = event.data;
  if (request.type === 'init') {
    renderer = loadRenderer(request.assets);
    renderer.then(
      () => {
        post({ type: 'ready' });
      },
      (error: unknown) => {
        post({ type: 'failure', id: null, message: errorMessage(error) });
      },
    );
    return;
  }

  const { id, templateId, report } = request;
  void (async () => {
    try {
      if (!renderer) throw new Error('Render worker was not initialised');
      const { pdf, warnings } = await (
        await renderer
      ).render(templateId, report);
      post({ type: 'result', id, pdf, warnings }, [pdf.buffer]);
    } catch (error) {
      post({ type: 'failure', id, message: errorMessage(error) });
    }
  })();
};
