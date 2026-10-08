import { useState } from 'preact/hooks';
import type { InputFile } from '@/core/pipeline';

interface Props {
  files: readonly InputFile[];
  problem: string | null;
  onPick: (files: File[]) => void;
  onClear: () => void;
}

const TEMPLATE_URL = `${import.meta.env.BASE_URL}modelo-tesouraria.xlsx`;

function describeSize(bytes: number): string {
  return bytes < 1024
    ? `${String(bytes)} B`
    : `${String(Math.round(bytes / 1024))} KB`;
}

export function UploadPanel({ files, problem, onPick, onClear }: Props) {
  const [dragging, setDragging] = useState(false);

  return (
    <section class="intake" aria-labelledby="dados-titulo">
      <h2 id="dados-titulo">Dados da tesouraria</h2>
      <div class="intake-grid">
        <div class="template-card">
          <h3>Ainda não tem o modelo?</h3>
          <p>
            Descarregue o modelo, preencha-o no Excel ou no LibreOffice e volte
            aqui.
          </p>
          <a
            class="button button-secondary"
            href={TEMPLATE_URL}
            download="modelo-tesouraria.xlsx"
          >
            Descarregar modelo (.xlsx)
          </a>
        </div>

        <label
          class={dragging ? 'dropzone dropzone-over' : 'dropzone'}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => {
            setDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            onPick(Array.from(event.dataTransfer?.files ?? []));
          }}
        >
          <input
            class="visually-hidden"
            type="file"
            accept=".xlsx,.csv"
            multiple
            aria-describedby="dropzone-ajuda"
            onChange={(event) => {
              onPick(Array.from(event.currentTarget.files ?? []));
              event.currentTarget.value = '';
            }}
          />
          <span class="dropzone-title">
            Largue aqui o ficheiro da Tesouraria
          </span>
          <span class="dropzone-action">ou escolha o ficheiro</span>
          <span id="dropzone-ajuda" class="dropzone-help">
            Um ficheiro .xlsx, ou vários ficheiros .csv. Os ficheiros são lidos
            neste computador e não são enviados para lado nenhum.
          </span>
        </label>
      </div>

      {problem !== null && (
        <p class="notice notice-error" role="alert">
          {problem}
        </p>
      )}

      {files.length > 0 && (
        <div class="file-list">
          <h3>Ficheiros carregados</h3>
          <ul>
            {files.map((file) => (
              <li key={file.name}>
                <span class="file-name">{file.name}</span>
                <span class="file-size">{describeSize(file.bytes.length)}</span>
              </li>
            ))}
          </ul>
          <button type="button" class="button button-quiet" onClick={onClear}>
            Limpar
          </button>
        </div>
      )}
    </section>
  );
}
