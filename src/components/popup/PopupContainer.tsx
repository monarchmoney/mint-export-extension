import Section from '@root/src/components/Section';
import SpinnerWithText from '@root/src/components/SpinnerWithText';
import Text from '@root/src/components/Text';
import DefaultButton from '@root/src/components/button/DefaultButton';
import DownloadTransactions from '@root/src/components/popup/DownloadTransactions';
import { ResponseStatus } from '@root/src/pages/popup/Popup';
import { usePopupContext } from '@root/src/pages/popup/context';
import React, { useCallback, useMemo } from 'react';
import stateStorage, { PageKey } from '@root/src/shared/storages/stateStorage';
import useStorage from '@root/src/shared/hooks/useStorage';
import { Action, useMessageSender } from '@root/src/shared/hooks/useMessage';
import Footer from '@root/src/components/Footer';
import OtherResources from '@root/src/components/popup/OtherResources';
import { fetchAccounts } from '@root/src/shared/lib/accounts';
import DownloadBalances from '@root/src/components/popup/DownloadBalances';
import accountStorage, { AccountsDownloadStatus } from '@root/src/shared/storages/accountStorage';
import DownloadTrend from './DownloadTrend';
import { isSupportedTrendReport } from '../../shared/lib/trends';
import trendStorage, { TrendDownloadStatus } from '../../shared/storages/trendStorage';

interface Page {
  title: string;
  component: React.ElementType;
}

const PAGE_TO_COMPONENT: Record<PageKey, Page> = {
  downloadTransactions: {
    title: 'Mint Transactions',
    component: DownloadTransactions,
  },
  downloadBalances: {
    title: 'Mint Account Balance History',
    component: DownloadBalances,
  },
  downloadTrend: {
    title: 'Current Trend Balance History',
    component: DownloadTrend,
  },
};

const PopupContainer = ({ children }: React.PropsWithChildren) => {
  const { currentPage, downloadTransactionsStatus } = useStorage(stateStorage);
  const { trend, status: trendStatus } = useStorage(trendStorage);
  const { status, userData } = usePopupContext();
  const sendMessage = useMessageSender();
  let showPage = currentPage;

  // Trend download is likely to be completed multiple times in a row; do not require the user to
  // click the back arrow after every download if the popup was closed.
  if (currentPage === 'downloadTrend' && trendStatus === TrendDownloadStatus.Success) {
    showPage = undefined;
    stateStorage.patch({ currentPage: undefined });
    trendStorage.patch({ status: TrendDownloadStatus.Idle });
  }

  const onDownloadTransactions = useCallback(async () => {
    const { downloadTransactionsStatus } = await stateStorage.get();
    if (downloadTransactionsStatus === AccountsDownloadStatus.Loading) {
      await stateStorage.patch({
        currentPage: 'downloadTransactions',
      });
      return;
    }
    await stateStorage.patch({
      currentPage: 'downloadTransactions',
      downloadTransactionsStatus: ResponseStatus.Loading,
      totalTransactionsCount: undefined,
    });
    const result = await sendMessage<{ count?: number }>({ action: Action.DownloadTransactions });
    if (result?.count) {
      await stateStorage.patch({
        downloadTransactionsStatus: ResponseStatus.Success,
        totalTransactionsCount: result.count,
      });
    } else {
      await stateStorage.patch({ downloadTransactionsStatus: ResponseStatus.Error });
    }
  }, [sendMessage]);

  const onDownloadAccountBalanceHistory = useCallback(async () => {
    const { status } = await accountStorage.get();
    if (status === AccountsDownloadStatus.Loading) {
      await stateStorage.patch({
        currentPage: 'downloadBalances',
      });
      return;
    }
    await accountStorage.clear();

    await stateStorage.patch({
      currentPage: 'downloadBalances',
      downloadTransactionsStatus: undefined,
      totalTransactionsCount: undefined,
    });

    await accountStorage.patch({ status: AccountsDownloadStatus.Loading });

    try {
      const mintAccounts = await fetchAccounts({ offset: 0 });
      await accountStorage.patch({
        status: AccountsDownloadStatus.Loading,
        progress: {
          totalAccounts: mintAccounts.length,
          completedAccounts: 0,
          completePercentage: 0,
        },
        successCount: 0,
        errorCount: 0,
      });
    } catch (error) {
      await accountStorage.patch({ status: AccountsDownloadStatus.Error });
    }

    // The result of this message is handled by the DownloadBalances component
    await sendMessage({ action: Action.DownloadAllAccountBalances });
  }, [sendMessage]);

  const onDownloadTrend = useCallback(async () => {
    await stateStorage.patch({
      currentPage: 'downloadTrend',
      downloadTransactionsStatus: undefined,
      totalTransactionsCount: undefined,
    });
    await sendMessage({ action: Action.DownloadTrendBalances });
  }, [sendMessage]);

  const content = useMemo(() => {
    switch (status) {
      case ResponseStatus.Loading:
        return <SpinnerWithText>Loading your information...</SpinnerWithText>;
      case ResponseStatus.RequireAuth:
      case ResponseStatus.Error:
        return (
          <div className="flex flex-col gap-2 text-center">
            <Text type="subtitle" className="block">
              Open Mint Dashboard
            </Text>
            <Text className="font-medium">
              We couldn&apos;t get your Mint user information. Please ensure you have a tab with the
              Mint dashboard open and try opening the extension again.
            </Text>
            <DefaultButton href="https://mint.intuit.com/overview">
              Go to Mint dashboard
            </DefaultButton>
          </div>
        );
      case ResponseStatus.Success:
        return (
          <div className="flex flex-col gap-2 text-center">
            <Text type="subtitle">Logged in to Mint</Text>
            <Text type="header">{userData?.userName}</Text>
            <DefaultButton onClick={onDownloadTransactions}>
              Download Mint transactions
            </DefaultButton>
            <DefaultButton onClick={onDownloadAccountBalanceHistory}>
              Download Mint account balance history
            </DefaultButton>
            <DefaultButton
              onClick={onDownloadTrend}
              disabled={!isSupportedTrendReport(trend?.reportType)}>
              Download current trend daily balances
            </DefaultButton>
          </div>
        );
      default:
        return (
          <div className="p-large text-center">
            Unknown state. Please try opening the extension again.
          </div>
        );
    }
  }, [
    status,
    userData?.userName,
    trend?.reportType,
    onDownloadTransactions,
    onDownloadAccountBalanceHistory,
  ]);

  const { component: PageComponent, title: pageTitle } = PAGE_TO_COMPONENT[showPage] ?? {};

  // 💀
  const showBackArrow =
    showPage === 'downloadTransactions'
      ? downloadTransactionsStatus !== ResponseStatus.Loading
      : showPage === 'downloadBalances'
      ? downloadTransactionsStatus !== ResponseStatus.Loading
      : !!showPage; // there's a page that's not index (index is undefined)

  // Make sure it's actually running
  if (currentPage === 'downloadBalances') {
    const {
      status,
      progress: { completePercentage },
    } = accountStorage.getSnapshot();
    if (status === AccountsDownloadStatus.Loading) {
      setTimeout(async () => {
        const { status, progress } = await accountStorage.get();
        if (
          status === AccountsDownloadStatus.Loading &&
          completePercentage === progress.completePercentage
        ) {
          await accountStorage.patch({
            status: AccountsDownloadStatus.Error,
          });
        }
      }, 15_000);
    }
  } else if (currentPage === 'downloadTransactions') {
    setTimeout(async () => {
      const { downloadTransactionsStatus } = await stateStorage.get();
      if (downloadTransactionsStatus === AccountsDownloadStatus.Loading) {
        await stateStorage.patch({
          downloadTransactionsStatus: AccountsDownloadStatus.Error,
        });
      }
    }, 30_000);
  } else if (currentPage === 'downloadTrend') {
    const {
      status,
      progress: { completePercentage },
    } = trendStorage.getSnapshot();
    if (status === TrendDownloadStatus.Loading) {
      setTimeout(async () => {
        const { status, progress } = await trendStorage.get();
        if (
          status === TrendDownloadStatus.Loading &&
          completePercentage === progress.completePercentage
        ) {
          await trendStorage.patch({
            status: TrendDownloadStatus.Error,
          });
        }
      }, 5_000); // 5 seconds is enough since there is no networking before progress begins
    }
  }

  return (
    <div className="flex flex-col">
      <Section
        className="border-b-0 bg-greenSpecial"
        left={
          showBackArrow && (
            <button onClick={() => stateStorage.patch({ currentPage: undefined })}>
              <Text type="header" className="text-white">
                ←
              </Text>
            </button>
          )
        }>
        <Text type="header" className="text-white">
          {pageTitle ?? 'Mint Data Exporter'}
        </Text>
      </Section>
      {PageComponent ? (
        <PageComponent />
      ) : (
        <div>
          <div className="p-large">{content}</div>
          <div>
            <OtherResources />
          </div>
        </div>
      )}
      <Footer />
      <div>{children}</div>
    </div>
  );
};

export default PopupContainer;
