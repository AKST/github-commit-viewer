const test = require('node:test');
const assert = require('node:assert/strict');
const { compile, splitPatterns } = require('../src/glob.js');
const { DEFAULT_CATEGORIES } = require('../src/defaults.js');

const m = (patterns) => compile(Array.isArray(patterns) ? patterns : [patterns]);

test('basename patterns float to any depth', () => {
  const md = m('*.md');
  assert.ok(md('README.md'));
  assert.ok(md('docs/guide/intro.md'));
  assert.ok(!md('src/md.ts'));
});

test('nested braces', () => {
  const t = m('*.{test,spec}.{js,ts{,x}}');
  for (const p of ['a.test.js', 'x/a.spec.ts', 'x/y/a.test.tsx']) assert.ok(t(p), p);
  for (const p of ['a.test.jsx', 'a.tests.js', 'test.js']) assert.ok(!t(p), p);
});

test('{test,tests}.{js,jsx,ts,tsx} matches files literally named test.* / tests.*', () => {
  const t = m('{test,tests}.{js,jsx,ts,tsx}');
  assert.ok(t('test.ts'));
  assert.ok(t('pkg/tests.jsx'));
  assert.ok(!t('foo.test.ts'));
});

test('**/dir/** floats; dir/** is anchored', () => {
  const floating = m('**/tests/**');
  assert.ok(floating('tests/a.py'));
  assert.ok(floating('pandas/tests/io/test_x.py'));
  assert.ok(!floating('pandas/testsuite/a.py'));
  const anchored = m('tests/**');
  assert.ok(anchored('tests/a.py'));
  assert.ok(!anchored('pkg/tests/a.py'));
});

test('bare name matches a directory anywhere', () => {
  const t = m('__snapshots__');
  assert.ok(t('src/__snapshots__/x.snap'));
  assert.ok(t('__snapshots__'));
});

test('trailing slash is directory-only', () => {
  const t = m('fixtures/');
  assert.ok(t('a/fixtures/x.json'));
  assert.ok(!t('a/fixtures'));
});

test('negation: last match wins', () => {
  const t = m(['*.md', '!README.md']);
  assert.ok(t('docs/a.md'));
  assert.ok(!t('README.md'));
  assert.ok(!t('pkg/README.md'));
});

test('character classes and ?', () => {
  assert.ok(m('file[0-9].txt')('file3.txt'));
  assert.ok(!m('file[!0-9].txt')('file3.txt'));
  assert.ok(m('a?.js')('ab.js'));
  assert.ok(!m('a?.js')('a/.js'));
});

test('comments and blanks ignored; literal dots escaped', () => {
  const t = m(['# comment', '', 'go.sum']);
  assert.ok(t('go.sum'));
  assert.ok(!t('goxsum'));
});

test('unbalanced braces throw', () => {
  assert.throws(() => m('*.{js,ts'));
});

test('splitPatterns keeps commas inside braces', () => {
  assert.deepEqual(splitPatterns('*.snap, *.{js,ts}\nfixtures/  !keep.md'), [
    '*.snap',
    '*.{js,ts}',
    'fixtures/',
    '!keep.md',
  ]);
});

test('default categories compile and classify sensibly', () => {
  const cats = Object.fromEntries(DEFAULT_CATEGORIES.map((c) => [c.id, compile(c.patterns)]));
  const expect = {
    'pandas/tests/io/parser/test_c_parser_only.py': 'tests',
    'src/foo.test.tsx': 'tests',
    'src/test.ts': 'tests',
    'src/__tests__/foo.ts': 'tests',
    'cmd/server/main_test.go': 'tests',
    'README.md': 'docs',
    'doc/source/whatsnew/v3.2.0.rst': 'docs',
    'pnpm-lock.yaml': 'lockfiles',
    'crates/x/Cargo.lock': 'lockfiles',
    'dist/app.min.js': 'generated',
    '.github/workflows/ci.yml': 'config',
    'vite.config.ts': 'config',
  };
  for (const [path, id] of Object.entries(expect)) assert.ok(cats[id](path), `${path} → ${id}`);
  for (const path of ['src/features/same-page-links.tsx', 'pandas/core/frame.py', 'src/testing.ts']) {
    for (const [id, f] of Object.entries(cats)) assert.ok(!f(path), `${path} should not be ${id}`);
  }
});
