import { useRef, useEffect, useCallback } from 'react';

export enum Action {
  PopupOpened = 'POPUP_OPENED',
  GetMintApiKey = 'GET_MINT_API_KEY',
  GetTrendState = 'GET_TREND_STATE',
  // Sent by the button in the popup to start downloading transactions
  RequestTransactionsDownload = 'REQUEST_TRANSACTIONS_DOWNLOAD',
  DownloadTransactions = 'DOWNLOAD_TRANSACTIONS',
  DownloadAllAccountBalances = 'DOWNLOAD_ALL_ACCOUNT_BALANCES',
  DownloadBalancesProgress = 'DOWNLOAD_BALANCES_PROGRESS',
  DownloadBalancesComplete = 'DOWNLOAD_BALANCES_COMPLETE',
  DownloadTrendBalances = 'DOWNLOAD_TREND_BALANCES',
  DownloadTrendBalancesProgress = 'DOWNLOAD_TREND_BALANCES_PROGRESS',
  // Debug actions
  DebugThrowError = 'DEBUG_THROW_ERROR',
}

export type Message<TPayload = Record<string, unknown>> = {
  action: Action;
  payload?: TPayload;
};

export const useMessageListener = <TPayload extends Record<string, unknown>>(
  action: Action,
  callback: (payload: TPayload) => void | Promise<void>,
) => {
  const listenerRef =
    useRef<(message: Message<TPayload>, sender: unknown, sendResponse: unknown) => void>();

  useEffect(() => {
    if (listenerRef.current) {
      return;
    }

    // Create a new listener
    listenerRef.current = async (message) => {
      if (message.action === action) {
        // eslint-disable-next-line no-prototype-builtins
        if (callback.hasOwnProperty('then')) {
          await callback(message.payload);
        } else {
          callback(message.payload);
        }
      }

      return true;
    };

    chrome.runtime.onMessage.addListener(listenerRef.current);

    return () => {
      chrome.runtime.onMessage.removeListener(listenerRef.current);
    };
  }, [action, callback]);
};

export const useMessageSender = () => {
  const sendMessage = useCallback(
    <T extends Record<string, unknown>>(message: Message) =>
      new Promise<T>((resolve, reject) => {
        chrome.runtime.sendMessage(message, (response: T) => {
          if (response?.error) {
            reject(response);
            return;
          }

          resolve(response);
        });
      }),
    [],
  );

  return sendMessage;
};
