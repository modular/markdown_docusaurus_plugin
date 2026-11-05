/**
 * Tests that fullyQualifiedLinks rewrites site-root links when docs are served
 * from the site root alongside a blog, keeps blog route bases, and resolves
 * site-root file links within the page's docs version.
 *
 * Run with: node tests/test-root-links.js
 */
const assert = require('assert');
const { convertLinksToAbsoluteUrls } = require('../index')._internals;

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (error) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${error.message}`);
    failed++;
  }
}

const SITE = 'https://docs.example.com';
const BLOG = ['/releases'];

// Docs served from the site root, as on a site with `docsPath: '/'`.
const rootDocs = (md, dir = '/', options = {}) =>
  convertLinksToAbsoluteUrls(md, dir, SITE, '', BLOG, options);

console.log('\nconvertLinksToAbsoluteUrls (docs at site root, with a blog):');

test('rewrites site-root doc links that are outside the blog', () => {
  assert.strictEqual(
    rootDocs('See [requirements](/system-requirements/) and [serve](/cli/serve).'),
    `See [requirements](${SITE}/system-requirements.md) and [serve](${SITE}/cli/serve.md).`
  );
});

test('keeps the blog route base and treats a dotted slug as a page', () => {
  assert.strictEqual(
    rootDocs('[notes](/releases/v26.7) [all](/releases/)'),
    `[notes](${SITE}/releases/v26.7.md) [all](${SITE}/releases.md)`
  );
});

test('keeps fragments', () => {
  assert.strictEqual(
    rootDocs('[gpu](/system-requirements/#gpu-compatibility)'),
    `[gpu](${SITE}/system-requirements.md#gpu-compatibility)`
  );
});

test('leaves links to non-page files without .md', () => {
  assert.strictEqual(rootDocs('[index](/llms.txt)'), `[index](${SITE}/llms.txt)`);
});

test('maps the site root to index.md', () => {
  assert.strictEqual(rootDocs('[home](/)'), `[home](${SITE}/index.md)`);
});

console.log('\nconvertLinksToAbsoluteUrls (versioned docs):');

const stable = { versionPrefix: '/stable' };

test('resolves a site-root .mdx file link within the page version', () => {
  assert.strictEqual(
    rootDocs('[packages](/packages.mdx)', '/stable/', stable),
    `[packages](${SITE}/stable/packages.md)`
  );
});

test('leaves a site-root URL link unversioned, as Docusaurus does', () => {
  assert.strictEqual(
    rootDocs('[nightly](/install/)', '/stable/', stable),
    `[nightly](${SITE}/install.md)`
  );
});

test('maps an index.mdx file link to its directory page', () => {
  assert.strictEqual(
    rootDocs('[develop](/develop/index.mdx)', '/stable/', stable),
    `[develop](${SITE}/stable/develop.md)`
  );
  assert.strictEqual(
    rootDocs('[develop](/develop/index.mdx)', '/stable/', { ...stable, directoryIndex: true }),
    `[develop](${SITE}/stable/develop/index.md)`
  );
});

test('resolves relative file links against the versioned page directory', () => {
  assert.strictEqual(
    rootDocs('[intro](../gpu/intro-tutorial.mdx)', '/stable/develop/', stable),
    `[intro](${SITE}/stable/gpu/intro-tutorial.md)`
  );
});

console.log('\nconvertLinksToAbsoluteUrls (docs under a prefix):');

const prefixed = (md) => convertLinksToAbsoluteUrls(md, '/', SITE, '/docs', BLOG);

test('still strips the docs prefix and skips links outside docs and blog', () => {
  assert.strictEqual(
    prefixed('[a](/docs/install/) [b](/pricing/) [c](/releases/v1)'),
    `[a](${SITE}/install.md) [b](/pricing/) [c](${SITE}/releases/v1.md)`
  );
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
