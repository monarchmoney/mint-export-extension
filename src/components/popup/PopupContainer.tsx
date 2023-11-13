import Section from '@root/src/components/Section';
import SpinnerWithText from '@root/src/components/SpinnerWithText';
import Text from '@root/src/components/Text';
import DefaultButton from '@root/src/components/button/DefaultButton';
import DownloadTransactions from '@root/src/components/popup/DownloadTransactions';
import { ResponseStatus } from '@root/src/pages/popup/Popup';
import { usePopupContext } from '@root/src/pages/popup/context';
import React, { useCallback, useMemo } from 'react';
import stateStorage from '@root/src/shared/storages/stateStorage';
import useStorage from '@root/src/shared/hooks/useStorage';
import { Action, useMessageSender } from '@root/src/shared/hooks/useMessage';
import Footer from '@root/src/components/Footer';
import OtherResources from '@root/src/components/popup/OtherResources';
import { fetchAccounts } from '@root/src/shared/lib/accounts';
import DownloadBalances from '@root/src/components/popup/DownloadBalances';
import balancesStorage, {
  BalanceHistoryDownloadStatus,
} from '@root/src/shared/storages/balanceStorage';

interface Page {
  title: string;
  component: React.ElementType;
}

const PAGE_TO_COMPONENT: Record<string, Page> = {
  downloadTransactions: {
    title: 'Mint Transactions',
    component: DownloadTransactions,
  },
  downloadAccountBalanceHistory: {
    title: 'Mint Account Balance History',
    component: DownloadBalances,
  },
};

const PopupContainer = ({ children }: React.PropsWithChildren) => {
  const { currentPage, downloadTransactionsStatus } = useStorage(stateStorage);
  const { status, userData } = usePopupContext();
  const sendMessage = useMessageSender();

  const onDownloadTransactions = useCallback(async () => {
    stateStorage.patch({
      currentPage: 'downloadTransactions',
      downloadTransactionsStatus: ResponseStatus.Loading,
      totalTransactionsCount: undefined,
    });
    const result = await sendMessage<{ count?: number }>({ action: Action.DownloadTransactions });
    if (result?.count) {
      stateStorage.patch({
        downloadTransactionsStatus: ResponseStatus.Success,
        totalTransactionsCount: result.count,
      });
    } else {
      stateStorage.patch({ downloadTransactionsStatus: ResponseStatus.Error });
    }
  }, [sendMessage]);

  const onDownloadAccountBalanceHistory = useCallback(async () => {
    // Reset any previous state
    await Promise.all([
      () =>
        stateStorage.patch({
          currentPage: 'downloadAccountBalanceHistory',
        }),
      () =>
        balancesStorage.patch({
          status: BalanceHistoryDownloadStatus.Loading,
          progress: { totalAccounts: 0, completedAccounts: 0, completePercentage: 0 },
        }),
    ]);

    const mintAccounts = await fetchAccounts({ offset: 0 });
    await balancesStorage.patch({
      progress: { totalAccounts: mintAccounts.length, completedAccounts: 0, completePercentage: 0 },
    });

    // The result of this message is handled by the DownloadBalances component
    return sendMessage({ action: Action.DownloadAllAccountBalances });
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
          </div>
        );
      default:
        return (
          <div className="p-large text-center">
            Unknown state. Please try opening the extension again.
          </div>
        );
    }
  }, [status, userData?.userName, onDownloadTransactions, onDownloadAccountBalanceHistory]);

  const { component: PageComponent, title: pageTitle } = PAGE_TO_COMPONENT[currentPage] ?? {};

  // 💀
  const showBackArrow =
    currentPage === 'downloadTransactions'
      ? downloadTransactionsStatus !== ResponseStatus.Loading
      : currentPage === 'downloadAccountBalanceHistory'
      ? downloadTransactionsStatus !== ResponseStatus.Loading
      : !!currentPage; // there's a page that's not index (index is undefined)

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
