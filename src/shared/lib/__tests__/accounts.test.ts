import { TEST_MINT_API_KEY } from '@root/src/shared/lib/constants';
import {
  ReportType,
  TrendState,
  calculateIntervalForAccountHistory,
  fetchAccounts,
  fetchDailyBalancesForAllAccounts,
  fetchMonthlyBalances,
  fetchNetWorthBalances,
  formatBalancesAsCSV,
  getAccountTypeFilterForTrend,
  makeAccountIdFilter,
} from '../accounts';
import { DateTime } from 'luxon';

describe('fetchMonthlyBalances', () => {
  it('fetches balances by date for asset account', async () => {
    const { balancesByDate } = await fetchMonthlyBalances({
      matchAllFilters: [makeAccountIdFilter('43237333_1544498')],
      overrideApiKey: TEST_MINT_API_KEY,
    });
    expect(balancesByDate.length).toEqual(141);
  });

  it('fetches balances for debt account', async () => {
    const { balancesByDate } = await fetchMonthlyBalances({
      matchAllFilters: [makeAccountIdFilter('43237333_2630847')],
      overrideApiKey: TEST_MINT_API_KEY,
    });
    expect(balancesByDate.length).toEqual(141);
  });
});

describe('fetchNetWorthBalances', () => {
  it('fetches asset and debt balances by date', async () => {
    const balancesByDate = await fetchNetWorthBalances({ overrideApiKey: TEST_MINT_API_KEY });
    expect(balancesByDate.length).toEqual(282);
  });
});

describe('fetchAccounts', () => {
  it('fetches all accounts', async () => {
    const accounts = await fetchAccounts({
      overrideApiKey: TEST_MINT_API_KEY,
    });
    expect(accounts.length).toEqual(35);
  });
});

describe('formatBalancesAsCSV', () => {
  it('includes account name if provied', () => {
    const result = formatBalancesAsCSV({
      balances: [
        { amount: 123.45, date: '2021-01-01', type: 'ASSET' },
        { amount: 234.56, date: '2021-02-01', type: 'ASSET' },
      ],
      accountName: `Mason's Account`,
    });
    expect(result).toEqual(`"Date","Amount","Account Name"
"2021-01-01","123.45","Mason's Account"
"2021-02-01","234.56","Mason's Account"
`);
  });

  it('does not include account name if not provided', () => {
    const result = formatBalancesAsCSV({
      balances: [
        { amount: 123.45, date: '2021-01-01', type: 'ASSET' },
        { amount: 234.56, date: '2021-02-01', type: 'ASSET' },
      ],
    });
    expect(result).toEqual(`"Date","Amount"
"2021-01-01","123.45"
"2021-02-01","234.56"
`);
  });

  it('converts undefined balances to empty string', () => {
    const result = formatBalancesAsCSV({
      balances: [
        {
          amount: undefined,
          date: '2020-01-01',
          type: 'ASSET',
        },
      ],
    });
    expect(result).toEqual(`"Date","Amount"
"2020-01-01",""
`);
  });

  it('trims trailing zero balances', () => {
    const result = formatBalancesAsCSV({
      balances: [
        {
          amount: 123.45,
          date: '2020-01-01',
          type: 'ASSET',
        },
        {
          amount: 234.56,
          date: '2020-01-02',
          type: 'ASSET',
        },
        {
          amount: 0,
          date: '2020-01-03',
          type: 'ASSET',
        },
        {
          amount: 0,
          date: '2020-01-04',
          type: 'ASSET',
        },
      ],
    });
    expect(result).toEqual(`"Date","Amount"
"2020-01-01","123.45"
"2020-01-02","234.56"
`);
  });

  it('leaves one row if all balances are zero', () => {
    const result = formatBalancesAsCSV({
      balances: [
        {
          amount: 0,
          date: '2020-01-01',
          type: 'ASSET',
        },
        {
          amount: 0,
          date: '2020-01-02',
          type: 'ASSET',
        },
        {
          amount: 0,
          date: '2020-01-03',
          type: 'ASSET',
        },
      ],
    });
    expect(result).toEqual(`"Date","Amount"
"2020-01-01","0"
`);
  });

  it('handles net income balances', () => {
    const result = formatBalancesAsCSV({
      reportType: 'NET_INCOME',
      balances: [
        {
          amount: 0,
          date: '2020-01-01',
          type: 'INCOME',
        },
        {
          amount: 123.45,
          date: '2020-01-01',
          type: 'EXPENSE',
        },
        {
          amount: 43.21,
          date: '2020-01-02',
          type: 'INCOME',
        },
        {
          amount: 234.56,
          date: '2020-01-03',
          type: 'INCOME',
        },
      ],
    });
    expect(result).toEqual(`"Date","Income","Expenses","Net"
"2020-01-01","0","123.45","-123.45"
"2020-01-02","43.21","0","43.21"
"2020-01-03","234.56","0","234.56"
`);
  });

  it('trims trailing zero net income balances', () => {
    const result = formatBalancesAsCSV({
      reportType: 'NET_INCOME',
      balances: [
        {
          amount: 0,
          date: '2020-01-01',
          type: 'INCOME',
        },
        {
          amount: 123.45,
          date: '2020-01-01',
          type: 'EXPENSE',
        },
        {
          amount: 0,
          date: '2020-01-02',
          type: 'INCOME',
        },
        {
          amount: 0,
          date: '2020-01-03',
          type: 'INCOME',
        },
      ],
    });
    expect(result).toEqual(`"Date","Income","Expenses","Net"
"2020-01-01","0","123.45","-123.45"
`);
  });

  it('fixes floating point subtraction in net income balances', () => {
    const result = formatBalancesAsCSV({
      reportType: 'NET_INCOME',
      balances: [
        {
          amount: 123.45,
          date: '2020-01-01',
          type: 'INCOME',
        },
        {
          amount: 12.35,
          date: '2020-01-01',
          type: 'EXPENSE',
        },
      ],
    });
    // Not 111.10000000000001
    expect(result).toEqual(`"Date","Income","Expenses","Net"
"2020-01-01","123.45","12.35","111.10"
`);
  });

  it('represents zero in the Net column as 0.00', () => {
    // as a consequence of toFixed(2)
    const result = formatBalancesAsCSV({
      reportType: 'NET_INCOME',
      balances: [
        {
          amount: 0,
          date: '2020-01-01',
          type: 'INCOME',
        },
      ],
    });
    // Not 111.10000000000001
    expect(result).toEqual(`"Date","Income","Expenses","Net"
"2020-01-01","0","0","0.00"
`);
  });
});

describe('fetchDailyBalancesForAllAccounts', () => {
  it('spaces requests out', async () => {
    const response = await fetchDailyBalancesForAllAccounts({
      overrideApiKey: TEST_MINT_API_KEY,
      onProgress: ({ completePercentage }) => console.log(`progress: ${completePercentage}`),
    });
    expect(response.length).toBeGreaterThan(0);
  }, 60000);
});

describe('calculateIntervalForAccountHistory', () => {
  it('starts at the first day of the first month with history', () => {
    const result = calculateIntervalForAccountHistory([
      { date: '2023-01-31', amount: 5, type: 'ASSET' },
      { date: '2023-02-28', amount: 10, type: 'ASSET' },
    ]);
    expect(result.start.toISODate()).toBe('2023-01-01');
  });

  it('ends today for nonzero balances', () => {
    const result = calculateIntervalForAccountHistory([
      { date: '2023-01-31', amount: 5, type: 'ASSET' },
      { date: '2023-02-28', amount: 10, type: 'ASSET' },
    ]);
    expect(result.end.toISODate()).toBe(DateTime.now().toISODate());
  });

  it('ends today even if the data goes beyond today', () => {
    const nextMonth = DateTime.now().plus({ month: 1 }).endOf('month').toISODate();
    const result = calculateIntervalForAccountHistory([
      { date: '2023-01-31', amount: 5, type: 'ASSET' },
      { date: nextMonth, amount: 10, type: 'ASSET' },
    ]);
    expect(result.end.toISODate()).toBe(DateTime.now().toISODate());
  });

  it('ends 1 month after the last historic nonzero monthly balance', () => {
    const result = calculateIntervalForAccountHistory([
      { date: '2023-01-31', amount: 5, type: 'ASSET' },
      { date: '2023-02-28', amount: 10, type: 'ASSET' },
      { date: '2023-03-31', amount: 0, type: 'ASSET' },
    ]);
    expect(result.end.toISODate()).toBe('2023-03-31');
  });

  it('ends 1 month after the last historic nonzero monthly balance', () => {
    const result = calculateIntervalForAccountHistory([
      { date: '2023-01-31', amount: 5, type: 'ASSET' },
      { date: '2023-02-28', amount: 10, type: 'ASSET' },
      { date: '2023-03-31', amount: 0, type: 'ASSET' },
      { date: '2023-04-30', amount: 0, type: 'ASSET' },
      { date: '2023-05-31', amount: 0, type: 'ASSET' },
    ]);
    expect(result.end.toISODate()).toBe('2023-03-31');
  });

  it('includes two full months for zero balances', () => {
    // No need for a special case here, the interval is 2 months because we always add 1 month for
    // safety to the last month worth including in the report.
    const result = calculateIntervalForAccountHistory([
      { date: '2023-01-31', amount: 0, type: 'ASSET' },
      { date: '2023-02-28', amount: 0, type: 'ASSET' },
      { date: '2023-03-31', amount: 0, type: 'ASSET' },
      { date: '2023-04-30', amount: 0, type: 'ASSET' },
    ]);
    expect(result.start.toISODate()).toBe('2023-01-01');
    expect(result.end.toISODate()).toBe('2023-02-28');
  });
});

describe('getAccountTypeFilterForTrend', () => {
  const baseTrend: TrendState = {
    reportType: 'ASSETS_TIME',
    fixedFilter: 'CUSTOM',
    fromDate: '2020-01-01',
    toDate: '2020-01-01',
  };

  it('should exclude certain debt accounts for ASSETS_TIME', () => {
    const filter = getAccountTypeFilterForTrend({ ...baseTrend, reportType: 'ASSETS_TIME' });
    expect(filter('BankAccount')).toBe(true);
    expect(filter('VehicleAccount')).toBe(true);
    expect(filter('CreditAccount')).toBe(false);
    expect(filter('LoanAccount')).toBe(false);
  });

  it('should exclude certain asset accounts for DEBTS_TIME', () => {
    const filter = getAccountTypeFilterForTrend({ ...baseTrend, reportType: 'DEBTS_TIME' });
    expect(filter('CreditAccount')).toBe(true);
    expect(filter('LoanAccount')).toBe(true);
    expect(filter('BankAccount')).toBe(false);
    expect(filter('InvestmentAccount')).toBe(false);
  });

  it('should exclude property accounts for SPENDING_TIME', () => {
    const filter = getAccountTypeFilterForTrend({ ...baseTrend, reportType: 'SPENDING_TIME' });
    expect(filter('BankAccount')).toBe(true);
    expect(filter('CreditAccount')).toBe(true);
    expect(filter('RealEstateAccount')).toBe(false);
    expect(filter('VehicleAccount')).toBe(false);
  });

  it('should exclude property accounts for INCOME_TIME', () => {
    const filter = getAccountTypeFilterForTrend({ ...baseTrend, reportType: 'INCOME_TIME' });
    expect(filter('BankAccount')).toBe(true);
    expect(filter('CreditAccount')).toBe(true);
    expect(filter('RealEstateAccount')).toBe(false);
    expect(filter('VehicleAccount')).toBe(false);
  });

  it('should include all accounts except insurance and cash for NET_WORTH', () => {
    const filter = getAccountTypeFilterForTrend({ ...baseTrend, reportType: 'NET_WORTH' });
    expect(filter('BankAccount')).toBe(true);
    expect(filter('CreditAccount')).toBe(true);
    expect(filter('RealEstateAccount')).toBe(true);
    expect(filter('VehicleAccount')).toBe(true);
  });

  it('should exclude property accounts for NET_INCOME', () => {
    const filter = getAccountTypeFilterForTrend({ ...baseTrend, reportType: 'NET_INCOME' });
    expect(filter('BankAccount')).toBe(true);
    expect(filter('CreditAccount')).toBe(true);
    expect(filter('RealEstateAccount')).toBe(false);
    expect(filter('VehicleAccount')).toBe(false);
  });

  it('should exclude cash and insurance accounts for all types', () => {
    const reportTypes: ReportType[] = [
      'ASSETS_TIME',
      'DEBTS_TIME',
      'SPENDING_TIME',
      'INCOME_TIME',
      'NET_WORTH',
      'NET_INCOME',
    ];
    for (const reportType of reportTypes) {
      const filter = getAccountTypeFilterForTrend({ ...baseTrend, reportType });
      expect(filter('CashAccount')).toBe(false);
      expect(filter('InsuranceAccount')).toBe(false);
    }
  });
});
