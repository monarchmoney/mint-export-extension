import { pRateLimit, Quota } from 'p-ratelimit';
import {
  MINT_RATE_LIMIT_CONCURRENT_REQUESTS,
  MINT_RATE_LIMIT_REQUESTS_PER_SECOND,
} from './constants';

type RateLimitOptions = Quota;

/**
 * Like Promise.all, except with requests spaced out.
 *
 * The default interval is 1 second, so {@link RateLimitOptions.rate} is in terms of requests per
 * second. The default {@link RateLimitOptions.rate} is {@link MINT_RATE_LIMIT_REQUESTS_PER_SECOND}
 * and the default {@link RateLimitOptions.concurrency} option is
 * {@link MINT_RATE_LIMIT_CONCURRENT_REQUESTS}.
 *
 * The concurrency limit once reached ensures that the next request does not begin until a previous
 * request has completed.
 *
 * Usage for 5 requests per second:
 * await withRateLimit({ rate: 5 })([
 *  () => request(),
 *  () => request(),
 * ])
 */
export const withRateLimit =
  (options?: RateLimitOptions) =>
  async <T>(requests: (() => Promise<T>)[]): Promise<T[]> => {
    const limit = pRateLimit({
      interval: 1000,
      rate: MINT_RATE_LIMIT_REQUESTS_PER_SECOND,
      concurrency: MINT_RATE_LIMIT_CONCURRENT_REQUESTS,
      ...options,
    });
    let cancelled = false;

    return Promise.all(
      // if Promise.all rejects, stop all remaining requests
      requests.map((request) => limit(() => (cancelled ? Promise.reject() : request()))),
    ).catch((e) => {
      cancelled = true;
      throw e;
    });
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
