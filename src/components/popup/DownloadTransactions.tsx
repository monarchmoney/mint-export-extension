import ErrorBoundary from '@root/src/components/ErrorBoundary';
import SpinnerWithText from '@root/src/components/SpinnerWithText';
import Text from '@root/src/components/Text';
import DefaultButton from '@root/src/components/button/DefaultButton';
import { ResponseStatus } from '@root/src/pages/popup/Popup';
import useStorage from '@root/src/shared/hooks/useStorage';
import stateStorage from '@root/src/shared/storages/stateStorage';
import pluralize from 'pluralize';

const formatter = new Intl.NumberFormat('en-US', {
  style: 'decimal',
  maximumFractionDigits: 2,
});

const DownloadTransactions = () => {
  const stateValue = useStorage(stateStorage);

  const isSuccess = stateValue.downloadTransactionsStatus === ResponseStatus.Success;

  if (stateValue.downloadTransactionsStatus === ResponseStatus.Error) {
    return <ErrorBoundary>Sorry, there was an error downloading your transactions</ErrorBoundary>;
  }

  return (
    <div className="mt-2 p-large">
      <SpinnerWithText complete={isSuccess}>
        <div className="text-center">
          {isSuccess ? (
            <div className="flex flex-col gap-3">
              <Text type="header">Download complete!</Text>
              <Text className="font-normal">
                {formatter.format(stateValue.totalTransactionsCount)}{' '}
                {pluralize('transaction', stateValue.totalTransactionsCount)} successfully
                downloaded to your computer.
              </Text>
              <DefaultButton href="https://help.monarchmoney.com/hc/en-us/articles/4411877901972-Move-data-over-from-Mint-to-Monarch">
                Import into Monarch
              </DefaultButton>
            </div>
          ) : (
            'Downloading your transactions...'
          )}
        </div>
      </SpinnerWithText>
    </div>
  );
};

export default DownloadTransactions;
