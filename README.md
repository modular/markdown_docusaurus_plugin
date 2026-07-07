# Docusaurus Markdown Source Plugin

A lightweight Docusaurus plugin that exposes your Markdown files as raw `.md`
URLs and adds a button (or drop-down widget) to each page so users can copy the
Markdown file to their clipboard.

> [!NOTE]
> This project is not packaged and distributed on npm. This is a fork of
> [markdown_docusaurus_plugin by FlyNumber](https://github.com/FlyNumber/markdown_docusaurus_plugin)
> with some added functionality to support docs.modular.com.

## Fork differences

Here are some of the things we added/changed:

- Supports `.mdx` files, turning them into `.md`
- Extracts page title from frontmatter before stripping the frontmatter
- Renders a single "Copy page" button instead of drop-down widget, by default
  (the drop-down widget is still available via configuration)
- Miscellaneous improvements to processing Docusaurus tags like tabs, plus
  other MDX components (most are specific to docs.modular.com)
- Adds several user-configuration properties:
  - Specify the path to your docs (previously hard-coded to `/docs`)
  - Optional `blog` array so `@docusaurus/plugin-content-blog` posts get
    matching `.md` URLs (same slug rules as the blog plugin)
  - Select the widget type, either original drop-down or new button
  - Specify the DOM element where you want to inject the button/drop-down
    as a CSS selector (default is the page header)
  - Specify the button text
  - Specify the button/widget icons
- Adds support for `slug: /` frontmatter (other slug customizations are
  currently not supported)

## Add to your project

Although this fork is not distributed as a package, you can still add it
as a dependency in your `package.json` pointing to the GitHub repo:

```json
{
  "dependencies": {
    "docusaurus-markdown-source-plugin": "github:modular/markdown_docusaurus_plugin"
  }
}
```

Then run `npm install` to generate `package-lock.json`, which pins the resolved
commit. To update to a specific commit later, update the lock file entry or
append a commit hash:

```json
"docusaurus-markdown-source-plugin": "github:modular/markdown_docusaurus_plugin#abc1234"
```

## Configure the widget

The plugin accepts several configuration options to customize the "copy page"
behavior on your Docusaurus pages.

You don't need to set any of these, but here's a snippet you can copy paste
into your `docusaurus.config.js` file in case you want to customize:

```javascript
module.exports = {
  plugins: [
    ['docusaurus-markdown-source-plugin', {
      // URL path prefix where docs are served; set to '/' if docs
      // are at the site root (default: '/docs/')
      docsPath: '/docs/',

      // Filesystem directory name containing markdown source files,
      // relative to the site root (default: 'docs')
      docsDir: 'docs',

      // Blog content (@docusaurus/plugin-content-blog): emit `.md` URLs that match
      // blog permalinks (routeBasePath + slug), not plain filesystem mirroring.
      blog: [
        {
          path: 'releases',
          exclude: ['archive.md', 'index.md'],
        },
      ],

      // 'button' for a simple copy button, 'dropdown' for a menu
      // with multiple actions (default: 'button')
      widgetType: 'button',

      // CSS selector for the element the widget is injected into
      // (default: 'article .markdown header')
      containerSelector: 'article .markdown header',

      // Label shown on the copy button (default: 'Copy page')
      copyButtonText: 'Copy page',

      // Label shown after a successful copy (default: 'Copied')
      copiedButtonText: 'Copied',

      // When true, trailing-slash URLs fetch intro.md
      // (e.g., /foo/ -> /foo/intro.md). When false, the trailing slash
      // is stripped (e.g., /foo/ -> /foo.md). (default: false)
      supportDirectoryIndex: false,

      // When true, rewrites internal markdown links to fully-qualified
      // .md URLs using the site's configured URL. Makes the raw markdown
      // self-contained for LLMs and external tools. (default: false)
      fullyQualifiedLinks: false,

      // Override the base URL used when fullyQualifiedLinks is enabled.
      // By default the plugin uses context.siteConfig.url + baseUrl
      // from your Docusaurus config. (default: undefined — auto-detected)
      // siteUrl: 'https://example.com/docs',

      // Markdown blockquote prepended to every generated .md file.
      // Satisfies the llms-txt-directive check (afdocs). When set, the
      // plugin also provides a <LlmsDirective /> theme component for
      // placement on any page. (default: null — disabled)
      // directive: '> For the full docs index, see [llms.txt](/llms.txt).\n> Markdown versions of all pages are available by appending .md to any URL.',

      // HTML string injected as a <blockquote class="llms-directive">
      // before the Docusaurus React root via preBodyTags. Ensures agents
      // on the HTML path encounter the directive before navbar/sidebar
      // content. (default: null — disabled)
      // htmlDirective: 'To view this page as Markdown, append `.md` to the URL. For the full docs index, see <a href="/llms.txt">llms.txt</a>.',
    }],
  ],
};
```

### `blog` — match plugin-content-blog URLs

Optional array for Markdown trees served by
**`@docusaurus/plugin-content-blog`**. The cleaning pipeline is the same as for
docs; **only** output paths and fully-qualified link bases follow the
**blog plugin’s URL scheme** (`routeBasePath` + slug from filename rules or
front matter `slug:`), so appending `.md` matches the HTML route.

Root-level **`index.md`** / **`index.mdx`** (the blog list / hub page at
`/{routeBasePath}/`) is written as **`{routeBasePath}.md`** in the build output
(e.g. `releases.md`), matching the usual “strip trailing slash and add `.md`”
behavior.

Each entry:

- **`path`** — folder relative to the site directory (same as the blog plugin
  `path`). Used as the URL **`routeBasePath`** when that option is omitted.
- **`routeBasePath`** — optional URL segment (same meaning as the blog plugin).
  Defaults to **`path`**; set only when the served route prefix differs from the
  source folder (unusual).
- **`exclude`** — optional basenames or relative paths to skip (for example
  `archive.md`).

### Fully-qualified links

When `fullyQualifiedLinks` is enabled, the plugin rewrites all internal
hyperlinks in the generated `.md` files to absolute URLs with `.md` extensions.
This makes the raw markdown useful outside the browser — for example, when an
LLM fetches a `.md` file, every link it encounters will be a fetchable URL
rather than a relative path that only works on the website.

Generated URLs have the form `<siteUrl>/<docPath>.md`, where `<siteUrl>` is
your Docusaurus `url` + `baseUrl` (e.g. `https://example.com/docs`) and
`<docPath>` is the resolved path relative to the docs root. For example, a
relative link `./algorithm/` in `std/index.md` becomes
`https://example.com/docs/std/algorithm.md`.

The plugin handles two kinds of internal links:

- **Relative** (`./algorithm/`, `../types`) — resolved against the current
  file's directory (using `dirname` of the source path), then converted to a
  fully-qualified `.md` URL.
- **Site-root-absolute** (`/docs/roadmap`, `/docs/manual/types#string-literals`)
  — converted directly to a fully-qualified `.md` URL with the fragment
  preserved.

External links (`https://...`), anchor-only links (`#section`), and image
references (both inline `![alt](...)` and reference-style `![alt][ref]`) are
left unchanged.

The base URL defaults to `url` + `baseUrl` from your Docusaurus config. You can
override it with the `siteUrl` option if your production URL differs from the
config.

### LLM directive (llms-txt-directive)

When `directive` is set to a markdown blockquote string, the plugin:

1. **Prepends it to every generated `.md` file** — before fully-qualified link
   processing, so links in the directive (like `/llms.txt`) are also rewritten
   when `fullyQualifiedLinks` is enabled.
2. **Provides a `LlmsDirective` theme component** — a server-rendered
   `<blockquote>` you can place on any page, satisfying the
   [llms-txt-directive](https://afdocs.dev/checks/content-discoverability.html#llms-txt-directive)
   check. For doc pages, swizzle `DocItem/Content` (wrapping mode) and render
   `<LlmsDirective />` before the original content.

Example configuration:

```javascript
directive: '> For the full docs index, see [llms.txt](/llms.txt).\n'
         + '> Markdown versions of all pages are available by appending .md to any URL.',
```

The rendered HTML blockquote has the class `llms-directive` so you can style or
visually hide it with CSS (the spec permits hiding it while keeping it in the
server-rendered HTML for agents).

**Doc pages — swizzle `DocItem/Content`:**

```jsx
// src/theme/DocItem/Content/index.js
import React from 'react';
import Content from '@theme-original/DocItem/Content';
import LlmsDirective from '@theme/LlmsDirective';

export default function ContentWrapper(props) {
  return (
    <>
      <LlmsDirective />
      <Content {...props} />
    </>
  );
}
```

**Non-doc pages — import the component directly:**

```jsx
import LlmsDirective from '@theme/LlmsDirective';

export default function HomePage() {
  return (
    <Layout>
      <LlmsDirective />
      {/* ... */}
    </Layout>
  );
}
```

When `directive` is not configured, the component renders nothing.

### Early HTML directive (`htmlDirective`)

The `directive` option places the blockquote inside each page's `<main>`
content area, which works well for the `.md` path. However, on the HTML path,
Docusaurus renders a navbar and sidebar before `<main>`, so agents using
Turndown (HTML-to-markdown conversion) may not reach the directive until deep
into the output.

The `htmlDirective` option solves this by injecting the directive as the very
first element in `<body>`, before the Docusaurus React root. It uses the
Docusaurus `injectHtmlTags` lifecycle with `preBodyTags`, so no component
swizzling or DOM reordering is needed.

```javascript
['docusaurus-markdown-source-plugin', {
  // Markdown directive for .md files (existing)
  directive: '> For the full docs index, see [llms.txt](/llms.txt).\n'
           + '> Markdown versions available by appending .md to any URL.',

  // HTML directive injected before <body> content (new)
  htmlDirective:
    'To view this page as Markdown, append `.md` to the URL. '
    + 'For the complete documentation index, see '
    + '<a href="/llms.txt">llms.txt</a>.',
}]
```

The injected element is a `<blockquote class="llms-directive">`, so the same
CSS that hides the in-page directive (e.g. `clip-path: inset(50%)`) applies
here too.

When `htmlDirective` is not configured, nothing is injected.

### Custom icons

The plugin uses theme components for icons, which can be overridden in your
site's `src/theme/` directory:

**Override the copy icon:**

Create `src/theme/MarkdownCopyIcon/index.js`:

```javascript
import React from 'react';
import IconCopy from '@theme/Icon/Copy';

export default function MarkdownCopyIcon({ size = 16, style }) {
  return <IconCopy style={{ width: size, height: size, ...style }} />;
}
```

**Override the success/check icon:**

Create `src/theme/MarkdownCheckIcon/index.js`:

```javascript
import React from 'react';
import IconSuccess from '@theme/Icon/Success';

export default function MarkdownCheckIcon({ size = 16, style }) {
  return <IconSuccess style={{ width: size, height: size, ...style }} />;
}
```

This allows you to use your site's existing icon components or any custom SVG
icons.

### Stylesheet

You'll want to customize this yourself, but here's some CSS to get the button
or drop-down in the page header looking good.

Whether you're using the button or drop-down, add these styles to your
`src/css/custom.css` to set the layout position:

```css
/* Style the article header as flexbox */
article .markdown header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  overflow: visible;
}

/* Allow h1 to grow and take available space */
article .markdown header h1 {
  flex: 1 1 auto;
  margin: 0;
}

/* Container for the markdown actions dropdown */
.markdown-actions-container {
  flex-shrink: 0;
  margin-left: auto;
  position: relative;
}

/* Ensure dropdown wrapper has proper positioning */
.markdown-actions-container .dropdown {
  position: relative;
}
```

Then, if you're using the default button, add this:

```css
.markdown-actions-container {
  display: inline-flex;
  align-items: center;
}

.markdown-actions-container .markdown-copy-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background-color: transparent;
  border: none;
  padding: 0;
  font-size: 0.875rem;
  cursor: pointer;
  color: var(--ifm-color-emphasis-600);
}

.markdown-actions-container .markdown-copy-button:hover {
  color: var(--ifm-color-emphasis-900);
}

.markdown-actions-container .markdown-copy-button svg {
  fill: currentColor;
}
```

Or if you set `widgetType: 'dropdown'`, add these styles:

```css
/* Base dropdown menu styles */
.markdown-actions-container .dropdown__menu {
  z-index: 1000;
  min-width: 220px;
  right: auto;
  left: 0;
}

/* Add hover effect for dropdown items */
.dropdown__link:hover {
  background-color: var(--ifm-hover-overlay);
}

/* Responsive adjustments for mobile */
@media (max-width: 768px) {
  .markdown-actions-container {
    margin-right: clamp(0px, 0.5rem, 1rem);
    margin-bottom: 1rem;
  }

  .markdown-actions-container .button {
    font-size: 0.875rem;
    padding: 0.375rem 0.75rem;
  }

  /* Right-align menu on mobile to prevent cutoff */
  .markdown-actions-container .dropdown__menu {
    right: 0;
    left: auto;
    min-width: min(220px, calc(100vw - 2rem));
    max-width: calc(100vw - 2rem);
    padding-bottom: 0.75rem;
  }
}

/* RTL language support */
[dir="rtl"] .markdown-actions-container {
  margin-left: 0;
  margin-right: auto;
}

[dir="rtl"] .markdown-actions-container .dropdown__menu {
  right: auto;
  left: 0;
}

@media (max-width: 768px) {
  [dir="rtl"] .markdown-actions-container .dropdown__menu {
    left: 0;
    right: auto;
  }
}
```

## Read more

For more information, see the
[original repo at FlyNumber/markdown_docusaurus_plugin](https://github.com/FlyNumber/markdown_docusaurus_plugin)
