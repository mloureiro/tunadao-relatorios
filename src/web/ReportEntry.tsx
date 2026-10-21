import { useEffect, useRef, useState } from 'preact/hooks';
import type { ReportInstance } from '@/core/sheets/instance';
import { saveFile } from './download';
import { EngineLoadError } from './engine';
import { engineProgressLabel } from './engine-progress';
import { StatusMark } from './StatusMark';
import { useAppState } from './state';
import { useObjectUrl } from './use-object-url';
import {
  isReady,
  sheetIssueParts,
  STATUS_LABEL,
  statusNote,
} from './view-model';

const GENERIC_FAILURE = 'Erro interno ao gerar o relatório.';

type Phase = 'idle' | 'done' | 'failed';

interface Props {
  readonly instance: ReportInstance;
  readonly pdf: Uint8Array | undefined;
  readonly generating: boolean;
  readonly locked: boolean;
  readonly generate: () => Promise<Uint8Array>;
  readonly previewing: boolean;
  readonly onPreview: (open: boolean) => void;
  readonly announce: (message: string) => void;
}

function IssueLine({
  issue,
}: {
  readonly issue: ReportInstance['issues'][number];
}) {
  const { lead, cell, body } = sheetIssueParts(issue);
  return (
    <li class="issue">
      <span class={`severity severity-${issue.severity}`}>
        {issue.severity === 'error' ? 'Erro' : 'Aviso'}
      </span>
      <span class="issue-text">
        {lead}
        {cell !== null && <kbd class="cell">{cell}</kbd>}
        {body}
        {issue.suggestion !== undefined && (
          <span class="suggestion"> {issue.suggestion}</span>
        )}
      </span>
    </li>
  );
}

export function ReportEntry({
  instance,
  pdf,
  generating,
  locked,
  generate,
  previewing,
  onPreview,
  announce,
}: Props) {
  const { engine } = useAppState();
  const ready = isReady(instance);
  const note = statusNote(instance);
  const [phase, setPhase] = useState<Phase>('idle');
  const [failure, setFailure] = useState<string | null>(null);
  const [pdfUrl, setPdf] = useObjectUrl();
  const [jsonUrl, setJson] = useObjectUrl();
  const mounted = useRef(true);
  const previewButton = useRef<HTMLButtonElement>(null);
  const previewHeading = useRef<HTMLHeadingElement>(null);
  const wasPreviewing = useRef(false);
  const headingId = `entrada-${instance.sheet}`.replace(/\W+/g, '-');
  const pdfName = `${instance.fileStem}.pdf`;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    setJson(
      instance.report === undefined
        ? null
        : new Blob([`${JSON.stringify(instance.report, null, 2)}\n`], {
            type: 'application/json',
          }),
    );
  }, [instance.report]);

  useEffect(() => {
    if (previewing) previewHeading.current?.focus();
    else if (wasPreviewing.current) previewButton.current?.focus();
    wasPreviewing.current = previewing;
  }, [previewing]);

  async function ensurePdf(): Promise<string | null> {
    if (pdfUrl !== null) return pdfUrl;
    const blobOf = (bytes: Uint8Array) =>
      new Blob([bytes.slice().buffer], { type: 'application/pdf' });
    if (pdf !== undefined) return setPdf(blobOf(pdf));
    setFailure(null);
    announce('A gerar o PDF…');
    try {
      const bytes = await generate();
      if (!mounted.current) return null;
      const url = setPdf(blobOf(bytes));
      setPhase('done');
      return url;
    } catch (error) {
      if (!mounted.current) return null;
      const message =
        error instanceof EngineLoadError ? error.message : GENERIC_FAILURE;
      setPhase('failed');
      setFailure(message);
      announce(message);
      return null;
    }
  }

  async function download() {
    if (locked) return;
    const url = await ensurePdf();
    if (url === null) return;
    saveFile(url, pdfName);
    announce(`PDF pronto: ${pdfName}.`);
  }

  async function togglePreview() {
    if (locked) return;
    if (previewing) {
      onPreview(false);
      return;
    }
    if ((await ensurePdf()) !== null) onPreview(true);
  }

  return (
    <li
      class={`entry entry-${instance.status}${previewing ? ' entry-open' : ''}`}
    >
      <p class="entry-tab">
        <span class="tab-kind">folha</span> {instance.sheet}
      </p>
      <div class="entry-body">
        <header class="entry-head">
          <h3 id={headingId}>{instance.title}</h3>
          <p class={`status status-${instance.status}`}>
            <StatusMark status={instance.status} />
            {STATUS_LABEL[instance.status]}
          </p>
        </header>

        {(instance.dates.length > 0 || instance.keyFigures.length > 0) && (
          <div class="entry-facts">
            {instance.dates.length > 0 && (
              <dl class="dates">
                {instance.dates.map(({ label, text, derivedFrom }) => (
                  <div key={label} class="date">
                    <dt>{label}</dt>
                    <dd>
                      {text}
                      {derivedFrom !== undefined && (
                        <span class="origin">
                          Em branco na folha; origem: {derivedFrom}
                        </span>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            {instance.keyFigures.length > 0 && (
              <dl class="figures">
                {instance.keyFigures.map(({ label, value }) => (
                  <div key={label} class="figure">
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        )}

        {instance.issues.length > 0 && (
          <ul class="issue-list">
            {instance.issues.map((issue, index) => (
              <IssueLine key={`${issue.code}-${String(index)}`} issue={issue} />
            ))}
          </ul>
        )}

        {note !== null && <p class="entry-note">{note}</p>}

        {instance.status !== 'por-preencher' && (
          <div class="entry-actions">
            <button
              type="button"
              class="button"
              disabled={!ready}
              aria-disabled={locked}
              aria-busy={generating}
              onClick={() => void download()}
            >
              {generating ? 'A gerar…' : 'Descarregar PDF'}
            </button>
            <button
              type="button"
              class="button button-secondary"
              ref={previewButton}
              disabled={!ready}
              aria-disabled={locked}
              aria-expanded={previewing}
              onClick={() => void togglePreview()}
            >
              {previewing ? 'Fechar pré-visualização' : 'Pré-visualizar'}
            </button>
            {jsonUrl !== null && (
              <a
                class="link"
                href={jsonUrl}
                download={`${instance.fileStem}.json`}
              >
                dados (.json)
              </a>
            )}
          </div>
        )}

        {generating && engine.status === 'loading' && (
          <p class="hint">{engineProgressLabel(engine.progress)}</p>
        )}
        {phase === 'done' && !previewing && (
          <p class="hint">PDF gerado: {pdfName}</p>
        )}
        {failure !== null && <p class="entry-failure">{failure}</p>}

        {previewing && pdfUrl !== null && (
          <section class="preview" aria-labelledby={`${headingId}-pre`}>
            <h4 id={`${headingId}-pre`} tabIndex={-1} ref={previewHeading}>
              Pré-visualização
            </h4>
            <iframe
              class="preview-frame"
              title={`Pré-visualização: ${instance.title}`}
              src={pdfUrl}
            />
            <p class="hint">
              Se a pré-visualização não aparecer neste navegador, descarregue o
              PDF.
            </p>
          </section>
        )}
      </div>
    </li>
  );
}
