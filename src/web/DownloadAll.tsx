import { useState } from 'preact/hooks';
import type { ReportInstance } from '@/core/sheets/instance';
import { saveFile } from './download';
import { engineProgressLabel } from './engine-progress';
import { reportZipFile } from './report-zip';
import { useAppState } from './state';
import { useObjectUrl } from './use-object-url';
import type { ReportPdfs } from './use-report-pdfs';
import { isReady, skippedForZip, zipResultLine } from './view-model';

interface Props {
  readonly reports: readonly ReportInstance[];
  readonly pdfs: ReportPdfs;
  readonly announce: (message: string) => void;
}

export function DownloadAll({ reports, pdfs, announce }: Props) {
  const { engine } = useAppState();
  const [, setZip] = useObjectUrl();
  const [result, setResult] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const ready = reports.filter(isReady);
  const { work } = pdfs;
  const running = work?.kind === 'all';

  async function download() {
    if (work !== null) return;
    setResult(null);
    setFailure(null);
    announce(`A gerar ${String(ready.length)} relatórios…`);
    const outcome = await pdfs.generateAll(ready);
    if (outcome === null) return;
    if (outcome.engineFailure !== null) {
      setFailure(outcome.engineFailure);
      announce(outcome.engineFailure);
      return;
    }
    const file = reportZipFile(
      outcome.made.map(({ instance, pdf }) => ({
        stem: instance.fileStem,
        pdf,
      })),
    );
    const url = setZip(file.blob);
    if (url === null) return;
    saveFile(url, file.name);
    const line = zipResultLine(
      outcome.made.length,
      skippedForZip(reports, outcome.failed),
    );
    setResult(line);
    announce(line);
  }

  return (
    <section class="download-all" aria-labelledby="zip-titulo">
      <h2 id="zip-titulo">Todos os relatórios</h2>
      <div class="download-all-body">
        <button
          type="button"
          class="button"
          disabled={ready.length === 0}
          aria-disabled={work !== null}
          aria-busy={running}
          onClick={() => void download()}
        >
          {running
            ? `A gerar ${String(work.step)} de ${String(work.total)}…`
            : 'Descarregar todos (.zip)'}
        </button>
        {ready.length === 0 && (
          <p class="hint">Nenhum relatório está pronto para descarregar.</p>
        )}
        {running && engine.status === 'loading' && (
          <p class="hint">{engineProgressLabel(engine.progress)}</p>
        )}
        {result !== null && <p class="hint">{result}</p>}
        {failure !== null && <p class="entry-failure">{failure}</p>}
      </div>
    </section>
  );
}
