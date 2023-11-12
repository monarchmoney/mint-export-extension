import { TEST_MINT_API_KEY } from '@root/src/shared/lib/constants';
import {
  fetchAccounts,
  fetchDailyBalancesForAllAccounts,
  fetchMonthlyBalancesForAccount,
  fetchNetWorthBalances,
  formatBalancesAsCSV,
} from '../accounts';

describe('fetchMonthlyBalancesForAccount', () => {
  it('fetches balances by date for asset account', async () => {
    const { balancesByDate } = await fetchMonthlyBalancesForAccount({
      accountId: '43237333_1544498',
      overrideApiKey: TEST_MINT_API_KEY,
    });
    expect(balancesByDate.length).toEqual(141);
  });

  it('fetches balances for debt account', async () => {
    const { balancesByDate } = await fetchMonthlyBalancesForAccount({
      accountId: '43237333_2630847',
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
    const result = formatBalancesAsCSV(
      [
        { amount: 123.45, date: '2021-01-01', type: '' },
        { amount: 234.56, date: '2021-02-01', type: '' },
      ],
      `Mason's Account`,
    );
    expect(result).toEqual(`"Date","Amount","Account Name"
"2021-01-01","123.45","Mason's Account"
"2021-02-01","234.56","Mason's Account"
`);
  });

  it('does not include account name if not provided', () => {
    const result = formatBalancesAsCSV([
      { amount: 123.45, date: '2021-01-01', type: '' },
      { amount: 234.56, date: '2021-02-01', type: '' },
    ]);
    expect(result).toEqual(`"Date","Amount"
"2021-01-01","123.45"
"2021-02-01","234.56"
`);
  });

  it('converts undefined balances to empty string', () => {
    const result = formatBalancesAsCSV([
      {
        amount: undefined,
        date: '2020-01-01',
        type: '',
      },
    ]);
    expect(result).toEqual(`"Date","Amount"
"2020-01-01",""
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
