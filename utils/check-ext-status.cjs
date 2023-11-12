/* eslint-disable @typescript-eslint/no-var-requires */

/**
 * Checks whether there's an extension draft under review
 * on the Chrome Web Store for the Beta version.
 */

require('dotenv').config();

const {
  GOOGLE_CLIENT_ID: clientId,
  GOOGLE_CLIENT_SECRET: clientSecret,
  GOOGLE_REFRESH_TOKEN: refreshToken,
  EXTENSION_ID: extensionId,
} = process.env;

if (!clientId || !clientSecret || !refreshToken) {
  throw new Error(
    `Missing credentials. Ensure you have defined the following environment ` +
      `variables: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN`,
  );
}

const run = async ({ core }) => {
  const { default: chromeWebstoreUpload } = await import('chrome-webstore-upload');
  const store = chromeWebstoreUpload({ extensionId, clientId, clientSecret, refreshToken });
  const existingDraft = await store.get('DRAFT');

  let status = 'no';

  if (existingDraft) {
    console.log('Extension draft exists');
    console.log(existingDraft);
    status = 'yes';
  } else {
    console.log('Extension draft does not exist. Continuing with upload.');
  }

  core.setOutput('status', status);
};

module.exports = { run };
