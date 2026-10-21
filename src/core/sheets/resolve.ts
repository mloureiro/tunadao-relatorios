import type { Dataset } from '../dataset/types.ts';
import { addDays, type IsoDate } from '../dates.ts';
import { formatDateLong } from '../format.ts';
import type { ReportTipo } from '../reports/index.ts';
import { SUPPORTED_LAYOUT_VERSION } from './catalogue.ts';
import type { SheetDraft } from './types.ts';

export interface DerivedValue {
  readonly value: IsoDate;
  readonly origin: string;
  readonly fromSheet?: string;
}

export interface Resolution {
  readonly derived: ReadonlyMap<string, DerivedValue>;
  readonly reasons: ReadonlyMap<string, string>;
}

export interface PeriodEnd {
  readonly sheet: string;
  readonly end: IsoDate;
}

export function isReadable(draft: SheetDraft): boolean {
  return (
    draft.tipo !== null &&
    !draft.porPreencher &&
    draft.version <= SUPPORTED_LAYOUT_VERSION
  );
}

export function textOf(draft: SheetDraft, key: string): string | null {
  const value = draft.fields.find((field) => field.key === key)?.value;
  return typeof value === 'string' ? value : null;
}

export const dateOf: (draft: SheetDraft, key: string) => IsoDate | null =
  textOf;

export function yearOf(draft: SheetDraft): number | null {
  const value = draft.fields.find((field) => field.key === 'ano')?.value;
  return typeof value === 'number' ? value : null;
}

export function isBlank(draft: SheetDraft, key: string): boolean {
  const field = draft.fields.find((candidate) => candidate.key === key);
  return field?.raw == null;
}

export function periodEndOf(draft: SheetDraft): IsoDate | null {
  if (!isReadable(draft)) return null;
  switch (draft.tipo) {
    case 'pegada':
      return dateOf(draft, 'dataPassagem');
    case 'letivo':
      return dateOf(draft, 'fim');
    case 'fiscal': {
      const year = yearOf(draft);
      return year === null ? null : `${String(year)}-12-31`;
    }
    case 'evento':
    case null:
      return null;
  }
}

export function previousPeriod(
  drafts: readonly SheetDraft[],
  self: SheetDraft,
  before: IsoDate,
): PeriodEnd | null {
  let found: PeriodEnd | null = null;
  for (const draft of drafts) {
    if (draft === self) continue;
    const end = periodEndOf(draft);
    if (end === null || end >= before) continue;
    if (found === null || end > found.end) found = { sheet: draft.sheet, end };
  }
  return found;
}

function lastMovementDate(dataset: Dataset): IsoDate | null {
  return (
    dataset.movimentos
      .map(({ data }) => data)
      .toSorted()
      .at(-1) ?? null
  );
}

class Resolver {
  readonly derived = new Map<string, DerivedValue>();
  readonly reasons = new Map<string, string>();

  constructor(
    private readonly draft: SheetDraft,
    private readonly drafts: readonly SheetDraft[],
    private readonly dataset: Dataset,
  ) {}

  private derive(
    key: string,
    value: IsoDate,
    origin: string,
    fromSheet?: string,
  ): void {
    this.derived.set(key, {
      value,
      origin,
      ...(fromSheet === undefined ? {} : { fromSheet }),
    });
  }

  private refuse(key: string, reason: string): void {
    this.reasons.set(key, reason);
  }

  private fromPreviousPeriod(
    key: string,
    endKey: string,
    wording: {
      readonly what: string;
      readonly anchor: string;
      readonly origin: (sheet: string) => string;
    },
    shift: number,
  ): void {
    const end = dateOf(this.draft, endKey);
    if (end === null) {
      this.refuse(
        key,
        `Não foi possível calcular ${wording.what}: corrija primeiro ${wording.anchor}.`,
      );
      return;
    }
    const previous = previousPeriod(this.drafts, this.draft, end);
    if (previous === null) {
      this.refuse(
        key,
        `Não foi possível calcular ${wording.what}: nenhuma outra folha de relatório deste ficheiro termina antes de ${formatDateLong(end)}. Escreva a data.`,
      );
      return;
    }
    this.derive(
      key,
      addDays(previous.end, shift),
      wording.origin(previous.sheet),
      previous.sheet,
    );
  }

  private pegada(): void {
    if (!isBlank(this.draft, 'dataUltimoRelatorio')) return;
    this.fromPreviousPeriod(
      'dataUltimoRelatorio',
      'dataPassagem',
      {
        what: 'a data do último relatório',
        anchor: 'a data da passagem',
        origin: (sheet) => `fim do relatório da folha "${sheet}"`,
      },
      0,
    );
  }

  private letivo(): void {
    if (!isBlank(this.draft, 'inicio')) return;
    this.fromPreviousPeriod(
      'inicio',
      'fim',
      {
        what: 'o início do período',
        anchor: 'o fim do período',
        origin: (sheet) => `dia seguinte ao relatório da folha "${sheet}"`,
      },
      1,
    );
  }

  private evento(): void {
    this.pendingReference();
    this.eventDates();
  }

  private pendingReference(): void {
    const key = 'refPendentes';
    if (!isBlank(this.draft, key)) return;

    if (!isBlank(this.draft, 'contarAte')) {
      const limit = dateOf(this.draft, 'contarAte');
      if (limit === null) {
        this.refuse(
          key,
          'Não foi possível calcular a data dos pendentes: corrija primeiro a data de "Contar movimentos até".',
        );
      } else {
        this.derive(key, limit, 'data de "Contar movimentos até"');
      }
      return;
    }

    const last = lastMovementDate(this.dataset);
    if (last === null) {
      this.refuse(
        key,
        'Não foi possível calcular a data dos pendentes: a folha não tem "Contar movimentos até" e o ficheiro não tem movimentos. Escreva a data.',
      );
    } else {
      this.derive(key, last, 'data do último movimento do ficheiro');
    }
  }

  private eventDates(): void {
    const startBlank = isBlank(this.draft, 'eventoInicio');
    const endBlank = isBlank(this.draft, 'eventoFim');
    if (!startBlank && !endBlank) return;

    if (startBlank && endBlank) {
      const reason =
        'Indique o início e o fim do evento, ou só um deles se o evento durou um dia.';
      this.refuse('eventoInicio', reason);
      this.refuse('eventoFim', reason);
      return;
    }

    const [blankKey, givenKey] = startBlank
      ? (['eventoInicio', 'eventoFim'] as const)
      : (['eventoFim', 'eventoInicio'] as const);
    const given = dateOf(this.draft, givenKey);
    if (given === null) {
      this.refuse(
        blankKey,
        'Corrija primeiro a outra data do evento: esta é igual a ela quando o evento dura um dia.',
      );
      return;
    }
    this.derive(
      blankKey,
      given,
      startBlank
        ? 'igual ao fim do evento (evento de um dia)'
        : 'igual ao início do evento (evento de um dia)',
    );
  }

  run(tipo: ReportTipo): Resolution {
    if (tipo === 'pegada') this.pegada();
    if (tipo === 'letivo') this.letivo();
    if (tipo === 'evento') this.evento();
    return { derived: this.derived, reasons: this.reasons };
  }
}

export function resolveDefaults(
  draft: SheetDraft,
  drafts: readonly SheetDraft[],
  dataset: Dataset,
): Resolution {
  if (draft.tipo === null || !isReadable(draft)) {
    return { derived: new Map(), reasons: new Map() };
  }
  return new Resolver(draft, drafts, dataset).run(draft.tipo);
}

export function resolvedDate(
  draft: SheetDraft,
  resolution: Resolution,
  key: string,
): IsoDate | null {
  return dateOf(draft, key) ?? resolution.derived.get(key)?.value ?? null;
}
