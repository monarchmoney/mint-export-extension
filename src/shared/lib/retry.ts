import delay from '@root/src/shared/lib/delay';

const DEFAULT_MAX_TRIES = 5;

type RetryOptions = {
  /** Delay between each try. */
  delayMs?: number;
  /** Maximum number of tries before rethrowing error. */
  maxTries?: number;
};

/**
 * Utility function to call function again if Promise rejects.
 *
 * Usage:
 * const result = await withRetry(() => funcThatCanThrow());
 */
export const withRetry = async <T>(
  handler: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> => {
  const { maxTries = DEFAULT_MAX_TRIES, delayMs } = options;

  try {
    const result = await handler();
    return result;
  } catch (e) {
    if (maxTries <= 1) {
      // we've already tried the maximum number of times, so fail and rethrow error
      throw e;
    }

    if (delayMs) {
      await delay(delayMs);
    }

    return withRetry(handler, {
      ...options,
      maxTries: maxTries !== undefined ? maxTries - 1 : undefined,
    });
  }
};
