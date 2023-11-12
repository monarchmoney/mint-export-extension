import { TEST_MINT_API_KEY } from '@root/src/shared/lib/constants';
import {
  fetchTransactionsTotalCount,
  fetchDownloadTransactionsPage,
  fetchAllDownloadTransactionPages,
  concatenateCSVPages,
} from '@root/src/shared/lib/transactions';

const TRANSACTION_COUNT = 15506; // total # transactions in this Mint account

const lineCount = (value: string) => value.split('\n').filter((value) => !!value).length;

describe('fetchTransactionsTotalCount', () => {
  it('fetches total transaction count', async () => {
    const totalCount = await fetchTransactionsTotalCount(TEST_MINT_API_KEY);
    expect(totalCount).toEqual(TRANSACTION_COUNT);
  });

  it('throws error for invalid api key', async () => {
    await expect(async () => {
      await fetchTransactionsTotalCount('invalid-api-key');
    }).rejects.toThrowError();
  });
});

describe('fetchDownloadTransactionsPage', () => {
  it('fetchs CSV content for transactions', async () => {
    const content = await fetchDownloadTransactionsPage({
      limit: 10,
      overrideApiKey: TEST_MINT_API_KEY,
    });
    expect(lineCount(content)).toEqual(11); // 10 transactions + header row
  });
});

describe('full download pipeline', () => {
  it('downloads all pages and concatenates CSV content', async () => {
    const totalTransactionCount = await fetchTransactionsTotalCount(TEST_MINT_API_KEY);
    const pages = await fetchAllDownloadTransactionPages({
      totalTransactionCount,
      overrideApiKey: TEST_MINT_API_KEY,
    });
    const csvContent = concatenateCSVPages(pages);
    expect(lineCount(csvContent)).toEqual(TRANSACTION_COUNT + 1); // 1 additional for CSV header
  });
});
