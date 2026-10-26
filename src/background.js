// Toolbar button and the menu's "Edit categories" link both open the options page.
// Content scripts can't call openOptionsPage themselves, so they message here.
chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'gdf:open-options') chrome.runtime.openOptionsPage();
});
