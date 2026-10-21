import { FilePicker } from './FilePicker';
import { StarterLinks, TEMPLATE_URL } from './StarterLinks';

interface Props {
  readonly dragging: boolean;
  readonly onPick: (files: File[]) => void;
}

export function Intake({ dragging, onPick }: Props) {
  return (
    <>
      <p class="lead">
        Carregue o ficheiro da Tesouraria e descarregue os relatórios.
      </p>

      <div class={dragging ? 'dropzone dropzone-over' : 'dropzone'}>
        <svg
          class="dropzone-glyph"
          width="72"
          height="72"
          viewBox="0 0 72 72"
          aria-hidden="true"
          focusable="false"
        >
          <rect
            x="10"
            y="8"
            width="52"
            height="56"
            rx="4"
            fill="none"
            stroke="currentColor"
            stroke-width="3"
          />
          <path
            d="M10 24h52M10 40h52M28 8v56M45 8v56"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            opacity="0.45"
          />
          <rect class="glyph-cell" x="28" y="24" width="17" height="16" />
        </svg>
        <p class="dropzone-title">Largue aqui o ficheiro da Tesouraria</p>
        <FilePicker className="button" onPick={onPick}>
          Escolher ficheiro (.xlsx)
        </FilePicker>
        <p class="privacy">O ficheiro nunca sai deste computador.</p>
      </div>

      <div class="help-grid">
        <section aria-labelledby="modelo-titulo">
          <h2 id="modelo-titulo">Ainda não tem a Tesouraria?</h2>
          <p>Comece pelo modelo e preencha-o no Excel ou no LibreOffice.</p>
          <a class="link" href={TEMPLATE_URL} download="modelo-tesouraria.xlsx">
            Descarregar modelo da tesouraria (.xlsx)
          </a>
        </section>
        <section aria-labelledby="folhas-titulo">
          <h2 id="folhas-titulo">Folhas de relatório</h2>
          <p>
            Cada relatório é uma folha dentro da Tesouraria. Acrescente as que
            precisar.
          </p>
          <StarterLinks />
        </section>
      </div>
    </>
  );
}
