import { renderTestPdf } from './engine';
import { useAppState } from './state';

function megabytes(bytes: number): string {
  return (bytes / 1_048_576).toFixed(1);
}

function download(pdf: Uint8Array): void {
  const url = URL.createObjectURL(
    new Blob([pdf.slice().buffer], { type: 'application/pdf' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = 'teste.pdf';
  link.click();
  URL.revokeObjectURL(url);
}

export function EngineProbe() {
  const { engine } = useAppState();
  const busy = engine.status === 'loading' || engine.status === 'busy';

  return (
    <footer class="engine">
      {engine.status === 'loading' && (
        <p role="status">
          A preparar o motor de PDF
          {engine.progress === null
            ? '…'
            : ` (${megabytes(engine.progress.loaded)}${
                engine.progress.total === null
                  ? ''
                  : ` / ${megabytes(engine.progress.total)}`
              } MB)`}
        </p>
      )}
      {engine.status === 'error' && <p role="alert">{engine.message}</p>}
      <button
        type="button"
        class="button button-quiet"
        disabled={busy}
        onClick={() => {
          void renderTestPdf().then((pdf) => {
            if (pdf !== null) download(pdf);
          });
        }}
      >
        Gerar PDF de teste
      </button>
    </footer>
  );
}
