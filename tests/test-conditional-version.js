/**
 * Tests that ConditionalVersionDocs emits the branch for the page's docs
 * version, and that CodeBlock and Link components convert cleanly.
 *
 * Run with: node tests/test-conditional-version.js
 */
const assert = require('assert');
const {
  cleanMarkdownForDisplay,
  convertConditionalVersionDocsToMarkdown,
  convertCodeBlockToMarkdown,
  convertLinkComponentsToMarkdown,
  convertInstallModularToMarkdown,
} = require('../index')._internals;

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

const installStep = [
  '3. Install `max-all`:',
  '',
  '   <ConditionalVersionDocs version="nightly">',
  '   <CodeBlock language="sh">',
  '   {`pixi add max-all`}',
  '   </CodeBlock>',
  '   </ConditionalVersionDocs>',
  '   <ConditionalVersionDocs version="stable">',
  '   <CodeBlock language="sh">',
  '   {`pixi add "max-all==26.7"`}',
  '   </CodeBlock>',
  '   </ConditionalVersionDocs>',
  '',
  '4. Start the virtual environment:',
].join('\n');

const render = (input, activeVersion) =>
  cleanMarkdownForDisplay(input, 'install.mdx', '/', undefined, {
    includeTemplates: {},
    activeVersion,
  });

console.log('\nconvertConditionalVersionDocsToMarkdown:');

test('emits only the nightly branch for the nightly version', () => {
  const out = render(installStep, 'nightly');
  assert.ok(out.includes('   ```sh\n   pixi add max-all\n   ```'), out);
  assert.ok(!out.includes('26.7'), out);
  assert.ok(!out.includes('ConditionalVersionDocs'), out);
});

test('emits only the stable branch for the stable version', () => {
  const out = render(installStep, 'stable');
  assert.ok(out.includes('   pixi add "max-all==26.7"'), out);
  assert.ok(!out.includes('pixi add max-all\n'), out);
});

test('labels both branches when the version is unknown', () => {
  const out = convertConditionalVersionDocsToMarkdown(
    '<ConditionalVersionDocs version="nightly">\nA\n</ConditionalVersionDocs>\n' +
      '<ConditionalVersionDocs version="stable">\nB\n</ConditionalVersionDocs>\n'
  );
  assert.strictEqual(out, '**Nightly:**\n\nA\n\n**Stable:**\n\nB\n\n');
});

test('keeps block content such as tabs and fences inside a branch', () => {
  const input = [
    '<ConditionalVersionDocs version="stable">',
    '',
    '```sh',
    'uv pip install mojo',
    '```',
    '',
    '</ConditionalVersionDocs>',
  ].join('\n');
  assert.strictEqual(
    convertConditionalVersionDocsToMarkdown(input, 'stable'),
    '\n```sh\nuv pip install mojo\n```'
  );
  assert.strictEqual(convertConditionalVersionDocsToMarkdown(input, 'nightly'), '');
});

console.log('\nconvertCodeBlockToMarkdown:');

test('keeps the indentation of a CodeBlock inside a list item', () => {
  const input = '   <CodeBlock language="sh">\n   {`uv venv`}\n   </CodeBlock>';
  assert.strictEqual(convertCodeBlockToMarkdown(input), '   ```sh\n   uv venv\n   ```');
});

test('unescapes template literal backslashes in continuation lines', () => {
  const input = [
    '<CodeBlock language="sh">',
    '{`uv add "max[all]" \\\\',
    '  --prerelease allow`}',
    '</CodeBlock>',
  ].join('\n');
  assert.strictEqual(
    convertCodeBlockToMarkdown(input),
    '```sh\nuv add "max[all]" \\\n  --prerelease allow\n```'
  );
});

test('strips the list container indent from continuation lines', () => {
  const input = [
    '    <CodeBlock language="python">',
    '    {`client = OpenAI()',
    '    if ok:',
    '        print(client)`}',
    '    </CodeBlock>',
  ].join('\n');
  assert.strictEqual(
    convertCodeBlockToMarkdown(input),
    '    ```python\n    client = OpenAI()\n    if ok:\n        print(client)\n    ```'
  );
});

console.log('\nconvertLinkComponentsToMarkdown:');

test('converts multi-line Link href and to forms', () => {
  assert.strictEqual(
    convertLinkComponentsToMarkdown(
      'For stable, <Link href="/stable/install/">switch to the\nstable docs</Link>.'
    ),
    'For stable, [switch to the stable docs](/stable/install/).'
  );
  assert.strictEqual(
    convertLinkComponentsToMarkdown('<Link to="/x/">X</Link>'),
    '[X](/x/)'
  );
});

console.log('\ninclude templates:');

test('expands an include with the active version branch only', () => {
  const template = [
    "import ConditionalVersionDocs from '@site/src/components/ConditionalVersionDocs'",
    'export default function InstallMAX({ folder = "example-project" }) {',
    '  return (',
    '    <>',
    '      <ConditionalVersionDocs version="nightly">',
    '        <CodeBlock language="sh">',
    '          {`pixi add max-all`}',
    '        </CodeBlock>',
    '      </ConditionalVersionDocs>',
    '      <ConditionalVersionDocs version="stable">',
    '        <CodeBlock language="sh">',
    '          {`pixi add "max-all==26.7"`}',
    '        </CodeBlock>',
    '      </ConditionalVersionDocs>',
    '    </>',
    '  );',
    '}',
  ].join('\n');
  const out = convertInstallModularToMarkdown('<InstallModular folder="q" />', {
    includeTemplates: { 'install-modular': template },
    activeVersion: 'stable',
  });
  assert.ok(out.includes('pixi add "max-all==26.7"'), out);
  assert.ok(!out.includes('pixi add max-all\n'), out);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
