/**
 * Tests that shared includes expand under their imported component name,
 * model placeholders resolve to the page's default model, and nested tabs keep
 * their list indentation.
 *
 * Run with: node tests/test-includes-and-models.js
 */
const assert = require('assert');
const {
  cleanMarkdownForDisplay,
  convertDynamicCodeToMarkdown,
  convertTabsToMarkdown,
  findIncludeComponentNames,
  findModelSelectorDefaults,
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

const installTemplate = [
  "import CodeBlock from '@theme/CodeBlock';",
  "import Link from '@docusaurus/Link';",
  'export default function InstallMAX({ folder = "example-project", extraLibraries = [] }) {',
  "  const extraLibsString = '';",
  '  return (',
  '    <>',
  '      <Tabs groupId="install">',
  '        <TabItem value="pixi" label="pixi">',
  '          <ol>',
  '            <li>',
  '              If you don\'t have it, install <a',
  '                href="https://pixi.sh/latest/"><code>pixi</code></a>:',
  '              <CodeBlock language="sh">',
  '                {`curl -fsSL https://pixi.sh/install.sh | sh`}',
  '              </CodeBlock>',
  '              <p>Then restart your terminal.</p>',
  '            </li>',
  '            <li>',
  '              Create a project:',
  '              <CodeBlock language="sh">',
  '                {`pixi init ${folder}`}',
  '              </CodeBlock>',
  '              <Admonition type="tip">',
  '                <p>',
  "                  <b>Tip:</b>{' '}",
  "                  Skip the <code>-c</code> options if you{' '}",
  '                  <Link to="https://pixi.sh/defaults">',
  '                    add default channels',
  '                  </Link>.',
  '                </p>',
  '              </Admonition>',
  '            </li>',
  '            <ConditionalVersionDocs version="nightly">',
  '              <li>',
  '                Install <code>max</code>{extraLibsDescription}:',
  '                <CodeBlock language="sh">',
  '                  {`pixi add max-all${extraLibsString}`}',
  '                </CodeBlock>',
  '              </li>',
  '            </ConditionalVersionDocs>',
  '          </ol>',
  '        </TabItem>',
  '      </Tabs>',
  '    </>',
  '  );',
  '}',
].join('\n');

console.log('\nincludes:');

test('finds the component names a page imports an include as', () => {
  const names = findIncludeComponentNames(
    "import InstallMAX from '../_includes/install-modular.mdx';\n" +
      'import InstallOpenAI from "./_includes/install-openai.mdx";'
  );
  assert.deepStrictEqual(names['install-modular'], ['InstallModular', 'InstallMAX']);
  assert.deepStrictEqual(names['install-openai'], ['InstallOpenAI']);
});

test('expands an include imported as InstallMAX into a numbered list', () => {
  const page = [
    '---',
    'title: Quickstart',
    '---',
    "import InstallMAX from './_includes/install-modular.mdx';",
    '',
    '## Set up your project',
    '',
    '<InstallMAX folder="quickstart" />',
    '',
    '## Next',
  ].join('\n');
  const out = cleanMarkdownForDisplay(page, 'get-started.mdx', '/', undefined, {
    includeTemplates: { 'install-modular': installTemplate },
    activeVersion: 'nightly',
  });
  const expected = [
    '**pixi:**',
    '',
    "1. If you don't have it, install [`pixi`](https://pixi.sh/latest/):",
    '   ```sh',
    '   curl -fsSL https://pixi.sh/install.sh | sh',
    '   ```',
    '',
    '   Then restart your terminal.',
    '',
    '2. Create a project:',
    '   ```sh',
    '   pixi init quickstart',
    '   ```',
    '   > **tip:** Skip the `-c` options if you [add default channels](https://pixi.sh/defaults).',
    '',
    '3. Install `max`:',
    '   ```sh',
    '   pixi add max-all',
    '   ```',
  ].join('\n');
  assert.ok(out.includes(expected), out);
  assert.ok(!/<InstallMAX|\{extraLibs|\{' '\}|<>/.test(out), out);
});

console.log('\nmodel placeholders:');

const selectorPage = [
  'export const textModelOptions = [',
  '  { label: "a", value: "org/model-a" },',
  '  { label: "b", value: "org/model-b", default: true },',
  '];',
  'export const imageModelOptions = [',
  '  { label: "c", value: "org/model-c" },',
  '];',
  'export const allModelOptions = {',
  '  text: textModelOptions,',
  '  image: imageModelOptions,',
  '};',
  '',
  '<ModelSelector modelOptions={allModelOptions} variableName="text" />',
  '<ModelSelector modelOptions={imageModelOptions} variableName="image" />',
].join('\n');

test('resolves the default option, else the first, through a map export', () => {
  assert.deepStrictEqual(findModelSelectorDefaults(selectorPage), {
    text: 'org/model-b',
    image: 'org/model-c',
  });
});

test('fills DynamicCode placeholders and keeps list indentation', () => {
  const input = [
    '    <DynamicCode language="python" title="gen.py" variableName="text">{',
    '    `client = OpenAI()',
    '    out = client.create(',
    '        model="{text}",',
    '    )`',
    '    }</DynamicCode>',
  ].join('\n');
  assert.strictEqual(
    convertDynamicCodeToMarkdown(input, { text: 'org/model-b' }),
    [
      '    ```python title="gen.py"',
      '    client = OpenAI()',
      '    out = client.create(',
      '        model="org/model-b",',
      '    )',
      '    ```',
    ].join('\n')
  );
});

test('leaves no placeholder in a rendered page', () => {
  const page =
    selectorPage +
    '\n\n<DynamicCode language="sh" variableName="text">{\n`max serve --model {text} \\\\\n  --port 8000`\n}</DynamicCode>\n';
  const out = cleanMarkdownForDisplay(page, 'p.mdx', '/', undefined, {
    includeTemplates: {},
  });
  assert.ok(out.includes('```sh\nmax serve --model org/model-b \\\n  --port 8000\n```'), out);
  assert.ok(!out.includes('{text}'), out);
});

console.log('\nconvertTabsToMarkdown:');

test('keeps nested tabs inside their list item', () => {
  const input = [
    '<Tabs>',
    '<TabItem value="a" label="A">',
    '',
    '1. Activate:',
    '',
    '    <Tabs>',
    '      <TabItem value="pixi" label="pixi">',
    '',
    '        ```bash',
    '        pixi shell',
    '        ```',
    '',
    '      </TabItem>',
    '    </Tabs>',
    '',
    '2. Next step',
    '',
    '</TabItem>',
    '</Tabs>',
  ].join('\n');
  assert.strictEqual(
    convertTabsToMarkdown(input),
    [
      '**A:**',
      '',
      '1. Activate:',
      '',
      '    **pixi:**',
      '',
      '    ```bash',
      '    pixi shell',
      '    ```',
      '',
      '2. Next step',
    ].join('\n')
  );
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
