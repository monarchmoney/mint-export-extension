import { TrendType, TrendState, ReportType } from '../../shared/lib/accounts';

/**
 * State for the most recent trend according to localStorage, does not need to be visible
 *
 * This function must be executed in the context of the Mint tab and therefore must be
 * self-contained.
 */
export const getCurrentTrendState = () => {
  if (
    // disable when not viewing the Trends page
    window.location.pathname.startsWith('/trends') &&
    // disable when filtered by category, tag, etc. because this filter is not in the trend state
    !document.querySelector('[data-automation-id="filter-chip"]')
  ) {
    try {
      const CURRENT_TREND_TYPE_LOCAL_STORAGE_KEY = 'trends-state';
      const currentTrendType = localStorage.getItem(
        CURRENT_TREND_TYPE_LOCAL_STORAGE_KEY,
      ) as TrendType;
      const trendState = JSON.parse(
        localStorage.getItem(`${CURRENT_TREND_TYPE_LOCAL_STORAGE_KEY}-${currentTrendType}`) ||
          'null',
      ) as TrendState;

      return trendState;
    } catch (e) {
      // ignore
    }
  }
  return null;
};

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
