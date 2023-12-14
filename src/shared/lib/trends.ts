import { TrendState, ReportType, FixedDateFilter, TrendType } from '../../shared/lib/accounts';

type TrendsUiState = {
  reportCategory: TrendType;
  reportType: ReportType;
  fromDate: string;
  toDate: string;
  fixedFilter: FixedDateFilter;
  accounts: {
    id: string;
    isSelected: boolean;
  }[];
};

type TrendsUiReactProps = {
  children: {
    props: {
      children: {
        props: {
          children: [
            unknown,
            {
              props: {
                store: {
                  getState: () => { Trends: TrendsUiState };
                };
              };
            },
          ];
        };
      };
    };
  };
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
      const trendsUiState =
        getReactProps<TrendsUiReactProps>(
          '.cg-pfm-trends-ui',
        ).children.props.children.props.children[1].props.store.getState();
      const { reportType, fromDate, toDate, fixedFilter, accounts } = trendsUiState.Trends;
      const accountIds = accounts.flatMap((a) => (a.isSelected ? a.id : []));
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
