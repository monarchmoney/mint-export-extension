import ErrorBoundary from '@root/src/components/ErrorBoundary';
import Progress from '@root/src/components/Progress';
import SpinnerWithText from '@root/src/components/SpinnerWithText';
import Text from '@root/src/components/Text';
import DefaultButton from '@root/src/components/button/DefaultButton';

import useStorage from '@root/src/shared/hooks/useStorage';
import { useMemo } from 'react';
import trendStorage, { TrendDownloadStatus } from '../../shared/storages/trendStorage';

const DownloadTrend = () => {
  const trendStateValue = useStorage(trendStorage);
  const isSuccess = trendStateValue.status === TrendDownloadStatus.Success;

  const content = useMemo(() => {
    const { progress } = trendStateValue ?? {};
    const { completePercentage = 0 } = progress ?? {};

    if (isSuccess) {
      return (
        <div className="flex flex-col gap-3">
          <Text type="header">Download complete!</Text>
          <Text className="font-normal">
            Balance history for the trend downloaded to your computer.
          </Text>
          <DefaultButton href="https://help.monarchmoney.com/hc/en-us/articles/14882425704212-Upload-account-balance-history">
            Import into Monarch
          </DefaultButton>
        </div>
      );
    } else if (completePercentage > 0) {
      return (
        <div className="flex flex-col gap-3">
          <Text className="text-current text-textLight">
            Downloading balance history for the trend. This may take a minute.
          </Text>
          {completePercentage > 0 && (
            <div className="flex flex-col gap-3">
              <Progress percentage={completePercentage} />
            </div>
          )}
        </div>
      );
    } else {
      return <Text>Getting your balance information...</Text>;
    }
  }, [isSuccess, trendStateValue]);

  if (trendStateValue.status === TrendDownloadStatus.Error) {
    return (
      <ErrorBoundary>
        Sorry, there was an error downloading the trend balances. Note that daily trend data is less
        likely to be available for trends that include very old transactions across a large number
        of accounts. Please try again later or refine the trend.
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

export default DownloadTrend;
