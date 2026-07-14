/**
 * Tests for fenced code block protection, MDX component converters,
 * and the JSX stripper regression that motivated the protect/restore mechanism.
 *
 * Run with: node tests/test-code-fence-protection.js
 */
const assert = require('assert');
const {
  cleanMarkdownForDisplay,
  protectFencedCodeBlocks,
  restoreFencedCodeBlocks,
  convertCodeBlockToMarkdown,
  convertConditionalVersionDocsToMarkdown,
  convertAdmonitionToMarkdown,
  convertFigureToMarkdown,
  convertInstallModularToMarkdown,
  convertInstallOpenAIToMarkdown,
  unwrapMdxComponents,
} = require('../index')._internals;

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
  }
}

// ---------------------------------------------------------------------------
// protectFencedCodeBlocks / restoreFencedCodeBlocks
// ---------------------------------------------------------------------------
console.log('\nprotectFencedCodeBlocks / restoreFencedCodeBlocks:');

test('round-trips a simple fenced block', () => {
  const input = 'before\n```python\nprint("hi")\n```\nafter';
  const { content, blocks } = protectFencedCodeBlocks(input);
  assert(!content.includes('```python'), 'fence should be replaced by token');
  assert(content.includes('__FENCE_0__'), 'token should be present');
  const restored = restoreFencedCodeBlocks(content, blocks);
  assert(restored.includes('```python\nprint("hi")\n```'), 'fence should be restored');
  assert(restored.includes('before'), 'surrounding text preserved');
  assert(restored.includes('after'), 'surrounding text preserved');
});

test('round-trips multiple fenced blocks', () => {
  const input = '```js\na()\n```\ntext\n```bash\nb()\n```';
  const { content, blocks } = protectFencedCodeBlocks(input);
  assert.strictEqual(blocks.length, 2);
  assert(content.includes('__FENCE_0__'));
  assert(content.includes('__FENCE_1__'));
  const restored = restoreFencedCodeBlocks(content, blocks);
  assert(restored.includes('```js\na()\n```'));
  assert(restored.includes('```bash\nb()\n```'));
});

test('preserves heredoc syntax inside fenced blocks', () => {
  const input = '```bash\ncat <<EOF > config.yaml\nkey: value\nEOF\n```';
  const { content, blocks } = protectFencedCodeBlocks(input);
  assert(!content.includes('<<EOF'), 'heredoc should be hidden');
  const restored = restoreFencedCodeBlocks(content, blocks);
  assert(restored.includes('<<EOF'), 'heredoc should be restored');
});

test('protect/restore round-trip is lossless (no extra blank lines)', () => {
  const input = 'before\n```python\nprint("hi")\n```\nafter';
  const { content, blocks } = protectFencedCodeBlocks(input);
  const restored = restoreFencedCodeBlocks(content, blocks);
  assert.strictEqual(restored, input);
});

// ---------------------------------------------------------------------------
// End-to-end: JSX stripper must not corrupt heredoc inside fenced blocks
// ---------------------------------------------------------------------------
console.log('\nJSX stripper regression (heredoc + self-closing component):');

test('heredoc <<EOF inside code fence is not eaten by JSX stripper', () => {
  const input = [
    '---',
    'title: Test',
    '---',
    '',
    'Some text',
    '',
    '```bash',
    'cat <<EOF > config.yaml',
    'key: value',
    'EOF',
    '```',
    '',
    '<InstallOpenAI />',
    '',
    'More text',
  ].join('\n');

  const result = cleanMarkdownForDisplay(input, 'test.md');
  assert(result.includes('```bash'), 'bash fence opener should survive');
  assert(result.includes('<<EOF'), 'heredoc marker should survive');
  assert(result.includes('key: value'), 'heredoc body should survive');
  assert(result.includes('More text'), 'text after component should survive');
});

test('multiple code fences with uppercase content survive JSX stripping', () => {
  const input = [
    '---',
    'title: Test',
    '---',
    '',
    '```python',
    'X = SomeClass()',
    '```',
    '',
    '<CustomComponent />',
    '',
    '```bash',
    'export MY_VAR="hello"',
    '```',
  ].join('\n');

  const result = cleanMarkdownForDisplay(input, 'test.md');
  assert(result.includes('X = SomeClass()'), 'python code preserved');
  assert(result.includes('export MY_VAR="hello"'), 'bash code preserved');
  assert(!result.includes('<CustomComponent'), 'JSX component removed');
});

// ---------------------------------------------------------------------------
// convertCodeBlockToMarkdown
// ---------------------------------------------------------------------------
console.log('\nconvertCodeBlockToMarkdown:');

test('converts CodeBlock with template literal to fenced block', () => {
  const input = '<CodeBlock language="python">{`print("hello")`}</CodeBlock>';
  const result = convertCodeBlockToMarkdown(input);
  assert.strictEqual(result, '```python\nprint("hello")\n```');
});

test('converts CodeBlock with title attribute', () => {
  const input = '<CodeBlock language="js" title="example.js">{`const x = 1;`}</CodeBlock>';
  const result = convertCodeBlockToMarkdown(input);
  assert(result.includes('```js title="example.js"'));
  assert(result.includes('const x = 1;'));
});

test('applies substitutions to CodeBlock content', () => {
  const input = '<CodeBlock language="bash">{`cd ${folder}`}</CodeBlock>';
  const result = convertCodeBlockToMarkdown(input, { folder: 'my-project' });
  assert(result.includes('cd my-project'));
});

test('converts CodeBlock with plain text content', () => {
  const input = '<CodeBlock language="text">\nHello world\n</CodeBlock>';
  const result = convertCodeBlockToMarkdown(input);
  assert(result.includes('```text'));
  assert(result.includes('Hello world'));
});

test('leaves non-matching content unchanged', () => {
  const input = 'regular markdown text\n\n```python\ncode\n```';
  const result = convertCodeBlockToMarkdown(input);
  assert.strictEqual(result, input);
});

// ---------------------------------------------------------------------------
// convertConditionalVersionDocsToMarkdown
// ---------------------------------------------------------------------------
console.log('\nconvertConditionalVersionDocsToMarkdown:');

test('converts nightly version docs', () => {
  const input = '<ConditionalVersionDocs version="nightly">\nInstall nightly build\n</ConditionalVersionDocs>';
  const result = convertConditionalVersionDocsToMarkdown(input);
  assert(result.includes('**Nightly:**'));
  assert(result.includes('Install nightly build'));
});

test('converts stable version docs', () => {
  const input = '<ConditionalVersionDocs version="stable">\nInstall stable build\n</ConditionalVersionDocs>';
  const result = convertConditionalVersionDocsToMarkdown(input);
  assert(result.includes('**Stable:**'));
  assert(result.includes('Install stable build'));
});

test('converts both nightly and stable in same content', () => {
  const input = [
    '<ConditionalVersionDocs version="nightly">nightly content</ConditionalVersionDocs>',
    '<ConditionalVersionDocs version="stable">stable content</ConditionalVersionDocs>',
  ].join('\n');
  const result = convertConditionalVersionDocsToMarkdown(input);
  assert(result.includes('**Nightly:**'));
  assert(result.includes('nightly content'));
  assert(result.includes('**Stable:**'));
  assert(result.includes('stable content'));
});

test('leaves unrecognized content unchanged', () => {
  const input = 'just some text';
  assert.strictEqual(convertConditionalVersionDocsToMarkdown(input), input);
});

// ---------------------------------------------------------------------------
// convertAdmonitionToMarkdown
// ---------------------------------------------------------------------------
console.log('\nconvertAdmonitionToMarkdown:');

test('converts Admonition with type to blockquote', () => {
  const input = '<Admonition type="note">\nRemember this.\n</Admonition>';
  const result = convertAdmonitionToMarkdown(input);
  assert(result.includes('> **note:**'));
  assert(result.includes('Remember this.'));
});

test('converts HTML within Admonition content', () => {
  const input = '<Admonition type="warning"><p>Use <b>caution</b> with <code>rm</code></p></Admonition>';
  const result = convertAdmonitionToMarkdown(input);
  assert(result.includes('**caution**'));
  assert(result.includes('`rm`'));
  assert(!result.includes('<p>'));
  assert(!result.includes('<b>'));
});

test('blockquotes every line of multi-line Admonition content', () => {
  const input = '<Admonition type="tip">\nLine one\nLine two\n</Admonition>';
  const result = convertAdmonitionToMarkdown(input);
  assert.strictEqual(
    result,
    '> **tip:** Line one\n> Line two\n'
  );
});

test('leaves non-Admonition content unchanged', () => {
  const input = 'plain text';
  assert.strictEqual(convertAdmonitionToMarkdown(input), input);
});

// ---------------------------------------------------------------------------
// convertFigureToMarkdown
// ---------------------------------------------------------------------------
console.log('\nconvertFigureToMarkdown:');

test('converts figure with require() image to markdown', () => {
  const input = '<figure>\n<img src={require(\'./img/diagram.png\').default} alt="Architecture" />\n<figcaption>System overview</figcaption>\n</figure>';
  const result = convertFigureToMarkdown(input, 'getting-started/', '/docs/');
  assert(result.includes('![Architecture]'));
  assert(result.includes('/docs/getting-started/img/diagram.png'));
  assert(result.includes('*System overview*'));
});

test('converts bold in figcaption to markdown bold', () => {
  const input = '<figure>\n<img src={require("./chart.png").default} alt="Chart" />\n<figcaption><b>Figure 1:</b> Results</figcaption>\n</figure>';
  const result = convertFigureToMarkdown(input, '', '/docs/');
  assert(result.includes('**Figure 1:**'));
});

test('leaves non-matching figure HTML unchanged', () => {
  const input = '<figure><img src="/static/img.png" alt="test" /></figure>';
  const result = convertFigureToMarkdown(input, '', '/docs/');
  assert.strictEqual(result, input);
});

// ---------------------------------------------------------------------------
// convertInstallModularToMarkdown
// ---------------------------------------------------------------------------
console.log('\nconvertInstallModularToMarkdown:');

test('returns content unchanged when pluginContext is undefined', () => {
  const input = '<InstallModular folder="test" />';
  assert.strictEqual(convertInstallModularToMarkdown(input, undefined), input);
});

test('returns content unchanged when template is not cached', () => {
  const input = '<InstallModular folder="test" />';
  const ctx = { includeTemplates: {} };
  assert.strictEqual(convertInstallModularToMarkdown(input, ctx), input);
});

test('expands self-closing InstallModular when template is available', () => {
  const template = [
    'import Something from "somewhere";',
    '',
    'export default function Install({ folder }) {',
    '  return (',
    '    <div>',
    '    Install into ${folder}',
    '    </div>',
    '  );',
    '}',
  ].join('\n');
  const ctx = { includeTemplates: { 'install-modular': template } };
  const input = 'Before\n<InstallModular folder="my-project" />\nAfter';
  const result = convertInstallModularToMarkdown(input, ctx);
  assert(!result.includes('<InstallModular'), 'tag should be replaced');
  assert(result.includes('my-project'), 'folder substitution should apply');
  assert(result.includes('Before'));
  assert(result.includes('After'));
});

// ---------------------------------------------------------------------------
// convertInstallOpenAIToMarkdown
// ---------------------------------------------------------------------------
console.log('\nconvertInstallOpenAIToMarkdown:');

test('returns content unchanged when pluginContext is undefined', () => {
  const input = '<InstallOpenAI />';
  assert.strictEqual(convertInstallOpenAIToMarkdown(input, undefined), input);
});

test('returns content unchanged when template is not cached', () => {
  const input = '<InstallOpenAI />';
  const ctx = { includeTemplates: {} };
  assert.strictEqual(convertInstallOpenAIToMarkdown(input, ctx), input);
});

// ---------------------------------------------------------------------------
// unwrapMdxComponents — InstallModular fallback for non-self-closing usage
// ---------------------------------------------------------------------------
console.log('\nunwrapMdxComponents (InstallModular fallback):');

test('unwraps non-self-closing InstallModular preserving children', () => {
  const input = '<InstallModular folder="test">Some child content</InstallModular>';
  const result = unwrapMdxComponents(input);
  assert(!result.includes('<InstallModular'), 'opening tag removed');
  assert(!result.includes('</InstallModular'), 'closing tag removed');
  assert(result.includes('Some child content'), 'children preserved');
});

test('unwraps self-closing InstallModular (tag stripped by unwrap)', () => {
  const input = 'Before <InstallModular folder="test" /> After';
  const result = unwrapMdxComponents(input);
  assert(!result.includes('<InstallModular'), 'self-closing tag removed');
  assert(result.includes('Before'), 'surrounding text preserved');
  assert(result.includes('After'), 'surrounding text preserved');
});

// ---------------------------------------------------------------------------
// cleanMarkdownForDisplay — compatibility with sites lacking pluginContext
// ---------------------------------------------------------------------------
console.log('\ncleanMarkdownForDisplay (compatibility):');

test('works without pluginContext (no 5th argument)', () => {
  const input = '---\ntitle: Test\n---\n\nHello world\n\n<SomeComponent />';
  const result = cleanMarkdownForDisplay(input, 'test.md', '/docs/');
  assert(result.includes('# Test'));
  assert(result.includes('Hello world'));
  assert(!result.includes('<SomeComponent'));
});

test('strips InstallModular via unwrap when pluginContext has no template', () => {
  const input = '---\ntitle: Test\n---\n\n<InstallModular folder="test" />\n\nMore text';
  const result = cleanMarkdownForDisplay(input, 'test.md', '/docs/', undefined, undefined);
  assert(!result.includes('<InstallModular'), 'tag should be removed');
  assert(result.includes('More text'), 'surrounding content preserved');
});

test('strips InstallOpenAI via JSX stripper when pluginContext is missing', () => {
  const input = '---\ntitle: Test\n---\n\n<InstallOpenAI />\n\nMore text';
  const result = cleanMarkdownForDisplay(input, 'test.md', '/docs/');
  assert(!result.includes('<InstallOpenAI'), 'tag should be removed');
  assert(result.includes('More text'), 'surrounding content preserved');
});

test('converts CodeBlock globally even without pluginContext', () => {
  const input = '---\ntitle: Test\n---\n\n<CodeBlock language="python">{`x = 1`}</CodeBlock>';
  const result = cleanMarkdownForDisplay(input, 'test.md');
  assert(result.includes('```python'));
  assert(result.includes('x = 1'));
});

test('converts Admonition globally even without pluginContext', () => {
  const input = '---\ntitle: Test\n---\n\n<Admonition type="tip">\nA tip.\n</Admonition>';
  const result = cleanMarkdownForDisplay(input, 'test.md');
  assert(result.includes('> **tip:**'));
  assert(result.includes('A tip.'));
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
