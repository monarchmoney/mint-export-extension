import apiKeyStorage, { getMintApiKey } from '@src/shared/storages/apiKeyStorage';

const MINT_API_BASE_URL = 'https://mint.intuit.com';

export const makeAuthorizationHeader = (key: string) =>
  `Intuit_APIKey intuit_apikey=${key},intuit_apikey_version=1.0`;

interface TypedResponse<T> extends Response {
  json(): Promise<T>;
}

export const makeMintApiRequest = async <T>(
  path: string,
  options: RequestInit,
  overrideApiKey?: string,
): Promise<TypedResponse<T>> => {
  // Try to get cached API key to speed up requests if possible
  const apiKey = overrideApiKey ?? (await getMintApiKey());

  if (!apiKey) {
    throw new Error('API key not found');
  }

  const response = await fetch(`${MINT_API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: makeAuthorizationHeader(apiKey),
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      await apiKeyStorage.clear();
    }

    throw new Error(`Request failed with status ${response.status}`);
  }

  return response;
};

export const getUserData = async (overrideApiKey?: string) => {
  const response = await makeMintApiRequest<{ userName: string }>(
    '/pfm/v1/user',
    { method: 'GET' },
    overrideApiKey,
  );

  return response.json();
};
