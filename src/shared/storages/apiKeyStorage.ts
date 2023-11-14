import { BaseStorage, createStorage, StorageType } from '@src/shared/storages/base';

const storage = createStorage<string>('auth-storage', undefined, {
  storageType: StorageType.Local,
});

const apiKeyStorage: BaseStorage<string> = storage;

export default apiKeyStorage;
