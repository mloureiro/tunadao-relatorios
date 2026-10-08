import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'preact/hooks';
import type { ColumnMapping } from '@/core/input/csv';
import { loadDataset, type InputFile } from '@/core/pipeline';
import { startEngine } from './engine';
import { EngineStatus } from './EngineStatus';
import { IssuesPanel } from './IssuesPanel';
import { prepareInputs, readInputFiles, selectionProblem } from './load-files';
import { MappingPanel } from './MappingPanel';
import { ReportFlow } from './ReportFlow';
import { browserStorage, clearProfile, saveProfile } from './profiles';
import { resetState, setState, useAppState } from './state';
import { Stepper } from './Stepper';
import { UploadPanel } from './UploadPanel';
import { countIssues, describeCounts, type IssueCounts } from './validation';

interface StatusInput {
  loading: boolean;
  loadFailed: boolean;
  pendingName: string | null;
  hasResult: boolean;
  valid: boolean;
  counts: IssueCounts;
}

function describeStatus(input: StatusInput): string {
  if (input.loading) return 'A validar os dados…';
  if (input.loadFailed) return 'Não foi possível validar os dados.';
  if (input.pendingName !== null) {
    return `Falta associar as colunas de ${input.pendingName}.`;
  }
  if (!input.hasResult) return '';
  const counts = describeCounts(input.counts);
  return input.valid
    ? `Dados válidos. ${counts}.`
    : `Há erros a corrigir. ${counts}.`;
}

export function App() {
  const { files, dataset, issues, loadResult } = useAppState();
  const [rawFiles, setRawFiles] = useState<InputFile[]>([]);
  const [chosen, setChosen] = useState<Record<string, ColumnMapping>>({});
  const [profileVersion, setProfileVersion] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [reportAnnouncement, setReportAnnouncement] = useState('');
  const selection = useRef(0);
  const onPreviewing = useCallback((value: boolean) => {
    setPreviewing(value);
  }, []);

  const prepared = useMemo(
    () => prepareInputs(rawFiles, chosen, browserStorage()),
    [rawFiles, chosen, profileVersion],
  );

  useEffect(() => {
    if (prepared.ready.length === 0) {
      resetState();
      return;
    }
    let current = true;
    setLoading(true);
    setLoadFailed(false);
    loadDataset(prepared.ready).then(
      (result) => {
        if (!current) return;
        setLoading(false);
        setState({
          files: prepared.ready,
          dataset: result.dataset,
          issues: result.issues,
          loadResult: result,
        });
      },
      () => {
        if (!current) return;
        setLoading(false);
        setLoadFailed(true);
        resetState();
      },
    );
    return () => {
      current = false;
    };
  }, [prepared]);

  async function pick(chosenFiles: File[]) {
    if (chosenFiles.length === 0) return;
    selection.current += 1;
    const mine = selection.current;
    const rejected = selectionProblem(chosenFiles.map((file) => file.name));
    setProblem(rejected);
    if (rejected !== null) return;
    void startEngine().catch(() => undefined);
    let read: InputFile[];
    try {
      read = await readInputFiles(chosenFiles);
    } catch {
      if (mine === selection.current) {
        setProblem(
          'Não foi possível ler o ficheiro. Volte a escolhê-lo ou copie-o para este computador.',
        );
      }
      return;
    }
    if (mine !== selection.current) return;
    setChosen({});
    setRawFiles(read);
  }

  function clear() {
    selection.current += 1;
    setRawFiles([]);
    setChosen({});
    setProblem(null);
  }

  const first = prepared.pending[0];
  const hasData = rawFiles.length > 0;
  const counts = countIssues(issues);
  const hasErrors = counts.errors > 0;
  const valid =
    hasData &&
    !loading &&
    dataset !== null &&
    first === undefined &&
    !hasErrors;

  useEffect(() => {
    if (!valid) setReporting(false);
  }, [valid]);

  const inReport = reporting && valid && loadResult !== null;

  const announcement = describeStatus({
    loading,
    loadFailed,
    pendingName: first?.name ?? null,
    hasResult: hasData && dataset !== null,
    valid,
    counts,
  });

  const wasReporting = useRef(false);
  useEffect(() => {
    if (wasReporting.current && !inReport) {
      document.getElementById('validacao-titulo')?.focus();
    }
    wasReporting.current = inReport;
  }, [inReport]);

  const stepIndex = !inReport ? 0 : previewing ? 2 : 1;

  return (
    <div class="page">
      <header class="masthead">
        <h1>Gerador de relatórios financeiros · TUNADÃO 1998</h1>
        <Stepper current={stepIndex} />
      </header>

      <p role="status" class="visually-hidden">
        {reportAnnouncement === '' ? announcement : reportAnnouncement}
      </p>

      <main>
        {inReport ? (
          <ReportFlow
            loadResult={loadResult}
            onBack={() => {
              setReporting(false);
              setPreviewing(false);
              setReportAnnouncement('');
            }}
            onPreviewing={onPreviewing}
            onAnnounce={setReportAnnouncement}
          />
        ) : (
          <>
            <UploadPanel
              files={rawFiles}
              problem={problem}
              onPick={(picked) => void pick(picked)}
              onClear={clear}
            />

            {prepared.autoMapped.length > 0 && (
              <section class="notice notice-info" aria-label="Perfis aplicados">
                {prepared.autoMapped.map(({ name, table }) => (
                  <p key={name}>
                    Aplicámos o perfil guardado de colunas ao ficheiro{' '}
                    <strong>{name}</strong>.{' '}
                    <button
                      type="button"
                      class="link-button"
                      onClick={() => {
                        clearProfile(browserStorage(), table.header);
                        setProfileVersion((version) => version + 1);
                      }}
                    >
                      Esquecer perfil
                    </button>
                  </p>
                ))}
              </section>
            )}

            {first !== undefined && (
              <MappingPanel
                key={first.name}
                pending={first}
                onApply={(mapping, save) => {
                  if (save)
                    saveProfile(browserStorage(), first.table.header, mapping);
                  setChosen((previous) => ({
                    ...previous,
                    [first.name]: mapping,
                  }));
                }}
              />
            )}

            {hasData && loading && <p>A validar os dados…</p>}
            {loadFailed && (
              <p class="notice notice-error" role="alert">
                Não foi possível validar os dados. Volte a escolher o ficheiro.
              </p>
            )}
            {hasData &&
              !loading &&
              (dataset !== null || first !== undefined) && (
                <IssuesPanel
                  issues={issues}
                  valid={valid}
                  blockedByMapping={first !== undefined}
                  onContinue={() => {
                    setReporting(true);
                  }}
                />
              )}
            {files.length === 0 && !hasData && (
              <p class="lead">
                Comece por carregar o ficheiro da Tesouraria. Os erros aparecem
                aqui com o separador, a linha e a coluna a corrigir.
              </p>
            )}
          </>
        )}
      </main>

      <EngineStatus />
    </div>
  );
}
