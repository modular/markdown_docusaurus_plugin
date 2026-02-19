import React from 'react';
import useMarkdownCopy from '../hooks/useMarkdownCopy';
import CopyIcon from '@theme/MarkdownCopyIcon';
import CheckIcon from '@theme/MarkdownCheckIcon';

/**
 * Simple button component for copying markdown content
 * Shows a copy icon and configurable text, changes to checkmark on success
 *
 * @param {Object} props
 * @param {string} props.docsPath - Base path for docs pages (default: '/docs/')
 * @param {string} props.copyButtonText - Text shown on button (default: 'Copy page')
 * @param {string} props.copiedButtonText - Text shown after copy (default: 'Copied')
 */
export default function MarkdownCopyButton({
  docsPath = '/docs/',
  copyButtonText = 'Copy page',
  copiedButtonText = 'Copied'
}) {
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
        <CheckIcon size={16} style={{ verticalAlign: 'middle' }} />
      ) : (
        <CopyIcon size={16} style={{ verticalAlign: 'middle' }} />
      )}
      {copied ? copiedButtonText : copyButtonText}
    </button>
  );
}
