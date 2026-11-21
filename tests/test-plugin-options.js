/**
 * Tests that aiProviders/aiPrompt are validated when the plugin is created
 * and exposed to the client through global data.
 *
 * Run with: node tests/test-plugin-options.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const markdownSourcePlugin = require('../index');
const { BUILT_IN_PROVIDERS, DEFAULT_PROMPT, DEFAULT_QUESTION } = require('../lib/ai-providers');

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
  assert.equal(data.aiQuestion, DEFAULT_QUESTION);
});

test('global data includes a custom aiQuestion', async () => {
  assert.equal((await globalDataFor({ aiQuestion: 'Explain this page.' })).aiQuestion, 'Explain this page.');
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
  assert.throws(() => markdownSourcePlugin(context, { aiQuestion: '' }), /aiQuestion/);
});

test('getClientModules ships the default widget stylesheets, each scoped to its widget', () => {
  const fs = require('fs');
  const modules = markdownSourcePlugin(context, {}).getClientModules();
  assert.equal(modules.length, 2);
  assert.match(modules[0], /css[\\/]markdown-actions-dropdown\.css$/);
  assert.match(modules[1], /css[\\/]markdown-ask-bar\.css$/);
  // Every rule must be scoped to its widget: appearance rules to --styled
  // (so `unstyled` skips them), behavior rules to the dropdown's open state.
  const scopes = [
    /^\.markdown-actions-dropdown--(styled|open)\b/,
    /^\.markdown-ask-bar--styled\b/,
  ];
  modules.forEach((file, i) => {
    assert.ok(fs.existsSync(file), file);
    const selectors = fs.readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('}')
      .map(block => block.split('{')[0].trim())
      .filter(Boolean);
    assert.ok(selectors.length > 0, file);
    for (const selector of selectors.flatMap(s => s.split(','))) {
      assert.match(selector.trim(), scopes[i], selector);
    }
  });
});
