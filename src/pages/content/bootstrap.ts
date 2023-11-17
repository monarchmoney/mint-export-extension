(async () => {
  // Load the content script with an async import, otherwise it will not be able to use module
  // import syntax.
  const src = chrome.runtime.getURL('src/pages/content/index.js');
  await import(src);
})();
