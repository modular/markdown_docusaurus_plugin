/**
 * Tests that link rewriting never touches fenced or inline code.
 *
 * Mojo syntax such as `ctx.enqueue_function[kernel](grid_dim=2)` matches the
 * markdown inline-link pattern, so code must be protected before rewriting.
 *
 * Run with: node tests/test-code-safe-links.js
 */
const assert = require('assert');
const {
  protectFencedCodeBlocks,
  restoreFencedCodeBlocks,
  protectInlineCode,
  restoreInlineCode,
  convertLinksToAbsoluteUrls,
  fenceToken,
  codeToken,
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

const SITE = 'https://example.com';
const rewrite = (md, dir = '/gpu/') =>
  convertLinksToAbsoluteUrls(md, dir, SITE, '', []);

console.log('\nprotectFencedCodeBlocks (line-based fences):');

test('protects a fence indented inside a list item', () => {
  const input = '1. Run it:\n\n    ```sh\n    docker run [x](y)\n    ```\n\n2. Done';
  const { content, blocks } = protectFencedCodeBlocks(input);
  assert.strictEqual(blocks.length, 1);
  assert(!content.includes('docker run'));
  assert.strictEqual(restoreFencedCodeBlocks(content, blocks), input);
});

test('protects tilde fences', () => {
  const input = '~~~mojo\nf[a](b)\n~~~';
  const { content, blocks } = protectFencedCodeBlocks(input);
  assert.strictEqual(content, fenceToken(0));
  assert.strictEqual(blocks[0], input);
});

test('a longer outer fence contains a shorter inner fence', () => {
  const input = '````md\n```mojo\nf[a](b)\n```\n````\nafter';
  const { content, blocks } = protectFencedCodeBlocks(input);
  assert.strictEqual(blocks.length, 1);
  assert.strictEqual(content, `${fenceToken(0)}\nafter`);
});

test('does not close a fence on an opening fence with an info string', () => {
  const input = '```python\na = 1\n```python\nb = 2\n```';
  const { blocks } = protectFencedCodeBlocks(input);
  assert.strictEqual(blocks.length, 1);
  assert(blocks[0].endsWith('b = 2\n```'));
});

test('leaves an unclosed fence alone', () => {
  const input = 'text\n```\nnever closed [a](b)';
  const { content, blocks } = protectFencedCodeBlocks(input);
  assert.strictEqual(blocks.length, 0);
  assert.strictEqual(content, input);
});

console.log('\nprotectInlineCode:');

test('protects single and double backtick spans', () => {
  const input = 'Call `f[a](b)` or ``g`[c](d)`` here.';
  const { content, spans } = protectInlineCode(input);
  assert.strictEqual(content, `Call ${codeToken(0)} or ${codeToken(1)} here.`);
  assert.strictEqual(restoreInlineCode(content, spans), input);
});

test('does not span a paragraph break', () => {
  const input = 'a ` stray\n\nnext `code` end';
  const { spans } = protectInlineCode(input);
  assert.deepStrictEqual(spans, ['`code`']);
});

console.log('\nconvertLinksToAbsoluteUrls:');

test('does not rewrite a multi-line Mojo call in a fence', () => {
  const input =
    '```mojo\n        ctx.enqueue_function[print_threads](\n' +
    '            grid_dim=2, block_dim=64\n        )\n```';
  assert.strictEqual(rewrite(input), input);
});

test('does not rewrite a Mojo call in an indented fence', () => {
  const input = '- Step\n\n  ```mojo\n  foo[T](x)\n  ```';
  assert.strictEqual(rewrite(input), input);
});

test('does not rewrite Mojo calls in inline code', () => {
  const input = 'Use `ctx.enqueue_function[kernel](grid_dim=1)` to launch.';
  assert.strictEqual(rewrite(input), input);
});

test('still rewrites prose links', () => {
  assert.strictEqual(
    rewrite('See [the intro](./intro).'),
    'See [the intro](https://example.com/gpu/intro.md).'
  );
});

test('still rewrites a link whose text is inline code', () => {
  assert.strictEqual(
    rewrite('See [`List`](/mojo/std/list).'),
    'See [`List`](https://example.com/mojo/std/list.md).'
  );
});

test('rewrites links around code without disturbing it', () => {
  const input = '[a](./a) then\n\n```\nx[T](y)\n```\n\n[b](./b)';
  assert.strictEqual(
    rewrite(input),
    '[a](https://example.com/gpu/a.md) then\n\n```\nx[T](y)\n```\n\n' +
      '[b](https://example.com/gpu/b.md)'
  );
});

test('keeps $ replacement patterns in code literal', () => {
  const input =
    "```bash\necho $'a' $& $$ [x](y)\n```\nand `$' $&` [z](./z)";
  assert.strictEqual(
    rewrite(input),
    "```bash\necho $'a' $& $$ [x](y)\n```\nand `$' $&` " +
      '[z](https://example.com/gpu/z.md)'
  );
});

test('does not confuse literal token-like text with protected code', () => {
  const input = 'Literal __CODE_0__ and __FENCE_0__ then `a[b](c)` and [l](/gpu/x)';
  const out = rewrite(input);
  assert(out.startsWith('Literal __CODE_0__ and __FENCE_0__ then `a[b](c)` and ['));
});

test('rewrites a page with many inline code spans in linear time', () => {
  let input = '';
  for (let i = 0; i < 20000; i++) input += `Use \`x${i}\` and [l](/gpu/a${i}).\n`;
  const start = Date.now();
  const out = rewrite(input);
  assert(out.includes('`x19999`'));
  assert(Date.now() - start < 1000, `took ${Date.now() - start} ms`);
});

test('leaves reference-style definitions inside fences alone', () => {
  const input = '```\n[ref]: ./not-a-link\n```\n\n[ref]: ./real';
  assert.strictEqual(
    rewrite(input),
    '```\n[ref]: ./not-a-link\n```\n\n[ref]: https://example.com/gpu/real.md'
  );
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
