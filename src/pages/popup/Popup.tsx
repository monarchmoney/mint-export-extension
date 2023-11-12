import { useEffect, useState, useMemo } from 'react';
import apiKeyStorage from '@src/shared/storages/apiKeyStorage';
import withSuspense from '@src/shared/hoc/withSuspense';
import withErrorBoundary from '@src/shared/hoc/withErrorBoundary';
import { Action, useMessageSender } from '@src/shared/hooks/useMessage';
import { getUserData } from '@src/shared/lib/auth';
import { ErrorCode } from '@src/shared/constants/error';
import PopupContainer from '@src/components/popup/PopupContainer';
import DefaultButton from '@root/src/components/button/DefaultButton';
import PopupContext from '@root/src/pages/popup/context';
import Text from '@root/src/components/Text';
import stateStorage from '@root/src/shared/storages/stateStorage';
import ErrorBoundary from '@root/src/components/ErrorBoundary';

// #v-ifdef VITE_SENTRY_DSN
// We don't want to track any user data, so we only initialize Sentry in development
// (it's where we have VITE_SENTRY_DSN defined)
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  release: import.meta.env.VITE_COMMIT_SHA,
  tracesSampleRate: 1.0,
});
// #v-endif

export enum ResponseStatus {
  RequireAuth = 'require_auth',
  Error = 'error',
  Success = 'success',
  Loading = 'loading',
}

const Popup = () => {
  const [showBrokenComponent, setShowBrokenComponent] = useState(false);
  const sendMessage = useMessageSender();

  const [status, setStatus] = useState<ResponseStatus>(ResponseStatus.Loading);
  const [errorMessage, setErrorMessage] = useState<string>(null);

  const [userData, setUserData] = useState<Record<string, string>>({});

  useEffect(() => {
    if (status === ResponseStatus.Loading) {
      handlePopupOpened();
    }
  }, [status]);

  const resetExtensionState = async () => {
    await apiKeyStorage.clear();
    await stateStorage.clear();
    setUserData(null);
    setStatus(ResponseStatus.Loading);
  };

  const authenticateUser = async (apiKey: string) => {
    try {
      const userData = await getUserData(apiKey);
      setUserData(userData);

      await apiKeyStorage.set(apiKey);
      setStatus(ResponseStatus.Success);
    } catch (error) {
      setStatus(ResponseStatus.Error);
      setErrorMessage(
        "We couldn't get your user data. Please ensure you have a tab with the Mint dashboard open.",
      );
    }
  };

  const handlePopupOpened = async () => {
    const response = await sendMessage<{ status: ResponseStatus; apiKey?: string }>({
      action: Action.PopupOpened,
    });

    if (!response) {
      setStatus(ResponseStatus.Error);
      return;
    }

    const { status, apiKey } = response;
    if (status === ResponseStatus.RequireAuth) {
      authenticateOnDashboard();
    } else {
      await authenticateUser(apiKey);
    }
  };

  const authenticateOnDashboard = async () => {
    try {
      const response = await sendMessage<{ success: boolean; apiKey?: string; error?: ErrorCode }>({
        action: Action.GetMintApiKey,
      });

      await authenticateUser(response.apiKey);
    } catch ({ error }) {
      if (error === ErrorCode.MintTabNotFound) {
        // User hasn't opened the popup in the dashboard, show message
        setStatus(ResponseStatus.RequireAuth);
      } else if (error === ErrorCode.MintApiKeyNotFound) {
        // User is not logged into Mint, show message to open Mint and login
        setStatus(ResponseStatus.Error);
        setErrorMessage('Please login to Mint and open this popup again.');
      }
    }
  };

  const context = useMemo(
    () => ({ status, errorMessage, userData }),
    [status, errorMessage, userData],
  );

  return (
    <PopupContext.Provider value={context}>
      <PopupContainer>
        {import.meta.env.DEV && (
          <div className="flex flex-col gap-2 border-b border-t border-dashed border-grayLight bg-grayLightBackground p-large">
            <Text type="subtitle" className="text-center">
              🔨 Debugging Tools
            </Text>
            <DefaultButton onClick={resetExtensionState}>Reset API key state</DefaultButton>
            <DefaultButton onClick={() => setShowBrokenComponent(true)}>Throw error</DefaultButton>
            <DefaultButton onClick={() => sendMessage({ action: Action.DebugThrowError })}>
              Throw error in service worker
            </DefaultButton>
            {showBrokenComponent && <BrokenComponent />}
          </div>
        )}
      </PopupContainer>
    </PopupContext.Provider>
  );
};

const BrokenComponent = () => {
  throw new Error('Broken component');
  return null;
};

export default withErrorBoundary(withSuspense(Popup, <div>Loading...</div>), <ErrorBoundary />);
