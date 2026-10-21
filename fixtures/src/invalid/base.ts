import type {
  MovimentoSpec,
  ReportSheetSpec,
  SaldoSpec,
  WorkbookSpec,
} from '../../../scripts/lib/workbook-writer.ts';
import { LISTAS } from '../listas.ts';

export function movimento(
  overrides: Partial<MovimentoSpec> = {},
): MovimentoSpec {
  return {
    data: '2026-01-10',
    doc: null,
    descricao: 'Movimento',
    atividade: 'Funcionamento',
    rubrica: 'Quotas',
    subRubrica: null,
    tipo: 'Entrada',
    meio: 'Caixa',
    valorCents: 5000,
    ...overrides,
  };
}

export function invalidWorkbook(
  movimentos: readonly MovimentoSpec[],
  saldos: readonly SaldoSpec[] = [],
  reportSheets: readonly ReportSheetSpec[] = [],
): WorkbookSpec {
  return {
    listas: LISTAS,
    movimentos,
    pendentes: [],
    orcamento: [],
    generos: [],
    saldos,
    reportSheets,
    instrucoes: [
      {
        titulo: 'Ficheiro de teste com erros propositados',
        paragrafos: ['Dados inventados que reproduzem classes de erros reais.'],
      },
    ],
  };
}
