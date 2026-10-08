import { useEffect, useMemo, useState } from 'preact/hooks';
import type { ColumnMapping } from '@/core/input/csv';
import { loadDataset, type InputFile } from '@/core/pipeline';
import { startEngine } from './engine';
import { EngineProbe } from './EngineProbe';
import { IssuesPanel } from './IssuesPanel';
import { prepareInputs, readInputFiles, selectionProblem } from './load-files';
import { MappingPanel } from './MappingPanel';
import { browserStorage, clearProfile, saveProfile } from './profiles';
import { resetState, setState, useAppState } from './state';
import { Stepper } from './Stepper';
import { UploadPanel } from './UploadPanel';
import { countIssues } from './validation';

export function App() {
  const { files, dataset, issues } = useAppState();
  const [rawFiles, setRawFiles] = useState<InputFile[]>([]);
  const [chosen, setChosen] = useState<Record<string, ColumnMapping>>({});
  const [profileVersion, setProfileVersion] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    void loadDataset(prepared.ready).then((result) => {
      if (!current) return;
      setLoading(false);
      setState({
        files: prepared.ready,
        dataset: result.dataset,
        issues: result.issues,
        loadResult: result,
      });
    });
    return () => {
      current = false;
    };
  }, [prepared]);

  async function pick(chosenFiles: File[]) {
    if (chosenFiles.length === 0) return;
    const rejected = selectionProblem(chosenFiles.map((file) => file.name));
    setProblem(rejected);
    if (rejected !== null) return;
    void startEngine().catch(() => undefined);
    setChosen({});
    setRawFiles(await readInputFiles(chosenFiles));
  }

  function clear() {
    setRawFiles([]);
    setChosen({});
    setProblem(null);
  }

  const first = prepared.pending[0];
  const hasData = rawFiles.length > 0;
  const hasErrors = countIssues(issues).errors > 0;
  const valid =
    hasData &&
    !loading &&
    dataset !== null &&
    first === undefined &&
    !hasErrors;

  return (
    <div class="page">
      <header class="masthead">
        <h1>Gerador de relatórios financeiros · TUNADÃO 1998</h1>
        <Stepper />
      </header>

      <main>
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
              setChosen((previous) => ({ ...previous, [first.name]: mapping }));
            }}
          />
        )}

        {hasData && loading && <p role="status">A validar os dados…</p>}
        {hasData && !loading && (dataset !== null || first !== undefined) && (
          <IssuesPanel
            issues={issues}
            valid={valid}
            blockedByMapping={first !== undefined}
          />
        )}
        {files.length === 0 && !hasData && (
          <p class="lead">
            Comece por carregar a folha de Tesouraria. Os erros aparecem aqui
            com o separador, a linha e a coluna a corrigir.
          </p>
        )}
      </main>

      <EngineProbe />
    </div>
  );
}
