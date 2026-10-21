import { useCallback, useRef, useState } from 'preact/hooks';
import { loadWorkbook, type WorkbookResult } from '@/core/workbook';
import { GENERATOR_VERSION } from '@/core/version';
import { lisbonDateTime } from '@/host/lisbon-time';
import { config } from './config';
import { startEngine } from './engine';
import { DataIssues } from './DataIssues';
import { DataSummary } from './DataSummary';
import { FileBar } from './FileBar';
import { Intake } from './Intake';
import { Notice } from './Notice';
import { ReportList } from './ReportList';
import { UpdateNotice } from './UpdateNotice';
import { useWindowDrop } from './use-window-drop';
import {
  checkContents,
  checkSelection,
  clockLabel,
  countErrors,
  isUnreadable,
  loadedAnnouncement,
  UNREADABLE,
} from './view-model';

interface Loaded {
  readonly id: number;
  readonly name: string;
  readonly time: string;
  readonly result: WorkbookResult;
}

export function App() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [reading, setReading] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ id: number; text: string } | null>(
    null,
  );
  const [announcement, setAnnouncement] = useState('');
  const attempt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const announce = useCallback((message: string) => {
    clearTimeout(timer.current);
    setAnnouncement('');
    timer.current = setTimeout(() => {
      setAnnouncement(message);
    }, 60);
  }, []);

  const pick = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (file === undefined) return;
      attempt.current += 1;
      const mine = attempt.current;
      const refuse = (text: string) => {
        setReading(null);
        setNotice({ id: mine, text });
        announce(text);
      };

      const refusal = checkSelection(files.map(({ name }) => name));
      if (refusal !== null) {
        refuse(refusal);
        return;
      }
      setNotice(null);
      setReading(file.name);
      void startEngine().catch(() => undefined);
      announce('A ler o ficheiro…');

      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const wrongContents = checkContents(bytes);
        if (wrongContents !== null) {
          if (mine === attempt.current) refuse(wrongContents);
          return;
        }
        const now = lisbonDateTime(new Date());
        const result = await loadWorkbook(
          { name: file.name, bytes },
          { config, now, generatorVersion: GENERATOR_VERSION },
        );
        if (mine !== attempt.current) return;
        if (isUnreadable(result)) {
          refuse(UNREADABLE);
          return;
        }
        setReading(null);
        setLoaded({ id: mine, name: file.name, time: clockLabel(now), result });
        announce(loadedAnnouncement(result));
      } catch {
        if (mine === attempt.current) refuse(UNREADABLE);
      }
    },
    [announce],
  );

  const dragging = useWindowDrop((files) => void pick(files), announce);
  const onPick = (files: File[]) => void pick(files);

  const dataErrors =
    loaded === null ? 0 : countErrors(loaded.result.load.issues);

  return (
    <div class="page">
      <header class="masthead">
        <h1>
          Relatórios financeiros do <span class="wordmark">TUNADÃO 1998</span>
        </h1>
      </header>

      <p role="status" class="visually-hidden">
        {announcement}
      </p>

      <UpdateNotice announce={announce} />

      <main>
        {reading !== null ? (
          <section class="filebar" aria-label="Ficheiro a ler">
            <p class="filebar-name">
              <span class="filebar-file">{reading}</span>
              <span class="filebar-time">A ler o ficheiro…</span>
            </p>
          </section>
        ) : loaded === null ? (
          <>
            {notice !== null && (
              <Notice key={notice.id} message={notice.text} />
            )}
            <Intake dragging={dragging} onPick={onPick} />
          </>
        ) : (
          <>
            <FileBar name={loaded.name} time={loaded.time} onPick={onPick} />
            {notice !== null && (
              <Notice key={notice.id} message={notice.text} />
            )}
            {loaded.result.summary !== null && (
              <DataSummary summary={loaded.result.summary} />
            )}
            {loaded.result.load.issues.length > 0 && (
              <DataIssues
                key={loaded.id}
                issues={loaded.result.load.issues}
                focusOnMount={dataErrors > 0}
              />
            )}
            <ReportList
              key={loaded.id}
              reports={loaded.result.reports}
              focusOnMount={dataErrors === 0}
              announce={announce}
            />
          </>
        )}
      </main>

      {dragging && (
        <div class="drop-overlay" aria-hidden="true">
          <p>Largue o ficheiro para o carregar</p>
        </div>
      )}
    </div>
  );
}
