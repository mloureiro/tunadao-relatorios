import type { Dataset, Direcao, Lists, SourceRef } from '../dataset/types.ts';
import { issueMessages, makeIssue, type Issue } from '../issues.ts';
import type { UnresolvedMovimento } from '../normalise/movimentos.ts';
import { closest } from '../text.ts';

const PAIR_SEPARATOR = '\u0000';

interface ListIndex {
  readonly rubricas: ReadonlyMap<string, Direcao | null>;
  readonly pairs: ReadonlySet<string>;
  readonly rubricasOfSub: ReadonlyMap<string, readonly string[]>;
  readonly subsOfRubrica: ReadonlyMap<string, readonly string[]>;
  readonly atividades: ReadonlySet<string>;
  readonly meios: ReadonlySet<string>;
}

function indexLists(lists: Lists): ListIndex {
  const rubricasOfSub = new Map<string, string[]>();
  const subsOfRubrica = new Map<string, string[]>();
  for (const def of lists.subRubricas) {
    rubricasOfSub.set(def.subRubrica, [
      ...(rubricasOfSub.get(def.subRubrica) ?? []),
      def.rubrica,
    ]);
    subsOfRubrica.set(def.rubrica, [
      ...(subsOfRubrica.get(def.rubrica) ?? []),
      def.subRubrica,
    ]);
  }
  return {
    rubricas: new Map(lists.rubricas.map((def) => [def.rubrica, def.tipo])),
    pairs: new Set(
      lists.subRubricas.map(
        (def) => def.rubrica + PAIR_SEPARATOR + def.subRubrica,
      ),
    ),
    rubricasOfSub,
    subsOfRubrica,
    atividades: new Set(lists.atividades),
    meios: new Set(lists.meios.map((def) => def.meio)),
  };
}

function at(src: SourceRef, column: string) {
  return { file: src.file, tab: src.tab, row: src.row, column };
}

function subRubricaSuggestion(
  index: ListIndex,
  rubrica: string,
  subRubrica: string,
): string | undefined {
  const elsewhere = index.rubricasOfSub.get(subRubrica);
  if (elsewhere !== undefined) {
    const names = elsewhere.map((name) => `"${name}"`).join(', ');
    return `A sub-rubrica "${subRubrica}" existe na rubrica ${names}.`;
  }
  return (
    closest(subRubrica, index.subsOfRubrica.get(rubrica) ?? []) ?? undefined
  );
}

function checkRubrica(
  index: ListIndex,
  src: SourceRef,
  rubrica: string,
  subRubrica: string | null,
  issues: Issue[],
): void {
  if (!index.rubricas.has(rubrica)) {
    issues.push(
      makeIssue(
        'unknown-rubrica',
        issueMessages['unknown-rubrica'](rubrica, null),
        at(src, 'Rubrica'),
        closest(rubrica, [...index.rubricas.keys()]) ?? undefined,
      ),
    );
    return;
  }
  if (
    subRubrica !== null &&
    !index.pairs.has(rubrica + PAIR_SEPARATOR + subRubrica)
  ) {
    issues.push(
      makeIssue(
        'unknown-rubrica',
        issueMessages['unknown-rubrica'](rubrica, subRubrica),
        at(src, 'Sub-rubrica'),
        subRubricaSuggestion(index, rubrica, subRubrica),
      ),
    );
  }
}

function checkAtividade(
  index: ListIndex,
  src: SourceRef,
  atividade: string | null,
  issues: Issue[],
): void {
  if (atividade === null || index.atividades.has(atividade)) return;
  issues.push(
    makeIssue(
      'unknown-atividade',
      issueMessages['unknown-atividade'](atividade),
      at(src, 'Atividade'),
      closest(atividade, [...index.atividades]) ?? undefined,
    ),
  );
}

function checkMeio(
  index: ListIndex,
  src: SourceRef,
  meio: string,
  issues: Issue[],
): void {
  if (index.meios.has(meio)) return;
  issues.push(
    makeIssue(
      'unknown-meio',
      issueMessages['unknown-meio'](meio),
      at(src, 'Meio'),
      closest(meio, [...index.meios]) ?? undefined,
    ),
  );
}

function checkBudgetTipo(
  index: ListIndex,
  src: SourceRef,
  rubrica: string,
  tipo: Direcao,
  issues: Issue[],
): void {
  const expected = index.rubricas.get(rubrica);
  if (expected === undefined || expected === null || expected === tipo) return;
  issues.push(
    makeIssue(
      'unknown-rubrica',
      issueMessages['unknown-rubrica'](rubrica, null, tipo),
      at(src, 'Tipo'),
      expected,
    ),
  );
}

export function membershipIssues(
  dataset: Dataset,
  unresolved: readonly UnresolvedMovimento[],
): Issue[] {
  const { lists } = dataset;
  const listsAbsent =
    lists.rubricas.length === 0 &&
    lists.atividades.length === 0 &&
    lists.meios.length === 0;
  if (listsAbsent) return [];

  const index = indexLists(lists);
  const issues: Issue[] = [];

  for (const def of dataset.lists.subRubricas) {
    if (index.rubricas.has(def.rubrica)) continue;
    issues.push(
      makeIssue(
        'unknown-rubrica',
        issueMessages['unknown-rubrica'](def.rubrica, null),
        at(def.src, 'Rubrica'),
        closest(def.rubrica, [...index.rubricas.keys()]) ?? undefined,
      ),
    );
  }

  for (const m of dataset.movimentos) {
    checkRubrica(
      index,
      m.src,
      m.rubrica,
      m.subRubrica === m.rubrica ? null : m.subRubrica,
      issues,
    );
    checkAtividade(index, m.src, m.atividade, issues);
    checkMeio(index, m.src, m.meio, issues);
  }

  for (const u of unresolved) {
    if (u.unknownRubrica) {
      checkRubrica(index, u.src, u.rubrica, u.subRubrica, issues);
    }
    checkAtividade(index, u.src, u.atividade, issues);
    if (u.unknownMeio) checkMeio(index, u.src, u.meio, issues);
  }

  for (const linha of dataset.orcamento) {
    checkRubrica(
      index,
      linha.src,
      linha.rubrica,
      linha.subRubrica === linha.rubrica ? null : linha.subRubrica,
      issues,
    );
    checkBudgetTipo(index, linha.src, linha.rubrica, linha.tipo, issues);
  }

  for (const pendente of dataset.pendentes) {
    checkAtividade(index, pendente.src, pendente.atividade, issues);
  }
  for (const genero of dataset.generos) {
    checkAtividade(index, genero.src, genero.atividade, issues);
  }
  return issues;
}
