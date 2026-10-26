// Shared storage access for the content script and options page.
//   sync:  categories  [{ id, name, patterns: string[] }]   (follows you across Chrome profiles)
//   local: active      { [categoryId]: boolean }            (which categories are currently hidden)
//          adhoc       string                               (extra patterns typed into the menu)
(function (root) {
  'use strict';

  const clone = (x) => JSON.parse(JSON.stringify(x));

  const GDFStore = {
    async load() {
      const [{ categories }, { active, adhoc }] = await Promise.all([
        chrome.storage.sync.get('categories'),
        chrome.storage.local.get(['active', 'adhoc']),
      ]);
      return {
        categories: Array.isArray(categories) ? categories : clone(root.GDFDefaults.DEFAULT_CATEGORIES),
        active: active ?? {},
        adhoc: adhoc ?? '',
      };
    },
    saveCategories: (categories) => chrome.storage.sync.set({ categories }),
    resetCategories: () => chrome.storage.sync.remove('categories'),
    saveActive: (active) => chrome.storage.local.set({ active }),
    saveAdhoc: (adhoc) => chrome.storage.local.set({ adhoc }),
    onChange(callback) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if ((area === 'sync' && changes.categories) || (area === 'local' && (changes.active || changes.adhoc))) {
          callback();
        }
      });
    },
  };

  root.GDFStore = GDFStore;
})(globalThis);
