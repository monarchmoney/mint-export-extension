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


/** Default number of API requests that can start in each 1 second window */
export const MINT_RATE_LIMIT_REQUESTS_PER_SECOND = 20;

/** Default number of API requests that can run at the same time */
export const MINT_RATE_LIMIT_CONCURRENT_REQUESTS = 6;

// The Mint API returns daily activity when the date range is 43 days or fewer.
export const MINT_DAILY_TRENDS_MAX_DAYS = 43;
