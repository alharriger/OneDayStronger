/**
 * Helper to create a Supabase-compatible fluent mock chain.
 *
 * The chain supports both:
 * - Queries ending in .single() (select queries)
 * - Queries ending in a chainable call that is itself awaitable (update/delete)
 */

export interface ChainMock {
  select: jest.Mock;
  update: jest.Mock;
  insert: jest.Mock;
  eq: jest.Mock;
  order: jest.Mock;
  limit: jest.Mock;
  single: jest.Mock;
}

/**
 * Creates a fully chainable mock where every method returns the chain,
 * and .single() resolves to the provided value. The chain itself is also
 * thenable so `await supabase.from().update().eq(...)` works too.
 */
export function createChain(resolveValue: { data: unknown; error: unknown }): ChainMock {
  // Make chain thenable so `await chain` works for update/delete
  const then = (resolve: (v: any) => any, reject?: (e: any) => any) =>
    Promise.resolve(resolveValue).then(resolve, reject);

  const chain: ChainMock & { then: typeof then } = {
    select: jest.fn(),
    update: jest.fn(),
    insert: jest.fn(),
    eq: jest.fn(),
    order: jest.fn(),
    limit: jest.fn(),
    single: jest.fn().mockResolvedValue(resolveValue),
    then,
  };

  // Each method returns the chain for further chaining
  (Object.keys(chain) as Array<keyof ChainMock>).forEach((method) => {
    if (method !== 'single' && method !== ('then' as any)) {
      chain[method].mockReturnValue(chain);
    }
  });

  return chain;
}
