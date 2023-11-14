import { BalanceHistoryCallbackProgress } from '@root/src/shared/lib/accounts';
import { createStorage, StorageType } from '@src/shared/storages/base';

export enum AccountsDownloadStatus {
  Idle = 'idle',
  Loading = 'loading',
  Success = 'success',
  Error = 'error',
}

type State = {
  status: AccountsDownloadStatus;
  successCount: number;
  errorCount: number;
  progress?: BalanceHistoryCallbackProgress;
};

const accountStorage = createStorage<State>(
  'accounts',
  {
    status: AccountsDownloadStatus.Idle,
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

export default accountStorage;
