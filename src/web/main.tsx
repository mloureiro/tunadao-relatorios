import { render } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import helloSample from '@/engine/hello-sample.json';
import { createWebRenderer, type WasmProgress } from '@/engine/typst-web';

function describeProgress({ loaded, total }: WasmProgress): string {
  const loadedMb = (loaded / 1_048_576).toFixed(1);
  if (total === null) return `${loadedMb} MB`;
  return `${loadedMb} / ${(total / 1_048_576).toFixed(1)} MB`;
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

function App() {
  const [progress, setProgress] = useState<WasmProgress | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'busy' | 'error'>(
    'loading',
  );
  const [message, setMessage] = useState('');
  const renderer = useMemo(
    () => createWebRenderer({ onProgress: setProgress }),
    [],
  );

  useEffect(() => {
    renderer.warmUp().then(
      () => {
        setStatus('ready');
      },
      (error: unknown) => {
        setStatus('error');
        setMessage(error instanceof Error ? error.message : String(error));
      },
    );
  }, [renderer]);

  async function generate() {
    setStatus('busy');
    try {
      const { pdf } = await renderer.render('hello', helloSample);
      download(pdf);
      setStatus('ready');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <main>
      <h1>Gerador de relatórios financeiros</h1>
      {status === 'loading' && (
        <p role="status">
          A carregar o motor de PDF
          {progress ? ` (${describeProgress(progress)})` : '…'}
        </p>
      )}
      {status === 'error' && <p role="alert">{message}</p>}
      <button
        type="button"
        disabled={status === 'loading' || status === 'busy'}
        onClick={() => void generate()}
      >
        Gerar PDF de teste
      </button>
    </main>
  );
}

const root = document.getElementById('app');
if (root) render(<App />, root);
