import { createStorage, StorageType } from '@src/shared/storages/base';

type State = {
  currentPage: string | undefined;
  // Transactions
  downloadTransactionsStatus: string; // ResponseStatus
  totalTransactionsCount: number;

  // Balances
  downloadAccountBalanceHistoryStatus: string; // ResponseStatus
  downloadBalancesProgress: {
    complete: number;
    total: number;
  };
  totalAccountsCount: number;
};

const stateStorage = createStorage<State>(
  'state-storage',
  {
    currentPage: undefined,
    downloadTransactionsStatus: undefined,
    totalTransactionsCount: undefined,
    downloadAccountBalanceHistoryStatus: undefined,
    totalAccountsCount: undefined,
    downloadBalancesProgress: {
      complete: 0,
      total: 0,
    },
  },
  {
    storageType: StorageType.Local,
  },
);

export default stateStorage;
