/**
 * Tests the `markdown_source` front matter override, which replaces a page's
 * cleaned markdown with a file from the site directory.
 *
 * Run with: node tests/test-markdown-source.js
 */
const assert = require('assert');
const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const {
  parseFrontmatterString,
  resolveMarkdownSource,
  writeProcessedMarkdownToBuild,
} = require('../index')._internals;

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (error) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${error.message}`);
    failed++;
  }
}

const SITE = 'https://docs.example.com';

async function main() {
  console.log('\nparseFrontmatterString:');

  await test('reads quoted and unquoted values', () => {
    assert.strictEqual(
      parseFrontmatterString('---\ntitle: X\nmarkdown_source: /a/b.md\n---\nbody', 'markdown_source'),
      '/a/b.md'
    );
    assert.strictEqual(
      parseFrontmatterString('---\nmarkdown_source: "/a/b.md"\n---\n', 'markdown_source'),
      '/a/b.md'
    );
  });

  await test('returns undefined without the key or front matter', () => {
    assert.strictEqual(parseFrontmatterString('---\ntitle: X\n---\n', 'markdown_source'), undefined);
    assert.strictEqual(parseFrontmatterString('# No front matter', 'markdown_source'), undefined);
  });

  await test('does not read the next line for an empty value', () => {
    assert.strictEqual(parseFrontmatterString('---\nslug:\ntitle: X\n---\n', 'slug'), undefined);
  });

  console.log('\nresolveMarkdownSource:');

  await test('returns null when unset', () => {
    assert.strictEqual(resolveMarkdownSource(undefined, '/site'), null);
  });

  await test('resolves a path relative to the site directory', () => {
    assert.strictEqual(
      resolveMarkdownSource('generated/v1/x.md', '/site'),
      path.join('/site', 'generated/v1/x.md')
    );
  });

  await test('rejects absolute paths and paths that leave the site directory', () => {
    assert.throws(() => resolveMarkdownSource('/generated/x.md', '/site'), /Unsafe relative path/);
    assert.throws(() => resolveMarkdownSource('../secret.md', '/site'), /Unsafe relative path/);
    assert.throws(() => resolveMarkdownSource(42, '/site'), /path string/);
  });

  await test('rejects a symlink that resolves outside the site directory', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'md-source-link-'));
    try {
      const siteDir = path.join(root, 'site');
      const outside = path.join(root, 'secret.md');
      await fs.outputFile(outside, 'secret');
      await fs.outputFile(path.join(siteDir, 'generated', 'inside.md'), '# Inside');
      await fs.ensureSymlink(outside, path.join(siteDir, 'generated', 'file-link.md'));
      await fs.ensureSymlink(root, path.join(siteDir, 'dir-link'));
      await fs.ensureSymlink(
        path.join(siteDir, 'generated', 'inside.md'),
        path.join(siteDir, 'generated', 'internal-link.md')
      );

      assert.throws(
        () => resolveMarkdownSource('generated/file-link.md', siteDir),
        /outside the site directory/
      );
      assert.throws(
        () => resolveMarkdownSource('dir-link/secret.md', siteDir),
        /outside the site directory/
      );
      // A link that stays inside the site is fine.
      assert.strictEqual(
        resolveMarkdownSource('generated/internal-link.md', siteDir),
        path.join(siteDir, 'generated', 'internal-link.md')
      );
    } finally {
      await fs.remove(root);
    }
  });

  console.log('\nwriteProcessedMarkdownToBuild with markdownSource:');

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'md-source-'));
  try {
    const override = path.join(tmpDir, 'generated', 'create.md');
    await fs.outputFile(
      override,
      [
        '# Create thing',
        '',
        'See the [guide](/guides/thing/).',
        '',
        '````yaml',
        'description: See [guide](/guides/thing/) <Component />',
        '````',
        '',
      ].join('\n')
    );
    const source = path.join(tmpDir, 'src', 'create.mdx');
    await fs.outputFile(source, '---\ntitle: Ignored\n---\n\n<Scalar url="x" />\n');
    const destPath = path.join(tmpDir, 'rest-api', 'create.md');

    await writeProcessedMarkdownToBuild({
      sourcePath: source,
      mdFileRelativeForCleaning: 'rest-api/create.mdx',
      destPath,
      pageUrlDir: '/rest-api/',
      docsPath: '/',
      directive: '> Index: /llms.txt',
      fullyQualifiedLinks: true,
      siteUrl: SITE,
      docsPrefix: '',
      linkOptions: {},
      markdownSource: override,
    });
    const output = await fs.readFile(destPath, 'utf8');

    await test('emits the override instead of the page source', () => {
      assert.ok(output.includes('# Create thing'), output);
      assert.ok(!output.includes('Ignored'), output);
    });

    await test('prepends the directive', () => {
      assert.ok(output.startsWith('> Index: /llms.txt\n\n# Create thing'), output);
    });

    await test('qualifies links outside code but leaves fenced code untouched', () => {
      assert.ok(output.includes(`[guide](${SITE}/guides/thing.md)`), output);
      assert.ok(
        output.includes('description: See [guide](/guides/thing/) <Component />'),
        output
      );
    });

    await test('fails when the override file is missing', async () => {
      await assert.rejects(
        writeProcessedMarkdownToBuild({
          sourcePath: source,
          destPath,
          pageUrlDir: '/',
          docsPath: '/',
          markdownSource: path.join(tmpDir, 'missing.md'),
        }),
        /not found/
      );
    });
  } finally {
    await fs.remove(tmpDir);
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

main();
