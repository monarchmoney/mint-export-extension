import { TrendState, ReportType, FixedDateFilter } from '../../shared/lib/accounts';

type AccountFilterReactProps = {
  children: {
    props: {
      /** Selected account IDs and categories */
      value: string[];
    };
  };
};

type DatePickerReactProps = {
  props: {
    children: [
      unknown,
      {
        props: {
          /** The ISO date string */
          value: string;
        };
      },
      unknown,
    ];
  };
};

type TimeFilterReactProps = {
  children: [DatePickerReactProps, DatePickerReactProps];
};

/**
 * State for the current visible trend.
 *
 * This function must be executed in the context of the Mint tab and therefore must be
 * self-contained.
 */
export const getCurrentTrendState = () => {
  if (
    // disable when not viewing the Trends page
    window.location.pathname.startsWith('/trends') &&
    // disable when filtered by category, tag, etc. because the extension does not support these
    !document.querySelector('[data-automation-id="filter-chip"]')
  ) {
    try {
      // Return React data backing HTML elements
      const getReactProps = <Props>(selector: string) => {
        const el = document.querySelector(selector);
        return el?.[Object.keys(el).find((key) => key.startsWith('__reactProps'))] as Props;
      };
      const accountState = getReactProps<AccountFilterReactProps>(
        '[data-automation-id="filter-accounts"]',
      );
      // For ALL_TIME charts this time range may be inaccurate (e.g. 2007 when the data only begins
      // in 2021) but the extension is better equipped to choose the correct date with the API.
      const timeFilterState = getReactProps<TimeFilterReactProps>(
        '[data-automation-id="filter-time-custom"]',
      );
      // ReportType can also be found in react props but it does not update reliably
      const reportType = document.querySelector('.trends-sidebar-report-selected-list-item a')
        ?.id as ReportType;
      const fixedFilter = (document.getElementById('select-timeframe') as HTMLSelectElement)
        .value as FixedDateFilter;
      const accountIds = accountState.children.props.value.filter(
        // Only numeric account IDs (ignore selected categories like AllAccounts and BankAccounts
        // that will evaluate to NaN)
        (id) => +id[0] === +id[0],
      ) as string[];
      // This is a bit much, but can't seem to get the value reliably from child elements
      const fromDate = timeFilterState.children[0].props.children[1].props.value;
      const toDate = timeFilterState.children[1].props.children[1].props.value;
      const trendState: TrendState = {
        accountIds,
        reportType,
        fixedFilter,
        fromDate,
        toDate,
      };
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
