import { Message } from '../../shared/hooks/useMessage';
import { TrendBalanceHistoryCallbackProgress, TrendState } from '../../shared/lib/accounts';
import { ContentAction } from './content-action';

/** Request daily history for the current trend and download as a CSV file. */
export const exportDailyHistory = ({
  trend,
  onProgress,
}: {
  trend: TrendState;
  onProgress?: (completed?: number) => void;
}) =>
  withProgressMonitor(async () => {
    const message: Message = {
      action: ContentAction.DownloadTrendBalances,
      payload: trend,
    };
    await chrome.runtime.sendMessage(message);
  }, onProgress);

/**
 * Performs the action with progress reporting that guarantees no stray progress updates after
 * completion of the action.
 */
const withProgressMonitor = async (
  action: () => Promise<void>,
  onProgress?: (completed?: number) => void,
) => {
  const listener = (message: Message<TrendBalanceHistoryCallbackProgress>) => {
    switch (message.action) {
      case ContentAction.DownloadTrendBalancesProgress:
        onProgress?.(+message.payload.completePercentage);
        break;
    }
  };

  chrome.runtime.onMessage.addListener(listener);
  onProgress?.(0);

  try {
    await action();
  } finally {
    chrome.runtime.onMessage.removeListener(listener);
    onProgress?.();
  }
};
