/**
 * Tests the AI assistant provider table, option validation and link builder.
 * Ported from upstream FlyNumber/markdown_docusaurus_plugin test/ai-providers.test.js.
 *
 * Run with: node tests/test-ai-providers.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { BUILT_IN_PROVIDERS, DEFAULT_PROMPT, DEFAULT_DESCRIPTION, DEFAULT_QUESTION, DEFAULT_ASK_PROMPT, normalizeAiOptions, buildAiLinks, resolveContextUrls } = require('../lib/ai-providers');

const IDS = ['chatgpt', 'claude', 'gemini', 'perplexity', 'grok'];
const promptFor = url => `Read from ${url} so I can ask questions about it.`;
const qOf = href => new URL(href).searchParams.get('q');

test('built-in table: five ids in spec order with context split', () => {
  assert.deepEqual(BUILT_IN_PROVIDERS.map(p => p.id), IDS);
  // ChatGPT and Claude fetch a user-supplied URL live, so they get the .md twin
  // (verified 2026-10-27: ChatGPT-User requested /docs/faq.md and answered from it).
  // Perplexity and Google AI Mode answer from their search index, which never holds
  // the noindexed twins, so they get the HTML page; Grok gets the safe choice.
  assert.deepEqual(BUILT_IN_PROVIDERS.map(p => p.context), ['markdown', 'markdown', 'page', 'page', 'page']);
  for (const p of BUILT_IN_PROVIDERS) assert.ok(p.url.includes('{prompt}'), p.id);
  assert.equal(BUILT_IN_PROVIDERS[0].url, 'https://chatgpt.com/?hints=search&q={prompt}');
  assert.equal(BUILT_IN_PROVIDERS[1].url, 'https://claude.ai/new?q={prompt}');
  assert.equal(BUILT_IN_PROVIDERS[2].url, 'https://www.google.com/search?udm=50&q={prompt}');
  assert.equal(BUILT_IN_PROVIDERS[3].url, 'https://www.perplexity.ai/search/new?q={prompt}');
  assert.equal(BUILT_IN_PROVIDERS[4].url, 'https://grok.com/?q={prompt}');
});

test('normalize: undefined gives all built-ins and the default prompt', () => {
  const out = normalizeAiOptions({});
  assert.deepEqual(out.aiProviders.map(p => p.id), IDS);
  assert.equal(out.aiPrompt, DEFAULT_PROMPT);
  assert.equal(DEFAULT_PROMPT, 'Read from {url} so I can ask questions about it.');
});

test('normalize: subset and reorder are honoured; built-ins are copies', () => {
  const out = normalizeAiOptions({ aiProviders: ['claude', 'chatgpt'] });
  assert.deepEqual(out.aiProviders.map(p => p.id), ['claude', 'chatgpt']);
  assert.notEqual(out.aiProviders[1], BUILT_IN_PROVIDERS[0]);
  assert.deepEqual(out.aiProviders[1], BUILT_IN_PROVIDERS[0]);
});

test('normalize: false and [] both yield an empty list', () => {
  assert.deepEqual(normalizeAiOptions({ aiProviders: false }).aiProviders, []);
  assert.deepEqual(normalizeAiOptions({ aiProviders: [] }).aiProviders, []);
});

test('normalize: custom entry gets custom-<index> id and page context by default', () => {
  const out = normalizeAiOptions({ aiProviders: ['chatgpt', { label: 'Open in Mistral', url: 'https://chat.mistral.ai/chat?q={prompt}' }] });
  assert.deepEqual(out.aiProviders[1], { id: 'custom-1', label: 'Open in Mistral', url: 'https://chat.mistral.ai/chat?q={prompt}', context: 'page' });
});

test('normalize: custom entry may opt into the markdown URL', () => {
  const out = normalizeAiOptions({ aiProviders: [{ label: 'Open in Kagi', url: 'https://kagi.com/assistant?q={prompt}', context: 'markdown' }] });
  assert.equal(out.aiProviders[0].context, 'markdown');
});

test('normalize: rejects unknown id, listing the valid ids', () => {
  assert.throws(() => normalizeAiOptions({ aiProviders: ['copilot'] }), /\[markdown-source-plugin\] .*aiProviders.*"copilot".*chatgpt, claude, gemini, perplexity, grok/);
});

test('normalize: rejects duplicate built-in ids', () => {
  assert.throws(() => normalizeAiOptions({ aiProviders: ['claude', 'claude'] }), /\[markdown-source-plugin\] .*aiProviders.*duplicate.*"claude"/);
});

test('normalize: rejects malformed custom entries', () => {
  const bad = [
    [{ url: 'https://x.test/?q={prompt}' }, /aiProviders.*label/],
    [{ label: '', url: 'https://x.test/?q={prompt}' }, /aiProviders.*label/],
    [{ label: 'X', url: 'https://x.test/' }, /aiProviders.*\{prompt\}/],
    [{ label: 'X', url: 'javascript:alert(1)//{prompt}' }, /aiProviders.*http/],
    [{ label: 'X', url: 'data:text/html,{prompt}' }, /aiProviders.*http/],
    [{ label: 'X', url: '/relative?q={prompt}' }, /aiProviders.*http/],
    [{ label: 'X', url: 'not a url {prompt}' }, /aiProviders.*http/],
    [{ label: 'X', url: 'https://x.test/?q={prompt}', context: 'html' }, /aiProviders.*context/],
    [{ label: 'X', url: 'https://x.test/?q={prompt}', icon: 'x' }, /aiProviders.*icon/],
    [{ label: 'X', url: 'https://x.test/?q={prompt}', id: 'claude' }, /aiProviders.*id/],
  ];
  for (const [entry, re] of bad) assert.throws(() => normalizeAiOptions({ aiProviders: [entry] }), re, JSON.stringify(entry));
});

test('normalize: rejects sparse arrays (a hole would serialize to null and break the dropdown)', () => {
  const sparse = ['chatgpt', , 'claude']; // eslint-disable-line no-sparse-arrays
  assert.throws(() => normalizeAiOptions({ aiProviders: sparse }), /\[markdown-source-plugin\] .*aiProviders\[1\]/);
});

test('normalize: output survives a JSON round trip unchanged', () => {
  const out = normalizeAiOptions({ aiProviders: ['chatgpt', { label: 'X', url: 'https://x.test/?q={prompt}' }] });
  assert.deepEqual(JSON.parse(JSON.stringify(out)), out);
});

test('normalize: rejects non-array aiProviders and bad aiPrompt', () => {
  assert.throws(() => normalizeAiOptions({ aiProviders: 'chatgpt' }), /\[markdown-source-plugin\] .*aiProviders/);
  assert.throws(() => normalizeAiOptions({ aiProviders: [42] }), /\[markdown-source-plugin\] .*aiProviders/);
  assert.throws(() => normalizeAiOptions({ aiPrompt: '' }), /\[markdown-source-plugin\] .*aiPrompt/);
  assert.throws(() => normalizeAiOptions({ aiPrompt: 'Summarise this page.' }), /aiPrompt.*\{url\}/);
  assert.throws(() => normalizeAiOptions({ aiPrompt: 42 }), /aiPrompt/);
});

const ctx = { pageUrl: 'https://docs.test/docs/intro', markdownUrl: 'https://docs.test/docs/intro.md' };

test('buildAiLinks: each built-in gets its context URL inside the prompt, read back exactly', () => {
  const { aiProviders, aiPrompt } = normalizeAiOptions({});
  const links = buildAiLinks({ aiProviders, aiPrompt, ...ctx });
  const byId = Object.fromEntries(links.map(l => [l.id, l.href]));
  assert.equal(qOf(byId.chatgpt), promptFor(ctx.markdownUrl));
  assert.equal(new URL(byId.chatgpt).searchParams.get('hints'), 'search');
  assert.equal(new URL(byId.chatgpt).origin + new URL(byId.chatgpt).pathname, 'https://chatgpt.com/');
  assert.equal(qOf(byId.claude), promptFor(ctx.markdownUrl));
  assert.equal(new URL(byId.claude).pathname, '/new');
  assert.equal(qOf(byId.gemini), promptFor(ctx.pageUrl));
  assert.equal(new URL(byId.gemini).searchParams.get('udm'), '50');
  assert.equal(qOf(byId.perplexity), promptFor(ctx.pageUrl));
  assert.equal(new URL(byId.perplexity).pathname, '/search/new');
  assert.equal(qOf(byId.grok), promptFor(ctx.pageUrl));
  assert.deepEqual(links.map(l => l.label), ['Open in ChatGPT', 'Open in Claude', 'Open in Gemini', 'Open in Perplexity', 'Open in Grok']);
});

test('buildAiLinks: reads back the exact prompt through URLSearchParams for hostile URLs', () => {
  const { aiProviders, aiPrompt } = normalizeAiOptions({ aiProviders: ['claude'] });
  for (const md of [
    'https://d.test/a b&c.md',
    'https://d.test/docs/caf%C3%A9.md',
    'https://d.test/docs/café.md',
    'https://d.test/docs/x.md#section',
    'https://d.test/docs/100%.md',
  ]) {
    const [link] = buildAiLinks({ aiProviders, aiPrompt, pageUrl: 'x', markdownUrl: md });
    assert.equal(qOf(link.href), promptFor(md), md);
    assert.equal(link.href.slice(0, 'https://claude.ai/new?q='.length), 'https://claude.ai/new?q=');
  }
});

test('buildAiLinks: full pathname is used, so baseUrl survives', () => {
  const { aiProviders, aiPrompt } = normalizeAiOptions({ aiProviders: ['chatgpt', 'claude'] });
  const links = buildAiLinks({ aiProviders, aiPrompt, pageUrl: 'https://h.test/sub/docs/x', markdownUrl: 'https://h.test/sub/docs/x.md' });
  assert.equal(qOf(links[0].href), promptFor('https://h.test/sub/docs/x.md'));
  assert.equal(qOf(links[1].href), promptFor('https://h.test/sub/docs/x.md'));
});

test('buildAiLinks: every {url} occurrence is replaced and $& in a template is literal', () => {
  const { aiProviders, aiPrompt } = normalizeAiOptions({
    aiPrompt: 'Open {url} then summarise {url}.',
    aiProviders: [{ label: 'Open in X', url: 'https://x.test/?pre=$&&q={prompt}' }],
  });
  const [link] = buildAiLinks({ aiProviders, aiPrompt, ...ctx });
  const u = new URL(link.href);
  assert.equal(u.searchParams.get('q'), `Open ${ctx.pageUrl} then summarise ${ctx.pageUrl}.`);
  assert.equal(u.searchParams.get('pre'), '$');
});

test('buildAiLinks: $& in the page and markdown URLs is substituted literally', () => {
  const { aiProviders, aiPrompt } = normalizeAiOptions({ aiProviders: ['perplexity', 'claude'] });
  const links = buildAiLinks({ aiProviders, aiPrompt, pageUrl: 'https://docs.test/a$&b', markdownUrl: 'https://docs.test/a$&b.md' });
  assert.equal(qOf(links[0].href), promptFor('https://docs.test/a$&b'));
  assert.equal(qOf(links[1].href), promptFor('https://docs.test/a$&b.md'));
});

test('resolveContextUrls: builds absolute page and markdown URLs from origin + pathname, keeping baseUrl', () => {
  assert.deepEqual(resolveContextUrls({ origin: 'https://h.test', pathname: '/sub/docs/x' }), { pageUrl: 'https://h.test/sub/docs/x', markdownUrl: 'https://h.test/sub/docs/x.md' });
  // This fork strips a trailing slash (/foo/ -> /foo.md), matching the copy action.
  assert.deepEqual(resolveContextUrls({ origin: 'https://h.test', pathname: '/sub/docs/' }), { pageUrl: 'https://h.test/sub/docs/', markdownUrl: 'https://h.test/sub/docs.md' });
  assert.deepEqual(resolveContextUrls({ origin: 'https://h.test', pathname: '/sub/docs/', supportDirectoryIndex: true }), { pageUrl: 'https://h.test/sub/docs/', markdownUrl: 'https://h.test/sub/docs/intro.md' });
  assert.deepEqual(resolveContextUrls({ origin: 'http://localhost:3000', pathname: '/docs/intro' }), { pageUrl: 'http://localhost:3000/docs/intro', markdownUrl: 'http://localhost:3000/docs/intro.md' });
});

test('buildAiLinks: custom entries honour their context', () => {
  const { aiProviders, aiPrompt } = normalizeAiOptions({ aiProviders: [
    { label: 'A', url: 'https://a.test/?q={prompt}' },
    { label: 'B', url: 'https://b.test/?q={prompt}', context: 'markdown' },
  ] });
  const links = buildAiLinks({ aiProviders, aiPrompt, ...ctx });
  assert.deepEqual(links.map(l => l.id), ['custom-0', 'custom-1']);
  assert.equal(qOf(links[0].href), promptFor(ctx.pageUrl));
  assert.equal(qOf(links[1].href), promptFor(ctx.markdownUrl));
});

test('buildAiLinks: empty provider list yields []', () => {
  assert.deepEqual(buildAiLinks({ aiProviders: [], aiPrompt: DEFAULT_PROMPT, ...ctx }), []);
});

// Fork addition: optional `description` (second line under the label).

test('description: built-ins carry the default description through to links', () => {
  assert.equal(DEFAULT_DESCRIPTION, 'Ask questions about this page');
  for (const p of BUILT_IN_PROVIDERS) assert.equal(p.description, DEFAULT_DESCRIPTION, p.id);
  const { aiProviders, aiPrompt } = normalizeAiOptions({ aiProviders: ['claude'] });
  const [link] = buildAiLinks({ aiProviders, aiPrompt, ...ctx });
  assert.equal(link.description, DEFAULT_DESCRIPTION);
});

test('description: custom entries may set one, and omit it otherwise', () => {
  const out = normalizeAiOptions({ aiProviders: [
    { label: 'A', description: 'Chat with A', url: 'https://a.test/?q={prompt}' },
    { label: 'B', url: 'https://b.test/?q={prompt}' },
  ] });
  assert.equal(out.aiProviders[0].description, 'Chat with A');
  assert.equal('description' in out.aiProviders[1], false);
  assert.deepEqual(JSON.parse(JSON.stringify(out)), out);
  const links = buildAiLinks({ ...out, ...ctx });
  assert.equal(links[0].description, 'Chat with A');
  assert.equal(links[1].description, undefined);
});

test('description: rejects empty or non-string values', () => {
  for (const description of ['', '  ', 42]) {
    assert.throws(
      () => normalizeAiOptions({ aiProviders: [{ label: 'X', description, url: 'https://x.test/?q={prompt}' }] }),
      /aiProviders\[0\]\.description/,
      JSON.stringify(description)
    );
  }
});

// Fork addition: MarkdownAskBar's `askLabel`, `aiQuestion` and {question}.

test('askLabel: built-ins have "Ask <name>" labels, carried through to links', () => {
  assert.deepEqual(BUILT_IN_PROVIDERS.map(p => p.askLabel), ['Ask ChatGPT', 'Ask Claude', 'Ask Gemini', 'Ask Perplexity', 'Ask Grok']);
  const { aiProviders, aiPrompt } = normalizeAiOptions({ aiProviders: ['claude'] });
  assert.equal(buildAiLinks({ aiProviders, aiPrompt, ...ctx })[0].askLabel, 'Ask Claude');
});

test('askLabel: custom entries may set one, and links fall back to label otherwise', () => {
  const out = normalizeAiOptions({ aiProviders: [
    { label: 'Open in A', askLabel: 'Ask A', url: 'https://a.test/?q={prompt}' },
    { label: 'Open in B', url: 'https://b.test/?q={prompt}' },
  ] });
  assert.equal(out.aiProviders[0].askLabel, 'Ask A');
  assert.equal('askLabel' in out.aiProviders[1], false);
  assert.deepEqual(JSON.parse(JSON.stringify(out)), out);
  const links = buildAiLinks({ ...out, ...ctx });
  assert.deepEqual(links.map(l => l.askLabel), ['Ask A', 'Open in B']);
});

test('askLabel: rejects empty or non-string values', () => {
  for (const askLabel of ['', '  ', 42]) {
    assert.throws(
      () => normalizeAiOptions({ aiProviders: [{ label: 'X', askLabel, url: 'https://x.test/?q={prompt}' }] }),
      /aiProviders\[0\]\.askLabel/,
      JSON.stringify(askLabel)
    );
  }
});

test('aiQuestion: defaults to "Summarize this page." and accepts any non-empty string', () => {
  assert.equal(DEFAULT_QUESTION, 'Summarize this page.');
  assert.equal(normalizeAiOptions({}).aiQuestion, DEFAULT_QUESTION);
  assert.equal(normalizeAiOptions({ aiQuestion: 'Explain this page.' }).aiQuestion, 'Explain this page.');
  for (const aiQuestion of ['', '   ', 42, null]) {
    assert.throws(() => normalizeAiOptions({ aiQuestion }), /\[markdown-source-plugin\] aiQuestion/, JSON.stringify(aiQuestion));
  }
});

test('buildAiLinks with a question: the ask prompt puts the context URL first, then the question', () => {
  assert.equal(DEFAULT_ASK_PROMPT, '{url}\n\n{question}');
  const { aiProviders } = normalizeAiOptions({ aiProviders: ['claude', 'gemini'] });
  const links = buildAiLinks({ aiProviders, aiPrompt: DEFAULT_ASK_PROMPT, question: 'What is ownership?', ...ctx });
  assert.equal(qOf(links[0].href), `${ctx.markdownUrl}\n\nWhat is ownership?`);
  assert.equal(qOf(links[1].href), `${ctx.pageUrl}\n\nWhat is ownership?`);
});

test('buildAiLinks with a question: the question is literal ({url}, $&, &, #, newlines)', () => {
  const { aiProviders } = normalizeAiOptions({ aiProviders: ['claude'] });
  for (const question of ['Compare {url} with v1', 'a $& b', 'x&q=y#z', 'line 1\nline 2', 'café 100%']) {
    const [link] = buildAiLinks({ aiProviders, aiPrompt: DEFAULT_ASK_PROMPT, question, ...ctx });
    assert.equal(qOf(link.href), `${ctx.markdownUrl}\n\n${question}`, question);
  }
});

test('buildAiLinks without a question leaves a {question} placeholder alone', () => {
  const { aiProviders } = normalizeAiOptions({ aiProviders: ['claude'] });
  const [link] = buildAiLinks({ aiProviders, aiPrompt: 'Read {url}: {question}', ...ctx });
  assert.equal(qOf(link.href), `Read ${ctx.markdownUrl}: {question}`);
});
