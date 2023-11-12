import { createRoot } from 'react-dom/client';
import '@pages/popup/index.css';
import Popup from '@pages/popup/Popup';
import refreshOnUpdate from 'virtual:reload-on-update-in-view';

refreshOnUpdate('pages/popup');
refreshOnUpdate('components');

function init() {
  const appContainer = document.querySelector('#app-container');
  if (!appContainer) {
    throw new Error('Cannot find #app-container');
  }
  const root = createRoot(appContainer);
  root.render(<Popup />);
}

init();
