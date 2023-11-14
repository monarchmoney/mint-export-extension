import { BaseStorage, createStorage, StorageType } from '@src/shared/storages/base';
import { DateTime } from 'luxon';

const CACHE_HIT_TTL_MS = 1000 * 60 * 1; // 1 minute

let cacheHitAt: DateTime | undefined;

const storage = createStorage<string>('auth-storage', undefined, {
  storageType: StorageType.Local,
});

const apiKeyStorage: BaseStorage<string> = storage;

export const getMintApiKey = async () => {
  if (cacheHitAt.diffNow().as('milliseconds') > CACHE_HIT_TTL_MS) {
    cacheHitAt = DateTime.local();
    return apiKeyStorage.getSnapshot();
  }

  return await apiKeyStorage.get();
};

export default apiKeyStorage;
