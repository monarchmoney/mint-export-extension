import ErrorBoundary from '@root/src/components/ErrorBoundary';
import Progress from '@root/src/components/Progress';
import SpinnerWithText from '@root/src/components/SpinnerWithText';
import Text from '@root/src/components/Text';
import DefaultButton from '@root/src/components/button/DefaultButton';
import { Action, useMessageListener } from '@root/src/shared/hooks/useMessage';
import useStorage from '@root/src/shared/hooks/useStorage';
import { BalanceHistoryCallbackProgress } from '@root/src/shared/lib/accounts';
import accountStorage, { AccountsDownloadStatus } from '@root/src/shared/storages/accountStorage';
import pluralize from 'pluralize';
import { useMemo, useState } from 'react';

const DownloadBalances = () => {
  const accountStateValue = useStorage(accountStorage);
  const isSuccess = accountStateValue.status === AccountsDownloadStatus.Success;

  const [currentProgress, setCurrentProgress] = useState<(typeof accountStateValue)['progress']>(
    accountStateValue.progress,
  );

  useMessageListener(
    Action.DownloadBalancesProgress,
    (progressArgs: BalanceHistoryCallbackProgress) => setCurrentProgress(progressArgs),
  );

  useMessageListener(
    Action.DownloadBalancesComplete,
    ({
      outcome,
      successCount,
      errorCount,
    }: {
      outcome: AccountsDownloadStatus;
      successCount: number;
      errorCount: number;
    }) => accountStorage.patch({ successCount, errorCount, status: outcome }),
  );

  const content = useMemo(() => {
    const { successCount, errorCount } = accountStateValue ?? {};
    const { totalAccounts, completedAccounts, completePercentage } = currentProgress ?? {};

    if (isSuccess) {
      return (
        <div className="flex flex-col gap-3">
          <Text type="header">Download complete!</Text>
          <Text className="font-normal">
            Balance history for {successCount} {pluralize('account', successCount)} downloaded to
            your computer.
          </Text>
          {errorCount > 0 && (
            <Text className="font-normal">
              {pluralize('account', errorCount, true)} failed to download.
            </Text>
          )}
          <DefaultButton href="https://help.monarchmoney.com/hc/en-us/articles/4411877901972-Move-data-over-from-Mint-to-Monarch">
            Import into Monarch
          </DefaultButton>
        </div>
      );
    } else if (totalAccounts) {
      return (
        <div className="flex flex-col gap-3">
          <Text className="text-current text-textLight">
            Downloading balance history for {totalAccounts} {pluralize('account', totalAccounts)}.
            This may take a minute.
          </Text>
          {totalAccounts > 0 && completePercentage > 0 && (
            <div className="flex flex-col gap-3">
              <Progress percentage={completePercentage} />
              <Text className="text-textLight">
                {completedAccounts} of {totalAccounts} {pluralize('accounts', totalAccounts)}{' '}
                complete
              </Text>
            </div>
          )}
        </div>
      );
    } else {
      return <Text>Getting your balance information...</Text>;
    }
  }, [isSuccess, accountStateValue, currentProgress]);

  if (accountStateValue.status === AccountsDownloadStatus.Error) {
    return (
      <ErrorBoundary>
        Sorry, there was an error downloading your balances. We&apos;ve been notified and are
        working on a fix.
      </ErrorBoundary>
    );
  }

  return (
    <div className="mt-2 p-large py-xlarge">
      <SpinnerWithText complete={isSuccess}>
        <div className="text-center">{content}</div>
      </SpinnerWithText>
    </div>
  );
};

export default DownloadBalances;
