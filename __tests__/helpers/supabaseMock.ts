/**
 * Helper to create a Supabase-compatible fluent mock chain.
 *
 * Uses a Proxy so that ANY method on the chain (eq, gte, ilike, order, etc.)
 * returns the chain itself for further chaining. Only `.single()` and
 * `.maybeSingle()` resolve to the provided value.
 *
 * The chain is also directly thenable so `await supabase.from().update().eq()`
 * works for update/delete patterns.
 */

export type ChainMock = Record<string, jest.Mock> & {
  then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise<unknown>;
};

export function createChain(resolveValue: { data: unknown; error: unknown }): ChainMock {
  const methodCache: Record<string, jest.Mock> = {};

  const then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(resolveValue).then(resolve, reject);

  const handler: ProxyHandler<typeof then> = {
    get(_target, prop: string) {
      if (prop === 'then') return then;

      if (!methodCache[prop]) {
        if (prop === 'single' || prop === 'maybeSingle') {
          methodCache[prop] = jest.fn().mockResolvedValue(resolveValue);
        } else {
          methodCache[prop] = jest.fn().mockReturnValue(proxy);
        }
      }

      return methodCache[prop];
    },
  };

  const proxy = new Proxy(then, handler) as unknown as ChainMock;
  return proxy;
}
