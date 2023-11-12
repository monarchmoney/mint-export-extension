import { withRetry } from '../retry';

const testFunc = () => {
  let counter = 0;

  return async () => {
    counter += 1;

    if (counter < 4) {
      throw new Error();
    }

    return counter;
  };
};

describe('withRetry', () => {
  it('retries until successful', async () => {
    const funcThatCanThrow = testFunc();
    const result = await withRetry(() => funcThatCanThrow());
    expect(result).toEqual(4);
  });

  it('respsects maxTries', async () => {
    const funcThatCanThrow = testFunc();
    await expect(async () => {
      await withRetry(() => funcThatCanThrow(), {
        maxTries: 3,
      });
    }).rejects.toThrowError();
  });

  it('respects delayMs', async () => {
    const funcThatCanThrow = testFunc();
    const startTime = new Date().getTime();
    await withRetry(() => funcThatCanThrow(), {
      delayMs: 500,
    });
    const endTime = new Date().getTime();

    expect(endTime - startTime).toBeGreaterThan(500 * 3);
  });
});
