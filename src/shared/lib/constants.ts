export const DATE_FILTER_ALL_TIME = {
  type: 'ALL_TIME',
};

export const MINT_HEADERS = {
  'content-type': 'application/json',
};

export const TEST_MINT_API_KEY = '';

export const UTM_URL_PARAMETERS = {
  utm_source: 'mint_export_extension',
};

// we may need to increase this, need to test more
export const MINT_RATE_LIMIT_DELAY_MS = 50;

// The Mint API returns daily activity when the date range is 43 days or fewer.
export const MINT_DAILY_TRENDS_MAX_DAYS = 43;
