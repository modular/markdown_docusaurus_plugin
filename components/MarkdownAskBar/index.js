import React, { useState, useEffect } from 'react';
import useMarkdownCopy from '../hooks/useMarkdownCopy';
import CopyIcon from '@theme/MarkdownCopyIcon';
import CheckIcon from '@theme/MarkdownCheckIcon';
import ViewIcon from '@theme/MarkdownViewIcon';
import ProviderIcon from '@theme/MarkdownProviderIcon';
import {
  buildAiLinks,
  resolveContextUrls,
  DEFAULT_QUESTION,
  DEFAULT_ASK_PROMPT,
} from '../../lib/ai-providers';

/**
 * A text box for a question about the page, one "Ask <assistant>" link per AI
 * provider, and markdown buttons ("Copy markdown", optionally "View markdown")
 * after a separator.
 *
 * Each "Ask" link opens the assistant with the page URL followed by the
 * reader's question, or `aiQuestion` (also the placeholder) when the box is
 * empty. Enter in the box opens the first provider. The links' hrefs update
 * as the reader types, so middle-click and "open in new tab" work too.
 *
 * Every element has a `markdown-ask-bar__*` class so sites can style it. The
 * plugin's css/markdown-ask-bar.css adds default layout unless `unstyled` is
 * set.
 *
 * @param {Object} props
 * @param {string} props.docsPath - Base path for docs pages (default: '/docs/')
 * @param {boolean} props.supportDirectoryIndex - See useMarkdownCopy
 * @param {Object[]} props.aiProviders - "Ask" links, as normalized by the
 *   plugin's `aiProviders` option (read them from the plugin's global data).
 *   Default: none, which also hides the text box.
 * @param {string} props.aiQuestion - Question sent when the box is empty, and
 *   the box's placeholder (default: 'Summarize this page.')
 * @param {string} props.askPrompt - Prompt template with {url} and {question}
 *   placeholders (default: '{url}\n\n{question}')
 * @param {string} props.inputLabel - Accessible name for the text box, which
 *   has no visible label (default: 'Ask an AI assistant about this page')
 * @param {('copy'|'view')[]} props.actions - Markdown buttons after the
 *   separator, in order (default: ['copy'])
 * @param {string} props.copyButtonText - Copy button label (default: 'Copy markdown')
 * @param {string} props.copiedButtonText - Copy button label after a successful copy (default: 'Copied')
 * @param {string} props.viewButtonText - View button label (default: 'View markdown')
 * @param {boolean} props.showIcons - Show provider, copy and view icons in the
 *   buttons (default: false)
 * @param {string} props.buttonClassName - Extra classes for every button
 *   (default: Infima's 'button button--secondary button--sm'; pass '' to style them yourself)
 * @param {string} props.className - Extra classes for the root element
 * @param {boolean} props.unstyled - Skip the plugin's default styles so the
 *   site's CSS has full control (default: false)
 */
export default function MarkdownAskBar({
  docsPath = '/docs/',
  supportDirectoryIndex = false,
  aiProviders = [],
  aiQuestion = DEFAULT_QUESTION,
  askPrompt = DEFAULT_ASK_PROMPT,
  inputLabel = 'Ask an AI assistant about this page',
  actions = ['copy'],
  copyButtonText = 'Copy markdown',
  copiedButtonText = 'Copied',
  viewButtonText = 'View markdown',
  showIcons = false,
  buttonClassName = 'button button--secondary button--sm',
  className = '',
  unstyled = false,
}) {
  const [question, setQuestion] = useState('');
  const { copied, loading, error, isDocsPage, markdownUrl, copyMarkdown } =
    useMarkdownCopy(docsPath, supportDirectoryIndex);

  // A question is about one page: clear it when the reader moves to another
  // (the component can stay mounted across client-side navigation).
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  useEffect(() => setQuestion(''), [pathname]);

  if (!isDocsPage) {
    return null;
  }

  // Absolute URLs, since the assistant fetches them from outside the site.
  // (isDocsPage is false during SSR, so window is always defined here.)
  const aiLinks = buildAiLinks({
    aiProviders,
    aiPrompt: askPrompt,
    question: question.trim() || aiQuestion,
    ...resolveContextUrls({
      origin: window.location.origin,
      pathname,
      supportDirectoryIndex,
    }),
  });

  // Enter opens the first assistant. window.open runs inside the key press,
  // so popup blockers allow it. Skip Enter that confirms an IME composition.
  const handleInputKeyDown = (event) => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing || !aiLinks.length) return;
    event.preventDefault();
    window.open(aiLinks[0].href, '_blank', 'noopener,noreferrer');
  };

  const classes = (...names) => names.filter(Boolean).join(' ');

  const renderAction = (action) => {
    if (action === 'copy') {
      const state = error ? 'error' : copied ? 'copied' : null;
      return (
        <button
          key="copy"
          type="button"
          className={classes(
            'markdown-ask-bar__button',
            'markdown-ask-bar__copy',
            state && `markdown-ask-bar__copy--${state}`,
            buttonClassName
          )}
          onClick={copyMarkdown}
          aria-disabled={loading || copied || !!error}
        >
          {showIcons && (
            <span className="markdown-ask-bar__icon">
              {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
            </span>
          )}
          <span className="markdown-ask-bar__label" aria-live="polite">
            {error ? 'Copy failed!' : copied ? copiedButtonText : copyButtonText}
          </span>
        </button>
      );
    }
    if (action === 'view') {
      return (
        <a
          key="view"
          className={classes('markdown-ask-bar__button', 'markdown-ask-bar__view', buttonClassName)}
          href={markdownUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {showIcons && (
            <span className="markdown-ask-bar__icon">
              <ViewIcon size={16} />
            </span>
          )}
          <span className="markdown-ask-bar__label">{viewButtonText}</span>
        </a>
      );
    }
    return null;
  };

  const actionButtons = actions.map(renderAction).filter(Boolean);

  return (
    <div
      className={classes(
        'markdown-ask-bar',
        !unstyled && 'markdown-ask-bar--styled',
        className
      )}
    >
      {aiLinks.length > 0 && (
        <div className="markdown-ask-bar__ask">
          <input
            type="text"
            className="markdown-ask-bar__input"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder={aiQuestion}
            aria-label={inputLabel}
            autoComplete="off"
            enterKeyHint="send"
          />
          {aiLinks.map((link) => (
            <a
              key={link.id}
              className={classes(
                'markdown-ask-bar__button',
                'markdown-ask-bar__provider',
                `markdown-ask-bar__provider--${link.id}`,
                buttonClassName
              )}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              {showIcons && (
                <span className="markdown-ask-bar__icon">
                  <ProviderIcon id={link.id} size={16} />
                </span>
              )}
              <span className="markdown-ask-bar__label">{link.askLabel}</span>
            </a>
          ))}
        </div>
      )}
      {aiLinks.length > 0 && actionButtons.length > 0 && (
        <span className="markdown-ask-bar__separator" aria-hidden="true" />
      )}
      {actionButtons.length > 0 && (
        <div className="markdown-ask-bar__actions">{actionButtons}</div>
      )}
    </div>
  );
}
