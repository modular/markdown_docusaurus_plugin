/**
 * Tests that aiProviders/aiPrompt are validated when the plugin is created
 * and exposed to the client through global data.
 *
 * Run with: node tests/test-plugin-options.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const markdownSourcePlugin = require('../index');
const { BUILT_IN_PROVIDERS, DEFAULT_PROMPT } = require('../lib/ai-providers');

const context = { siteDir: __dirname, siteConfig: { url: 'https://docs.test', baseUrl: '/' } };

async function globalDataFor(options) {
  let data;
  const plugin = markdownSourcePlugin(context, options);
  await plugin.contentLoaded({ actions: { setGlobalData: d => { data = d; } } });
  return data;
}

test('global data includes all built-in providers and the default prompt by default', async () => {
  const data = await globalDataFor({});
  assert.deepEqual(data.aiProviders.map(p => p.id), BUILT_IN_PROVIDERS.map(p => p.id));
  assert.equal(data.aiPrompt, DEFAULT_PROMPT);
});

test('global data honours a provider subset, order and custom prompt', async () => {
  const data = await globalDataFor({
    aiProviders: ['claude', 'chatgpt', 'gemini'],
    aiPrompt: 'Help me with {url}',
  });
  assert.deepEqual(data.aiProviders.map(p => p.id), ['claude', 'chatgpt', 'gemini']);
  assert.equal(data.aiPrompt, 'Help me with {url}');
});

test('aiProviders: false yields an empty list', async () => {
  assert.deepEqual((await globalDataFor({ aiProviders: false })).aiProviders, []);
});

test('global data survives a JSON round trip', async () => {
  const data = await globalDataFor({
    aiProviders: ['chatgpt', { label: 'Open in X', url: 'https://x.test/?q={prompt}' }],
  });
  assert.deepEqual(JSON.parse(JSON.stringify(data)), data);
});

test('existing global data keys are unchanged', async () => {
  const data = await globalDataFor({ docsPath: '/', copyButtonText: 'Copy as Markdown' });
  assert.equal(data.docsPath, '/');
  assert.equal(data.widgetType, 'button');
  assert.equal(data.copyButtonText, 'Copy as Markdown');
  assert.equal(data.copiedButtonText, 'Copied');
});

test('invalid AI options fail when the plugin is created', () => {
  assert.throws(() => markdownSourcePlugin(context, { aiProviders: ['copilot'] }), /\[markdown-source-plugin\].*"copilot"/);
  assert.throws(() => markdownSourcePlugin(context, { aiPrompt: 'no placeholder' }), /aiPrompt.*\{url\}/);
});
