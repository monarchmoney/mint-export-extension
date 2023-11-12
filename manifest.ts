import packageJson from './package.json';

/**
 * After changing this file, please reload the extension at `chrome://extensions`
 */
const manifest: chrome.runtime.ManifestV3 = {
  manifest_version: 3,
  name: 'Mint Data Exporter, by Monarch',
  version: packageJson.version,
  description: packageJson.description,
  permissions: ['storage', 'activeTab', 'scripting', 'downloads'],
  background: {
    service_worker: 'src/pages/background/index.js',
    type: 'module',
  },
  action: {
    default_popup: 'src/pages/popup/index.html',
    default_icon: 'icon-34.png',
    default_title: 'Open Mint Data Exporter',
  },
  icons: {
    '128': 'icon-128.png',
  },
  web_accessible_resources: [
    {
      resources: [
        'assets/js/*.js',
        'assets/css/*.css',
        'icon-128.png',
        'icon-34.png',
        'icon-beta-34.png',
        'icon-beta-128.png',
      ],
      matches: ['https://mint.intuit.com/*'],
    },
  ],
};

export default manifest;
