import type { TemplateId } from './renderer';

export interface AssetManifest {
  templates: readonly string[];
  fonts: readonly string[];
  images: readonly string[];
}

export const defaultManifest: AssetManifest = {
  templates: [
    'templates/hello.typ',
    'templates/evento.typ',
    'templates/pegada.typ',
    'templates/letivo.typ',
    'templates/fiscal.typ',
    'templates/lib/page.typ',
    'templates/lib/sections.typ',
    'templates/lib/charts.typ',
  ],
  fonts: [
    'assets/fonts/Lato-Regular.ttf',
    'assets/fonts/Lato-Bold.ttf',
    'assets/fonts/Lato-Italic.ttf',
    'assets/fonts/Lato-BoldItalic.ttf',
    'assets/fonts/CarterOne.ttf',
    'assets/fonts/Rubik-Bold.ttf',
    'assets/fonts/Nunito-Regular.ttf',
    'assets/fonts/Nunito-Bold.ttf',
  ],
  images: ['assets/letterhead/selo.jpg', 'assets/letterhead/fundo.png'],
};

export const REPORT_DATA_PATH = 'data/report.json';

export function mainTemplatePath(id: TemplateId): string {
  return `templates/${id}.typ`;
}
