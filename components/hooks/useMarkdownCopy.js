import { useState, useCallback } from 'react';

/**
 * Custom hook for markdown copy functionality
 * Provides shared logic for fetching and copying markdown content
 * 
 * @param {string} docsPath - The base path for docs (e.g., '/docs/' or '/')
 * @param {boolean} supportDirectoryIndex - When true, trailing-slash URLs
 *   fetch intro.md (e.g., /foo/ -> /foo/intro.md). When false, the trailing
 *   slash is stripped (e.g., /foo/ -> /foo.md).
 * @returns {Object} Hook state and actions
 */
export default function useMarkdownCopy(docsPath = '/docs/', supportDirectoryIndex = false) {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Get current pathname from window.location
  const currentPath = typeof window !== 'undefined' 
    ? window.location.pathname 
    : '';

  // Check if current page is a docs page
  const isDocsPage = currentPath.startsWith(docsPath);

  // Construct the .md URL from the current path
  let markdownUrl;
  if (!currentPath.endsWith('/')) {
    markdownUrl = `${currentPath}.md`;
  } else if (supportDirectoryIndex) {
    markdownUrl = `${currentPath}intro.md`;
  } else {
    markdownUrl = `${currentPath.slice(0, -1)}.md`;
  }

  /**
   * Copy markdown content to clipboard
   * Fetches the markdown file and copies its content
   */
  const copyMarkdown = useCallback(async () => {
    if (loading || copied || error) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(markdownUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch markdown: ${response.status}`);
      }
      const markdown = await response.text();
      await navigator.clipboard.writeText(markdown);

      setCopied(true);
      // Reset copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setError(err);
      console.error('Failed to copy markdown:', err);
      setTimeout(() => setError(null), 2000);
    } finally {
      setLoading(false);
    }
  }, [markdownUrl, loading, copied]);

  /**
   * Open markdown file in a new tab
   */
  const openMarkdown = useCallback(() => {
    window.open(markdownUrl, '_blank');
  }, [markdownUrl]);

  return {
    // State
    copied,
    loading,
    error,
    isDocsPage,
    markdownUrl,
    // Actions
    copyMarkdown,
    openMarkdown,
  };
}
