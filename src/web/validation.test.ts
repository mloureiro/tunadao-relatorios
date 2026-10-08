import { describe, expect, it } from 'vitest';
import { makeIssue } from '@/core/issues';
import {
  countIssues,
  describeCounts,
  filterIssues,
  sortIssues,
} from './validation';

const warning = makeIssue('sub-cent', 'aviso');
const errorA = makeIssue('required-empty', 'erro A', {}, 'sugestão');
const errorB = makeIssue('invalid-date', 'erro B');
const issues = [warning, errorA, makeIssue('sub-cent', 'aviso 2'), errorB];

describe('sortIssues()', () => {
  it('lists errors first and keeps the original order inside each severity', () => {
    expect(sortIssues(issues).map((issue) => issue.message)).toEqual([
      'erro A',
      'erro B',
      'aviso',
      'aviso 2',
    ]);
  });
});

describe('filterIssues()', () => {
  it('keeps only the chosen severity', () => {
    expect(filterIssues(issues, 'warning')).toHaveLength(2);
    expect(filterIssues(issues, 'error')).toHaveLength(2);
    expect(filterIssues(issues, 'all')).toHaveLength(4);
  });
});

describe('describeCounts()', () => {
  it('uses the singular for one and the plural for zero and many', () => {
    expect(describeCounts(countIssues([errorA]))).toBe('1 erro, 0 avisos');
    expect(describeCounts(countIssues(issues))).toBe('2 erros, 2 avisos');
    expect(describeCounts(countIssues([warning]))).toBe('0 erros, 1 aviso');
  });
});
