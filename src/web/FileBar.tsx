import { FilePicker } from './FilePicker';

interface Props {
  readonly name: string;
  readonly time: string;
  readonly onPick: (files: File[]) => void;
}

export function FileBar({ name, time, onPick }: Props) {
  return (
    <section class="filebar" aria-label="Ficheiro carregado">
      <p class="filebar-name">
        <span class="filebar-file">{name}</span>
        <span class="filebar-time">carregado às {time}</span>
      </p>
      <div class="filebar-action">
        <FilePicker className="button button-secondary" onPick={onPick}>
          Carregar versão corrigida
        </FilePicker>
        <p class="hint">Ou largue o ficheiro em qualquer ponto da página.</p>
      </div>
    </section>
  );
}
