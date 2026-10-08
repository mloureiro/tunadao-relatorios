import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { formatMoney } from '@/core/format';
import type { LoadResult } from '@/core/pipeline';
import type { ReportTipo } from '@/core/reports';
import { config } from './config';
import { EngineLoadError, renderReport } from './engine';
import { engineProgressLabel } from './engine-progress';
import type { FormApi } from './form-controls';
import { lisbonDateTime } from '@/host/lisbon-time';
import { PreviewPanel, type GeneratedReport } from './PreviewPanel';
import { REQUIRED_MESSAGE } from '@/core/reports/field-errors';
import { ReportFields } from './ReportFields';
import {
  emptyForm,
  extratoOn,
  setField,
  setFlag,
  touch,
  withDefaults,
  type ReportFormValues,
} from './report-form';
import { ReportIssues } from './ReportIssues';
import { ReportPicker, REPORT_CHOICES } from './ReportPicker';
import {
  evaluateForm,
  needsManualOpening,
  reportIssues,
  type Evaluation,
} from './report-run';
import { useAppState } from './state';

const DEBOUNCE_MS = 250;
const GENERIC_FAILURE = 'Erro interno ao gerar o relatório.';

interface Props {
  loadResult: LoadResult;
  onBack: () => void;
  onPreviewing: (previewing: boolean) => void;
  onAnnounce: (message: string) => void;
}

interface Settled {
  readonly source: ReportFormValues;
  readonly evaluation: Evaluation;
}

const initialForms: Record<ReportTipo, ReportFormValues> = {
  evento: emptyForm('evento'),
  pegada: emptyForm('pegada'),
  letivo: emptyForm('letivo'),
  fiscal: emptyForm('fiscal'),
};

export function ReportFlow({
  loadResult,
  onBack,
  onPreviewing,
  onAnnounce,
}: Props) {
  const { engine } = useAppState();
  const [tipo, setTipo] = useState<ReportTipo | null>(null);
  const [forms, setForms] = useState(initialForms);
  const [settled, setSettled] = useState<Settled | null>(null);
  const [generating, setGenerating] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [generated, setGenerated] = useState<GeneratedReport | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const returningFromPreview = useRef(false);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!previewing && returningFromPreview.current) {
      returningFromPreview.current = false;
      submitRef.current?.focus();
    }
  }, [previewing]);

  const form = useMemo(
    () =>
      tipo === null
        ? null
        : withDefaults(tipo, forms[tipo], loadResult.dataset),
    [tipo, forms, loadResult],
  );

  useEffect(() => {
    if (tipo === null || form === null) return undefined;
    const timer = setTimeout(() => {
      setSettled({
        source: form,
        evaluation: evaluateForm(
          tipo,
          form,
          loadResult,
          config,
          lisbonDateTime(new Date()),
        ),
      });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [tipo, form, loadResult]);

  useEffect(() => {
    onPreviewing(previewing);
  }, [previewing, onPreviewing]);

  useEffect(
    () => () => {
      if (generated !== null) URL.revokeObjectURL(generated.pdfUrl);
    },
    [generated],
  );

  const evaluation = settled?.evaluation ?? null;
  const current = settled !== null && settled.source === form;
  const errors = evaluation?.status === 'invalid' ? evaluation.errors : {};
  const errorCount = Object.keys(errors).length;
  const blocked = evaluation?.status === 'blocked';
  const ready = current && evaluation?.status === 'report';
  const showManualOpening =
    evaluation !== null &&
    (needsManualOpening(evaluation) ||
      (form?.fields['aberturaManual/caixa'] ?? '') !== '' ||
      (form?.fields['aberturaManual/banco'] ?? '') !== '');

  function change(update: (previous: ReportFormValues) => ReportFormValues) {
    if (tipo === null) return;
    setForms((all) => {
      const next = update(all[tipo]);
      return next === all[tipo] ? all : { ...all, [tipo]: next };
    });
  }

  const api: FormApi | null =
    form === null
      ? null
      : {
          form,
          idPrefix: `form-${tipo ?? ''}`,
          set: (key, value) => {
            change((previous) => setField(previous, key, value));
          },
          blur: (key) => {
            change((previous) => touch(previous, key));
          },
          flag: (key, value) => {
            change((previous) => setFlag(previous, key, value));
          },
          patch: (update) => {
            change(update);
          },
          error: (key) => {
            const message = errors[key];
            return message !== undefined &&
              (message !== REQUIRED_MESSAGE || form.touched[key] === true)
              ? message
              : undefined;
          },
        };

  async function generate() {
    if (tipo === null || form === null) return;
    setFailure(null);
    const result = evaluateForm(
      tipo,
      form,
      loadResult,
      config,
      lisbonDateTime(new Date()),
    );
    if (result.status !== 'report') {
      setFailure(
        result.status === 'failure'
          ? `${GENERIC_FAILURE} ${result.message}`
          : 'Corrija os problemas assinalados antes de gerar o PDF.',
      );
      return;
    }
    setGenerating(true);
    onAnnounce('A gerar o PDF…');
    try {
      const pdf = await renderReport(tipo, result.report);
      const pdfUrl = URL.createObjectURL(
        new Blob([pdf.slice().buffer], { type: 'application/pdf' }),
      );
      setGenerated({
        pdfUrl,
        json: `${JSON.stringify(result.report, null, 2)}\n`,
        stem: result.stem,
        issues: result.issues,
      });
      setPreviewing(true);
      onAnnounce('PDF gerado. A pré-visualização está disponível.');
    } catch (error) {
      const message =
        error instanceof EngineLoadError ? error.message : GENERIC_FAILURE;
      setFailure(message);
    } finally {
      setGenerating(false);
    }
  }

  if (previewing && generated !== null) {
    return (
      <PreviewPanel
        generated={generated}
        onEdit={() => {
          returningFromPreview.current = true;
          setPreviewing(false);
        }}
      />
    );
  }

  const extrato =
    tipo === 'pegada' && form !== null && form.touched.saldoExtrato !== true
      ? extratoOn(loadResult.dataset, form.fields.dataPassagem ?? '')
      : null;
  const extratoHint =
    extrato === null
      ? undefined
      : `Preenchido com o extrato de ${form?.fields.dataPassagem ?? ''} (${formatMoney(extrato)}).`;
  const choice = REPORT_CHOICES.find((entry) => entry.tipo === tipo);

  return (
    <section class="report" aria-labelledby="relatorio-titulo">
      <div class="report-head">
        <h2 id="relatorio-titulo" tabIndex={-1} ref={headingRef}>
          Relatório
        </h2>
        <button type="button" class="button button-quiet" onClick={onBack}>
          Voltar aos dados
        </button>
      </div>

      <ReportPicker
        selected={tipo}
        onSelect={(next) => {
          setTipo(next);
          setSettled(null);
          setFailure(null);
        }}
      />

      {tipo !== null && api !== null && (
        <form
          class="report-form"
          aria-label={`Parâmetros: ${choice?.title ?? ''}`}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (ready && !generating) void generate();
          }}
        >
          <ReportFields
            tipo={tipo}
            api={api}
            atividades={loadResult.dataset.lists.atividades}
            showManualOpening={showManualOpening}
            extratoHint={extratoHint}
          />

          {evaluation !== null && (
            <ReportIssues issues={reportIssues(evaluation)} />
          )}
          {evaluation?.status === 'failure' && (
            <p class="notice notice-error" role="alert">
              {GENERIC_FAILURE} {evaluation.message}
            </p>
          )}
          {failure !== null && (
            <p class="notice notice-error" role="alert">
              {failure}
            </p>
          )}

          <div class="actions">
            <button
              type="submit"
              ref={submitRef}
              class="button"
              disabled={!ready || generating}
            >
              {generating ? 'A gerar…' : 'Gerar PDF'}
            </button>
            {generated !== null && !generating && (
              <button
                type="button"
                class="button button-quiet"
                onClick={() => {
                  setPreviewing(true);
                }}
              >
                Ver o último PDF
              </button>
            )}
            {errorCount > 0 && (
              <span class="hint">
                {errorCount === 1
                  ? 'Falta preencher ou corrigir 1 campo.'
                  : `Faltam preencher ou corrigir ${String(errorCount)} campos.`}
              </span>
            )}
            {errorCount === 0 && blocked && (
              <span class="hint">Resolva os erros acima para gerar o PDF.</span>
            )}
            {generating && engine.status === 'loading' && (
              <span class="hint">{engineProgressLabel(engine.progress)}</span>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
