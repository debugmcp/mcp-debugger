/**
 * Runs `fn` over `items` with at most `limit` calls in flight, so peak memory
 * scales with `limit` instead of `items.length`.
 *
 * Completion order is not guaranteed. A rejection propagates and leaves the
 * remaining items unprocessed; catch inside `fn` to survive single failures.
 */
export async function forEachBounded<T>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<void>,
): Promise<void> {
  if (items.length === 0) {
    return;
  }
  const requested = Number.isFinite(limit) ? Math.floor(limit) : 1;
  const width = Math.max(1, Math.min(requested, items.length));
  let cursor = 0;
  const worker = async (): Promise<void> => {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) {
        return;
      }
      await fn(items[index]!, index);
    }
  };
  await Promise.all(Array.from({ length: width }, worker));
}
