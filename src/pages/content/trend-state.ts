import { TrendType, TrendState, ReportType } from '../../shared/lib/accounts';

const CURRENT_TREND_TYPE_LOCAL_STORAGE_KEY = 'trends-state';

const getCurrentTrendType = () => {
  return localStorage.getItem(CURRENT_TREND_TYPE_LOCAL_STORAGE_KEY) as TrendType;
};

const getTrendState = (type: TrendType) => {
  return JSON.parse(
    localStorage.getItem(`${CURRENT_TREND_TYPE_LOCAL_STORAGE_KEY}-${type}`) || 'null',
  ) as TrendState;
};

/** State for the most recent trend according to localStorage, does not need to be visible */
export const getCurrentTrendState = () => getTrendState(getCurrentTrendType());

/** Whether the extension can generate daily balances for the active trend. */
export const isSupportedTrendReport = (type: ReportType) => {
  switch (type) {
    case 'ASSETS_TIME':
    case 'DEBTS_TIME':
    case 'INCOME_TIME':
    case 'SPENDING_TIME':
    case 'NET_INCOME':
    case 'NET_WORTH':
      return true;
    default:
      // by tag, by category, by type, etc.
      return false;
  }
};
