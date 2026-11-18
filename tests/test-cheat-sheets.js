/**
 * Tests that cheat sheet components (<Sheet>, <Panel>, <Intro>, <Yes>, <No>,
 * <Partial>) become Markdown instead of being dropped, and that multi-line
 * named imports are removed.
 *
 * Run with: node tests/test-cheat-sheets.js
 */
const assert = require('assert');
const { convertCheatSheetsToMarkdown, cleanMarkdownForDisplay } =
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

console.log('\nconvertCheatSheetsToMarkdown:');

test('turns a panel into an H3 with its summary and source', () => {
  const input =
    '<Panel title="AnyType" summary="the root; every type conforms" source="traits/anytype.mojo" table="requires">\n\nBody.\n\n</Panel>';
  assert.strictEqual(
    convertCheatSheetsToMarkdown(input).trim(),
    [
      '### AnyType',
      '',
      'the root; every type conforms',
      '',
      'Source: `traits/anytype.mojo`',
      '',
      'Body.',
    ].join('\n')
  );
});

test('allows > inside quoted panel attributes', () => {
  const input = '<Panel title="Returns" summary="def f() -> Int">\n\nBody.\n\n</Panel>';
  const out = convertCheatSheetsToMarkdown(input);
  assert.ok(out.includes('### Returns\n\ndef f() -> Int'));
  assert.ok(!out.includes('<Panel'));
});

test('removes Sheet wrapper tags', () => {
  const input = '<Sheet slug="basics">\n\n<Panel title="A">\n\nx\n\n</Panel>\n\n</Sheet>';
  const out = convertCheatSheetsToMarkdown(input);
  assert.ok(!out.includes('Sheet'));
  assert.ok(out.includes('### A\n\nx'));
});

test('unwraps Intro', () => {
  assert.strictEqual(
    convertCheatSheetsToMarkdown('<Intro>make</Intro>'),
    'make'
  );
});

test('renders Yes, No, and Partial table cells as text', () => {
  const input =
    '| <No /> | <Yes>(own copy)</Yes> | <Partial>yes, unless ^</Partial> | <Partial /> | <Yes /> |';
  assert.strictEqual(
    convertCheatSheetsToMarkdown(input),
    '| no | yes (own copy) | yes, unless ^ | partial | yes |'
  );
});

console.log('\ncleanMarkdownForDisplay with cheat sheets:');

test('keeps panel content and drops multi-line imports', () => {
  const input = [
    '---',
    'title: Mojo basics cheat sheet',
    '---',
    '',
    'import {',
    '  Sheet,',
    '  Panel,',
    "} from '@site/src/components/CheatSheets/sheet';",
    '',
    '<Sheet slug="basics">',
    '',
    '<Panel title="Hello" summary="Basic structure.">',
    '',
    '```mojo',
    'def main():',
    '    print("Hello, Mojo!")',
    '```',
    '',
    '</Panel>',
    '',
    '<Panel title="Comments" summary="How to comment.">',
    '',
    '# not a heading in the panel, a code comment would be in a fence',
    '',
    '</Panel>',
    '',
    '</Sheet>',
  ].join('\n');
  const out = cleanMarkdownForDisplay(input, 'reference/cheat-sheets/basics.mdx');
  assert.ok(!out.includes('import'), 'import statement left behind');
  assert.ok(!out.includes('Sheet'), 'Sheet tag left behind');
  assert.ok(!out.includes('<Panel') && !out.includes('</Panel>'));
  assert.ok(out.startsWith('# Mojo basics cheat sheet\n\n### Hello\n\nBasic structure.'));
  assert.ok(out.includes('print("Hello, Mojo!")'));
  assert.ok(out.includes('### Comments\n\nHow to comment.'));
});

test('leaves cheat sheet components inside a code fence untouched', () => {
  const input = '```mdx\n<Panel title="A">\n\n<Yes />\n\n</Panel>\n```';
  assert.ok(
    cleanMarkdownForDisplay(input, 'page.mdx').includes(
      '<Panel title="A">\n\n<Yes />\n\n</Panel>'
    )
  );
});

test('still removes single-line imports', () => {
  const input =
    "import Tabs from '@theme/Tabs';\nimport { A, B } from './x';\n\nText.";
  assert.strictEqual(cleanMarkdownForDisplay(input, 'page.mdx').trim(), 'Text.');
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
