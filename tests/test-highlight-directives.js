/**
 * Tests that Docusaurus highlight directives are removed from code blocks.
 *
 * Run with: node tests/test-highlight-directives.js
 */
const assert = require('assert');
const { stripHighlightDirectives, cleanMarkdownForDisplay } =
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

console.log('\nstripHighlightDirectives:');

test('removes # highlight-start/end inside a continued shell command', () => {
  const input = [
    '    ```bash',
    '    docker run --gpus=1 \\',
    '      # highlight-start',
    '      --env "HF_TOKEN=${HF_TOKEN}" \\',
    '      # highlight-end',
    '      modular/max-nvidia-full:latest',
    '    ```',
  ].join('\n');
  assert.strictEqual(
    stripHighlightDirectives(input),
    [
      '    ```bash',
      '    docker run --gpus=1 \\',
      '      --env "HF_TOKEN=${HF_TOKEN}" \\',
      '      modular/max-nvidia-full:latest',
      '    ```',
    ].join('\n')
  );
});

test('removes every comment style Docusaurus recognizes', () => {
  const styles = [
    '// highlight-next-line',
    '/* highlight-start */',
    '{/* highlight-end */}',
    '<!-- highlight-next-line -->',
    '-- highlight-start',
    ';; highlight-end',
    '% highlight-next-line',
    '#highlight-start',
  ];
  const input = '```\n' + styles.join('\nx\n') + '\nx\n```';
  const out = stripHighlightDirectives(input);
  assert(!out.includes('highlight-'), out);
  assert.strictEqual(out.split('\n').filter((l) => l === 'x').length, styles.length);
});

test('keeps lines that only mention highlighting', () => {
  const input = '```python\nx = 1  # highlight-next-line is not alone\n# highlight-start the plan\n```';
  assert.strictEqual(stripHighlightDirectives(input), input);
});

test('leaves prose outside code blocks alone', () => {
  const input = 'Add `# highlight-start` to a block:\n\n# highlight-start\n';
  assert.strictEqual(stripHighlightDirectives(input), input);
});

test('end to end through cleanMarkdownForDisplay', () => {
  const input = '---\ntitle: T\n---\n\n```bash\na \\\n  # highlight-start\n  b\n  # highlight-end\n```\n';
  const out = cleanMarkdownForDisplay(input, 'container.mdx', '/');
  assert(out.includes('```bash\na \\\n  b\n```'), out);
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
