import { createStorage, StorageType } from '@src/shared/storages/base';

export type PageKey = 'downloadTransactions' | 'downloadBalances' | 'downloadTrend';

type State = {
  currentPage: PageKey | undefined;
  // Transactions
  downloadTransactionsStatus: string; // ResponseStatus
  totalTransactionsCount: number;
};

const stateStorage = createStorage<State>(
  'state-storage',
  {
    currentPage: undefined,
    downloadTransactionsStatus: undefined,
    totalTransactionsCount: undefined,
  },
  {
    storageType: StorageType.Local,
  },
);

export default stateStorage;
