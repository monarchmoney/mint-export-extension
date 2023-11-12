import * as fs from 'fs';
import * as path from 'path';
import colorLog from '../log';
import ManifestParser from '../manifest-parser';
import type { PluginOption } from 'vite';

const { resolve } = path;

const distDir = resolve(__dirname, '..', '..', 'dist');
const publicDir = resolve(__dirname, '..', '..', 'public');

const isBetaVersion = process.env.IS_BETA === '1';

export default function makeManifest(
  manifest: chrome.runtime.ManifestV3,
  config: { isDev: boolean; contentScriptCssKey?: string },
): PluginOption {
  function makeManifest(to: string) {
    if (!fs.existsSync(to)) {
      fs.mkdirSync(to);
    }

    const manifestPath = resolve(to, 'manifest.json');

    // https://developer.chrome.com/docs/extensions/migrating/publish-mv3/
    if (isBetaVersion) {
      manifest.name += ' BETA';
      manifest.version += process.env.GITHUB_RUN_NUMBER ? `.${process.env.GITHUB_RUN_NUMBER}` : '';
      manifest.description += '\nTHIS EXTENSION IS FOR BETA TESTING';

      manifest.action.default_icon = 'icon-beta-34.png';
      manifest.icons['128'] = 'icon-beta-128.png';
    }

    // Naming change for cache invalidation
    if (config.contentScriptCssKey && !!manifest.content_scripts) {
      manifest.content_scripts.forEach((script) => {
        script.css = script.css.map((css) => css.replace('<KEY>', config.contentScriptCssKey));
      });
    }

    fs.writeFileSync(manifestPath, ManifestParser.convertManifestToString(manifest));

    colorLog(`Manifest file copy complete: ${manifestPath}`, 'success');
  }

  return {
    name: 'make-manifest',
    buildStart() {
      if (config.isDev) {
        makeManifest(distDir);
      }
    },
    buildEnd() {
      if (config.isDev) {
        return;
      }
      makeManifest(publicDir);
    },
  };
}
