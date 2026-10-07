import type { Conta, Lists, Movimento } from '../dataset/types.ts';
import { MOVIMENTOS_COLUMNS, resolveColumns } from '../input/columns.ts';
import { isBlankRow, type RawTable } from '../input/raw-table.ts';
import { issueMessages, type Issue } from '../issues.ts';
import { formatMoney } from '../format.ts';
import {
  CONTAS,
  DIRECOES,
  RowReader,
  warnAmbiguousDateOrder,
} from './row-reader.ts';

export interface UnresolvedMovimento {
  readonly src: Movimento['src'];
  readonly rubrica: string;
  readonly subRubrica: string | null;
  readonly meio: string;
  readonly unknownRubrica: boolean;
  readonly unknownMeio: boolean;
}

export interface MovimentosResult {
  readonly movimentos: Movimento[];
  readonly unresolved: UnresolvedMovimento[];
}

const PAIR_SEPARATOR = '\u0000';

function flipSuggestion(
  tipo: (typeof DIRECOES)[number] | null,
  cents: number,
): string | undefined {
  if (tipo === null || cents >= 0) return undefined;
  const other = tipo === 'Entrada' ? 'Saída' : 'Entrada';
  return `Se o movimento é uma ${other}, altere o Tipo para "${other}" e use o valor ${formatMoney(-cents)}.`;
}

export function normaliseMovimentos(
  tables: readonly RawTable[],
  lists: Lists,
  issues: Issue[],
): MovimentosResult {
  const rubricas = new Map(lists.rubricas.map((def) => [def.rubrica, def]));
  const pairs = new Set(
    lists.subRubricas.map(
      (def) => def.rubrica + PAIR_SEPARATOR + def.subRubrica,
    ),
  );
  const meios = new Map(lists.meios.map((def) => [def.meio, def.conta]));

  const movimentos: Movimento[] = [];
  const unresolved: UnresolvedMovimento[] = [];

  for (const table of tables) {
    const index = resolveColumns(
      table,
      'Movimentos',
      MOVIMENTOS_COLUMNS,
      issues,
    );
    warnAmbiguousDateOrder(
      table,
      'Movimentos',
      MOVIMENTOS_COLUMNS,
      index,
      'data',
      issues,
    );

    table.rows.forEach((cells, offset) => {
      if (isBlankRow(cells)) return;
      const reader = new RowReader(
        table,
        'Movimentos',
        MOVIMENTOS_COLUMNS,
        index,
        cells,
        table.firstDataRow + offset,
        issues,
      );

      const data = reader.date('data', true);
      const doc = reader.text('doc');
      const descricao = reader.requiredText('descricao');
      const atividade = reader.requiredText('atividade');
      const rubrica = reader.requiredText('rubrica');
      const subRubrica = reader.text('subRubrica');
      const tipo = reader.enumValue('tipo', DIRECOES, true);
      const meio = reader.requiredText('meio');
      const valor = reader.money('valor', true);
      const suppliedConta = reader.enumValue('conta', CONTAS, false);
      const suppliedSigned = reader.money('valorComSinal', false);
      const suppliedResultado = reader.yesNo('contaResultado', false);

      if (valor !== null && valor.cents <= 0) {
        reader.report(
          'non-positive-value',
          issueMessages['non-positive-value'](valor.cents),
          'valor',
          flipSuggestion(tipo, valor.cents),
        );
      }

      const conta: Conta | undefined =
        meio === null ? undefined : meios.get(meio);
      const rubricaDef = rubrica === null ? undefined : rubricas.get(rubrica);
      const pairKnown =
        rubrica !== null &&
        rubricaDef !== undefined &&
        (subRubrica === null ||
          pairs.has(rubrica + PAIR_SEPARATOR + subRubrica));

      if (
        conta !== undefined &&
        suppliedConta !== null &&
        suppliedConta !== conta
      ) {
        reader.report(
          'derived-mismatch',
          issueMessages['derived-mismatch'](
            MOVIMENTOS_COLUMNS.conta.header,
            suppliedConta,
            conta,
          ),
          'conta',
        );
      }

      const signedCents =
        valor !== null && valor.cents > 0 && tipo !== null
          ? tipo === 'Entrada'
            ? valor.cents
            : -valor.cents
          : null;
      if (
        signedCents !== null &&
        suppliedSigned !== null &&
        suppliedSigned.cents !== signedCents
      ) {
        reader.report(
          'derived-mismatch',
          issueMessages['derived-mismatch'](
            MOVIMENTOS_COLUMNS.valorComSinal.header,
            formatMoney(suppliedSigned.cents),
            formatMoney(signedCents),
          ),
          'valorComSinal',
        );
      }

      if (
        rubricaDef !== undefined &&
        suppliedResultado !== null &&
        suppliedResultado !== rubricaDef.contaResultado
      ) {
        reader.report(
          'derived-mismatch',
          issueMessages['derived-mismatch'](
            MOVIMENTOS_COLUMNS.contaResultado.header,
            suppliedResultado ? 'Sim' : 'Não',
            rubricaDef.contaResultado ? 'Sim' : 'Não',
          ),
          'contaResultado',
        );
      }

      if (reader.failed) return;
      if (
        data === null ||
        descricao === null ||
        atividade === null ||
        rubrica === null ||
        tipo === null ||
        meio === null ||
        valor === null ||
        signedCents === null
      ) {
        return;
      }

      if (conta === undefined || rubricaDef === undefined || !pairKnown) {
        unresolved.push({
          src: reader.src,
          rubrica,
          subRubrica,
          meio,
          unknownRubrica: !pairKnown,
          unknownMeio: conta === undefined,
        });
        return;
      }

      movimentos.push({
        data,
        doc,
        descricao,
        atividade,
        rubrica,
        subRubrica: subRubrica ?? rubrica,
        tipo,
        meio,
        conta,
        valorCents: valor.cents,
        signedCents,
        contaResultado: rubricaDef.contaResultado,
        src: reader.src,
      });
    });
  }

  return { movimentos, unresolved };
}
