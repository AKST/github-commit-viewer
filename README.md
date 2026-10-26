# GitHub Diff Filter

Hide noisy files in GitHub commit, compare and pull-request diffs by **category**. A category is a named
list of glob patterns, so it can mix extension and path rules. The default "Tests" category, for example, is:

```gitignore
**/{test,tests,__tests__,spec,specs}/**
*.{test,tests,spec}.{js,jsx,ts,tsx,mjs,cjs,mts,cts}
{test,tests}.{js,jsx,ts,tsx,mjs,cjs,mts,cts}
test_*.py
*_test.{py,go,rs,exs}
```

An eye icon with a count sits next to the file-tree filter. Its menu has a checkbox per category (with how
many files in the current diff match it), plus a free-text box for one-off patterns such as
`*.snap, fixtures/, !keep.md`. Hidden files disappear from both the diff and the file tree, and directories
whose files are all hidden collapse away.

Defaults: Tests, Docs & prose, Lockfiles, Generated & vendored, CI & config. Edit them on the options page
(toolbar icon, or **Edit categories** in the menu), which also has a box for testing which categories a path
falls into.

## Install

**Chrome / Arc / Edge / Brave:** `chrome://extensions` → enable *Developer mode* → *Load unpacked* → pick
this folder.

**Firefox (121+):** `about:debugging#/runtime/this-firefox` → *Load Temporary Add-on* → pick `manifest.json`.

**Safari:** convert it into an Xcode project, then build and run the app once and enable the extension in
Safari's settings:

```fish
xcrun safari-web-extension-converter . --macos-only --app-name "GitHub Diff Filter"
```

## Pattern syntax

| Pattern | Meaning |
| --- | --- |
| `*` | any characters except `/` |
| `**` | any characters including `/`; `**/` also matches zero directories |
| `?`, `[a-z]`, `[!a-z]` | one character, a class, a negated class |
| `{a,b}` | alternatives, nestable: `*.{test,spec}.{js,ts{,x}}` |
| no `/` in the pattern | matches a file *or directory* name at any depth (`*.md`, `__snapshots__`) |
| `/` in the pattern | anchored at the repo root (`docs/**`); write `**/docs/**` for any depth |
| trailing `/` | directories only (`fixtures/`) |
| `!pattern` | exclude; the last matching line wins |
| `# …` | comment |

These are gitignore semantics, with brace expansion added. Note that `{test,tests}.{js,ts}` matches files
literally *named* `test.js` or `tests.ts`. For `foo.test.ts`, use `*.{test,tests}.{js,ts}`.

## How it works

`src/content.js` handles both diff UIs GitHub currently ships:

- **React view** (commit pages): `h3[id^="heading-"]` headers inside `[aria-labelledby]` file boxes. Paths
  are wrapped in U+200E marks, and file-tree rows use the path as their `id`.
- **Classic view** (PR *Files changed*, compare): `.file[data-tagsearch-path]` inside `copilot-diff-entry`,
  with tree rows at `#file-tree-item-<diff id>`.

Elements are hidden with the `hidden` attribute plus a `data-gdf-hidden` marker. The extension only ever
unhides elements it hid itself, because GitHub's own filters also toggle `hidden`. A `MutationObserver`
reapplies the filters as GitHub lazy-loads diffs or navigates between pages without a reload. The menu lives
in a shadow root and opens as a popover in the top layer, so the sidebar's overflow can't clip it.

Storage: category definitions live in `chrome.storage.sync`. Which categories are on, and the ad-hoc
patterns, live in `chrome.storage.local`. No network access, no analytics; the only permission is `storage`.

If GitHub changes its markup, the adapters `reactFiles()` and `classicFiles()` at the top of
`src/content.js` are the only places that should need updating.

## Tests

```fish
npm test
```

These exercise the glob compiler and the default categories against real-world paths.
