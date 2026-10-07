import type { TemplateId } from './renderer';

export interface WorkerAssets {
  wasmUrl: string;
  fontUrls: readonly string[];
  fileUrls: Readonly<Record<string, string>>;
}

export type WorkerRequest =
  | { type: 'init'; assets: WorkerAssets }
  | { type: 'render'; id: number; templateId: TemplateId; report: unknown };

export type WorkerResponse =
  | { type: 'progress'; loaded: number; total: number | null }
  | { type: 'ready' }
  | { type: 'result'; id: number; pdf: Uint8Array; warnings: string[] }
  | { type: 'failure'; id: number | null; message: string };
