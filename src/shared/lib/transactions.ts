import { makeMintApiRequest } from '@root/src/shared/lib/auth';
import { DATE_FILTER_ALL_TIME, MINT_HEADERS } from '@root/src/shared/lib/constants';
import { withRetry } from '@root/src/shared/lib/retry';

/** Either due to a bug or something else, this is the maximum number of transactions
 * Mint will return from the download endpoint in CSV format. */
const MINT_MAX_TRANSACTIONS_DOWNLOAD = 10000;

const DATE_SORT = 'DATE_DESCENDING';

/**
 * Use internal Mint API to fetch total transaction count for user.
 */
export const fetchTransactionsTotalCount = async (overrideApiKey?: string): Promise<number> => {
  const response = await makeMintApiRequest<{ metaData: { totalSize: number } }>(
    '/pfm/v1/transactions/search',
    {
      method: 'POST',
      headers: MINT_HEADERS,
      body: JSON.stringify({
        limit: 50,
        offset: 0,
        dateFilter: DATE_FILTER_ALL_TIME,
        sort: DATE_SORT,
      }),
    },
    overrideApiKey,
  );
  const {
    metaData: { totalSize },
  } = await response.json();

  return totalSize;
};

/**
 * Use internal Mint API to fetch transactions CSV.
 * Returns a maximum of 10,000 transactions.
 */
export const fetchDownloadTransactionsPage = async ({
  limit = MINT_MAX_TRANSACTIONS_DOWNLOAD,
  offset = 0,
  overrideApiKey,
}: {
  limit?: number;
  offset?: number;
  overrideApiKey?: string;
}): Promise<string> => {
  const response = await makeMintApiRequest<string>(
    '/pfm/v1/transactions/search/download',
    {
      method: 'POST',
      headers: MINT_HEADERS,
      body: JSON.stringify({
        limit,
        offset,
        searchFilters: [],
        dateFilter: DATE_FILTER_ALL_TIME,
        sort: DATE_SORT,
      }),
    },
    overrideApiKey,
  );

  return response.text();
};

/**
 * Use internal Mint API to fetch all transaction CSV pages.
 *
 * @returns list of CSV content, unmodified.
 */
export const fetchAllDownloadTransactionPages = async ({
  totalTransactionCount,
  pageSize = MINT_MAX_TRANSACTIONS_DOWNLOAD,
  overrideApiKey,
}: {
  totalTransactionCount: number;
  pageSize?: number;
  overrideApiKey?: string;
}): Promise<string[]> => {
  const pageCount = Math.ceil(totalTransactionCount / pageSize);

  return Promise.all(
    [...Array(pageCount).keys()].map((i) =>
      withRetry(
        () =>
          fetchDownloadTransactionsPage({
            limit: pageSize,
            offset: i * pageSize,
            overrideApiKey,
          }),
        {
          delayMs: 500,
        },
      ),
    ),
  );
};

/**
 * Join together multiple pages of CSV content. Removes the header row
 * from all pages except the first one to prevent duplication.
 */
export const concatenateCSVPages = (pages: string[]): string =>
  pages.reduce((acc, content, i) => {
    if (i === 0) {
      // keep CSV header row from first page
      return acc + content;
    }

    // for all other pages, remove first row
    const lines = content.split('\n');
    lines.splice(0, 1);
    const withoutFirstLine = lines.join('\n');

    return acc + withoutFirstLine;
  }, '');
