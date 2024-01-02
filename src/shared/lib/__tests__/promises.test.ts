import delay from '@root/src/shared/lib/delay';
import { withDefaultOnError, withRateLimit } from '@root/src/shared/lib/promises';

describe('withRateLimit', () => {
  it('spaces out requests', async () => {
    const request = async () => {
      await delay(100);
      console.log(new Date().getTime());
    };

    const startTime = new Date().getTime();
    await withRateLimit({ rate: 2 })([request, request, request]);
    const endTime = new Date().getTime();

    expect(endTime - startTime).toBeGreaterThan(1000);
  });
});

describe('withDefaultOnError', () => {
  it('returns default value when promise rejects', async () => {
    const func = async () => {
      await delay(100);
      throw new Error();

      return 'test';
    };

    const result = await withDefaultOnError('errored')(func());
    expect(result).toEqual('errored');
  });
});
