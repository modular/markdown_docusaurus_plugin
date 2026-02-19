# Docusaurus Markdown Source Plugin

A lightweight Docusaurus plugin that exposes your Markdown files as raw `.md`
URLs and adds a button (or drop-down widget) to each page so users can copy the
Markdown file to their clipboard.

> [!NOTE]
> This project is not packaged and distributed on npm.
> This is a fork of [markdown_docusaurus_plugin by FlyNumber](https://github.com/FlyNumber/markdown_docusaurus_plugin)
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
  - Select the widget type, either original drop-down or new button
  - Specify the DOM element where you want to inject the button/drop-down
    as a CSS selector (default is the page header)
  - Specify the button text
  - Specify the button/widget icons

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
    }],
  ],
};
```

### Custom icons

The plugin uses theme components for icons, which can be overridden in your site's `src/theme/` directory:

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

This allows you to use your site's existing icon components or any custom SVG icons.

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

For more information, see the [original repo at
FlyNumber/markdown_docusaurus_plugin](https://github.com/FlyNumber/markdown_docusaurus_plugin)
