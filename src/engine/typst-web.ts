import wasmUrl from '@myriaddreamin/typst-ts-web-compiler/wasm?url';
import { defaultManifest, type AssetManifest } from './assets';
import type { RenderResult, Renderer, TemplateId } from './renderer';
import type {
  WorkerAssets,
  WorkerRequest,
  WorkerResponse,
} from './worker-protocol';

export interface WasmProgress {
  loaded: number;
  total: number | null;
}

export interface WebRenderer extends Renderer {
  warmUp(): Promise<void>;
}

export interface WebRendererOptions {
  manifest?: AssetManifest;
  onProgress?: (progress: WasmProgress) => void;
}

const assetUrls = import.meta.glob<string>(
  [
    '../../assets/fonts/*.ttf',
    '../../assets/logo.svg',
    '../../templates/**/*.typ',
  ],
  { query: '?url', import: 'default', eager: true },
);

const urlByPath = new Map(
  Object.entries(assetUrls).map(([key, url]) => [
    key.replace('../../', ''),
    url,
  ]),
);

function urlFor(path: string): string {
  const url = urlByPath.get(path);
  if (!url) throw new Error(`Asset is not part of the build: ${path}`);
  return url;
}

function resolveAssets(manifest: AssetManifest): WorkerAssets {
  const filePaths = [...manifest.templates, manifest.logo];
  return {
    wasmUrl,
    fontUrls: manifest.fonts.map(urlFor),
    fileUrls: Object.fromEntries(filePaths.map((p) => [p, urlFor(p)])),
  };
}

interface Pending {
  resolve: (result: RenderResult) => void;
  reject: (error: Error) => void;
}

export function createWebRenderer(
  options: WebRendererOptions = {},
): WebRenderer {
  const manifest = options.manifest ?? defaultManifest;
  let worker: Worker | undefined;
  let ready: Promise<void> | undefined;
  let nextId = 0;
  const pending = new Map<number, Pending>();

  function start(): Promise<void> {
    ready ??= new Promise<void>((resolve, reject) => {
      const instance = new Worker(
        new URL('./render.worker.ts', import.meta.url),
        { type: 'module' },
      );
      worker = instance;
      instance.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const message = event.data;
        switch (message.type) {
          case 'progress':
            options.onProgress?.({
              loaded: message.loaded,
              total: message.total,
            });
            break;
          case 'ready':
            resolve();
            break;
          case 'result':
            pending.get(message.id)?.resolve({
              pdf: message.pdf,
              warnings: message.warnings,
            });
            pending.delete(message.id);
            break;
          case 'failure': {
            const error = new Error(message.message);
            if (message.id === null) reject(error);
            else pending.get(message.id)?.reject(error);
            if (message.id !== null) pending.delete(message.id);
            break;
          }
        }
      };
      instance.onerror = (event) => {
        reject(new Error(event.message || 'Render worker crashed'));
      };
      const init: WorkerRequest = {
        type: 'init',
        assets: resolveAssets(manifest),
      };
      instance.postMessage(init);
    });
    return ready;
  }

  return {
    warmUp: start,
    async render(templateId: TemplateId, report: unknown) {
      await start();
      const id = nextId++;
      return new Promise<RenderResult>((resolve, reject) => {
        pending.set(id, { resolve, reject });
        const request: WorkerRequest = {
          type: 'render',
          id,
          templateId,
          report,
        };
        worker?.postMessage(request);
      });
    },
  };
}
