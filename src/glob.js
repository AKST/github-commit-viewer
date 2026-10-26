// Glob → RegExp compiler with gitignore-like matching semantics.
//
//   *        any run of characters except "/"
//   **       any run of characters including "/"; "**/" also matches zero dirs
//   ?        one character except "/"
//   [abc]    character class ([!abc] negates)
//   {a,b}    alternation, may nest: *.{test,spec}.{js,ts{,x}}
//   \x       literal x
//
// Line semantics (as in .gitignore):
//   - no "/" in the pattern      → matches a file or directory name at any depth
//   - "/" anywhere but the end   → anchored to the repo root (use **/ to float it)
//   - trailing "/"               → directories only (matches every file inside)
//   - leading "!"                → negates; within a list, the last matching line wins
//   - blank lines and "#" lines  → ignored
(function (root) {
  'use strict';

  const escapeChar = (c) => (/[.+^$()|\\\/\]\[{}*?]/.test(c) ? '\\' + c : c);

  function globToSource(glob) {
    let re = '';
    let depth = 0;
    let i = 0;
    while (i < glob.length) {
      const c = glob[i];
      if (c === '*') {
        if (glob[i + 1] === '*') {
          const atSegmentStart = i === 0 || '/{,'.includes(glob[i - 1]);
          const j = i + 2;
          if (atSegmentStart && glob[j] === '/') {
            re += '(?:.*/)?';
            i = j + 1;
          } else {
            re += '.*';
            i = j;
          }
          continue;
        }
        re += '[^/]*';
        i += 1;
        continue;
      }
      if (c === '?') {
        re += '[^/]';
        i += 1;
        continue;
      }
      if (c === '[') {
        const end = glob.indexOf(']', i + 2);
        if (end !== -1) {
          let cls = glob.slice(i + 1, end).replace(/\\/g, '\\\\');
          if (cls[0] === '!') cls = '^' + cls.slice(1);
          re += '[' + cls + ']';
          i = end + 1;
          continue;
        }
        re += '\\[';
        i += 1;
        continue;
      }
      if (c === '{') {
        depth += 1;
        re += '(?:';
        i += 1;
        continue;
      }
      if (c === '}' && depth > 0) {
        depth -= 1;
        re += ')';
        i += 1;
        continue;
      }
      if (c === ',' && depth > 0) {
        re += '|';
        i += 1;
        continue;
      }
      if (c === '\\' && i + 1 < glob.length) {
        re += escapeChar(glob[i + 1]);
        i += 2;
        continue;
      }
      re += escapeChar(c);
      i += 1;
    }
    if (depth !== 0) throw new SyntaxError(`Unbalanced "{" in ${glob}`);
    return re;
  }

  function compileLine(line) {
    let p = line.trim();
    if (!p || p.startsWith('#')) return null;
    let negate = false;
    if (p.startsWith('!')) {
      negate = true;
      p = p.slice(1);
    } else if (p.startsWith('\\!') || p.startsWith('\\#')) {
      p = p.slice(1);
    }
    const dirOnly = p.endsWith('/');
    if (dirOnly) p = p.replace(/\/+$/, '');
    const anchored = p.includes('/');
    p = p.replace(/^\/+/, '');
    if (!p) return null;

    const src = globToSource(p);
    const head = anchored ? '^' : '(?:^|/)';
    const tail = dirOnly ? '/' : '(?:/|$)';
    return { negate, re: new RegExp(head + src + tail), source: line.trim() };
  }

  /** Compile pattern lines into a predicate: path → boolean. Throws on bad syntax. */
  function compile(lines) {
    const rules = [];
    for (const line of lines) {
      const rule = compileLine(line);
      if (rule) rules.push(rule);
    }
    const matcher = (path) => {
      const p = String(path).replace(/^\/+/, '');
      let hit = false;
      for (const r of rules) if (r.re.test(p)) hit = !r.negate;
      return hit;
    };
    matcher.rules = rules;
    return matcher;
  }

  /** Split free text (newlines, commas outside braces, or whitespace) into pattern lines. */
  function splitPatterns(text) {
    const out = [];
    let cur = '';
    let depth = 0;
    for (const c of String(text)) {
      if (c === '{') depth += 1;
      if (c === '}') depth = Math.max(0, depth - 1);
      if (depth === 0 && (c === ',' || /\s/.test(c))) {
        if (cur) out.push(cur);
        cur = '';
      } else {
        cur += c;
      }
    }
    if (cur) out.push(cur);
    return out;
  }

  const api = { compile, compileLine, globToSource, splitPatterns };
  root.GDFGlob = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
