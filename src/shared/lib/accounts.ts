import { DateTime, Interval } from 'luxon';

import { makeMintApiRequest } from '@root/src/shared/lib/auth';
import {
  DATE_FILTER_ALL_TIME,
  MINT_HEADERS,
  MINT_RATE_LIMIT_DELAY_MS,
} from '@root/src/shared/lib/constants';
import { formatCSV } from '@root/src/shared/lib/csv';
import { withRetry } from '@root/src/shared/lib/retry';
import {
  resolveSequential,
  withDefaultOnError,
  withRateLimit,
} from '@root/src/shared/lib/promises';

type TrendEntry = {
  amount: number;
  date: string;
  type: 'DEBT' | 'ASSET' | 'EXPENSE' | string;
};

type TrendsResponse = {
  Trend: TrendEntry[];
  // there's more here...
};

export type BalanceHistoryProgressCallback = (progress: {
  completedAccounts: number;
  totalAccounts: number;
  completePercentage: number;
}) => void | Promise<void>;

export type BalanceHistoryCallbackProgress = Parameters<BalanceHistoryProgressCallback>[0];

type ProgressCallback = (progress: { complete: number; total: number }) => void | Promise<void>;

/**
 * Use internal Mint "Trends" API to fetch account balance by month
 * for all time.
 *
 * This is technically a paginated API, but since the limit is 1000 (> 83 years)
 * we probably don't need to worry about pagination.
 */
export const fetchMonthlyBalancesForAccount = async ({
  accountId,
  offset,
  limit,
  overrideApiKey,
}: {
  accountId: string;
  offset?: number;
  limit?: number;
  overrideApiKey?: string;
}): Promise<{ balancesByDate: TrendEntry[]; reportType: string } | undefined> => {
  // we don't have a good way to know if an account is "asset" or "debt", so we just try both reports
  // the Mint API returns undefined if the report type doesn't match the account type
  const tryReportTypes = ['ASSETS_TIME', 'DEBTS_TIME'];

  for (const reportType of tryReportTypes) {
    const response = await fetchTrends({
      reportType,
      filters: [makeAccountIdFilter(accountId)],
      offset,
      limit,
      overrideApiKey,
    });
    const { Trend: balancesByDate } = await response.json();

    if (balancesByDate) {
      return { balancesByDate, reportType };
    }
  }
};

/**
 * Determine earliest date for which account has balance history, and return monthly intervals from then to now.
 */
const fetchMonthlyIntervalsForAccountHistory = async ({
  accountId,
  overrideApiKey,
}: {
  accountId: string;
  overrideApiKey?: string;
}) => {
  // fetch monthly balances so we can get start date
  const balanceInfo = await withRetry(() =>
    fetchMonthlyBalancesForAccount({ accountId, overrideApiKey }),
  );

  if (!balanceInfo) {
    throw new Error('Unable to fetch account history.');
  }

  const { balancesByDate: monthlyBalances, reportType } = balanceInfo;

  const startDate = monthlyBalances[0]?.date;

  if (!startDate) {
    throw new Error('Unable to determine start date for account history.');
  }

  // then fetch balances for each month in range, since that's the only timeframe that the API will return a balance for each day
  const months = Interval.fromDateTimes(
    DateTime.fromISO(startDate).startOf('month'),
    DateTime.local().endOf('month'),
  ).splitBy({
    months: 1,
  }) as Interval[];

  return { months, reportType };
};

/**
 * Fetch balance history for each month for an account.
 */
const fetchDailyBalancesForMonthIntervals = async ({
  months,
  accountId,
  reportType,
  overrideApiKey,
  onProgress,
}: {
  months: Interval[];
  accountId: string;
  reportType: string;
  overrideApiKey?: string;
  onProgress?: ProgressCallback;
}) => {
  if (!reportType) {
    throw new Error('Invalid report type.');
  }

  const counter = {
    count: 0,
  };

  const dailyBalancesByMonth = await withRateLimit({ delayMs: MINT_RATE_LIMIT_DELAY_MS })(
    months.map(
      ({ start, end }) =>
        () =>
          withRetry(() =>
            fetchTrends({
              reportType,
              filters: [makeAccountIdFilter(accountId)],
              dateFilter: {
                type: 'CUSTOM',
                startDate: start.toISODate(),
                // end is really the start of the next month, so subtract one day
                endDate:
                  end < DateTime.now()
                    ? end.minus({ day: 1 }).toISODate()
                    : DateTime.now().toISODate(),
              },
              overrideApiKey,
            })
              .then((response) =>
                response.json().then(({ Trend }) =>
                  Trend.map(({ amount, type, ...rest }) => ({
                    ...rest,
                    type,
                    amount: type === 'DEBT' ? -amount : amount,
                  })),
                ),
              )
              .finally(() => {
                counter.count += 1;
                onProgress?.({ complete: counter.count, total: months.length });
              }),
          ),
    ),
  );

  const balancesByDate = dailyBalancesByMonth.reduce((acc, balances) => acc.concat(balances), []);

  return balancesByDate;
};

export const fetchDailyBalancesForAllAccounts = async ({
  onProgress,
  overrideApiKey,
}: {
  onProgress?: BalanceHistoryProgressCallback;
  overrideApiKey?: string;
}) => {
  const accounts = await withRetry(() => fetchAccounts({ overrideApiKey }));

  // first, fetch the range of months we need to fetch for each account
  const accountsWithMonthsToFetch = await Promise.all(
    accounts.map(async ({ id: accountId, name: accountName }) => {
      const { months, reportType } = await withDefaultOnError({ months: [], reportType: '' })(
        fetchMonthlyIntervalsForAccountHistory({
          accountId,
          overrideApiKey,
        }),
      );
      return { months, reportType, accountId, accountName };
    }),
  );

  // one per account per month
  const totalRequestsToFetch = accountsWithMonthsToFetch.reduce(
    (acc, { months }) => acc + months.length,
    0,
  );

  // fetch one account at a time so we don't hit the rate limit
  const balancesByAccount = await resolveSequential(
    accountsWithMonthsToFetch.map(
      ({ accountId, accountName, months, reportType }, accountIndex) =>
        async () => {
          const balances = await withDefaultOnError<TrendEntry[]>([])(
            fetchDailyBalancesForMonthIntervals({
              accountId,
              months,
              reportType,
              overrideApiKey,
              onProgress: ({ complete }) => {
                // this is the progress handler for *each* account, so we need to sum up the results before calling onProgress

                const previousAccounts = accountsWithMonthsToFetch.slice(0, accountIndex);
                // since accounts are fetched sequentially, we can assume that all previous accounts have completed all their requests
                const previousCompletedRequestCount = previousAccounts.reduce(
                  (acc, { months }) => acc + months.length,
                  0,
                );
                const completedRequests = previousCompletedRequestCount + complete;

                onProgress?.({
                  completedAccounts: accountIndex,
                  totalAccounts: accounts.length,
                  completePercentage: completedRequests / totalRequestsToFetch,
                });
              },
            }),
          );

          return {
            balances,
            accountName,
          };
        },
    ),
  );

  return balancesByAccount;
};

/**
 * Use internal Mint API to fetch net worth history. Return list of
 * balances for type: "ASSET" and type: "DEBT" for each month.
 */
export const fetchNetWorthBalances = async ({
  offset = 0,
  limit = 1000, // mint default
  overrideApiKey,
}: {
  offset?: number;
  limit?: number;
  overrideApiKey?: string;
}) => {
  const response = await fetchTrends({
    reportType: 'NET_WORTH',
    offset,
    limit,
    overrideApiKey,
  });
  const { Trend: balancesByDate } = await response.json();

  return balancesByDate;
};

const fetchTrends = ({
  reportType,
  filters = [],
  dateFilter = DATE_FILTER_ALL_TIME,
  offset = 0,
  limit = 1000, // mint default
  overrideApiKey,
}: {
  reportType: string;
  filters?: Record<string, string>[];
  dateFilter?: Record<string, string>;
  offset?: number;
  limit?: number;
  overrideApiKey?: string;
}) =>
  makeMintApiRequest<TrendsResponse>(
    '/pfm/v1/trends',
    {
      method: 'POST',
      headers: MINT_HEADERS,
      body: JSON.stringify({
        reportView: {
          type: reportType,
        },
        dateFilter,
        searchFilters: [
          {
            matchAll: true,
            filters,
          },
        ],
        offset,
        limit,
      }),
    },
    overrideApiKey,
  );

type AccountsResponse = {
  Account: {
    type: string;
    id: string;
    name: string;
  }[];
};

/**
 * Use internal Mint API to fetch all of user's accounts.
 */
export const fetchAccounts = async ({
  offset = 0,
  limit = 1000, // mint default
  overrideApiKey,
}: {
  offset?: number;
  limit?: number;
  overrideApiKey?: string;
}) => {
  const response = await makeMintApiRequest<AccountsResponse>(
    `/pfm/v1/accounts?offset=${offset}&limit=${limit}`,
    {
      headers: MINT_HEADERS,
    },
    overrideApiKey,
  );
  const { Account: accounts } = await response.json();

  return accounts;
};

export const formatBalancesAsCSV = (balances: TrendEntry[], accountName?: string) => {
  const header = ['Date', 'Amount', accountName && 'Account Name'].filter(Boolean);
  const rows = balances.map(({ date, amount }) => [
    date,
    amount,
    ...(accountName ? [accountName] : []),
  ]);

  return formatCSV([header, ...rows]);
};

const makeAccountIdFilter = (accountId: string) => ({
  type: 'AccountIdFilter',
  accountId,
});
