import type {
  ReportSheetSpec,
  WorkbookSpec,
} from '../../../scripts/lib/workbook-writer.ts';
import { LISTAS } from '../listas.ts';
import { invalidWorkbook, movimento } from './base.ts';

const EVENTO = {
  atividade: 'Funcionamento',
  eventoInicio: '2026-01-10',
  eventoFim: '2026-01-10',
};

function evento(day: number, extra: Record<string, unknown> = {}) {
  return {
    ...EVENTO,
    contarAte: `2026-01-${String(day)}`,
    ...extra,
  };
}

const PEGADA = {
  dataUltimoRelatorio: '2025-12-31',
  dataPassagem: '2026-01-31',
  direcaoCessante: 'Direção cessante',
  direcaoEntrante: 'Direção entrante',
  saldoExtrato: 0,
};

export const REPORT_SHEET_CASES: readonly ReportSheetSpec[] = [
  { tipo: 'evento', name: 'Válida', values: evento(11) },
  {
    tipo: 'evento',
    name: 'Sem atividade',
    values: { ...EVENTO, atividade: undefined },
  },
  {
    tipo: 'evento',
    name: 'Data inválida',
    values: {
      atividade: EVENTO.atividade,
      eventoFim: EVENTO.eventoFim,
      contarAte: '2026-01-15',
    },
    cells: { B5: '31/02/2026' },
  },
  {
    tipo: 'evento',
    name: 'Data em texto',
    values: {
      atividade: EVENTO.atividade,
      eventoFim: EVENTO.eventoFim,
      contarAte: '2026-01-16',
    },
    cells: { B5: '10/01/2026' },
  },
  {
    tipo: 'evento',
    name: 'Fórmula sem valor',
    values: { eventoInicio: EVENTO.eventoInicio, eventoFim: EVENTO.eventoFim },
    cells: { B4: { formula: 'A9' } },
  },
  {
    tipo: 'evento',
    name: 'Orçamento desconhecido',
    values: evento(12, { ambitoOrcamento: 'Festa que não existe' }),
  },
  {
    tipo: 'evento',
    name: 'Versão nova',
    values: evento(13),
    cells: { B2: 2 },
  },
  {
    tipo: 'evento',
    name: 'Tipo desconhecido',
    values: evento(14),
    cells: { B1: 'Relatório de teste' },
  },
  {
    tipo: 'pegada',
    name: 'Denominação errada',
    values: PEGADA,
    cells: { A31: 25 },
  },
];

export const REPORT_SHEETS: WorkbookSpec = {
  ...invalidWorkbook(
    [movimento({ descricao: 'Quotas em numerário' })],
    [],
    REPORT_SHEET_CASES,
  ),
  listas: { ...LISTAS, orcamentos: ['Funcionamento'] },
  orcamento: [
    {
      ambito: 'Funcionamento',
      tipo: 'Entrada',
      rubrica: 'Quotas',
      subRubrica: null,
      orcadoCents: 10000,
    },
  ],
};
