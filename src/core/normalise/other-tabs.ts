import type {
  Checkpoint,
  Genero,
  LinhaOrcamento,
  Pendente,
} from '../dataset/types.ts';
import {
  GENEROS_COLUMNS,
  ORCAMENTO_COLUMNS,
  PENDENTES_COLUMNS,
  SALDOS_COLUMNS,
  resolveColumns,
} from '../input/columns.ts';
import { isBlankRow, type RawTable } from '../input/raw-table.ts';
import { issueMessages, type Issue } from '../issues.ts';
import { formatMoney } from '../format.ts';
import {
  CONTAS,
  DIRECOES,
  RowReader,
  warnAmbiguousDateOrder,
} from './row-reader.ts';

const PENDENTE_TIPOS = ['A receber', 'A pagar'] as const;
const FONTES = ['Extrato', 'Contagem', 'Declarado'] as const;

export function normalisePendentes(
  tables: readonly RawTable[],
  issues: Issue[],
): Pendente[] {
  const result: Pendente[] = [];
  for (const table of tables) {
    const index = resolveColumns(table, 'Pendentes', PENDENTES_COLUMNS, issues);
    warnAmbiguousDateOrder(
      table,
      'Pendentes',
      PENDENTES_COLUMNS,
      index,
      'dataRegisto',
      issues,
    );
    table.rows.forEach((cells, offset) => {
      if (isBlankRow(cells)) return;
      const reader = new RowReader(
        table,
        'Pendentes',
        PENDENTES_COLUMNS,
        index,
        cells,
        table.firstDataRow + offset,
        issues,
      );
      const tipo = reader.enumValue('tipo', PENDENTE_TIPOS, true);
      const entidade = reader.requiredText('entidade');
      const descricao = reader.requiredText('descricao');
      const atividade = reader.text('atividade');
      const valor = reader.money('valor', true);
      const dataRegisto = reader.date('dataRegisto', true);
      const dataLiquidacao = reader.date('dataLiquidacao', false);
      const notas = reader.text('notas');

      if (valor !== null && valor.cents <= 0) {
        const other = tipo === 'A receber' ? 'A pagar' : 'A receber';
        reader.report(
          'non-positive-value',
          issueMessages['non-positive-value'](valor.cents),
          'valor',
          tipo !== null && valor.cents < 0
            ? `Se é um valor "${other}", altere o Tipo para "${other}" e use ${formatMoney(-valor.cents)}.`
            : undefined,
        );
      }

      if (
        reader.failed ||
        tipo === null ||
        entidade === null ||
        descricao === null ||
        valor === null ||
        dataRegisto === null
      ) {
        return;
      }
      result.push({
        tipo,
        entidade,
        descricao,
        atividade,
        valorCents: valor.cents,
        dataRegisto,
        dataLiquidacao,
        notas,
        src: reader.src,
      });
    });
  }
  return result;
}

export function normaliseOrcamento(
  tables: readonly RawTable[],
  issues: Issue[],
): LinhaOrcamento[] {
  const result: LinhaOrcamento[] = [];
  for (const table of tables) {
    const index = resolveColumns(table, 'Orçamento', ORCAMENTO_COLUMNS, issues);
    table.rows.forEach((cells, offset) => {
      if (isBlankRow(cells)) return;
      const reader = new RowReader(
        table,
        'Orçamento',
        ORCAMENTO_COLUMNS,
        index,
        cells,
        table.firstDataRow + offset,
        issues,
      );
      const ambito = reader.requiredText('ambito');
      const tipo = reader.enumValue('tipo', DIRECOES, true);
      const rubrica = reader.requiredText('rubrica');
      const subRubrica = reader.text('subRubrica');
      const orcado = reader.money('orcado', true);

      if (orcado !== null && orcado.cents < 0) {
        reader.report(
          'negative-value',
          issueMessages['negative-value'](orcado.cents),
          'orcado',
        );
      }

      if (
        reader.failed ||
        ambito === null ||
        tipo === null ||
        rubrica === null ||
        orcado === null
      ) {
        return;
      }
      result.push({
        ambito,
        tipo,
        rubrica,
        subRubrica: subRubrica ?? rubrica,
        orcadoCents: orcado.cents,
        src: reader.src,
      });
    });
  }
  return result;
}

export function normaliseGeneros(
  tables: readonly RawTable[],
  issues: Issue[],
): Genero[] {
  const result: Genero[] = [];
  for (const table of tables) {
    const index = resolveColumns(table, 'Géneros', GENEROS_COLUMNS, issues);
    warnAmbiguousDateOrder(
      table,
      'Géneros',
      GENEROS_COLUMNS,
      index,
      'data',
      issues,
    );
    table.rows.forEach((cells, offset) => {
      if (isBlankRow(cells)) return;
      const reader = new RowReader(
        table,
        'Géneros',
        GENEROS_COLUMNS,
        index,
        cells,
        table.firstDataRow + offset,
        issues,
      );
      const data = reader.date('data', false);
      const atividade = reader.requiredText('atividade');
      const tipo = reader.requiredText('tipo');
      const quantidade = reader.text('quantidade');
      const emFalta = reader.count('emFalta');
      const valorEstimado = reader.money('valorEstimado', false);

      if (valorEstimado !== null && valorEstimado.cents < 0) {
        reader.report(
          'negative-value',
          issueMessages['negative-value'](valorEstimado.cents),
          'valorEstimado',
        );
      }

      if (reader.failed || atividade === null || tipo === null) return;
      result.push({
        data,
        atividade,
        tipo,
        quantidade,
        emFalta,
        valorEstimadoCents: valorEstimado?.cents ?? null,
        src: reader.src,
      });
    });
  }
  return result;
}

export function normaliseSaldos(
  tables: readonly RawTable[],
  issues: Issue[],
): Checkpoint[] {
  const result: Checkpoint[] = [];
  for (const table of tables) {
    const index = resolveColumns(table, 'Saldos', SALDOS_COLUMNS, issues);
    warnAmbiguousDateOrder(
      table,
      'Saldos',
      SALDOS_COLUMNS,
      index,
      'data',
      issues,
    );
    table.rows.forEach((cells, offset) => {
      if (isBlankRow(cells)) return;
      const reader = new RowReader(
        table,
        'Saldos',
        SALDOS_COLUMNS,
        index,
        cells,
        table.firstDataRow + offset,
        issues,
      );
      const data = reader.date('data', true);
      const conta = reader.enumValue('conta', CONTAS, true);
      const saldo = reader.money('saldo', true);
      const fonte = reader.enumValue('fonte', FONTES, true);

      if (
        reader.failed ||
        data === null ||
        conta === null ||
        saldo === null ||
        fonte === null
      ) {
        return;
      }
      result.push({
        data,
        conta,
        saldoCents: saldo.cents,
        fonte,
        src: reader.src,
      });
    });
  }
  return result;
}
