import ErrorBoundary from '@root/src/components/ErrorBoundary';
import Progress from '@root/src/components/Progress';
import SpinnerWithText from '@root/src/components/SpinnerWithText';
import Text from '@root/src/components/Text';
import DefaultButton from '@root/src/components/button/DefaultButton';

import useStorage from '@root/src/shared/hooks/useStorage';
import accountStorage, { AccountsDownloadStatus } from '@root/src/shared/storages/accountStorage';
import pluralize from 'pluralize';
import { useMemo } from 'react';

const DownloadBalances = () => {
  const accountStateValue = useStorage(accountStorage);
  const isSuccess = accountStateValue.status === AccountsDownloadStatus.Success;

  const content = useMemo(() => {
    const { successCount, errorCount, progress } = accountStateValue ?? {};
    const { totalAccounts, completedAccounts, completePercentage = 0 } = progress ?? {};

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
          <DefaultButton href="https://help.monarchmoney.com/hc/en-us/articles/14882425704212-Upload-account-balance-history">
            Import into Monarch
          </DefaultButton>
        </div>
      );
    } else if (completePercentage > 0) {
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
  }, [isSuccess, accountStateValue]);

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
