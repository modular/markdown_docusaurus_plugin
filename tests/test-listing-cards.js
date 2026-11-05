/**
 * Tests that <ListingCards> grids become Markdown lists of
 * "- [title](url): description" items instead of being dropped.
 *
 * Run with: node tests/test-listing-cards.js
 */
const assert = require('assert');
const { convertListingCardsToMarkdown, cleanMarkdownForDisplay } =
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

console.log('\nconvertListingCardsToMarkdown:');

test('converts each card to a list item', () => {
  const input = [
    '<ListingCards>',
    '  <ListingCard title="Quickstart"',
    '    url="/docs/manual/quickstart"',
    '    description="Learn the basics" />',
    '  <ListingCard',
    '    title="GPU Puzzles"',
    '    url="https://puzzles.modular.com/"',
    '    description="Solve GPU challenges"',
    '  />',
    '</ListingCards>',
  ].join('\n');
  assert.strictEqual(
    convertListingCardsToMarkdown(input).trim(),
    [
      '- [Quickstart](/docs/manual/quickstart): Learn the basics',
      '- [GPU Puzzles](https://puzzles.modular.com/): Solve GPU challenges',
    ].join('\n')
  );
});

test('ignores wrapper attributes and converts <code> in descriptions', () => {
  const input =
    '<ListingCards className="docs-desktop:!grid-cols-2">\n' +
    '  <ListingCard title="Fundamentals" url="/gpu/fundamentals"\n' +
    '    description="Explore <code>DeviceContext</code>, buffers, and kernels." />\n' +
    '</ListingCards>';
  assert.strictEqual(
    convertListingCardsToMarkdown(input).trim(),
    '- [Fundamentals](/gpu/fundamentals): Explore `DeviceContext`, buffers, and kernels.'
  );
});

test('omits the link without a url and the colon without a description', () => {
  const input =
    '<ListingCards>\n' +
    '  <ListingCard title="No link" description="Text only" />\n' +
    '  <ListingCard title="No description" url="/page" />\n' +
    '</ListingCards>';
  assert.strictEqual(
    convertListingCardsToMarkdown(input).trim(),
    '- No link: Text only\n- [No description](/page)'
  );
});

test('keeps the indentation of a grid nested in a list item', () => {
  const input =
    '1. Next steps:\n\n' +
    '   <ListingCards>\n' +
    '     <ListingCard title="A" url="/a" description="First" />\n' +
    '   </ListingCards>';
  assert.strictEqual(
    convertListingCardsToMarkdown(input),
    '1. Next steps:\n\n\n   - [A](/a): First\n'
  );
});

console.log('\ncleanMarkdownForDisplay:');

test('emits the list and no stray tags', () => {
  const input = [
    '## Next steps',
    '',
    "import ListingCards from '@site/src/components/Listing/ListingCards';",
    '',
    '<ListingCards>',
    '  <ListingCard title="Types"',
    '    url="/docs/reference/types"',
    '    description="`SIMD`, `DType`, and conversions" />',
    '  <ListingCard title="Decorators"',
    '    url="/docs/reference/decorators"',
    '    description="Modify structs and functions" />',
    '</ListingCards>',
    '',
    'After.',
  ].join('\n');
  const output = cleanMarkdownForDisplay(input, 'reference/index.mdx');
  assert.ok(!/ListingCard/.test(output), output);
  assert.ok(
    output.includes(
      '- [Types](/docs/reference/types): `SIMD`, `DType`, and conversions\n' +
        '- [Decorators](/docs/reference/decorators): Modify structs and functions\n\nAfter.'
    ),
    output
  );
});

test('leaves ListingCards inside a code fence untouched', () => {
  const input = '```mdx\n<ListingCards>\n  <ListingCard title="A" url="/a" />\n</ListingCards>\n```';
  assert.ok(
    cleanMarkdownForDisplay(input, 'page.mdx').includes(
      '<ListingCards>\n  <ListingCard title="A" url="/a" />\n</ListingCards>'
    )
  );
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
