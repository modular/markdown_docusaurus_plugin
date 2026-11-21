// AI assistant "Open in …" rows: provider table, option validation, href building.
//
// `context` says which URL the assistant receives inside the prompt:
//   'markdown' — the clean .md URL this plugin generates. ChatGPT and Claude
//                fetch a user-supplied URL live (verified 2026-10-27: ChatGPT-User
//                requested the .md with a 200 and answered from it, with and
//                without hints=search), so they get the better input.
//   'page'     — the HTML page URL. Perplexity and Google AI Mode answer from
//                their search index, which never holds the noindexed .md twins
//                (Perplexity never requested the .md in testing); Grok is
//                untested and gets the safe choice.
const { getMarkdownUrl } = require('./markdown-path');

// `description` is a fork addition: a short second line under the label in the
// dropdown. Custom entries may set it; built-ins share DEFAULT_DESCRIPTION.
const DEFAULT_DESCRIPTION = 'Ask questions about this page';

// `askLabel` is a fork addition too: the button text in MarkdownAskBar.
// Custom entries may set it; without one, the bar uses `label`.
const BUILT_IN_PROVIDERS = [
  { id: 'chatgpt', label: 'Open in ChatGPT', askLabel: 'Ask ChatGPT', description: DEFAULT_DESCRIPTION, url: 'https://chatgpt.com/?hints=search&q={prompt}', context: 'markdown' },
  { id: 'claude', label: 'Open in Claude', askLabel: 'Ask Claude', description: DEFAULT_DESCRIPTION, url: 'https://claude.ai/new?q={prompt}', context: 'markdown' },
  { id: 'gemini', label: 'Open in Gemini', askLabel: 'Ask Gemini', description: DEFAULT_DESCRIPTION, url: 'https://www.google.com/search?udm=50&q={prompt}', context: 'page' },
  { id: 'perplexity', label: 'Open in Perplexity', askLabel: 'Ask Perplexity', description: DEFAULT_DESCRIPTION, url: 'https://www.perplexity.ai/search/new?q={prompt}', context: 'page' },
  { id: 'grok', label: 'Open in Grok', askLabel: 'Ask Grok', description: DEFAULT_DESCRIPTION, url: 'https://grok.com/?q={prompt}', context: 'page' },
];

// Same wording Mintlify, Neon and PostHog use, so assistants see a familiar prompt.
const DEFAULT_PROMPT = 'Read from {url} so I can ask questions about it.';

// MarkdownAskBar (fork addition): the question sent when the reader types
// nothing (also the text box's placeholder), and the prompt it builds: the
// page URL first, then the question.
const DEFAULT_QUESTION = 'Summarize this page.';
const DEFAULT_ASK_PROMPT = '{url}\n\n{question}';

const PREFIX = '[markdown-source-plugin]';
const VALID_IDS = BUILT_IN_PROVIDERS.map(p => p.id);
const CUSTOM_KEYS = ['label', 'askLabel', 'description', 'url', 'context'];

function fail(message) {
  throw new Error(`${PREFIX} ${message}`);
}

// Literal substitution: never String.replace with a string pattern, which
// would interpret `$&` and friends inside the replacement.
function replaceAll(str, token, value) {
  return str.split(token).join(value);
}

function isAbsoluteHttpUrl(template) {
  let parsed;
  try {
    parsed = new URL(replaceAll(template, '{prompt}', 'x'));
  } catch {
    return false;
  }
  return parsed.protocol === 'http:' || parsed.protocol === 'https:';
}

function normalizeCustomEntry(entry, index) {
  const unknown = Object.keys(entry).filter(key => !CUSTOM_KEYS.includes(key));
  if (unknown.length > 0) {
    fail(
      `aiProviders[${index}] has unsupported key${unknown.length > 1 ? 's' : ''} ` +
      `${unknown.map(key => `"${key}"`).join(', ')}. A custom entry accepts "label", "url", ` +
      `an optional "askLabel", an optional "description" and an optional "context" ('page' | 'markdown').`
    );
  }
  if (typeof entry.label !== 'string' || entry.label.trim() === '') {
    fail(`aiProviders[${index}].label must be a non-empty string.`);
  }
  for (const key of ['askLabel', 'description']) {
    if (entry[key] !== undefined && (typeof entry[key] !== 'string' || entry[key].trim() === '')) {
      fail(`aiProviders[${index}].${key} must be a non-empty string when set.`);
    }
  }
  if (typeof entry.url !== 'string' || !entry.url.includes('{prompt}')) {
    fail(`aiProviders[${index}].url must be a string containing the {prompt} placeholder.`);
  }
  if (!isAbsoluteHttpUrl(entry.url)) {
    fail(`aiProviders[${index}].url must be an absolute http(s) URL, got "${entry.url}".`);
  }
  if (entry.context !== undefined && entry.context !== 'page' && entry.context !== 'markdown') {
    fail(`aiProviders[${index}].context must be 'page' or 'markdown', got ${JSON.stringify(entry.context)}.`);
  }
  // Only include optional keys when set: undefined would not survive the JSON
  // round trip into global data.
  return {
    id: `custom-${index}`,
    label: entry.label,
    ...(entry.askLabel !== undefined && { askLabel: entry.askLabel }),
    ...(entry.description !== undefined && { description: entry.description }),
    url: entry.url,
    context: entry.context === 'markdown' ? 'markdown' : 'page',
  };
}

function normalizeProviders(aiProviders) {
  if (aiProviders === undefined) return BUILT_IN_PROVIDERS.map(p => ({ ...p }));
  if (aiProviders === false) return [];
  if (!Array.isArray(aiProviders)) {
    fail(`aiProviders must be an array of built-in ids and/or custom entries, or false; got ${typeof aiProviders}.`);
  }
  const seen = new Set();
  // Array.from visits holes (as undefined) where .map would skip them; a hole
  // would otherwise survive validation, serialize to null in global data and
  // crash buildAiLinks in the browser.
  return Array.from(aiProviders, (entry, index) => {
    if (typeof entry === 'string') {
      const builtIn = BUILT_IN_PROVIDERS.find(p => p.id === entry);
      if (!builtIn) {
        fail(`aiProviders[${index}]: unknown id "${entry}". Built-in ids: ${VALID_IDS.join(', ')}.`);
      }
      if (seen.has(entry)) fail(`aiProviders: duplicate id "${entry}".`);
      seen.add(entry);
      return { ...builtIn };
    }
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      return normalizeCustomEntry(entry, index);
    }
    fail(`aiProviders[${index}] must be a built-in id string or a { label, url } object; got ${JSON.stringify(entry)}.`);
  });
}

function normalizePrompt(aiPrompt) {
  if (aiPrompt === undefined) return DEFAULT_PROMPT;
  if (typeof aiPrompt !== 'string' || aiPrompt.trim() === '') {
    fail('aiPrompt must be a non-empty string containing the {url} placeholder.');
  }
  if (!aiPrompt.includes('{url}')) {
    fail(`aiPrompt must contain the {url} placeholder, got "${aiPrompt}".`);
  }
  return aiPrompt;
}

function normalizeQuestion(aiQuestion) {
  if (aiQuestion === undefined) return DEFAULT_QUESTION;
  if (typeof aiQuestion !== 'string' || aiQuestion.trim() === '') {
    fail(`aiQuestion must be a non-empty string, got ${JSON.stringify(aiQuestion)}.`);
  }
  return aiQuestion;
}

// Raw user options in, normalized shape out. Throws on invalid input.
function normalizeAiOptions(options = {}) {
  const { aiProviders, aiPrompt, aiQuestion } = options || {};
  return {
    aiProviders: normalizeProviders(aiProviders),
    aiPrompt: normalizePrompt(aiPrompt),
    aiQuestion: normalizeQuestion(aiQuestion),
  };
}

// Absolute URLs for the current page from window.location parts. The full
// pathname is kept, so a site baseUrl like /sub/ survives. The .md URL uses
// the same mapping as the copy action (see lib/markdown-path.js).
function resolveContextUrls({ origin, pathname, supportDirectoryIndex = false }) {
  return {
    pageUrl: origin + pathname,
    markdownUrl: origin + getMarkdownUrl(pathname, { supportDirectoryIndex }),
  };
}

// `question`, when given, fills a {question} placeholder in the prompt
// (MarkdownAskBar). {url} is filled first, so a question that happens to
// contain "{url}" is sent as typed.
function buildAiLinks({ aiProviders = [], aiPrompt = DEFAULT_PROMPT, pageUrl, markdownUrl, question }) {
  return aiProviders.map(provider => {
    const contextUrl = provider.context === 'markdown' ? markdownUrl : pageUrl;
    let prompt = replaceAll(aiPrompt, '{url}', contextUrl);
    if (question !== undefined) prompt = replaceAll(prompt, '{question}', question);
    return {
      id: provider.id,
      label: provider.label,
      askLabel: provider.askLabel || provider.label,
      description: provider.description,
      href: replaceAll(provider.url, '{prompt}', encodeURIComponent(prompt)),
    };
  });
}

module.exports = {
  BUILT_IN_PROVIDERS,
  DEFAULT_PROMPT,
  DEFAULT_DESCRIPTION,
  DEFAULT_QUESTION,
  DEFAULT_ASK_PROMPT,
  normalizeAiOptions,
  resolveContextUrls,
  buildAiLinks,
};
