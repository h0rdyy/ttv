import { describe, expect, it } from 'vitest';
import { bulkSummary, partitionBulkResults, safeBulk } from '../../src/features/campaign/bulkOperations';

describe('safeBulk', () => {
  it('wraps a resolving promise as success', async () => {
    const result = await safeBulk(Promise.resolve('ok'));
    expect(result).toEqual({ value: 'ok', error: null });
  });

  it('captures a rejecting promise as an Error', async () => {
    const result = await safeBulk(Promise.reject(new Error('boom')));
    expect(result.value).toBeNull();
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error?.message).toBe('boom');
  });

  it('coerces non-Error rejections into Error instances', async () => {
    const result = await safeBulk(Promise.reject('just a string'));
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error?.message).toBe('just a string');
  });
});

describe('partitionBulkResults', () => {
  it('separates succeeded and failed items by index', () => {
    const items = ['a', 'b', 'c', 'd'];
    const results = [
      { value: 1, error: null },
      { value: null, error: new Error('nope') },
      { value: 3, error: null },
      { value: null, error: new Error('also nope') },
    ];
    const { succeeded, failed } = partitionBulkResults(items, results);
    expect(succeeded.map((entry) => entry.item)).toEqual(['a', 'c']);
    expect(failed.map((entry) => entry.item)).toEqual(['b', 'd']);
  });

  it('returns all succeeded when nothing failed', () => {
    const items = [1, 2, 3];
    const results = items.map(() => ({ value: true, error: null }));
    const { succeeded, failed } = partitionBulkResults(items, results);
    expect(succeeded).toHaveLength(3);
    expect(failed).toHaveLength(0);
  });

  it('returns all failed when nothing succeeded', () => {
    const items = [1, 2, 3];
    const results = items.map(() => ({ value: null, error: new Error('x') }));
    const { succeeded, failed } = partitionBulkResults(items, results);
    expect(succeeded).toHaveLength(0);
    expect(failed).toHaveLength(3);
  });

  it('handles empty input', () => {
    const { succeeded, failed } = partitionBulkResults([], []);
    expect(succeeded).toEqual([]);
    expect(failed).toEqual([]);
  });
});

describe('bulkSummary', () => {
  it('omits the failure note when everything succeeded', () => {
    expect(bulkSummary('Скрыто фишек', 5, 0)).toBe('Скрыто фишек: 5');
  });

  it('includes the failure count when some failed', () => {
    expect(bulkSummary('Скрыто фишек', 3, 2)).toBe('Скрыто фишек: 3 (2 не удалось)');
  });

  it('handles all-failed case with 0 succeeded', () => {
    expect(bulkSummary('Убрано', 0, 4)).toBe('Убрано: 0 (4 не удалось)');
  });
});
