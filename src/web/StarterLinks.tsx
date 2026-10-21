import { REPORT_SPECS, REPORT_TIPOS } from '@/core/sheets/catalogue';
import { starterFileName } from '@/core/sheets/file-name';

const BASE = import.meta.env.BASE_URL;

export const TEMPLATE_URL = `${BASE}modelo-tesouraria.xlsx`;

export function StarterLinks() {
  return (
    <>
      <ul class="starter-list">
        {REPORT_TIPOS.map((tipo) => (
          <li key={tipo}>
            <a
              class="link"
              href={`${BASE}folhas/${starterFileName(tipo)}`}
              download={starterFileName(tipo)}
            >
              {REPORT_SPECS[tipo].label}
            </a>
          </li>
        ))}
      </ul>
      <details class="how-to">
        <summary>Como acrescentar uma folha à Tesouraria</summary>
        <ul>
          <li>
            Excel: clique com o botão direito num separador e escolha Mover ou
            Copiar.
          </li>
          <li>LibreOffice: Folha, Inserir folha a partir de ficheiro.</li>
          <li>Google Sheets: Ficheiro, Importar, Inserir novas folhas.</li>
        </ul>
        <p>Preencha a folha, grave a Tesouraria e carregue-a outra vez aqui.</p>
      </details>
    </>
  );
}
