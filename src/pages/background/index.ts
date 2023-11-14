import { ResponseStatus } from '@root/src/pages/popup/Popup';
import { ErrorCode } from '@root/src/shared/constants/error';
import { Action } from '@root/src/shared/hooks/useMessage';
import {
  fetchDailyBalancesForAllAccounts,
  formatBalancesAsCSV,
  BalanceHistoryCallbackProgress,
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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.tab?.url.startsWith('chrome://')) {
    return true;
  }

  const transaction = Sentry.startTransaction({
    name: message.action,
    op: 'background',
  });

  Sentry.configureScope((scope) => scope.setSpan(transaction));

  console.log(`Received message with action: ${message.action}`);

  switch (message.action) {
    case Action.PopupOpened:
      handlePopupOpened(sendResponse);
      break;
    case Action.GetMintApiKey:
      handleMintAuthentication(sendResponse);
      break;
    case Action.DownloadTransactions:
      handleTransactionsDownload(sendResponse);
      break;
    case Action.DownloadAllAccountBalances:
      handleDownloadAllAccountBalances();
      break;
    case Action.DebugThrowError:
      throw new Error('Debug error');
    default:
      console.warn(`Unknown action: ${message.action}`);
      break;
  }

  transaction.finish();

  return true; // indicates we will send a response asynchronously
});

const handlePopupOpened = async (sendResponse: (args: unknown) => void) => {
  const apiKey = await apiKeyStorage.get();

  const [accountStorageValue, stateStorageValue] = await Promise.all([
    accountStorage.get(),
    stateStorage.get(),
  ]);
  const hasBalancesError = accountStorageValue?.status === AccountsDownloadStatus.Error;
  const hasTransactionsError =
    stateStorageValue?.downloadTransactionsStatus === ResponseStatus.Error;

  if (hasBalancesError || hasTransactionsError) {
    await stateStorage.clear();
  }

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
 * Download all daily balances for all accounts. Since this is an operation that
 * may take a while, we will send progress updates to the popup.
 */
const handleDownloadAllAccountBalances = async () => {
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
    successAccounts.forEach(({ accountName, balances }) => {
      zip.file(`${accountName}.csv`, formatBalancesAsCSV(balances, accountName));
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

    chrome.runtime.sendMessage({
      action: Action.DownloadBalancesComplete,
      payload: {
        outcome: ResponseStatus.Success,
        successCount: successAccounts.length,
        errorCount: errorAccounts.length,
      },
    });
  } catch (e) {
    Sentry.captureException(e);
    await accountStorage.patch({ status: AccountsDownloadStatus.Error });
    chrome.runtime.sendMessage({
      action: Action.DownloadBalancesComplete,
      payload: {
        outcome: ResponseStatus.Error,
      },
    });
  }
};

/**
 * Updates both the state storage and sends a message with the current progress,
 * so the popup can update the UI and we have a state to restore from if the
 * popup is closed.
 */
const sendDownloadBalancesProgress = (payload: BalanceHistoryCallbackProgress) =>
  chrome.runtime.sendMessage({
    action: Action.DownloadBalancesProgress,
    payload,
  });
