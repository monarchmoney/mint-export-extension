import { ResponseStatus } from '@root/src/pages/popup/Popup';
import { createContext, useContext } from 'react';

const PopupContext = createContext<{
  status: ResponseStatus;
  errorMessage?: string;
  userData?: Partial<{ userName: string }>;
}>(undefined as any);

export const usePopupContext = () => {
  const context = useContext(PopupContext);

  if (!context) {
    throw new Error('usePopupContext must be used within PopupContext.Provider');
  }

  return context;
};

export default PopupContext;
