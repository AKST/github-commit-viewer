(function () {
  'use strict';

  const { compile } = globalThis.GDFGlob;
  const store = globalThis.GDFStore;

  const list = document.getElementById('categories');
  const template = document.getElementById('category-template');
  const status = document.getElementById('status');
  const testPath = document.getElementById('test-path');
  const testResult = document.getElementById('test-result');

  const slug = (s) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'category';

  function addCard(cat = { id: '', name: '', patterns: [] }) {
    const node = template.content.firstElementChild.cloneNode(true);
    node.dataset.id = cat.id;
    node.querySelector('.name').value = cat.name;
    node.querySelector('.patterns').value = cat.patterns.join('\n');
    node.querySelector('.remove').addEventListener('click', () => {
      node.remove();
      runTester();
    });
    node.addEventListener('input', () => {
      validate(node);
      runTester();
    });
    list.append(node);
    validate(node);
    return node;
  }

  function readCard(node) {
    return {
      id: node.dataset.id,
      name: node.querySelector('.name').value.trim(),
      patterns: node.querySelector('.patterns').value.split('\n').map((l) => l.trimEnd()).filter((l, i, a) => l || i < a.length - 1),
    };
  }

  function validate(node) {
    const err = node.querySelector('.error');
    try {
      compile(readCard(node).patterns);
      err.hidden = true;
      return true;
    } catch (e) {
      err.textContent = e.message;
      err.hidden = false;
      return false;
    }
  }

  function render(categories) {
    list.replaceChildren();
    categories.forEach((c) => addCard(c));
    runTester();
  }

  function runTester() {
    const path = testPath.value.trim();
    if (!path) {
      testResult.textContent = '';
      return;
    }
    const hits = [];
    for (const node of list.children) {
      const cat = readCard(node);
      try {
        if (compile(cat.patterns)(path)) hits.push(cat.name || '(unnamed)');
      } catch {
        // invalid categories are flagged on their card
      }
    }
    testResult.replaceChildren();
    if (hits.length) {
      testResult.append('Matches ');
      hits.forEach((h, i) => {
        const b = document.createElement('span');
        b.className = 'hit';
        b.textContent = h;
        testResult.append(b, i < hits.length - 1 ? ', ' : '');
      });
    } else {
      testResult.textContent = 'No category matches';
    }
  }

  function setStatus(text, isError = false) {
    status.textContent = text;
    status.classList.toggle('error-status', isError);
  }

  async function save() {
    const nodes = [...list.children];
    if (!nodes.every(validate)) {
      setStatus('Fix the highlighted patterns before saving.', true);
      return;
    }
    const used = new Set();
    const categories = nodes.map((node) => {
      const cat = readCard(node);
      if (!cat.name) cat.name = 'Untitled';
      let id = cat.id || slug(cat.name);
      for (let n = 2; used.has(id); n += 1) id = `${slug(cat.name)}-${n}`;
      used.add(id);
      node.dataset.id = id;
      return { ...cat, id };
    });
    try {
      await store.saveCategories(categories);
      setStatus('Saved. Open diff pages update immediately.');
    } catch (e) {
      setStatus(`Couldn't save: ${e.message}`, true);
    }
  }

  document.getElementById('add').addEventListener('click', () => addCard().querySelector('.name').focus());
  document.getElementById('save').addEventListener('click', save);
  document.getElementById('reset').addEventListener('click', async () => {
    await store.resetCategories();
    render((await store.load()).categories);
    setStatus('Restored the default categories.');
  });
  testPath.addEventListener('input', runTester);
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      save();
    }
  });

  store.load().then((s) => render(s.categories));
})();
