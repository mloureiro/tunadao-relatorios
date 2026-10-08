import { useAppState } from './state';

function megabytes(bytes: number): string {
  return (bytes / 1_048_576).toFixed(1);
}

export function EngineStatus() {
  const { engine } = useAppState();
  if (engine.status === 'loading') {
    return (
      <footer class="engine">
        <p>
          A preparar o motor de PDF
          {engine.progress === null
            ? '…'
            : ` (${megabytes(engine.progress.loaded)}${
                engine.progress.total === null
                  ? ''
                  : ` / ${megabytes(engine.progress.total)}`
              } MB)`}
        </p>
      </footer>
    );
  }
  if (engine.status === 'error') {
    return (
      <footer class="engine">
        <p role="alert">O motor de PDF falhou: {engine.message}</p>
      </footer>
    );
  }
  return null;
}
