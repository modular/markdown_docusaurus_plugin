/**
 * Tests for <details> conversion.
 *
 * Run with: node tests/test-details.js
 */
const assert = require('assert');
const { convertDetailsToMarkdown, cleanMarkdownForDisplay } =
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

console.log('\nconvertDetailsToMarkdown:');

const code = [
  '```mojo',
  'struct Grid[rows: Int]:',
  '    var cells: List[Int]',
  '',
  '    fn __init__(out self):',
  '        self.cells = List[Int]()',
  '```',
].join('\n');

test('keeps code indentation and blank lines', () => {
  const input = `<details>\n  <summary>View the complete grid.mojo</summary>\n\n${code}\n\n</details>`;
  assert.strictEqual(
    convertDetailsToMarkdown(input),
    `### View the complete grid.mojo\n\n${code}`
  );
});

test('removes indentation shared by every line', () => {
  const indented = code.split('\n').map((l) => (l ? `  ${l}` : l)).join('\n');
  const input = `<details>\n<summary>Code</summary>\n\n  Some text.\n\n${indented}\n</details>`;
  assert.strictEqual(
    convertDetailsToMarkdown(input),
    `### Code\n\nSome text.\n\n${code}`
  );
});

test('supports a <strong> summary', () => {
  const input = '<details>\n<summary><strong>Title</strong></summary>\n\nBody\n</details>';
  assert.strictEqual(convertDetailsToMarkdown(input), '### Title\n\nBody');
});

test('end to end: details code survives cleanMarkdownForDisplay', () => {
  const input = `---\ntitle: T\n---\n\n<details>\n  <summary>Full code</summary>\n\n${code}\n\n</details>\n`;
  const out = cleanMarkdownForDisplay(input, 'manual/get-started.mdx', '/docs/');
  assert(out.includes(code), out);
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
