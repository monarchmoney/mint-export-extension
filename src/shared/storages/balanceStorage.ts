import { BalanceHistoryCallbackProgress } from '@root/src/shared/lib/accounts';
import { createStorage, StorageType } from '@src/shared/storages/base';

export enum BalanceHistoryDownloadStatus {
  Idle = 'idle',
  Loading = 'loading',
  Success = 'success',
  Error = 'error',
}

type State = {
  status: BalanceHistoryDownloadStatus;
  successCount: number;
  errorCount: number;
  progress?: BalanceHistoryCallbackProgress;
};

const balancesStorage = createStorage<State>(
  'balances',
  {
    status: BalanceHistoryDownloadStatus.Idle,
    successCount: 0,
    errorCount: 0,
    progress: {
      completePercentage: 0,
      completedAccounts: 0,
      totalAccounts: 0,
    },
  },
  {
    storageType: StorageType.Local,
  },
);

export default balancesStorage;
