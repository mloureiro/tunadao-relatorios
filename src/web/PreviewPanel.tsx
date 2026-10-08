import { useEffect, useRef } from 'preact/hooks';
import type { Issue } from '@/core/issues';
import { saveFile, saveText } from './download';
import { ReportIssues } from './ReportIssues';

export interface GeneratedReport {
  readonly pdfUrl: string;
  readonly json: string;
  readonly stem: string;
  readonly issues: readonly Issue[];
}

interface Props {
  generated: GeneratedReport;
  onEdit: () => void;
}

export function PreviewPanel({ generated, onEdit }: Props) {
  const { pdfUrl, json, stem, issues } = generated;
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  return (
    <section class="preview" aria-labelledby="pre-visualizacao-titulo">
      <h2 id="pre-visualizacao-titulo" tabIndex={-1} ref={heading}>
        Relatório gerado
      </h2>
      <div class="actions">
        <button
          type="button"
          class="button"
          onClick={() => {
            saveFile(pdfUrl, `${stem}.pdf`);
          }}
        >
          Descarregar PDF
        </button>
        <button
          type="button"
          class="button button-secondary"
          onClick={() => {
            saveText(json, `${stem}.json`, 'application/json');
          }}
        >
          Descarregar dados (.json)
        </button>
        <button type="button" class="button button-quiet" onClick={onEdit}>
          Alterar parâmetros
        </button>
      </div>
      <ReportIssues issues={issues} />
      <iframe
        class="preview-frame"
        title="Pré-visualização do relatório em PDF"
        src={pdfUrl}
      />
      <p class="hint">
        Se a pré-visualização não aparecer neste navegador, descarregue o PDF.
      </p>
    </section>
  );
}
