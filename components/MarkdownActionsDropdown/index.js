import React, { useState, useRef, useEffect, useCallback, useId } from 'react';
import useMarkdownCopy from '../hooks/useMarkdownCopy';
import CopyIcon from '@theme/MarkdownCopyIcon';
import CheckIcon from '@theme/MarkdownCheckIcon';
import ChevronIcon from '@theme/MarkdownChevronIcon';
import ViewIcon from '@theme/MarkdownViewIcon';
import ExternalLinkIcon from '@theme/MarkdownExternalLinkIcon';
import ProviderIcon from '@theme/MarkdownProviderIcon';
import { buildAiLinks, resolveContextUrls, DEFAULT_PROMPT } from '../../lib/ai-providers';

const DEFAULT_LABELS = {
  copy: { title: 'Copy page', description: 'Copy page as Markdown for LLMs' },
  view: { title: 'View as Markdown', description: 'Open this page as plain text' },
};

const CLOSE_AFTER_COPY_MS = 1500;

/**
 * "Copy page" menu button with markdown actions.
 *
 * Every element has a `markdown-actions-dropdown__*` class so sites can style
 * it; the only built-in styling comes from Infima's `dropdown` classes (menu
 * positioning and show/hide) and `triggerClassName`.
 *
 * @param {Object} props
 * @param {string} props.docsPath - Base path for docs pages (default: '/docs/')
 * @param {boolean} props.supportDirectoryIndex - See useMarkdownCopy
 * @param {string} props.buttonText - Trigger label (default: 'Copy page')
 * @param {string} props.copiedButtonText - Copy row title after a successful copy (default: 'Copied')
 * @param {('copy'|'view')[]} props.actions - Which markdown rows to show, in order (default: ['view', 'copy'])
 * @param {Object} props.labels - Per-row { title, description } overrides, keyed by action
 * @param {Object[]} props.aiProviders - "Open in …" rows, as normalized by the
 *   plugin's `aiProviders` option (read them from the plugin's global data).
 *   Default: none.
 * @param {string} props.aiPrompt - Prompt template with a {url} placeholder
 * @param {string} props.triggerClassName - Extra classes for the trigger
 *   (default: Infima's 'button button--secondary button--sm'; pass '' to style it yourself)
 * @param {string} props.className - Extra classes for the root element
 */
export default function MarkdownActionsDropdown({
  docsPath = '/docs/',
  supportDirectoryIndex = false,
  buttonText = 'Copy page',
  copiedButtonText = 'Copied',
  actions = ['view', 'copy'],
  labels = {},
  aiProviders = [],
  aiPrompt = DEFAULT_PROMPT,
  triggerClassName = 'button button--secondary button--sm',
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const closeTimerRef = useRef(null);
  const menuId = useId();

  const {
    copied,
    loading,
    error,
    isDocsPage,
    markdownUrl,
    copyMarkdown,
  } = useMarkdownCopy(docsPath, supportDirectoryIndex);

  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  useEffect(() => clearCloseTimer, []);

  // Closing hides the list, so if focus was inside it (keyboard use), hand it
  // back to the trigger instead of leaving it on a hidden element.
  const close = useCallback(({ refocus = true } = {}) => {
    clearCloseTimer();
    setIsOpen(false);
    if (refocus && menuRef.current && menuRef.current.contains(document.activeElement)) {
      triggerRef.current?.focus();
    }
  }, []);

  // Close on click outside, Escape, or focus moving outside the widget.
  useEffect(() => {
    if (!isOpen) return;

    const isOutside = (target) => rootRef.current && !rootRef.current.contains(target);
    const handlePointerDown = (event) => {
      if (isOutside(event.target)) close({ refocus: false });
    };
    const handleFocusIn = (event) => {
      if (isOutside(event.target)) close({ refocus: false });
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        clearCloseTimer();
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, close]);

  if (!isDocsPage) {
    return null;
  }

  // Absolute URLs, since the assistant fetches them from outside the site.
  // (isDocsPage is false during SSR, so window is always defined here.)
  const aiLinks = buildAiLinks({
    aiProviders,
    aiPrompt,
    ...resolveContextUrls({
      origin: window.location.origin,
      pathname: window.location.pathname,
      supportDirectoryIndex,
    }),
  });

  const menuItems = () =>
    menuRef.current ? Array.from(menuRef.current.querySelectorAll('[role="menuitem"]')) : [];

  const openAndFocus = (index) => {
    setIsOpen(true);
    // Wait for the menu to become visible before moving focus into it.
    requestAnimationFrame(() => {
      const items = menuItems();
      if (items.length) items[(index + items.length) % items.length].focus();
    });
  };

  const handleTriggerKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      openAndFocus(0);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      openAndFocus(-1);
    }
  };

  const handleMenuKeyDown = (event) => {
    // Menu items activate on Space as well as Enter. Buttons do that natively;
    // links would scroll the page instead, so click them explicitly.
    const link = event.key === ' ' && event.target.closest?.('a[role="menuitem"]');
    if (link) {
      event.preventDefault();
      link.click();
      return;
    }

    const items = menuItems();
    const index = items.indexOf(document.activeElement);
    let next = null;
    if (event.key === 'ArrowDown') next = index + 1;
    else if (event.key === 'ArrowUp') next = index - 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    if (next !== null && items.length) {
      event.preventDefault();
      items[(next + items.length) % items.length].focus();
    }
  };

  const handleCopy = async () => {
    clearCloseTimer();
    await copyMarkdown();
    // Keep the menu open briefly so the "Copied" state is visible.
    closeTimerRef.current = setTimeout(() => close(), CLOSE_AFTER_COPY_MS);
  };

  const renderText = (title, description, live = false) => (
    <span className="markdown-actions-dropdown__text">
      <span className="markdown-actions-dropdown__title" aria-live={live ? 'polite' : undefined}>
        {title}
      </span>
      {description && (
        <span className="markdown-actions-dropdown__description">{description}</span>
      )}
    </span>
  );

  const renderAction = (action) => {
    if (!DEFAULT_LABELS[action]) return null;
    const { title, description } = { ...DEFAULT_LABELS[action], ...labels[action] };

    if (action === 'copy') {
      const state = error ? 'error' : copied ? 'copied' : null;
      return (
        <li key="copy" role="none">
          <button
            type="button"
            role="menuitem"
            className={[
              'dropdown__link',
              'markdown-actions-dropdown__item',
              'markdown-actions-dropdown__item--copy',
              state && `markdown-actions-dropdown__item--${state}`,
            ].filter(Boolean).join(' ')}
            onClick={handleCopy}
            aria-disabled={loading || copied || !!error}
          >
            <span className="markdown-actions-dropdown__icon">
              {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
            </span>
            {renderText(error ? 'Copy failed!' : copied ? copiedButtonText : title, description, true)}
          </button>
        </li>
      );
    }

    // action === 'view'
    return (
      <li key="view" role="none">
        <a
          role="menuitem"
          className="dropdown__link markdown-actions-dropdown__item markdown-actions-dropdown__item--view"
          href={markdownUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => close()}
        >
          <span className="markdown-actions-dropdown__icon">
            <ViewIcon size={16} />
          </span>
          {renderText(title, description)}
        </a>
      </li>
    );
  };

  return (
    <div
      ref={rootRef}
      className={[
        'dropdown',
        'markdown-actions-dropdown',
        isOpen && 'dropdown--show markdown-actions-dropdown--open',
        className,
      ].filter(Boolean).join(' ')}
    >
      <button
        ref={triggerRef}
        type="button"
        className={['markdown-actions-dropdown__trigger', triggerClassName].filter(Boolean).join(' ')}
        onClick={() => (isOpen ? close({ refocus: false }) : setIsOpen(true))}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
      >
        <span className="markdown-actions-dropdown__icon">
          <CopyIcon size={16} />
        </span>
        <span className="markdown-actions-dropdown__label">{buttonText}</span>
        <span className="markdown-actions-dropdown__chevron">
          <ChevronIcon size={12} />
        </span>
      </button>

      <ul
        ref={menuRef}
        id={menuId}
        role="menu"
        aria-label={buttonText}
        className="dropdown__menu markdown-actions-dropdown__menu"
        onKeyDown={handleMenuKeyDown}
      >
        {actions.map(renderAction)}
        {actions.length > 0 && aiLinks.length > 0 && (
          <li role="separator" className="markdown-actions-dropdown__separator" />
        )}
        {aiLinks.map((link) => (
          <li key={link.id} role="none">
            <a
              role="menuitem"
              className={`dropdown__link markdown-actions-dropdown__item markdown-actions-dropdown__item--ai markdown-actions-dropdown__item--${link.id}`}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => close()}
            >
              <span className="markdown-actions-dropdown__icon">
                <ProviderIcon id={link.id} size={16} />
              </span>
              {renderText(link.label, link.description)}
              <span className="markdown-actions-dropdown__external">
                <ExternalLinkIcon size={12} />
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
