import type { ListasSpec } from '../../fixtures/src/listas.ts';
import { TABLE_HEADERS, type WorkbookSpec } from './workbook-writer.ts';

const BOM = [0xef, 0xbb, 0xbf];
const NBSP = ' ';
const LISTAS_HEADER = [
  'Rubrica',
  'Tipo',
  'Conta para o resultado',
  '',
  'Sub-rubrica',
  'Rubrica',
  '',
  'Atividade',
  '',
  'Meio',
  'Conta',
];

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

function money(cents: number): string {
  const magnitude = Math.abs(cents);
  const whole = groupThousands(String(Math.trunc(magnitude / 100)));
  const fraction = String(magnitude % 100).padStart(2, '0');
  return `${cents < 0 ? '-' : ''}${whole},${fraction}${NBSP}€`;
}

function date(iso: string): string {
  const [year = '', month = '', day = ''] = iso.split('-');
  return `${day}/${month}/${year}`;
}

function field(value: string | number | null): string {
  const text = value === null ? '' : String(value);
  return /[;"\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function table(
  header: readonly string[],
  rows: readonly (readonly (string | number | null)[])[],
): Uint8Array {
  const text = [header, ...rows]
    .map((row) => row.map(field).join(';'))
    .join('\r\n');
  return Uint8Array.from([...BOM, ...new TextEncoder().encode(`${text}\r\n`)]);
}

function listasRows(listas: ListasSpec): string[][] {
  const length = Math.max(
    listas.rubricas.length,
    listas.subRubricas.length,
    listas.atividades.length,
    listas.meios.length,
  );
  return Array.from({ length }, (_, at) => {
    const rubrica = listas.rubricas[at];
    const sub = listas.subRubricas[at];
    const meio = listas.meios[at];
    return [
      rubrica?.rubrica ?? '',
      rubrica?.tipo ?? '',
      rubrica === undefined ? '' : rubrica.contaResultado ? 'Sim' : 'Não',
      '',
      sub?.subRubrica ?? '',
      sub?.rubrica ?? '',
      '',
      listas.atividades[at] ?? '',
      '',
      meio?.meio ?? '',
      meio?.conta ?? '',
    ];
  });
}

export function writeCsvSet(spec: WorkbookSpec): Record<string, Uint8Array> {
  const contaDoMeio = new Map(spec.listas.meios.map((m) => [m.meio, m.conta]));
  const resultado = new Map(
    spec.listas.rubricas.map((r) => [r.rubrica, r.contaResultado]),
  );

  return {
    'movimentos.csv': table(
      TABLE_HEADERS.movimentos,
      spec.movimentos.map((m) => [
        date(m.data),
        m.doc,
        m.descricao,
        m.atividade,
        m.rubrica,
        m.subRubrica,
        m.tipo,
        m.meio,
        money(m.valorCents),
        (m.meio && contaDoMeio.get(m.meio)) ?? '',
        money(m.tipo === 'Saída' ? -m.valorCents : m.valorCents),
        resultado.get(m.rubrica) ? 'Sim' : 'Não',
      ]),
    ),
    'pendentes.csv': table(
      TABLE_HEADERS.pendentes,
      spec.pendentes.map((p) => [
        p.tipo,
        p.entidade,
        p.descricao,
        p.atividade,
        money(p.valorCents),
        date(p.dataRegisto),
        p.dataLiquidacao === null ? null : date(p.dataLiquidacao),
        p.notas,
      ]),
    ),
    'orcamento.csv': table(
      TABLE_HEADERS.orcamento,
      spec.orcamento.map((o) => [
        o.ambito,
        o.tipo,
        o.rubrica,
        o.subRubrica,
        money(o.orcadoCents),
      ]),
    ),
    'generos.csv': table(
      TABLE_HEADERS.generos,
      spec.generos.map((g) => [
        g.data === null ? null : date(g.data),
        g.atividade,
        g.tipo,
        g.quantidade,
        g.emFalta,
        g.valorEstimadoCents === null ? null : money(g.valorEstimadoCents),
      ]),
    ),
    'saldos.csv': table(
      TABLE_HEADERS.saldos,
      spec.saldos.map((s) => [
        date(s.data),
        s.conta,
        money(s.saldoCents),
        s.fonte,
      ]),
    ),
    'listas.csv': table(LISTAS_HEADER, listasRows(spec.listas)),
  };
}
