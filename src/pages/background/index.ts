import { ResponseStatus } from '@root/src/pages/popup/Popup';
import { ErrorCode } from '@root/src/shared/constants/error';
import { Action, Message } from '@root/src/shared/hooks/useMessage';
import {
  fetchDailyBalancesForAllAccounts,
  formatBalancesAsCSV,
  BalanceHistoryCallbackProgress,
  fetchDailyBalancesForTrend,
  TrendBalanceHistoryCallbackProgress,
  TrendEntry,
} from '@root/src/shared/lib/accounts';
import { throttle } from '@root/src/shared/lib/events';
import stateStorage from '@root/src/shared/storages/stateStorage';
import accountStorage, { AccountsDownloadStatus } from '@src/shared/storages/accountStorage';
import {
  concatenateCSVPages,
  fetchAllDownloadTransactionPages,
  fetchTransactionsTotalCount,
} from '@src/shared/lib/transactions';
import apiKeyStorage from '@src/shared/storages/apiKeyStorage';
import JSZip from 'jszip';
import reloadOnUpdate from 'virtual:reload-on-update-in-background-script';
import 'webextension-polyfill';

import * as Sentry from '@sentry/browser';
import trendStorage, { TrendDownloadStatus } from '../../shared/storages/trendStorage';
import { getCurrentTrendState } from '../../shared/lib/trends';

// @ts-ignore - https://github.com/getsentry/sentry-javascript/issues/5289#issuecomment-1368705821
Sentry.WINDOW.document = {
  visibilityState: 'hidden',
  addEventListener: () => {},
};

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  release: import.meta.env.VITE_COMMIT_SHA,
  environment: import.meta.env.MODE,
  integrations: [new Sentry.BrowserTracing()],
  tracesSampleRate: 1.0,
  ignoreErrors: [/ResizeObserver/, 'ResizeObserver loop limit exceeded', 'Network request failed'],
  beforeSend(event) {
    if (event.user) {
      // Do not send user data to Sentry
      delete event.user.ip_address;
      delete event.user.segment;
      delete event.user.id;
    }
    return event;
  },
});

reloadOnUpdate('pages/background');

const THROTTLE_INTERVAL_MS = 200;

chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  if (sender.tab?.url.startsWith('chrome://')) {
    return true;
  }

  const transaction = Sentry.startTransaction({
    name: message.action,
    op: 'background',
  });

  Sentry.configureScope((scope) => scope.setSpan(transaction));

  if (message.action === Action.PopupOpened) {
    handlePopupOpened(sendResponse);
  } else if (message.action === Action.GetMintApiKey) {
    handleMintAuthentication(sendResponse);
  } else if (message.action === Action.GetTrendState) {
    handleGetTrendState(sendResponse);
  } else if (message.action === Action.DownloadTransactions) {
    handleTransactionsDownload(sendResponse);
  } else if (message.action === Action.DownloadAllAccountBalances) {
    handleDownloadAllAccountBalances(sendResponse);
  } else if (message.action === Action.DownloadTrendBalances) {
    handleDownloadTrendBalances(sendResponse);
  } else if (message.action === Action.DebugThrowError) {
    throw new Error('Debug error');
  } else {
    console.warn(`Unknown action: ${message.action}`);
  }

  transaction.finish();

  return true; // indicates we will send a response asynchronously
});

const handlePopupOpened = async (sendResponse: (args: unknown) => void) => {
  const apiKey = await apiKeyStorage.get();

  await stateStorage.clear();

  if (apiKey) {
    sendResponse({ status: ResponseStatus.Success, apiKey });
  } else {
    sendResponse({ status: ResponseStatus.RequireAuth });
  }
};

const handleMintAuthentication = async (sendResponse: (args: unknown) => void) => {
  const [activeMintTab] = await chrome.tabs.query({
    active: true,
    url: 'https://mint.intuit.com/*',
  });

  // No active Mint tab, return early
  if (!activeMintTab) {
    sendResponse({ success: false, error: ErrorCode.MintTabNotFound });
    return;
  }

  // Get the API key from the page
  const response = await chrome.scripting.executeScript({
    target: { tabId: activeMintTab.id },
    world: 'MAIN',
    func: getMintApiKey,
  });

  const [{ result: apiKey }] = response;

  if (apiKey) {
    await apiKeyStorage.set(apiKey);
    sendResponse({ success: true, key: apiKey });
  } else {
    sendResponse({ success: false, error: ErrorCode.MintApiKeyNotFound });
  }
};

function getMintApiKey() {
  return window.__shellInternal?.appExperience?.appApiKey;
}

const handleGetTrendState = async (sendResponse: (args: unknown) => void) => {
  const [activeMintTab] = await chrome.tabs.query({
    active: true,
    url: 'https://mint.intuit.com/*',
  });

  // No active Mint tab, return early
  if (!activeMintTab) {
    sendResponse({ success: false, error: ErrorCode.MintTabNotFound });
    return;
  }

  // Get the trend state from the page
  const response = await chrome.scripting.executeScript({
    target: { tabId: activeMintTab.id },
    world: 'MAIN',
    func: getCurrentTrendState,
  });

  const [{ result: trend }] = response;

  await trendStorage.patch({ trend });
  if (trend) {
    sendResponse({ success: true, trend });
  } else {
    sendResponse({ success: false, error: ErrorCode.MintTrendStateNotFound });
  }
};

const handleTransactionsDownload = async (sendResponse: (args: unknown) => void) => {
  const totalTransactionCount = await fetchTransactionsTotalCount();

  const pages = await fetchAllDownloadTransactionPages({ totalTransactionCount });
  const csvContent = concatenateCSVPages(pages);

  await chrome.downloads.download({
    url: `data:text/csv;charset=utf-8,${encodeURIComponent(csvContent)}`,
    filename: 'mint-transactions.csv',
  });

  // Update state in the background, in case the user closes the popup before the download completes
  await stateStorage.patch({
    totalTransactionsCount: totalTransactionCount,
    downloadTransactionsStatus: ResponseStatus.Success,
  });

  sendResponse({ success: true, count: totalTransactionCount });
};

/**
 * Download all daily balances for all account. Since this is an operation that
 * may take a while, we will send progress updastes to the popup.
 */
const handleDownloadAllAccountBalances = async (sendResponse: () => void) => {
  try {
    const throttledSendDownloadBalancesProgress = throttle(
      sendDownloadBalancesProgress,
      THROTTLE_INTERVAL_MS,
    );

    const balancesByAccount = await fetchDailyBalancesForAllAccounts({
      onProgress: throttledSendDownloadBalancesProgress,
    });

    const successAccounts = balancesByAccount.filter(({ balances }) => balances.length > 0);
    const errorAccounts = balancesByAccount.filter(({ balances }) => balances.length === 0);

    // combine CSV for each account into one zip file
    const zip = new JSZip();
    const seenAccountNames = {};
    successAccounts.forEach(({ accountName, fiName, balances }) => {
      const seenCount = (seenAccountNames[accountName] = (seenAccountNames[accountName] || 0) + 1);
      // If there are multiple accounts with the same name, export both with distinct filenames
      const disambiguation = seenCount > 1 ? ` (${seenCount - 1})` : '';
      zip.file(
        `${accountName}${disambiguation}-${fiName}.csv`,
        formatBalancesAsCSV({ balances, accountName }),
      );
    });

    const zipFile = await zip.generateAsync({ type: 'base64' });

    chrome.downloads.download({
      url: `data:application/zip;base64,${zipFile}`,
      filename: 'mint-balances.zip',
    });

    await accountStorage.patch({
      status: AccountsDownloadStatus.Success,
      successCount: successAccounts.length,
      errorCount: errorAccounts.length,
    });
  } catch (e) {
    await accountStorage.patch({ status: AccountsDownloadStatus.Error });
  } finally {
    sendResponse();
  }
};

let pendingTrendBalances: Promise<TrendEntry[]>;

/** Download daily balances for the specified trend. */
const handleDownloadTrendBalances = async (sendResponse: () => void) => {
  try {
    if (pendingTrendBalances) {
      // already downloading
      await pendingTrendBalances;
    } else {
      const throttledSendDownloadTrendBalancesProgress = throttle(
        sendDownloadTrendBalancesProgress,
        THROTTLE_INTERVAL_MS,
      );
      const { trend } = await trendStorage.get();
      await trendStorage.set({
        trend,
        status: TrendDownloadStatus.Loading,
        progress: { completePercentage: 0 },
      });
      pendingTrendBalances = fetchDailyBalancesForTrend({
        trend,
        onProgress: throttledSendDownloadTrendBalancesProgress,
      });
      const balances = await pendingTrendBalances;
      const { reportType } = trend;
      const csv = formatBalancesAsCSV({ balances, reportType });

      chrome.downloads.download({
        url: `data:text/csv,${csv}`,
        filename: 'mint-trend-daily-balances.csv',
      });

      await trendStorage.patch({ status: TrendDownloadStatus.Success });
    }
  } catch (e) {
    await trendStorage.patch({ status: TrendDownloadStatus.Error });
  } finally {
    pendingTrendBalances = null;
    sendResponse();
  }
};

/**
 * Updates both the state storage and sends a message with the current progress,
 * so the popup can update the UI and we have a state to restore from if the
 * popup is closed.
 */
const sendDownloadBalancesProgress = async (payload: BalanceHistoryCallbackProgress) => {
  await accountStorage.patch({ progress: payload });
};

const sendDownloadTrendBalancesProgress = async (payload: TrendBalanceHistoryCallbackProgress) => {
  await trendStorage.patch({ progress: payload });
};
