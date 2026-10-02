/**
 * Run `fn` over `items` with at most `limit` calls in flight. Used to keep many independent
 * database round trips inside a serverless function's time limit without flooding the pool.
 */
export async function forEachLimit<T>(items: T[], limit: number, fn: (item: T) => PromiseLike<unknown>) {
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await fn(items[next++])
  })
  await Promise.all(workers)
}
