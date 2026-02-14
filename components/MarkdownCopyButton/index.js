import React from 'react';
import useMarkdownCopy from '../hooks/useMarkdownCopy';
import { CopyIcon, CheckIcon } from '../icons';

/**
 * Simple button component for copying markdown content
 * Shows a copy icon and "Copy page" text, changes to checkmark and "Copied" on success
 * 
 * @param {Object} props
 * @param {string} props.docsPath - Base path for docs pages (default: '/docs/')
 */
export default function MarkdownCopyButton({ docsPath = '/docs/' }) {
  const { copied, loading, isDocsPage, copyMarkdown } = useMarkdownCopy(docsPath);

  // Don't render on non-docs pages
  if (!isDocsPage) {
    return null;
  }

  return (
    <button
      className="button button--secondary button--sm markdown-copy-button"
      onClick={copyMarkdown}
      disabled={copied || loading}
      aria-label={copied ? 'Copied to clipboard' : 'Copy page as markdown'}
    >
      {copied ? (
        <CheckIcon size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
      ) : (
        <CopyIcon size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
      )}
      {copied ? 'Copied' : 'Copy page'}
    </button>
  );
}
