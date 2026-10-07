import type {
  Conta,
  Direcao,
  Lists,
  MeioDef,
  RubricaDef,
  SubRubricaDef,
} from '../dataset/types.ts';
import { headerRow } from '../input/columns.ts';
import { isBlankRow, type RawTable } from '../input/raw-table.ts';
import { issueMessages, makeIssue, type Issue } from '../issues.ts';
import { normaliseHeader } from '../text.ts';
import { CONTAS, DIRECOES, RowReader } from './row-reader.ts';

interface BlockSpec {
  readonly label: string;
  readonly headers: readonly string[];
  readonly anchoredOnSecond?: boolean;
}

const RUBRICAS: BlockSpec = {
  label: 'Rubricas',
  headers: ['Rubrica', 'Tipo', 'Conta para o resultado'],
  anchoredOnSecond: true,
};
const SUB_RUBRICAS: BlockSpec = {
  label: 'Sub-rubricas',
  headers: ['Sub-rubrica', 'Rubrica'],
};
const ATIVIDADES: BlockSpec = { label: 'Atividades', headers: ['Atividade'] };
const MEIOS: BlockSpec = { label: 'Meios', headers: ['Meio', 'Conta'] };

const RUBRICAS_COLUMNS = {
  rubrica: { header: 'Rubrica', required: true },
  tipo: { header: 'Tipo', required: false },
  contaResultado: { header: 'Conta para o resultado', required: true },
} as const;
const SUB_RUBRICAS_COLUMNS = {
  subRubrica: { header: 'Sub-rubrica', required: true },
  rubrica: { header: 'Rubrica', required: true },
} as const;
const ATIVIDADES_COLUMNS = {
  atividade: { header: 'Atividade', required: true },
} as const;
const MEIOS_COLUMNS = {
  meio: { header: 'Meio', required: true },
  conta: { header: 'Conta', required: true },
} as const;

function blockStart(
  header: readonly string[],
  block: BlockSpec,
): number | null {
  const wanted = block.headers.map(normaliseHeader);
  const anchor = wanted[0];
  const second = wanted[1];
  const at = header.findIndex(
    (cell, position) =>
      cell === anchor &&
      (block.anchoredOnSecond !== true || header[position + 1] === second),
  );
  return at >= 0 ? at : null;
}

function locate(
  table: RawTable,
  block: BlockSpec,
  issues: Issue[],
): number[] | null {
  const header = table.header.map(normaliseHeader);
  const start = blockStart(header, block);
  const where = {
    file: table.source,
    tab: 'Listas' as const,
    row: headerRow(table),
  };

  if (start === null) {
    for (const wanted of block.headers) {
      issues.push(
        makeIssue(
          'missing-column',
          issueMessages['missing-column'](
            `${block.label}: ${wanted}`,
            'Listas',
          ),
          { ...where, column: `${block.label}: ${wanted}` },
        ),
      );
    }
    return null;
  }

  return block.headers.map((wanted, offset) => {
    if (header[start + offset] === normaliseHeader(wanted))
      return start + offset;
    issues.push(
      makeIssue(
        'missing-column',
        issueMessages['missing-column'](wanted, 'Listas'),
        { ...where, column: wanted },
      ),
    );
    return -1;
  });
}

function duplicate(
  table: RawTable,
  row: number,
  block: string,
  key: string,
  column: string,
  issues: Issue[],
): void {
  issues.push(
    makeIssue(
      'duplicate-listas',
      issueMessages['duplicate-listas'](block, key),
      {
        file: table.source,
        tab: 'Listas',
        row,
        column,
      },
    ),
  );
}

function blockIndex<K extends string>(
  keys: readonly K[],
  columns: readonly number[] | null,
): Record<K, number | null> {
  const index = {} as Record<K, number | null>;
  keys.forEach((key, position) => {
    const at = columns?.[position] ?? -1;
    index[key] = at >= 0 ? at : null;
  });
  return index;
}

function blockRows(
  table: RawTable,
  columns: readonly number[] | null,
): { cells: RawTable['rows'][number]; row: number }[] {
  if (columns === null) return [];
  const used = columns.filter((at) => at >= 0);
  return table.rows.flatMap((cells, offset) =>
    isBlankRow(used.map((at) => cells[at] ?? null))
      ? []
      : [{ cells, row: table.firstDataRow + offset }],
  );
}

export function normaliseListas(
  tables: readonly RawTable[],
  issues: Issue[],
): Lists {
  const rubricas: RubricaDef[] = [];
  const subRubricas: SubRubricaDef[] = [];
  const atividades: string[] = [];
  const meios: MeioDef[] = [];

  for (const table of tables) {
    const rubricaColumns = locate(table, RUBRICAS, issues);
    const rubricaIndex = blockIndex(
      ['rubrica', 'tipo', 'contaResultado'],
      rubricaColumns,
    );
    for (const { cells, row } of blockRows(table, rubricaColumns)) {
      const reader = new RowReader(
        table,
        'Listas',
        RUBRICAS_COLUMNS,
        rubricaIndex,
        cells,
        row,
        issues,
      );
      const rubrica = reader.requiredText('rubrica');
      const contaResultado = reader.yesNo('contaResultado', true);
      const tipo: Direcao | null =
        contaResultado === true
          ? reader.enumValue('tipo', DIRECOES, true)
          : null;
      if (rubrica === null || reader.failed) continue;
      if (rubricas.some((known) => known.rubrica === rubrica)) {
        duplicate(table, row, RUBRICAS.label, rubrica, 'Rubrica', issues);
        continue;
      }
      rubricas.push({
        rubrica,
        tipo,
        contaResultado: contaResultado === true,
        order: rubricas.length,
        src: reader.src,
      });
    }

    const subColumns = locate(table, SUB_RUBRICAS, issues);
    const subIndex = blockIndex(['subRubrica', 'rubrica'], subColumns);
    for (const { cells, row } of blockRows(table, subColumns)) {
      const reader = new RowReader(
        table,
        'Listas',
        SUB_RUBRICAS_COLUMNS,
        subIndex,
        cells,
        row,
        issues,
      );
      const subRubrica = reader.requiredText('subRubrica');
      const rubrica = reader.requiredText('rubrica');
      if (subRubrica === null || rubrica === null) continue;
      if (
        subRubricas.some(
          (known) =>
            known.subRubrica === subRubrica && known.rubrica === rubrica,
        )
      ) {
        duplicate(
          table,
          row,
          SUB_RUBRICAS.label,
          `${subRubrica} (${rubrica})`,
          'Sub-rubrica',
          issues,
        );
        continue;
      }
      subRubricas.push({
        subRubrica,
        rubrica,
        order: subRubricas.length,
        src: reader.src,
      });
    }

    const atividadeColumns = locate(table, ATIVIDADES, issues);
    const atividadeIndex = blockIndex(['atividade'], atividadeColumns);
    for (const { cells, row } of blockRows(table, atividadeColumns)) {
      const reader = new RowReader(
        table,
        'Listas',
        ATIVIDADES_COLUMNS,
        atividadeIndex,
        cells,
        row,
        issues,
      );
      const atividade = reader.requiredText('atividade');
      if (atividade === null) continue;
      if (atividades.includes(atividade)) {
        duplicate(table, row, ATIVIDADES.label, atividade, 'Atividade', issues);
        continue;
      }
      atividades.push(atividade);
    }

    const meioColumns = locate(table, MEIOS, issues);
    const meioIndex = blockIndex(['meio', 'conta'], meioColumns);
    for (const { cells, row } of blockRows(table, meioColumns)) {
      const reader = new RowReader(
        table,
        'Listas',
        MEIOS_COLUMNS,
        meioIndex,
        cells,
        row,
        issues,
      );
      const meio = reader.requiredText('meio');
      const conta: Conta | null = reader.enumValue('conta', CONTAS, true);
      if (meio === null || conta === null) continue;
      if (meios.some((known) => known.meio === meio)) {
        duplicate(table, row, MEIOS.label, meio, 'Meio', issues);
        continue;
      }
      meios.push({ meio, conta });
    }
  }

  return { rubricas, subRubricas, atividades, meios };
}
