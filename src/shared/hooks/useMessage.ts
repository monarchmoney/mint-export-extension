import { useRef, useEffect, useCallback } from 'react';

export enum Action {
  PopupOpened = 'POPUP_OPENED',
  GetMintApiKey = 'GET_MINT_API_KEY',
  // Sent by the button in the popup to start downloading transactions
  RequestTransactionsDownload = 'REQUEST_TRANSACTIONS_DOWNLOAD',
  DownloadTransactions = 'DOWNLOAD_TRANSACTIONS',
  DownloadAllAccountBalances = 'DOWNLOAD_ALL_ACCOUNT_BALANCES',
  DownloadBalancesProgress = 'DOWNLOAD_BALANCES_PROGRESS',
  DownloadBalancesComplete = 'DOWNLOAD_BALANCES_COMPLETE',
  // Debug actions
  DebugThrowError = 'DEBUG_THROW_ERROR',
}

type Message = { action: Action; payload?: Record<string, unknown> };

export const useMessageListener = <TPayload extends Record<string, unknown>>(
  action: Action,
  callback: (payload: TPayload) => void | Promise<void>,
) => {
  const listenerRef = useRef<(message: Message, sender: unknown, sendResponse: unknown) => void>();

  useEffect(() => {
    // Remove listener if it exists
    if (listenerRef.current) {
      chrome.runtime.onMessage.removeListener(listenerRef.current);
    }

    // Create a new listener
    listenerRef.current = (message) => {
      if (message.action === action) {
        callback(message.payload as TPayload);
      }
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
