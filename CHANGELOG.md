# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.4] - 2026-05-01

### Fixed

- **`fullyQualifiedLinks`** now rewrites site-root links under configured **`blog`** `routeBasePath` values (e.g. `/releases/...`), not only the docs prefix.
- Relative **`img/`** image URLs in blog emitted markdown use the blog route base (via **`assetBasePath`**) instead of the docs prefix.

### Security

- Reject blog output paths and slug segments that escape the build directory (`..`, unsafe YAML `slug:` values).

### Changed

- Clarified log line: “image directories” when copying blog images.

## [2.0.3] - 2026-04-30

### Fixed

- Root **`index.md`** / **`index.mdx`** in a `blog` tree emits **`{routeBasePath}.md`** (e.g. `releases.md`) so list-page raw markdown matches `/{routeBasePath}/` → `.md` URLs instead of `/{routeBasePath}/index.md`.

## [2.0.2] - 2026-04-30

### Added

- **`blog`** plugin option: array of `{ path, routeBasePath?, exclude? }` to emit cleaned `.md` files for content served by **`@docusaurus/plugin-content-blog`**, using the same slug rules as that plugin (`slug` front matter or filename-derived slug, including date-style filenames). Reuses the existing markdown cleaning, directive prepend, `fullyQualifiedLinks`, and `img/` copying pipeline as for docs.

### Documentation

- README section for **`blog`**, fork differences bullet, and config example.

### Modular fork history (merged before `blog`; omitted from earlier CHANGELOG releases)

Compressed summary of work landed between the prior **v2.0.1** changelog snapshot (mostly README/documentation notes on upstream FlyNumber **v2.0.x**) and the **`blog`** feature—the functionality shipped incrementally via pinned commits / PRs **#1–#13** on this fork rather than separate semver bumps documented here.

- **Configurable UX:** **`docsPath`** plus injection/widget knobs (**`containerSelector`**, **`widgetType`**, **`copyButtonText`**, **`copiedButtonText`**, icon sizing/overrides); refactored client plumbing (`MarkdownCopyButton`/hooks/icons architecture).
- **Copy reliability (#1–#8):** correct `.md` fetches for trailing-slash URLs and **`index.md`** sources; **`credentials: 'include'`**; clearer clipboard failures vs opaque **`NotAllowedError`** on Safari; Safari-compatible **`ClipboardItem`** flows using **`text/plain`** payloads.
- **LLM-style publishing (#10–#12):** **`fullyQualifiedLinks`** rewrites internal links to absolute `.md` URLs; **`directive`** prepends the llms-txt blockquote on emitted markdown (with **`LlmsDirective`** theme hook); **`htmlDirective`** injects an equivalent hint earlier in HTML via **`preBodyTags`**.
- **Richer MD → Markdown conversion:** **`.mdx`** plus **`title`** from front matter as leading **`#`**; **`DynamicCode`** → fenced blocks with template-literal cleanup; **`export const`** object arrays → bullets; **`ConditionalContent`**, **`Requirements`**, MDX **`{/* … */}`** comments; **`Tabs`**/**`TabItem`** (nested layouts, arbitrary attribute order, custom **`*Tabs`** components); **`details`**/**`summary`**; unwrap/remove **`ModelSelector`**, **`InstallModular`**, **`div`** wrappers; **`collapseBlankLines`**; preserve fenced/inline code when stripping JSX noise (#9).
- **Cleanup polish (#13):** strip stray **`section`** wrappers, normalize **`b`** tags, remove zero-width spaces; assorted indentation fixes for **`DynamicCode`** / **`TabItem`** output.

## [2.0.1] - 2025-11-24

### Documentation
- Added button screenshot to README showing the dropdown UI
- Removed unnecessary v1.x migration guide (no users existed before v2.0.0)
- Simplified Advanced Configuration section
- Removed complex swizzling instructions for blog support
- Added honest note about customization trade-offs

### Improved
- Screenshot now displays at 400px width for better README viewing
- Cleaner, more focused documentation
- More transparent about current limitations and future plans

## [2.0.0] - 2025-11-24

### Breaking Changes
- **Eliminated manual file copying requirement** - Plugin now uses Docusaurus native APIs
- Users upgrading from v1.x must remove manually copied theme files (`src/theme/Root.js` and `src/components/MarkdownActionsDropdown/`)
- Component directory structure changed: `src/` → `theme/` and `components/`
- Components now bundled with plugin instead of user's project

### Added
- `getThemePath()` plugin API to automatically provide theme components
- `.gitignore` file for cleaner development experience
- Comprehensive migration guide in README for v1.x users
- Zero-config installation - just add plugin to docusaurus.config.js

### Changed
- Plugin now provides components via Docusaurus plugin APIs instead of requiring manual copying
- Updated README with simplified installation instructions
- Component imports now use relative paths instead of `@site` alias
- Updated troubleshooting guide to reflect new architecture
- Updated advanced configuration examples to use swizzling

### Improved
- Much better developer experience - no manual file management needed
- Components automatically update when plugin updates (no stale copied files)
- Cleaner project structure - plugin consumers don't need theme overrides
- Standard Docusaurus plugin pattern - follows best practices

### Technical Details
- Uses Docusaurus `getThemePath()` lifecycle method
- Components bundled at: `theme/Root.js` and `components/MarkdownActionsDropdown/`
- Tested in production with 58 markdown files and 10 image directories
- Compatible with Docusaurus v3.x

### Migration from v1.x
1. Remove manually copied files: `src/theme/Root.js` and `src/components/MarkdownActionsDropdown/`
2. Update the plugin: `npm update docusaurus-markdown-source-plugin`
3. Rebuild: `npm run build`
4. CSS in `custom.css` remains unchanged

## [1.0.0] - 2025-11-24

### Added
- Initial release of docusaurus-markdown-source-plugin
- Build-time plugin that copies markdown files to build output
- Automatic cleaning of Docusaurus-specific syntax (front matter, imports, MDX components)
- Conversion of HTML elements back to markdown equivalents
- Conversion of relative image paths to absolute paths from /docs/ root
- Automatic copying of image directories to build output
- React dropdown component for viewing and copying markdown
- "View as Markdown" feature - opens raw markdown in new tab
- "Copy Page as Markdown" feature - copies markdown to clipboard
- Dynamic injection into article headers via Root.js theme override
- Click-outside-to-close dropdown behavior
- Mobile-responsive dropdown positioning
- RTL language support for dropdown menu
- Comprehensive deployment guides for:
  - Vercel
  - Netlify
  - Cloudflare Pages
  - Apache
  - Nginx
- SEO-safe HTTP headers configuration examples
- CSS customization support via custom.css
- Support for Tabs/TabItem component conversion
- Support for details/summary component conversion
- YouTube iframe to text link conversion
- HTML5 video tag handling
- Zero-config setup with sensible defaults

### Documentation
- Comprehensive README with installation instructions
- Quick start guide
- Deployment configuration for all major platforms
- Troubleshooting guide
- Advanced configuration examples (blog support, custom URL patterns)
- CSS customization guide
- Live example at flynumber.com/docs

### Technical Details
- Dependencies: fs-extra ^11.0.0
- Peer dependencies: @docusaurus/core ^3.0.0, react ^18.0.0
- Requires Node.js >=18.0.0
- Compatible with Docusaurus v3.x
- Uses React 18's createRoot API for component injection

[2.0.1]: https://github.com/FlyNumber/markdown_docusaurus_plugin/releases/tag/v2.0.1
[2.0.0]: https://github.com/FlyNumber/markdown_docusaurus_plugin/releases/tag/v2.0.0
[1.0.0]: https://github.com/FlyNumber/markdown_docusaurus_plugin/releases/tag/v1.0.0
