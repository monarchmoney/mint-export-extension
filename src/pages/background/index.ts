import { ResponseStatus } from '@root/src/pages/popup/Popup';
import { ErrorCode } from '@root/src/shared/constants/error';
import { Action } from '@root/src/shared/hooks/useMessage';
import stateStorage from '@root/src/shared/storages/stateStorage';
import {
  concatenateCSVPages,
  fetchAllDownloadTransactionPages,
  fetchTransactionsTotalCount,
} from '@src/shared/lib/transactions';
import apiKeyStorage from '@src/shared/storages/apiKeyStorage';
import reloadOnUpdate from 'virtual:reload-on-update-in-background-script';
import {
  fetchDailyBalancesForAllAccounts,
  formatBalancesAsCSV,
} from '@root/src/shared/lib/accounts';
import JSZip from 'jszip';
import 'webextension-polyfill';
import { throttle } from '@root/src/shared/lib/events';

// #v-ifdef VITE_SENTRY_DSN
// We don't want to track any user data, so we only initialize Sentry in development
// (it's where we have VITE_SENTRY_DSN defined)

import * as Sentry from '@sentry/browser';

// https://github.com/getsentry/sentry-javascript/issues/5289#issuecomment-1368705821
// @ts-ignore - Just for local development
Sentry.WINDOW.document = {
  visibilityState: 'hidden',
  addEventListener: () => {},
};

Sentry.init({
  debug: true,
  dsn: import.meta.env.VITE_SENTRY_DSN,
  release: import.meta.env.VITE_COMMIT_SHA,
  environment: import.meta.env.MODE,
  integrations: [new Sentry.BrowserTracing()],
  tracesSampleRate: 1.0,
  ignoreErrors: [/ResizeObserver/, 'ResizeObserver loop limit exceeded', 'Network request failed'],
});
// #v-endif

reloadOnUpdate('pages/background');

const THROTTLE_INTERVAL_MS = 200;

declare global {
  interface Window {
    __shellInternal?: {
      appExperience: {
        appApiKey: string;
      };
    };
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.tab?.url.startsWith('chrome://')) {
    return true;
  }

  // #v-ifdef VITE_SENTRY_DSN
  const transaction = Sentry.startTransaction({
    name: message.action,
    op: 'background',
  });

  Sentry.configureScope((scope) => scope.setSpan(transaction));
  // #v-endif

  console.log(`Received message with action: ${message.action}`);

  if (message.action === Action.PopupOpened) {
    handlePopupOpened(sendResponse);
  } else if (message.action === Action.GetMintApiKey) {
    handleMintAuthentication(sendResponse);
  } else if (message.action === Action.DownloadTransactions) {
    handleTransactionsDownload(sendResponse);
  } else if (message.action === Action.DownloadAllAccountBalances) {
    handleDownloadAllAccountBalances();
  } else if (message.action === Action.DebugThrowError) {
    throw new Error('Debug error');
  }

  // #v-ifdef VITE_SENTRY_DSN
  transaction.finish();
  // #v-endif

  return true; // indicates we will send a response asynchronously
});

const handlePopupOpened = async (sendResponse: (args: unknown) => void) => {
  const apiKey = await apiKeyStorage.get();

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

    chrome.runtime.sendMessage({
      action: Action.DownloadBalancesComplete,
      payload: {
        outcome: ResponseStatus.Success,
        successCount: successAccounts.length,
        errorCount: errorAccounts.length,
      },
    });
  } catch (e) {
    console.error(e);
    console.log(JSON.stringify(e));
    chrome.runtime.sendMessage({
      action: Action.DownloadBalancesComplete,
      payload: {
        outcome: ResponseStatus.Error,
      },
    });
  }
};

const sendDownloadBalancesProgress = (payload) =>
  chrome.runtime.sendMessage({
    action: Action.DownloadBalancesProgress,
    payload,
  });
