// The raw .md URL for a page path. Shared by the copy hook (browser) and the
// AI provider links (browser + tests), so both always point at the same file.
//
// Without supportDirectoryIndex, a trailing slash is stripped (/foo/ -> /foo.md,
// / -> /index.md). With it, a trailing slash maps to the directory's intro page
// (/foo/ -> /foo/intro.md).
function getMarkdownUrl(pathname, { supportDirectoryIndex = false } = {}) {
  if (!pathname.endsWith('/')) return `${pathname}.md`;
  if (supportDirectoryIndex) return `${pathname}intro.md`;
  const trimmed = pathname.slice(0, -1);
  return trimmed ? `${trimmed}.md` : '/index.md';
}

module.exports = { getMarkdownUrl };
