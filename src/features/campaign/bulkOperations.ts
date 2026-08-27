export type BulkResult<T> = { value: T; error: null } | { value: null; error: Error };

/**
 * Wraps a thenable operation so it never rejects — failures are captured as
 * `error` so the caller can apply partial-success logic. Accepts any
 * thenable (Promise or Supabase's PostgrestFilterBuilder).
 */
export function safeBulk<T>(thenable: PromiseLike<T>): Promise<BulkResult<T>> {
  return Promise.resolve(thenable)
    .then((value): BulkResult<T> => ({ value, error: null }))
    .catch((error: unknown): BulkResult<T> => ({ value: null, error: error instanceof Error ? error : new Error(String(error)) }));
}

export type Partitioned<T> = {
  succeeded: { item: T; index: number }[];
  failed: { item: T; index: number; error: Error }[];
};

/**
 * Splits bulk-operation results into the items that succeeded and the ones
 * that failed. Useful for partial UI updates after a Promise.all where some
 * RPC calls may have failed individually.
 */
export function partitionBulkResults<T>(items: T[], results: BulkResult<unknown>[]): Partitioned<T> {
  const succeeded: Partitioned<T>['succeeded'] = [];
  const failed: Partitioned<T>['failed'] = [];
  results.forEach((result, index) => {
    const item = items[index];
    if (item === undefined) return;
    if (result.error) failed.push({ item, index, error: result.error });
    else succeeded.push({ item, index });
  });
  return { succeeded, failed };
}

/**
 * Builds a user-facing summary in Russian (matching the rest of the GM UI)
 * for a partial bulk operation. Returns a single line like
 * "Скрыто фишек: 3 (2 не удалось)".
 */
export function bulkSummary(verb: string, succeededCount: number, failedCount: number): string {
  if (failedCount === 0) return `${verb}: ${succeededCount}`;
  return `${verb}: ${succeededCount} (${failedCount} не удалось)`;
}
