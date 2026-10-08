import type { TemplateId } from './renderer';

export interface AssetManifest {
  templates: readonly string[];
  fonts: readonly string[];
  logo: string;
}

export const defaultManifest: AssetManifest = {
  templates: [
    'templates/hello.typ',
    'templates/evento.typ',
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
  ],
  logo: 'assets/logo.svg',
};

export const REPORT_DATA_PATH = 'data/report.json';

export function mainTemplatePath(id: TemplateId): string {
  return `templates/${id}.typ`;
}
