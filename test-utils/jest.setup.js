// Do what you need to set up your test

// polyfill fetch api for node
require('isomorphic-fetch');

// mock auth storage because chrome environment does not exist
jest.mock('../src/shared/storages/apiKeyStorage', () => ({}));
