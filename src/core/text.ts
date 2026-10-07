const COMBINING_MARKS = /\p{M}/gu;
const WHITESPACE = /\s+/g;
const TRAILING_PARENTHESES = /\s*\([^()]*\)\s*$/;

export function normalise(text: string): string {
  return text
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(WHITESPACE, ' ')
    .trim();
}

export function normaliseHeader(text: string): string {
  let stripped = text;
  while (TRAILING_PARENTHESES.test(stripped)) {
    stripped = stripped.replace(TRAILING_PARENTHESES, '');
  }
  return normalise(stripped);
}

function distance(a: readonly string[], b: readonly string[]): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const substitution =
        (previous[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1);
      const deletion = (previous[j] ?? 0) + 1;
      const insertion = (current[j - 1] ?? 0) + 1;
      current.push(Math.min(substitution, deletion, insertion));
    }
    previous = current;
  }
  return previous[b.length] ?? 0;
}

export function closest(
  candidate: string,
  list: readonly string[],
): string | null {
  const wanted = Array.from(normalise(candidate));
  if (wanted.length === 0) return null;

  let best: string | null = null;
  let bestDistance = Infinity;
  for (const entry of list) {
    const other = Array.from(normalise(entry));
    const allowed = Math.floor(Math.max(wanted.length, other.length) / 3);
    const gap = distance(wanted, other);
    if (gap <= allowed && gap < bestDistance) {
      best = entry;
      bestDistance = gap;
    }
  }
  return best;
}
