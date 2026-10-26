// Hides diff entries (and their file-tree rows) on GitHub commit, compare and PR pages
// when their path matches an active category or the ad-hoc patterns typed into the menu.
(function () {
  'use strict';

  const { compile, splitPatterns } = globalThis.GDFGlob;
  const MARK = 'data-gdf-hidden';
  const HOST_ID = 'gdf-menu-host';

  // ---------------------------------------------------------------------------
  // Page adapters: each returns [{ paths, diffEl, treeEl }] for the files it finds.
  // GitHub currently ships two diff UIs, so both are handled.

  const stripMarks = (s) => s.replace(/[‎‏‪-‮]/g, '').trim();

  /** React diff view (commit pages): <div aria-labelledby=heading-x><h3 id=heading-x><a><code>path</code> */
  function reactFiles() {
    const out = [];
    for (const h of document.querySelectorAll('h3[id^="heading-"]')) {
      const box = h.closest(`[aria-labelledby="${CSS.escape(h.id)}"]`);
      if (!box) continue;
      const codes = h.querySelectorAll('code');
      const text = stripMarks(codes.length ? [...codes].map((c) => c.textContent).join(' → ') : h.textContent);
      const paths = text.split(/\s*→\s*/).filter(Boolean);
      if (!paths.length) continue;
      // Each file box sits alone in a wrapper div; hide the wrapper so no gap is left.
      const wrap = box.parentElement;
      const diffEl = wrap && wrap.childElementCount === 1 && wrap.id !== 'diff-content-parent' ? wrap : box;
      const treeEl = document.getElementById(paths[paths.length - 1]);
      out.push({ paths, diffEl, treeEl: treeEl?.getAttribute('role') === 'treeitem' ? treeEl : null });
    }
    return out;
  }

  /** Classic diff view (PR "Files changed", compare): .file[data-tagsearch-path] */
  function classicFiles() {
    const out = [];
    for (const file of document.querySelectorAll('.file[data-tagsearch-path]')) {
      const path = file.getAttribute('data-tagsearch-path');
      const diffEl = file.closest('copilot-diff-entry') ?? file;
      const treeEl = file.id ? document.getElementById(`file-tree-item-${file.id}`) : null;
      out.push({ paths: [path], diffEl, treeEl });
    }
    return out;
  }

  function collectFiles() {
    const react = reactFiles();
    return react.length ? react : classicFiles();
  }

  /** Directory rows to hide because every file under them is hidden. */
  function directoryRows(files) {
    const rows = [];
    // React tree: directory <li role=treeitem aria-expanded id="a/b"> (ids are paths, possibly
    // compressed like "source/features"). Collapsed directories don't render their children, so
    // decide by path prefix against the diff list rather than by looking at child rows.
    for (const li of document.querySelectorAll('[role="treeitem"][aria-expanded][id]')) {
      const prefix = li.id + '/';
      const under = files.filter((f) => f.paths.some((p) => p.startsWith(prefix)));
      if (under.length) rows.push({ el: li, hide: under.every((f) => f.hidden) });
    }
    // Classic tree: directory rows carry no path, but the tree is fully rendered.
    for (const li of document.querySelectorAll('li[role="treeitem"][data-tree-entry-type="directory"]')) {
      const leaves = li.querySelectorAll('li[role="treeitem"][data-tree-entry-type="file"]');
      if (leaves.length) rows.push({ el: li, hide: [...leaves].every((x) => x.hasAttribute(MARK)) });
    }
    return rows;
  }

  // Uses the `hidden` attribute (Primer forces it to display:none) plus a marker, so we only
  // ever unhide elements we hid ourselves — GitHub's own filters also toggle `hidden`.
  function setHidden(el, hide) {
    if (!el) return;
    const ours = el.hasAttribute(MARK);
    if (hide && !ours) {
      el.setAttribute(MARK, '');
      el.hidden = true;
    } else if (!hide && ours) {
      el.removeAttribute(MARK);
      el.hidden = false;
    }
  }

  // ---------------------------------------------------------------------------
  // State

  let state = { categories: [], active: {}, adhoc: '' };
  let matchers = new Map(); // id → predicate, or Error when the patterns don't compile
  let adhocMatcher = () => false;
  let adhocError = null;

  function compileState() {
    matchers = new Map();
    for (const cat of state.categories) {
      try {
        matchers.set(cat.id, compile(cat.patterns));
      } catch (err) {
        matchers.set(cat.id, err);
      }
    }
    try {
      adhocMatcher = compile(splitPatterns(state.adhoc));
      adhocError = null;
    } catch (err) {
      adhocMatcher = () => false;
      adhocError = err;
    }
  }

  async function reload() {
    state = await globalThis.GDFStore.load();
    compileState();
    schedule();
  }

  // ---------------------------------------------------------------------------
  // Apply

  let lastStats = null;

  function apply() {
    const files = collectFiles();
    const counts = Object.fromEntries(state.categories.map((c) => [c.id, 0]));
    let adhocCount = 0;

    for (const f of files) {
      let hide = false;
      for (const cat of state.categories) {
        const m = matchers.get(cat.id);
        if (typeof m === 'function' && f.paths.some(m)) {
          counts[cat.id] += 1;
          if (state.active[cat.id]) hide = true;
        }
      }
      if (f.paths.some(adhocMatcher)) {
        adhocCount += 1;
        hide = true;
      }
      f.hidden = hide;
      setHidden(f.diffEl, hide);
      setHidden(f.treeEl, hide);
    }
    for (const row of directoryRows(files)) setHidden(row.el, row.hide);

    lastStats = { total: files.length, hidden: files.filter((f) => f.hidden).length, counts, adhocCount };
    menu.update(files.length > 0);
  }

  let timer = 0;
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(apply, 120);
  }

  // ---------------------------------------------------------------------------
  // Menu (shadow DOM so GitHub's CSS and ours don't interact; Primer's CSS variables still
  // inherit through the shadow boundary, which gives light/dark theming for free).

  const MENU_CSS = `
    :host { all: initial; font: 12px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif;
      color: var(--fgColor-default, #1f2328); display: inline-flex; flex: none; }
    :host(.gdf-block) { display: flex; margin: 0 0 8px; }
    :host(.gdf-floating) { position: fixed; right: 16px; bottom: 16px; z-index: 100; }
    button { font: inherit; color: inherit; cursor: pointer; }
    .trigger { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 10px; border-radius: 6px;
      border: 1px solid var(--button-default-borderColor-rest, var(--borderColor-default, #d1d9e0));
      background: var(--button-default-bgColor-rest, var(--bgColor-muted, #f6f8fa)); white-space: nowrap; font-weight: 500; }
    :host(.gdf-inline) .trigger { padding: 0 8px; gap: 4px; }
    :host(.gdf-inline) .label { display: none; }
    :host(.gdf-block) .trigger { width: 100%; justify-content: center; }
    .trigger:hover { background: var(--button-default-bgColor-hover, var(--bgColor-neutral-muted, #eff2f5)); }
    .trigger:focus-visible { outline: 2px solid var(--focus-outlineColor, #0969da); outline-offset: -2px; }
    .trigger svg { fill: currentColor; flex: none; }
    .badge { min-width: 18px; padding: 0 5px; border-radius: 9px; font-size: 11px; line-height: 18px; text-align: center;
      box-sizing: border-box; background: var(--bgColor-neutral-muted, #818b981f); }
    .badge.on { background: var(--bgColor-accent-emphasis, #0969da); color: var(--fgColor-onEmphasis, #fff); }
    /* Popover: rendered in the top layer, so the file-tree sidebar's overflow can't clip it.
       The UA centres popovers with inset/margin; we place it next to the trigger instead. */
    .menu { position: fixed; inset: auto; margin: 0; width: 288px; max-width: calc(100vw - 16px);
      padding: 8px; border-radius: 12px; box-sizing: border-box; color: inherit; font: inherit;
      background: var(--overlay-bgColor, var(--bgColor-default, #fff));
      border: 1px solid var(--borderColor-default, #d1d9e0);
      box-shadow: var(--shadow-floating-large, 0 8px 24px rgba(37, 41, 46, 0.2)); }
    .heading { padding: 2px 8px 6px; color: var(--fgColor-muted, #59636e); font-weight: 600; }
    label.row { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 6px; cursor: pointer; }
    label.row:hover { background: var(--control-transparent-bgColor-hover, #818b981a); }
    label.row input { margin: 0; accent-color: var(--bgColor-accent-emphasis, #0969da); }
    .name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .count { color: var(--fgColor-muted, #59636e); font-variant-numeric: tabular-nums; }
    .row.empty .name { color: var(--fgColor-muted, #59636e); }
    .error { color: var(--fgColor-danger, #d1242f); font-size: 11px; }
    .adhoc { display: block; margin: 6px 0 0; padding: 8px 8px 0; border-top: 1px solid var(--borderColor-muted, #d1d9e0b3); }
    .adhoc span { display: block; margin-bottom: 4px; color: var(--fgColor-muted, #59636e); }
    .adhoc input { box-sizing: border-box; width: 100%; padding: 5px 8px; border-radius: 6px; font: 12px ui-monospace, SFMono-Regular, Menlo, monospace;
      color: inherit; background: var(--bgColor-default, #fff); border: 1px solid var(--borderColor-default, #d1d9e0); }
    .adhoc input:focus { outline: 2px solid var(--focus-outlineColor, #0969da); outline-offset: -1px; }
    .footer { display: flex; justify-content: space-between; align-items: center; margin-top: 8px; padding: 8px 8px 2px;
      border-top: 1px solid var(--borderColor-muted, #d1d9e0b3); color: var(--fgColor-muted, #59636e); }
    .link { border: 0; background: none; padding: 0; color: var(--fgColor-accent, #0969da); }
    .link:hover { text-decoration: underline; }
  `;

  // Octicon eye-closed-16.
  const ICON =
    '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M.143 2.31a.75.75 0 0 1 1.047-.167l14.5 10.5a.75.75 0 1 1-.88 1.214l-2.248-1.628C11.346 13.19 9.792 14 8 14c-1.981 0-3.67-.992-4.933-2.078C1.797 10.832.88 9.577.43 8.9a1.619 1.619 0 0 1 0-1.797c.353-.533.995-1.42 1.868-2.305L.31 3.357A.75.75 0 0 1 .143 2.31Zm1.536 5.622A.12.12 0 0 0 1.657 8c0 .021.006.045.022.068.412.621 1.242 1.75 2.366 2.717C5.175 11.758 6.527 12.5 8 12.5c1.195 0 2.31-.488 3.29-1.191L9.063 9.695A2 2 0 0 1 6.058 7.52L3.529 5.688a14.207 14.207 0 0 0-1.85 2.244ZM8 3.5c-.516 0-1.017.09-1.499.251a.75.75 0 1 1-.473-1.423A6.207 6.207 0 0 1 8 2c1.981 0 3.67.992 4.933 2.078 1.27 1.091 2.187 2.345 2.637 3.023a1.62 1.62 0 0 1 0 1.798c-.11.166-.248.365-.41.587a.75.75 0 1 1-1.21-.887c.148-.201.272-.382.371-.53a.119.119 0 0 0 0-.137c-.412-.621-1.242-1.75-2.366-2.717C10.825 4.242 9.473 3.5 8 3.5Z"></path></svg>';

  const menu = (() => {
    let host = null;
    let root = null;
    let open = false;

    function build() {
      host = document.createElement('div');
      host.id = HOST_ID;
      root = host.attachShadow({ mode: 'open' });
      root.innerHTML = `
        <style>${MENU_CSS}</style>
        <button class="trigger" type="button" popovertarget="gdf-menu" aria-label="Hide files by category" title="Hide files by category">
          ${ICON}<span class="label">Hide files</span><span class="badge">0</span>
        </button>
        <div class="menu" id="gdf-menu" popover="auto" role="dialog" aria-label="Hide files by category">
          <div class="heading">Hide files by category</div>
          <div class="rows"></div>
          <label class="adhoc"><span>Also hide (globs, comma or space separated)</span>
            <input type="text" spellcheck="false" placeholder="*.snap, fixtures/, !keep.md"></label>
          <div class="error adhoc-error" hidden></div>
          <div class="footer"><span class="summary"></span><button class="link edit" type="button">Edit categories</button></div>
        </div>`;

      // popover="auto" provides click-away and Escape dismissal; we only track state and position.
      const popover = root.querySelector('.menu');
      popover.addEventListener('beforetoggle', (e) => {
        open = e.newState === 'open';
        if (open) {
          render();
          position();
          addEventListener('scroll', position, { capture: true, passive: true });
          addEventListener('resize', position, { passive: true });
        } else {
          removeEventListener('scroll', position, { capture: true });
          removeEventListener('resize', position);
        }
      });
      root.querySelector('.edit').addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'gdf:open-options' });
        popover.hidePopover();
      });

      const adhoc = root.querySelector('.adhoc input');
      adhoc.value = state.adhoc;
      let adhocTimer = 0;
      adhoc.addEventListener('input', () => {
        clearTimeout(adhocTimer);
        adhocTimer = setTimeout(() => {
          state.adhoc = adhoc.value;
          compileState();
          apply();
          globalThis.GDFStore.saveAdhoc(state.adhoc);
        }, 200);
      });

      root.querySelector('.rows').addEventListener('change', (e) => {
        const id = e.target?.dataset?.id;
        if (!id) return;
        state.active = { ...state.active, [id]: e.target.checked };
        apply();
        globalThis.GDFStore.saveActive(state.active);
      });
    }

    /** Anchor the popover under the trigger (above it when the trigger floats at the bottom). */
    function position() {
      const menuEl = root.querySelector('.menu');
      const r = root.querySelector('.trigger').getBoundingClientRect();
      const width = menuEl.offsetWidth || 288;
      const left = Math.min(Math.max(8, r.left), innerWidth - width - 8);
      menuEl.style.left = `${left}px`;
      if (host.classList.contains('gdf-floating')) {
        menuEl.style.top = 'auto';
        menuEl.style.bottom = `${innerHeight - r.top + 4}px`;
      } else {
        menuEl.style.bottom = 'auto';
        menuEl.style.top = `${r.bottom + 4}px`;
      }
    }

    /** Put the host next to the file-tree filter if there is one, else float it. */
    function mount() {
      const reactRow = document.getElementById('diff-file-tree-filter');
      const classicSearch = document.getElementById('file-tree-filter-field')?.closest('.subnav-search');
      let mode;
      if (reactRow) {
        if (host.parentElement !== reactRow) reactRow.append(host);
        mode = 'inline';
      } else if (classicSearch) {
        if (host.previousElementSibling !== classicSearch) classicSearch.after(host);
        mode = 'block';
      } else {
        if (host.parentElement !== document.body) document.body.append(host);
        mode = 'floating';
      }
      host.classList.toggle('gdf-inline', mode === 'inline');
      host.classList.toggle('gdf-block', mode === 'block');
      host.classList.toggle('gdf-floating', mode === 'floating');
    }

    function buildRow(cat) {
      const row = document.createElement('label');
      row.className = 'row';
      row.dataset.id = cat.id;
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.dataset.id = cat.id;
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = cat.name;
      const count = document.createElement('span');
      row.append(box, name, count);
      return row;
    }

    function render() {
      if (!root || !lastStats) return;
      const badge = root.querySelector('.badge');
      badge.textContent = String(lastStats.hidden);
      badge.classList.toggle('on', lastStats.hidden > 0);
      root.querySelector('.summary').textContent = `${lastStats.hidden} of ${lastStats.total} hidden`;

      const adhocErr = root.querySelector('.adhoc-error');
      adhocErr.hidden = !adhocError;
      adhocErr.textContent = adhocError ? adhocError.message : '';

      if (!open) return;
      // Update rows in place so toggling a checkbox keeps keyboard focus; rebuild only when
      // the category list itself has changed.
      const rows = root.querySelector('.rows');
      const key = state.categories.map((c) => `${c.id}\u0000${c.name}`).join('\u0001');
      if (rows.dataset.key !== key) {
        rows.replaceChildren(...state.categories.map(buildRow));
        rows.dataset.key = key;
      }
      for (const row of rows.children) {
        const id = row.dataset.id;
        const m = matchers.get(id);
        const n = lastStats.counts[id] ?? 0;
        const [box, , count] = row.children;
        row.classList.toggle('empty', !n);
        box.checked = !!state.active[id];
        count.className = m instanceof Error ? 'error' : 'count';
        count.textContent = m instanceof Error ? 'bad pattern' : String(n);
        count.title = m instanceof Error ? m.message : `${n} file${n === 1 ? '' : 's'} in this diff`;
      }
    }

    return {
      update(hasDiff) {
        if (!hasDiff) {
          if (open) root.querySelector('.menu').hidePopover();
          host?.remove();
          return;
        }
        if (!host) build();
        mount();
        render();
      },
    };
  })();

  // ---------------------------------------------------------------------------
  // Boot: GitHub navigates without full page loads and lazy-loads diffs, so watch the DOM.
  // Mutations inside our shadow root aren't observed, and attribute changes aren't either,
  // so apply() never retriggers itself.

  new MutationObserver((records) => {
    for (const r of records) {
      if (r.addedNodes.length || r.removedNodes.length) {
        if (r.target.id === HOST_ID) continue;
        schedule();
        return;
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });

  globalThis.GDFStore.onChange(reload);
  reload();
})();
