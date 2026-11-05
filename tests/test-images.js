/**
 * Tests for image conversion and relative image path resolution.
 *
 * Run with: node tests/test-images.js
 */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { convertImagesToMarkdown, resolveImagePaths, cleanMarkdownForDisplay } =
  require('../index')._internals;

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

console.log('\nconvertImagesToMarkdown:');

test('converts a multi-line require() img tag', () => {
  const input = '<img\n  src={require("./images/cookbook.png").default}\n  alt="Cookbook"\n  width="704"\n/>';
  assert.strictEqual(convertImagesToMarkdown(input), '![Cookbook](./images/cookbook.png)');
});

test('keeps the light img and drops the dark one inside a figure', () => {
  const input = [
    '<figure>',
    "  <img src={require('./images/mm.png').default}",
    '       className="light" alt="" />',
    "  <img src={require('./images/mm_dark.png').default}",
    '       className="dark" alt="" />',
    '</figure>',
  ].join('\n');
  assert.strictEqual(convertImagesToMarkdown(input).trim(), '![](./images/mm.png)');
});

test('drops #dark markdown images and strips #light', () => {
  const input = 'a\n![](../images/gpu/sm.png#light)\n![](../images/gpu/sm-dark.png#dark)\nb';
  assert.strictEqual(convertImagesToMarkdown(input), 'a\n![](../images/gpu/sm.png)\nb');
});

test('handles multi-line alt text with brackets in light/dark pairs', () => {
  const alt = 'A ptr points to an OwnedPointer[Int] which\npoints to an Int.';
  const input = `![${alt}](../images/p.png#light)\n![${alt}](../images/p-dark.png#dark)\nafter`;
  assert.strictEqual(convertImagesToMarkdown(input), `![${alt}](../images/p.png)\nafter`);
});

test('converts links in figcaption and drops <cite>', () => {
  const input = '<figcaption>Based on <cite><a\nhref="https://example.com/x">Guide</a></cite></figcaption>';
  assert.strictEqual(convertImagesToMarkdown(input), '*Based on [Guide](https://example.com/x)*');
});

test('maps @site/static/ to the site root', () => {
  assert.strictEqual(
    convertImagesToMarkdown('<img src={require("@site/static/images/x.png").default} alt="X" />'),
    '![X](/images/x.png)'
  );
});

test('converts figcaption to italic text', () => {
  const input = '<figure>\n![](./a.png)\n<figcaption><b>Figure 1.</b> A\nchart.</figcaption>\n</figure>';
  assert.strictEqual(convertImagesToMarkdown(input), '![](./a.png)\n***Figure 1.** A chart.*\n');
});

console.log('\nresolveImagePaths:');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'md-images-'));
fs.mkdirSync(path.join(root, 'gpu'), { recursive: true });
fs.mkdirSync(path.join(root, 'images', 'gpu'), { recursive: true });
fs.writeFileSync(path.join(root, 'images', 'gpu', 'sm.png'), '');
fs.writeFileSync(path.join(root, 'images', 'a b.png'), '');
const ctx = (urlPrefix = '') => ({
  sourceDir: path.join(root, 'gpu'),
  contentRoot: root,
  urlPrefix,
  urlBase: 'https://example.com',
});

test('resolves ../images/ against the source file and lists the copy', () => {
  const { content, files } = resolveImagePaths('![](../images/gpu/sm.png)', ctx());
  assert.strictEqual(content, '![](https://example.com/images/gpu/sm.png)');
  assert.deepStrictEqual(files, [
    { source: path.join(root, 'images', 'gpu', 'sm.png'), destRel: 'images/gpu/sm.png' },
  ]);
});

test('ignores a symlink that points outside the content root', () => {
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'md-outside-'));
  fs.writeFileSync(path.join(outside, 'secret.png'), '');
  fs.symlinkSync(path.join(outside, 'secret.png'), path.join(root, 'images', 'link.png'));
  const input = '![](../images/link.png)';
  const { content, files } = resolveImagePaths(input, ctx());
  assert.strictEqual(content, input);
  assert.deepStrictEqual(files, []);
});

test('adds the version prefix', () => {
  const { content, files } = resolveImagePaths('![](../images/gpu/sm.png)', ctx('nightly'));
  assert.strictEqual(content, '![](https://example.com/nightly/images/gpu/sm.png)');
  assert.strictEqual(files[0].destRel, 'nightly/images/gpu/sm.png');
});

test('resolves an image whose alt text contains brackets', () => {
  const { content } = resolveImagePaths('![List[Int]\nlayout](../images/gpu/sm.png)', ctx());
  assert.strictEqual(content, '![List[Int]\nlayout](https://example.com/images/gpu/sm.png)');
});

test('encodes spaces in file names', () => {
  const { content } = resolveImagePaths('![](../images/a%20b.png)', ctx());
  assert.strictEqual(content, '![](https://example.com/images/a%20b.png)');
});

test('leaves absolute, external, missing, and escaping paths alone', () => {
  const input = [
    '![](/img/x.png)',
    '![](https://cdn.example.com/x.png)',
    '![](../images/missing.png)',
    '![](../../outside.png)',
  ].join('\n');
  const { content, files } = resolveImagePaths(input, ctx());
  assert.strictEqual(content, input);
  assert.strictEqual(files.length, 0);
});

test('leaves image syntax inside code alone', () => {
  const input = '```md\n![](../images/gpu/sm.png)\n```';
  assert.strictEqual(resolveImagePaths(input, ctx()).content, input);
});

test('end to end: light/dark pair becomes one resolvable image', () => {
  const md = cleanMarkdownForDisplay(
    '---\ntitle: T\n---\n\n![](../images/gpu/sm.png#light)\n![](../images/gpu/sm-dark.png#dark)\n',
    'gpu/intro.mdx',
    '/'
  );
  const { content } = resolveImagePaths(md, ctx());
  assert(content.includes('![](https://example.com/images/gpu/sm.png)'), content);
  assert(!content.includes('dark'), content);
});

fs.rmSync(root, { recursive: true, force: true });

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
