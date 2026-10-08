const LISBON = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Lisbon',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

export function lisbonDateTime(instant: Date): string {
  const parts = new Map(
    LISBON.formatToParts(instant).map(({ type, value }) => [type, value]),
  );
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.get(type) ?? '';
  const date = `${part('year')}-${part('month')}-${part('day')}`;
  return `${date}T${part('hour')}:${part('minute')}:${part('second')}`;
}
