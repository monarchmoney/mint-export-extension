import { WebClient } from '@slack/web-api';
import core from '@actions/core';
import fs from 'fs';

import packageJson from '../../../../package.json';

const EXTENSION_ZIP_PATH = './chrome-extension-beta.zip';

// Not used for now, but should be added to the message in the future
const COMMIT_MESSAGE = process.env.COMMIT_MSG;
const COMMIT_SHA = process.env.COMMIT_SHA;

const run = async () => {
  try {
    if (!process.env.SLACK_BOT_TOKEN) {
      throw new TypeError('SLACK_BOT_TOKEN is not set');
    }

    if (!process.env.SLACK_CHANNEL_ID) {
      throw new TypeError('SLACK_CHANNEL_ID is not set');
    }

    const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
    const zipExists = fs.existsSync(EXTENSION_ZIP_PATH);

    if (!zipExists) {
      core.info('chrome-extension-beta.zip does not exist. Skipping notification.');
      return;
    }

    const version = determineVersion();

    await slack.files.uploadV2({
      channel_id: process.env.SLACK_CHANNEL_ID,
      file: EXTENSION_ZIP_PATH,
      filename: `chrome-extension-${version}.zip`,
      initial_comment: [
        `✨ *New beta release available (\`v${version}\`)*`,
        COMMIT_MESSAGE &&
          COMMIT_SHA &&
          `> ${COMMIT_MESSAGE} (<https://github.com/monarchmoney/mint-exporter-ext/commit/${COMMIT_SHA}|${COMMIT_SHA.slice(
            0,
            7,
          )}>)`,
        `To learn how to test it locally, follow <https://developer.chrome.com/docs/extensions/mv3/getstarted/development-basics/#load-unpacked|this guide from Google>.`,
      ]
        .filter(Boolean)
        .join('\n'),
    });
  } catch (e) {
    core.setFailed(e.message);
  }
};

const determineVersion = () => {
  const { version } = packageJson;
  const runNumber = process.env.GITHUB_RUN_NUMBER;
  return runNumber ? `${version}.${runNumber}` : `${version}-beta`;
};

run();
