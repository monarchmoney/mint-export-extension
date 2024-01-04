import { DateTime, Interval } from 'luxon';

import { makeMintApiRequest } from '@root/src/shared/lib/auth';
import {
  DATE_FILTER_ALL_TIME,
  MINT_DAILY_TRENDS_MAX_DAYS,
  MINT_HEADERS,
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
  // this is determined by the type of report we fetch (DEBTS_TIME/ASSETS_TIME)
  // it will return different values if we decide to fetch more types of reports (e.g., SPENDING_TIME)
  type: 'DEBT' | 'ASSET' | string;
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

export const calculateIntervalForAccountHistory = (monthlyBalances: TrendEntry[]) => {
  const startDate = monthlyBalances[0]?.date;

  if (!startDate) {
    throw new Error('Unable to determine start date for account history.');
  }

  // find the last month with a non-zero balance
  let endDate: string;
  let monthIndex = monthlyBalances.length - 1;
  while (monthIndex > 0 && monthlyBalances[monthIndex].amount === 0) {
    monthIndex -= 1;
    endDate = monthlyBalances[monthIndex].date;
  }

  const now = DateTime.now();
  const approximateRangeEnd = endDate
    ? // Mint trend months are strange and daily balances may be present after the end of the reported
      // month (anecodotally observed daily balances 10 days into the first month that showed a zero
      // monthly balance).
      DateTime.fromISO(endDate).plus({ month: 1 }).endOf('month')
    : now;

  // then fetch balances for each period in the range
  return Interval.fromDateTimes(
    DateTime.fromISO(startDate).startOf('month'),
    (approximateRangeEnd < now ? approximateRangeEnd : now).endOf('day'),
  );
};

/**
 * Determine earliest date for which account has balance history, and return 43 day intervals from then to now.
 */
const fetchIntervalsForAccountHistory = async ({
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
  const interval = calculateIntervalForAccountHistory(monthlyBalances);
  const periods = interval.splitBy({
    days: MINT_DAILY_TRENDS_MAX_DAYS,
  }) as Interval[];

  return { periods, reportType };
};

/**
 * Fetch balance history for each month for an account.
 */
const fetchDailyBalancesForAccount = async ({
  periods,
  accountId,
  reportType,
  overrideApiKey,
  onProgress,
}: {
  periods: Interval[];
  accountId: string;
  reportType: string;
  fiName: string;
  overrideApiKey?: string;
  onProgress?: ProgressCallback;
}) => {
  if (!reportType) {
    throw new Error('Invalid report type.');
  }

  const counter = {
    count: 0,
  };

  const dailyBalancesByPeriod = await withRateLimit()(
    periods.map(
      ({ start, end }) =>
        () =>
          withRetry(() =>
            fetchTrends({
              reportType,
              filters: [makeAccountIdFilter(accountId)],
              dateFilter: {
                type: 'CUSTOM',
                startDate: start.toISODate(),
                endDate: end < DateTime.now() ? end.toISODate() : DateTime.now().toISODate(),
              },
              overrideApiKey,
            })
              .then((response) => response.json())
              .then(({ Trend }) =>
                Trend.map(({ amount, type, ...rest }) => ({
                  ...rest,
                  type,
                  amount: type === 'DEBT' ? -amount : amount,
                })),
              ),
          ).finally(() => {
            counter.count += 1;
            onProgress?.({ complete: counter.count, total: periods.length });
          }),
    ),
  );

  const balancesByDate = dailyBalancesByPeriod.reduce((acc, balances) => acc.concat(balances), []);

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

  // first, fetch the range of dates we need to fetch for each account
  const accountsWithPeriodsToFetch = await withRateLimit()(
    accounts.map(({ id: accountId, name: accountName, fiName: fiName }) => async () => {
      const { periods, reportType } = await withDefaultOnError({ periods: [], reportType: '' })(
        fetchIntervalsForAccountHistory({
          accountId,
          overrideApiKey,
        }),
      );
      return { periods, reportType, accountId, accountName, fiName };
    }),
  );

  // one per account per 43 day period
  const totalRequestsToFetch = accountsWithPeriodsToFetch.reduce(
    (acc, { periods }) => acc + periods.length,
    0,
  );

  // fetch one account at a time so we don't hit the rate limit
  const balancesByAccount = await resolveSequential(
    accountsWithPeriodsToFetch.map(
      ({ accountId, accountName, periods, reportType, fiName }, accountIndex) =>
        async () => {
          const balances = await withDefaultOnError<TrendEntry[]>([])(
            fetchDailyBalancesForAccount({
              accountId,
              periods,
              reportType,
              overrideApiKey,
              fiName,
              onProgress: ({ complete }) => {
                // this is the progress handler for *each* account, so we need to sum up the results before calling onProgress

                const previousAccounts = accountsWithPeriodsToFetch.slice(0, accountIndex);
                // since accounts are fetched sequentially, we can assume that all previous accounts have completed all their requests
                const previousCompletedRequestCount = previousAccounts.reduce(
                  (acc, { periods }) => acc + periods.length,
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
            fiName,
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
    fiName: string;
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
  const maybeAccountColumn: [string?] = accountName ? [accountName] : [];
  // remove zero balances from the end of the report leaving just the first row if all are zero
  const rows = balances.reduceRight(
    (acc, { date, amount }, index) => {
      if (acc.length || amount !== 0 || index === 0) {
        acc.unshift([date, amount, ...maybeAccountColumn]);
      }
      return acc;
    },
    [] as [string, number, string?][],
  );

  return formatCSV([header, ...rows]);
};

const makeAccountIdFilter = (accountId: string) => ({
  type: 'AccountIdFilter',
  accountId,
});
