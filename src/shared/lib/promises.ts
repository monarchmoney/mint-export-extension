import delay from '@root/src/shared/lib/delay';

type RateLimitOptions = {
  /** Delay between when each request is started. Does not wait for request to finish. */
  delayMs: number;
};

/**
 * Like Promise.all, except with requests spaced out.
 *
 * Usage:
 * await withRateLimit({ delayMs: 50 })([
 *  () => request(),
 *  () => request(),
 * ])
 */
export const withRateLimit =
  (options: RateLimitOptions) =>
  async <T>(requests: (() => Promise<T>)[]): Promise<T[]> => {
    const { delayMs } = options;

    return Promise.all(
      requests.map(async (request, i) => {
        await delay(i * delayMs);
        return request();
      }),
    );
  };

/**
 * Like Promise.all but resolves one at a time, in order.
 */
export const resolveSequential = async <T>(requests: (() => Promise<T>)[]): Promise<T[]> => {
  const results: T[] = [];

  for (const request of requests) {
    const response = await request();
    results.push(response);
  }

  return results;
};

export const withDefaultOnError =
  <T>(defaultValue: T) =>
  (promise: Promise<T>): Promise<T> =>
    promise.catch(() => defaultValue);
