// Default categories. Edit these on the options page; they're stored in chrome.storage.sync.
// Pattern syntax is documented at the top of glob.js.
(function (root) {
  'use strict';

  const CODE_EXT = '{js,jsx,ts,tsx,mjs,cjs,mts,cts}';

  const DEFAULT_CATEGORIES = [
    {
      id: 'tests',
      name: 'Tests',
      patterns: [
        '# test directories at any depth',
        '**/{test,tests,__tests__,spec,specs}/**',
        `*.{test,tests,spec}.${CODE_EXT}`,
        `{test,tests}.${CODE_EXT}`,
        'test_*.py',
        '*_test.{py,go,rs,exs}',
        '*{Test,Tests,Spec}.{java,kt,swift,cs}',
        '**/__snapshots__/**',
        '*.snap',
        '**/{fixtures,__fixtures__,__mocks__}/**',
      ],
    },
    {
      id: 'docs',
      name: 'Docs & prose',
      patterns: ['*.{md,mdx,markdown,rst,adoc,txt}', '**/{doc,docs}/**', 'LICENSE*', 'CHANGELOG*'],
    },
    {
      id: 'lockfiles',
      name: 'Lockfiles',
      patterns: [
        'package-lock.json',
        'npm-shrinkwrap.json',
        'yarn.lock',
        'pnpm-lock.yaml',
        'bun.lock',
        'bun.lockb',
        'deno.lock',
        'Cargo.lock',
        'poetry.lock',
        'uv.lock',
        'Pipfile.lock',
        'Gemfile.lock',
        'composer.lock',
        'go.sum',
        'flake.lock',
        'mix.lock',
        'Package.resolved',
      ],
    },
    {
      id: 'generated',
      name: 'Generated & vendored',
      patterns: [
        '*.min.{js,css}',
        '*.map',
        '*.{generated,gen}.*',
        '*.pb.go',
        '*_pb2.py',
        '*_pb2.pyi',
        '**/{dist,build,vendor,third_party,node_modules}/**',
      ],
    },
    {
      id: 'config',
      name: 'CI & config',
      patterns: [
        '.github/**',
        '.gitlab-ci.yml',
        '.*rc',
        '.*rc.{js,cjs,mjs,json,yml,yaml}',
        '*.config.{js,cjs,mjs,ts,mts}',
        'tsconfig*.json',
        '.editorconfig',
        '.gitignore',
        '.gitattributes',
        '.pre-commit-config.yaml',
      ],
    },
  ];

  root.GDFDefaults = { DEFAULT_CATEGORIES };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.GDFDefaults;
})(globalThis);
