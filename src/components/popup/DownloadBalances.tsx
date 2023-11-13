import ErrorBoundary from '@root/src/components/ErrorBoundary';
import Progress from '@root/src/components/Progress';
import SpinnerWithText from '@root/src/components/SpinnerWithText';
import Text from '@root/src/components/Text';
import DefaultButton from '@root/src/components/button/DefaultButton';
import { ResponseStatus } from '@root/src/pages/popup/Popup';
import { Action, useMessageListener } from '@root/src/shared/hooks/useMessage';
import useStorage from '@root/src/shared/hooks/useStorage';
import stateStorage from '@root/src/shared/storages/stateStorage';
import pluralize from 'pluralize';
import { useMemo, useState } from 'react';

const DownloadTransactions = () => {
  const stateValue = useStorage(stateStorage);
  const [progress, setProgress] = useState({
    totalAccounts: 0,
    completedAccounts: 0,
    completePercentage: 0,
  });

  const [status, setStatus] = useState(stateValue.downloadAccountBalanceHistoryStatus);
  const isSuccess = status === ResponseStatus.Success;

  const [accountsOutcome, setAccountsOutcome] = useState({ successCount: 0, errorCount: 0 });

  useMessageListener(
    Action.DownloadBalancesProgress,
    ({ completedAccounts, totalAccounts, completePercentage }: any) =>
      setProgress({ completedAccounts, totalAccounts, completePercentage }),
  );

  useMessageListener(
    Action.DownloadBalancesComplete,
    ({
      outcome,
      successCount,
      errorCount,
    }: {
      outcome: ResponseStatus;
      successCount: number;
      errorCount: number;
    }) => {
      setStatus(outcome);
      setAccountsOutcome({ successCount, errorCount });
    },
  );

  const content = useMemo(() => {
    const { totalAccountsCount = 0 } = stateValue;
    const { totalAccounts, completedAccounts, completePercentage } = progress;
    const { successCount, errorCount } = accountsOutcome;

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
    } else if (totalAccountsCount) {
      return (
        <div className="flex flex-col gap-3">
          <Text className="text-current text-textLight">
            Downloading balance history for {totalAccountsCount}{' '}
            {pluralize('account', totalAccountsCount)}. This may take a minute.
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
  }, [isSuccess, stateValue, progress, accountsOutcome]);

  if (status === ResponseStatus.Error) {
    return <ErrorBoundary>Sorry, there was an error downloading your balances</ErrorBoundary>;
  }

  return (
    <div className="mt-2 p-large py-xlarge">
      <SpinnerWithText complete={isSuccess}>
        <div className="text-center">{content}</div>
      </SpinnerWithText>
    </div>
  );
};

export default DownloadTransactions;
