/**
 * Tests getMarkdownUrl, which maps a page path to its raw .md URL.
 *
 * Run with: node tests/test-markdown-path.js
 */
const test = require('node:test');
const assert = require('node:assert');
const { getMarkdownUrl } = require('../lib/markdown-path');

test('appends .md to a path without a trailing slash', () => {
  assert.strictEqual(getMarkdownUrl('/docs/manual/basics'), '/docs/manual/basics.md');
});

test('strips a trailing slash by default', () => {
  assert.strictEqual(getMarkdownUrl('/docs/manual/'), '/docs/manual.md');
});

test('maps the site root to /index.md', () => {
  assert.strictEqual(getMarkdownUrl('/'), '/index.md');
});

test('maps a trailing slash to intro.md with supportDirectoryIndex', () => {
  assert.strictEqual(
    getMarkdownUrl('/docs/manual/', { supportDirectoryIndex: true }),
    '/docs/manual/intro.md'
  );
});

test('supportDirectoryIndex does not affect paths without a trailing slash', () => {
  assert.strictEqual(
    getMarkdownUrl('/docs/manual/basics', { supportDirectoryIndex: true }),
    '/docs/manual/basics.md'
  );
});
