import { useEffect, useRef, useState } from 'preact/hooks';
import type { ReportInstance } from '@/core/sheets/instance';
import { EngineLoadError, renderReport } from './engine';

export type Work =
  | { readonly kind: 'one'; readonly sheet: string }
  | { readonly kind: 'all'; readonly step: number; readonly total: number };

export interface ZipOutcome {
  readonly made: readonly {
    readonly instance: ReportInstance;
    readonly pdf: Uint8Array;
  }[];
  readonly failed: readonly ReportInstance[];
  readonly engineFailure: string | null;
}

export interface ReportPdfs {
  readonly pdfs: Readonly<Record<string, Uint8Array>>;
  readonly work: Work | null;
  generate(instance: ReportInstance): Promise<Uint8Array>;
  generateAll(instances: readonly ReportInstance[]): Promise<ZipOutcome | null>;
}

export function useReportPdfs(): ReportPdfs {
  const [pdfs, setPdfs] = useState<Readonly<Record<string, Uint8Array>>>({});
  const [work, setWork] = useState<Work | null>(null);
  const latest = useRef(pdfs);
  const running = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  function show(next: Work | null): void {
    if (mounted.current) setWork(next);
  }

  async function render(instance: ReportInstance): Promise<Uint8Array> {
    const known = latest.current[instance.sheet];
    if (known !== undefined) return known;
    if (instance.report === undefined || instance.tipo === null) {
      throw new Error(`Report sheet ${instance.sheet} has no report`);
    }
    const pdf = await renderReport(instance.tipo, instance.report);
    latest.current = { ...latest.current, [instance.sheet]: pdf };
    if (mounted.current) setPdfs(latest.current);
    return pdf;
  }

  async function generate(instance: ReportInstance): Promise<Uint8Array> {
    if (running.current) throw new Error('Another report is being generated');
    running.current = true;
    show({ kind: 'one', sheet: instance.sheet });
    try {
      return await render(instance);
    } finally {
      running.current = false;
      show(null);
    }
  }

  async function generateAll(
    instances: readonly ReportInstance[],
  ): Promise<ZipOutcome | null> {
    if (running.current) return null;
    running.current = true;
    const made: { instance: ReportInstance; pdf: Uint8Array }[] = [];
    const failed: ReportInstance[] = [];
    let engineFailure: string | null = null;
    try {
      for (const [index, instance] of instances.entries()) {
        show({ kind: 'all', step: index + 1, total: instances.length });
        try {
          made.push({ instance, pdf: await render(instance) });
        } catch (error) {
          failed.push(instance);
          if (error instanceof EngineLoadError) {
            engineFailure = error.message;
            failed.push(...instances.slice(index + 1));
            break;
          }
        }
      }
    } finally {
      running.current = false;
      show(null);
    }
    return { made, failed, engineFailure };
  }

  return { pdfs, work, generate, generateAll };
}
