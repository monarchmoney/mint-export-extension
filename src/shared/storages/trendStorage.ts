import { TrendBalanceHistoryCallbackProgress, TrendState } from '@root/src/shared/lib/accounts';
import { createStorage, StorageType } from '@src/shared/storages/base';

export enum TrendDownloadStatus {
  Idle = 'idle',
  Loading = 'loading',
  Success = 'success',
  Error = 'error',
}

type State = {
  status: TrendDownloadStatus;
  trend: TrendState;
  progress?: TrendBalanceHistoryCallbackProgress;
};

const trendStorage = createStorage<State>(
  'trend',
  {
    status: TrendDownloadStatus.Idle,
    trend: null,
    progress: {
      completePercentage: 0,
    },
  },
  {
    storageType: StorageType.Local,
  },
);

export default trendStorage;
