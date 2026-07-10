const fs = require('fs-extra');
const path = require('path');

/**
 * Docusaurus plugin to copy raw markdown files to build output
 * This allows users to view markdown source by appending .md to URLs
 */

// Helper function to extract attribute value from a tag string
function extractAttribute(tagString, attrName) {
  const regex = new RegExp(`${attrName}=["']([^"']*)["']`);
  const match = tagString.match(regex);
  return match ? match[1] : null;
}

// Convert Tabs/TabItem components to readable markdown format
// Handles both standard <Tabs> and custom tab components like <ModelDropdownTabs>
function convertTabsToMarkdown(content) {
  // Match standard Tabs and any custom component ending in "Tabs"
  const tabsPattern = /<(\w*Tabs)[^>]*>([\s\S]*?)<\/\1>/g;

  const processTabsBlock = (fullMatch, tagName, tabsContent) => {
    // Match TabItem with any attribute order by capturing the entire opening tag
    const tabItemPattern = /<TabItem\s+([^>]*)>([\s\S]*?)<\/TabItem>/g;

    let result = [];
    let match;

    while ((match = tabItemPattern.exec(tabsContent)) !== null) {
      const [, attributes, itemContent] = match;

      // Extract label and value from attributes (works regardless of order)
      const label = extractAttribute(attributes, 'label');
      const value = extractAttribute(attributes, 'value');

      // Use label if available, otherwise fall back to value
      const displayLabel = label || value || 'Tab';

      // Preserve the content as-is (don't strip indentation - it may be meaningful for lists)
      const cleanContent = itemContent.trim();

      result.push(`**${displayLabel}:**\n\n${cleanContent}`);
    }

    return result.join('\n\n---\n\n');
  };

  // Process repeatedly to handle nested tabs (innermost first)
  let previousContent;
  let currentContent = content;

  do {
    previousContent = currentContent;
    currentContent = currentContent.replace(tabsPattern, processTabsBlock);
  } while (currentContent !== previousContent);

  // Clean up any leftover TabItem or Tabs closing tags that weren't matched
  currentContent = currentContent.replace(/<\/TabItem>/g, '');
  currentContent = currentContent.replace(/<\/\w*Tabs>/g, '');

  // Also clean up orphaned opening tags (in case content wasn't properly structured)
  currentContent = currentContent.replace(/<TabItem\s+[^>]*>/g, '');
  currentContent = currentContent.replace(/<\w*Tabs[^>]*>/g, '');

  return currentContent;
}

// Parse JavaScript array objects into an array of key-value objects
function parseArrayObjects(arrayContent) {
  const objects = [];
  const objRegex = /\{([^}]+)\}/g;
  let objMatch;
  while ((objMatch = objRegex.exec(arrayContent)) !== null) {
    const obj = {};
    // Match property: 'value' or property: "value" or property: value (for booleans/numbers)
    const propRegex = /(\w+)\s*:\s*(?:'([^']*)'|"([^"]*)"|([^\s,}]+))/g;
    let propMatch;
    while ((propMatch = propRegex.exec(objMatch[1])) !== null) {
      const key = propMatch[1];
      const value = propMatch[2] || propMatch[3] || propMatch[4];
      // Skip internal properties like 'default: true'
      if (key !== 'default') {
        obj[key] = value;
      }
    }
    if (Object.keys(obj).length > 0) objects.push(obj);
  }
  return objects;
}

// Find the end of an export statement starting at the given position,
// properly tracking nested {}/[] so we don't stop at inner braces.
function findExportEnd(content, startIdx) {
  let i = startIdx;
  let depth = 0;
  let inString = false;
  let stringChar = '';

  while (i < content.length) {
    const ch = content[i];

    if (inString) {
      if (ch === '\\') { i += 2; continue; }
      if (ch === stringChar) inString = false;
      i++;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      inString = true;
      stringChar = ch;
    } else if (ch === '{' || ch === '[' || ch === '(') {
      depth++;
    } else if (ch === '}' || ch === ']' || ch === ')') {
      depth--;
      if (depth <= 0) {
        i++;
        if (i < content.length && content[i] === ';') i++;
        return i;
      }
    } else if (depth === 0 && ch === ';') {
      return i + 1;
    }

    i++;
  }
  return i;
}

// Convert JavaScript export const arrays to readable markdown bullet lists
// Arrays of objects are converted to lists; other exports are removed
function convertExportsToMarkdown(content) {
  // First, convert array exports that contain objects to bullet lists
  content = content.replace(
    /export\s+const\s+(\w+)\s*=\s*\[([\s\S]*?)\]\s*;?/g,
    (match, varName, arrayContent) => {
      const items = parseArrayObjects(arrayContent);
      if (items.length === 0) return '';

      let md = `**${varName}:**\n\n`;
      items.forEach(obj => {
        const pairs = Object.entries(obj)
          .map(([k, v]) => `**${k}:** ${v}`)
          .join(', ');
        md += `- ${pairs}\n`;
      });
      return md + '\n';
    }
  );

  // Remove all remaining export const statements, tracking nested {}/[] depth
  const exportPattern = /^export\s+const\s+\w+\s*=\s*/gm;
  let match;
  const regions = [];
  while ((match = exportPattern.exec(content)) !== null) {
    const valueStart = match.index + match[0].length;
    const end = findExportEnd(content, valueStart);
    regions.push([match.index, end]);
  }
  for (let i = regions.length - 1; i >= 0; i--) {
    content = content.slice(0, regions[i][0]) + content.slice(regions[i][1]);
  }

  return content;
}

// Convert DynamicCode components to fenced code blocks
function convertDynamicCodeToMarkdown(content) {
  // Match <DynamicCode language="sh" ...>{`...`}</DynamicCode>
  // Also capture any leading whitespace so we can remove it
  return content.replace(
    /^[ \t]*<DynamicCode\s+language="([^"]+)"[^>]*>([\s\S]*?)<\/DynamicCode>/gim,
    (match, language, code) => {
      // Clean up the code content:
      // 1. Remove outer { and } (JSX expression wrapper)
      // 2. Remove backticks (template literal)
      // 3. Normalize indentation
      let cleanCode = code.trim();

      // Remove leading { and trailing }
      cleanCode = cleanCode.replace(/^\s*\{\s*/, '').replace(/\s*\}\s*$/, '');

      // Remove backticks (template literal delimiters)
      cleanCode = cleanCode.replace(/^`/, '').replace(/`$/, '');

      // Normalize indentation: find minimum indent and remove it from all lines
      const lines = cleanCode.split('\n');
      const nonEmptyLines = lines.filter(line => line.trim().length > 0);
      if (nonEmptyLines.length > 0) {
        const minIndent = Math.min(...nonEmptyLines.map(line => {
          const match = line.match(/^(\s*)/);
          return match ? match[1].length : 0;
        }));
        if (minIndent > 0) {
          cleanCode = lines.map(line => line.slice(minIndent)).join('\n');
        }
      }

      cleanCode = cleanCode.trim();
      return '```' + language + '\n' + cleanCode + '\n```';
    }
  );
}

// Convert ConditionalContent components to labeled markdown sections
function convertConditionalContentToMarkdown(content) {
  // Match <ConditionalContent ... condition={(model) => model.includes('Value')} > ... </ConditionalContent>
  const pattern = /<ConditionalContent(?:[^>{]|\{[^}]*\})*>\s*([\s\S]*?)<\/ConditionalContent>/gi;

  return content.replace(pattern, (match, innerContent) => {
    // Extract the condition value from the tag (e.g., 'Llama' from model.includes('Llama'))
    const conditionMatch = match.match(/\.includes\s*\(\s*['"]([^'"]+)['"]\s*\)/);

    if (conditionMatch) {
      const conditionValue = conditionMatch[1];
      // Clean up the inner content
      const cleanContent = innerContent.trim();
      return `**${conditionValue} model:**\n\n${cleanContent}\n`;
    }

    // If no condition found, just return the inner content
    return innerContent.trim();
  });
}

// Convert Requirements component to a markdown link using the url attribute
function convertRequirementsToMarkdown(content) {
  // Match <Requirements ... url="..." /> (self-closing)
  // Handle multiline and various attribute orders
  return content.replace(
    /<Requirements(?:[^>]*?)url="([^"]+)"[^>]*?\/?>/gi,
    (match, url) => {
      return `[Read the requirements](${url})`;
    }
  );
}

// Temporarily replace fenced code blocks so downstream regexes cannot corrupt them.
// The step-9 JSX stripper matches /<[A-Z].../ and treats heredoc markers like
// `<<EOF` as component tags (<EOF ...>) because `[A-Z]` matches the E in EOF.
// It then deletes everything until the next self-closing JSX tag (e.g.
// `<InstallOpenAI />`), leaving an unclosed ``` fence in the emitted .md file.
function protectFencedCodeBlocks(content) {
  const blocks = [];
  const protectedContent = content.replace(
    /(^|\n)(```[\s\S]*?\n```)/g,
    (match, prefix, block) => {
      const token = `\n__FENCE_${blocks.length}__\n`;
      blocks.push(block);
      return prefix + token;
    }
  );
  return { content: protectedContent, blocks };
}

function restoreFencedCodeBlocks(content, blocks) {
  blocks.forEach((block, index) => {
    content = content.replace(`__FENCE_${index}__`, block.trim());
  });
  return content;
}

// Convert Docusaurus CodeBlock components to fenced code blocks
function convertCodeBlockToMarkdown(content, substitutions = {}) {
  content = content.replace(
    /<CodeBlock\s+language="([^"]+)"(?:\s+title="([^"]*)")?\s*>\s*\{`([\s\S]*?)`\}\s*<\/CodeBlock>/g,
    (match, language, title, code) => {
      let cleanCode = code;
      for (const [key, value] of Object.entries(substitutions)) {
        cleanCode = cleanCode.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
      }
      const opener = title
        ? '```' + language + ' title="' + title + '"'
        : '```' + language;
      return opener + '\n' + cleanCode + '\n```';
    }
  );
  return content.replace(
    /<CodeBlock\s+language="([^"]+)"[^>]*>\s*\n?\s*([^<{][\s\S]*?)\s*<\/CodeBlock>/g,
    (match, language, code) => '```' + language + '\n' + code.trim() + '\n```'
  );
}

// Include both nightly and stable branches so agents see all install paths
function convertConditionalVersionDocsToMarkdown(content) {
  content = content.replace(
    /<ConditionalVersionDocs\s+version="nightly">\s*([\s\S]*?)<\/ConditionalVersionDocs>/gi,
    (match, inner) => '**Nightly:**\n\n' + inner.trim() + '\n\n'
  );
  return content.replace(
    /<ConditionalVersionDocs\s+version="stable">\s*([\s\S]*?)<\/ConditionalVersionDocs>/gi,
    (match, inner) => '**Stable:**\n\n' + inner.trim() + '\n\n'
  );
}

function convertAdmonitionToMarkdown(content) {
  return content.replace(
    /<Admonition\s+type="([^"]+)">\s*([\s\S]*?)<\/Admonition>/g,
    (match, type, inner) => {
      const cleanInner = inner
        .replace(/<p>/g, '')
        .replace(/<\/p>/g, '\n')
        .replace(/<b>([^<]*)<\/b>/g, '**$1**')
        .replace(/<code>([^<]*)<\/code>/g, '`$1`')
        .replace(/<[^>]+>/g, '')
        .trim();
      return '> **' + type + ':** ' + cleanInner + '\n';
    }
  );
}

function convertFigureToMarkdown(content, fileDir, imgUrlBase) {
  return content.replace(
    /<figure>\s*<img src=\{require\(['"]([^'"]+)['"]\)\.default\}[^>]*alt="([^"]*)"[^>]*\/>\s*<figcaption>([\s\S]*?)<\/figcaption>\s*<\/figure>/g,
    (match, imagePath, alt, caption) => {
      const relativePath = imagePath.replace(/^\.\//, '');
      const normalizedBase = imgUrlBase.endsWith('/') ? imgUrlBase : imgUrlBase + '/';
      const imageUrl = normalizedBase + fileDir + relativePath;
      const cleanCaption = caption.replace(/<\/?b>/g, '**').replace(/<\/?strong>/g, '**');
      return '![' + alt + '](' + imageUrl + ')\n\n*' + cleanCaption + '*';
    }
  );
}

function extractIncludeComponentBody(includeContent) {
  let body = includeContent.replace(/^import[\s\S]*?(?=^export default)/m, '');
  const returnMatch = body.match(/return\s*\(\s*([\s\S]*)\s*\)\s*;\s*\}\s*$/);
  return returnMatch ? returnMatch[1] : body;
}

function processIncludeTemplate(includeContent, substitutions) {
  let body = extractIncludeComponentBody(includeContent);
  body = body.replace(/const tooltipNightly[\s\S]*?;\s*/g, '');
  body = body.replace(/const tooltipStable[\s\S]*?;\s*/g, '');
  body = body.replace(/\(\{tooltipNightly\}\)/g, '(nightly)');
  body = body.replace(/\(\{tooltipStable\}\)/g, '(stable)');
  body = body.replace(/<Tooltip[\s\S]*?\/>/g, '');
  for (const [key, value] of Object.entries(substitutions)) {
    body = body.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
  }
  body = convertConditionalVersionDocsToMarkdown(body);
  body = convertCodeBlockToMarkdown(body, substitutions);
  body = convertAdmonitionToMarkdown(body);
  body = body.replace(/<Link to="([^"]+)">([\s\S]*?)<\/Link>/g, '[$2]($1)');
  body = body.replace(/<a\s+href="([^"]+)"><code>([^<]*)<\/code><\/a>/g, '[`$2`]($1)');
  body = removeDivTags(body);
  body = convertTabsToMarkdown(body);
  body = body.replace(/<[^>]+>/g, '');
  return body.trim();
}

function convertInstallModularToMarkdown(content, pluginContext) {
  if (!pluginContext) return content;
  const includeTemplate = pluginContext.includeTemplates?.['install-modular'];
  if (!includeTemplate) return content;

  return content.replace(/<InstallModular\s+([^>]*?)\/>/gi, (match) => {
    const folder = extractAttribute(match, 'folder') || 'example-project';
    const extraMatch = match.match(/extraLibraries=\{(\[[^\]]*\])\}/);
    let extraLibs = [];
    if (extraMatch) {
      try {
        extraLibs = JSON.parse(extraMatch[1].replace(/'/g, '"'));
      } catch (error) {
        extraLibs = [];
      }
    }
    const extraLibsString = extraLibs.length > 0 ? ' ' + extraLibs.join(' ') : '';
    const extraLibsDescription =
      extraLibs.length > 0 ? ' and other required packages' : '';
    return processIncludeTemplate(includeTemplate, {
      folder,
      extraLibsString,
      extraLibsDescription,
    });
  });
}

function convertInstallOpenAIToMarkdown(content, pluginContext) {
  if (!pluginContext) return content;
  const includeTemplate = pluginContext.includeTemplates?.['install-openai'];
  if (!includeTemplate) return content;

  return content.replace(/<InstallOpenAI\s*\/>/gi, () =>
    processIncludeTemplate(includeTemplate, {})
  );
}

// Unwrap MDX components by removing their tags but preserving inner content
function unwrapMdxComponents(content) {
  // List of MDX components to unwrap (keeps growing as we find more)
  // Note: ConditionalContent is handled separately by convertConditionalContentToMarkdown
  // Note: Requirements is handled separately by convertRequirementsToMarkdown
  const components = [
    'ModelSelector',
    'ModelDropdownTabs',
    'InstallModular',
  ];

  for (const comp of components) {
    // Remove opening tags with any attributes
    // Handle JSX expressions in attributes that may contain > inside {...}
    // Pattern: match <Component, then any non->{, or {...} blocks, then >
    content = content.replace(new RegExp(`<${comp}(?:[^>{]|\\{[^}]*\\})*>`, 'gis'), '');
    // Remove closing tags
    content = content.replace(new RegExp(`</${comp}>`, 'gi'), '');
  }
  return content;
}

// Remove div tags while preserving their inner content
function removeDivTags(content) {
  // Remove opening div tags with any attributes (including className, style, etc.)
  content = content.replace(/<div[^>]*>/gi, '');
  // Remove closing div tags
  content = content.replace(/<\/div>/gi, '');
  return content;
}

// Remove MDX/JSX comments {/* ... */}
function removeMdxComments(content) {
  // Match {/* ... */} including multiline comments
  return content.replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
}

// Collapse multiple consecutive blank lines into a single blank line
function collapseBlankLines(content) {
  // Replace 3+ consecutive newlines (2+ blank lines) with just 2 newlines (1 blank line)
  return content.replace(/\n{3,}/g, '\n\n');
}

// Convert details/summary components to readable markdown format
function convertDetailsToMarkdown(content) {
  const detailsPattern = /<details>\s*<summary>(<strong>)?([^<]+)(<\/strong>)?<\/summary>([\s\S]*?)<\/details>/g;

  return content.replace(detailsPattern, (fullMatch, strongOpen, summaryText, strongClose, detailsContent) => {
    // Clean up the details content
    const cleanContent = detailsContent
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n')
      .trim();

    return `### ${summaryText.trim()}\n\n${cleanContent}`;
  });
}

// Extract title from YAML frontmatter
function extractTitleFromFrontmatter(content) {
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (frontmatterMatch) {
    const frontmatter = frontmatterMatch[1];
    // Match title: value (with optional quotes)
    const titleMatch = frontmatter.match(/^title:\s*["']?([^"'\n]+)["']?\s*$/m);
    if (titleMatch) {
      return titleMatch[1].trim();
    }
  }
  return null;
}

// Clean markdown content for raw display - remove MDX/Docusaurus-specific syntax
// `assetBasePath`: URL prefix for rewriting `img/` relative images (defaults to docsPath)
function cleanMarkdownForDisplay(
  content,
  filepath,
  docsPath = '/docs/',
  assetBasePath = undefined,
  pluginContext = undefined
) {
  const imgUrlBase =
    assetBasePath !== undefined ? assetBasePath : docsPath;
  // Get the directory path for this file (relative to docs root)
  const fileDir = filepath.replace(/[^/]*$/, ''); // Remove filename, keep directory

  // Extract title from frontmatter before stripping it
  const title = extractTitleFromFrontmatter(content);

  // 1. Strip YAML front matter (--- at start, content, then ---)
  content = content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');

  // 2. Remove import statements (MDX imports)
  content = content.replace(/^import\s+.*?from\s+['"].*?['"];?\s*$/gm, '');

  // 3. Remove MDX/JSX comments {/* ... */}
  content = removeMdxComments(content);

  // 4. Convert DynamicCode components to fenced code blocks
  content = convertDynamicCodeToMarkdown(content);

  // 4. Convert JavaScript export arrays to readable bullet lists
  content = convertExportsToMarkdown(content);

  // 5. Convert ConditionalContent to labeled sections
  content = convertConditionalContentToMarkdown(content);

  // 6. Convert Requirements component to link
  content = convertRequirementsToMarkdown(content);

  // Expand shared MDX includes into markdown (improves .md/HTML parity for agents)
  content = convertInstallModularToMarkdown(content, pluginContext);
  content = convertInstallOpenAIToMarkdown(content, pluginContext);
  content = convertConditionalVersionDocsToMarkdown(content);
  content = convertCodeBlockToMarkdown(content);
  content = convertAdmonitionToMarkdown(content);

  // Convert Button components with DocLink to markdown links
  content = content.replace(
    /<Button\s+component=\{DocLink\}\s+to=['"]([^'"]+)['"]>\s*([\s\S]*?)\s*<\/Button>/g,
    '[$2]($1)'
  );

  // 7. Unwrap MDX components (remove tags, preserve inner content)
  content = unwrapMdxComponents(content);

  // 7. Remove div tags (preserve inner content)
  content = removeDivTags(content);

  // 7b. Strip <section> tags (preserve inner content, same as div removal)
  content = content.replace(/<section[^>]*>/gi, '');
  content = content.replace(/<\/section>/gi, '');

  // 7c. Convert <b> tags to markdown bold
  content = content.replace(/<b>([^<]*)<\/b>/g, '**$1**');

  // 7d. Remove zero-width spaces (U+200B) used in API reference docs
  content = content.replace(/\u200B/g, '');

  // 7. Convert HTML images to markdown
  // Pattern: <p align="center"><img src={require('./path').default} alt="..." width="..." /></p>
  content = content.replace(
    /<p align="center">\s*\n?\s*<img src=\{require\(['"]([^'"]+)['"]\)\.default\} alt="([^"]*)"(?:\s+width="[^"]*")?\s*\/>\s*\n?\s*<\/p>/g,
    (match, imagePath, alt) => {
      // Clean the path: remove @site/static prefix
      const cleanPath = imagePath.replace('@site/static/', '/');
      return `![${alt}](${cleanPath})`;
    }
  );

  // 4. Convert YouTube iframes to text links
  content = content.replace(
    /<iframe[^>]*src="https:\/\/www\.youtube\.com\/embed\/([a-zA-Z0-9_-]+)[^"]*"[^>]*title="([^"]*)"[^>]*>[\s\S]*?<\/iframe>/g,
    'Watch the video: [$2](https://www.youtube.com/watch?v=$1)'
  );

  // 5. Clean HTML5 video tags - keep HTML but add fallback text
  content = content.replace(
    /<video[^>]*>\s*<source src=["']([^"']+)["'][^>]*>\s*<\/video>/g,
    '<video controls>\n  <source src="$1" type="video/mp4" />\n  <p>Video demonstration: $1</p>\n</video>'
  );

  // 6. Remove <Head> components with structured data (SEO metadata not needed in raw markdown)
  content = content.replace(/<Head>[\s\S]*?<\/Head>/g, '');

  // 7. Convert Tabs/TabItem components to readable markdown (preserve content)
  content = convertTabsToMarkdown(content);

  // 8. Convert details/summary components to readable markdown (preserve content)
  content = convertDetailsToMarkdown(content);

  // Convert figure blocks before stripping remaining JSX components
  content = convertFigureToMarkdown(content, fileDir, imgUrlBase);

  // 9. Remove custom React/MDX components (FAQStructuredData, etc.)
  // Matches both self-closing and paired tags: <Component ... /> or <Component ...>...</Component>
  // This runs AFTER Tabs/details conversion to preserve their content.
  // Fenced code blocks are protected first so heredoc syntax is not corrupted.
  const { content: protectedContent, blocks: fencedBlocks } =
    protectFencedCodeBlocks(content);
  content = protectedContent.replace(
    /<[A-Z][a-zA-Z]*[\s\S]*?(?:\/>|<\/[A-Z][a-zA-Z]*>)/g,
    ''
  );
  content = restoreFencedCodeBlocks(content, fencedBlocks);

  // 10. Convert relative image paths to absolute paths from docs root
  // Matches: ![alt](./img/file.png) or ![alt](img/file.png)
  content = content.replace(
    /!\[([^\]]*)\]\((\.\/)?img\/([^)]+)\)/g,
    (match, alt, relPrefix, filename) => {
      const normalizedBase =
        imgUrlBase.endsWith('/') ? imgUrlBase : `${imgUrlBase}/`;
      return `![${alt}](${normalizedBase}${fileDir}img/${filename})`;
    }
  );

  // 11. Remove any leading blank lines
  content = content.replace(/^\s*\n/, '');

  // 12. Prepend title from frontmatter as H1 heading
  if (title) {
    content = `# ${title}\n\n${content}`;
  }

  // 13. Collapse multiple consecutive blank lines into single blank line
  content = collapseBlankLines(content);

  return content;
}

// Resolve a URL href to a fully-qualified .md URL.
// Handles relative paths (./foo, ../bar), site-root-absolute paths (/docs/foo),
// fragments (#section), and already-qualified URLs (https://...).
// docsPrefix is the URL path prefix where docs are served (e.g. '/docs' or ''),
// used to map site-root-absolute links back to file-space paths.
// extraPathPrefixes: other site-root prefixes (e.g. ['/releases']) for blog routes.
function resolveLink(href, pageUrlDir, siteUrl, docsPrefix, extraPathPrefixes = []) {
  if (!href
    || href.startsWith('http://')
    || href.startsWith('https://')
    || href.startsWith('mailto:')
    || href.startsWith('#')) {
    return null;
  }

  const hashIdx = href.indexOf('#');
  let pathPart = hashIdx >= 0 ? href.slice(0, hashIdx) : href;
  const fragment = hashIdx >= 0 ? href.slice(hashIdx) : '';

  if (!pathPart) return null;

  if (pathPart.startsWith('/')) {
    const prefixes = [];
    if (docsPrefix) prefixes.push(docsPrefix);
    for (const p of extraPathPrefixes) {
      if (p && !prefixes.includes(p)) prefixes.push(p);
    }
    if (prefixes.length > 0) {
      prefixes.sort((a, b) => b.length - a.length);
      let matched = null;
      for (const p of prefixes) {
        if (pathPart === p || pathPart.startsWith(`${p}/`)) {
          matched = p;
          break;
        }
      }
      if (!matched) return null;
      pathPart = pathPart.slice(matched.length) || '/';
      if (!pathPart.startsWith('/')) pathPart = `/${pathPart}`;
    }
  } else {
    // Relative — resolve against the current file's directory
    pathPart = path.posix.join(pageUrlDir, pathPart);
  }

  pathPart = path.posix.normalize(pathPart);

  if (pathPart.endsWith('/') && pathPart.length > 1) {
    pathPart = pathPart.slice(0, -1);
  }

  const ext = path.posix.extname(pathPart);
  if (ext === '.mdx') {
    pathPart = pathPart.slice(0, -4) + '.md';
  } else if (!ext) {
    pathPart += '.md';
  }

  return siteUrl + pathPart + fragment;
}

// Rewrite internal markdown links to fully-qualified .md URLs.
// Matches inline links [text](url) (but not images ![alt](url))
// and reference-style definitions [ref]: url.
function convertLinksToAbsoluteUrls(
  content,
  pageUrlDir,
  siteUrl,
  docsPrefix,
  extraPathPrefixes = []
) {
  // Inline links: [text](url) — negative lookbehind excludes images.
  // Note: links with titles [text](url "title") or nested parentheses in URLs
  // are not supported and will be left as-is or may be corrupted. These patterns
  // are extremely rare in documentation markdown.
  content = content.replace(
    /(?<!!)\[([^\]]*)\]\(([^)]*)\)/g,
    (match, text, href) => {
      const resolved = resolveLink(
        href.trim(),
        pageUrlDir,
        siteUrl,
        docsPrefix,
        extraPathPrefixes
      );
      return resolved ? `[${text}](${resolved})` : match;
    }
  );

  // Collect labels used by image references (![alt][label]) so we skip them
  const imageRefLabels = new Set();
  const imageRefPattern = /!\[[^\]]*\]\[([^\]]+)\]/g;
  let imgMatch;
  while ((imgMatch = imageRefPattern.exec(content)) !== null) {
    imageRefLabels.add(imgMatch[1].toLowerCase());
  }

  // Reference-style link definitions: [ref]: url (skip image labels)
  content = content.replace(
    /^\[([^\]]+)\]:\s+(\S+)$/gm,
    (match, ref, href) => {
      if (imageRefLabels.has(ref.toLowerCase())) return match;
      const resolved = resolveLink(
        href.trim(),
        pageUrlDir,
        siteUrl,
        docsPrefix,
        extraPathPrefixes
      );
      return resolved ? `[${ref}]: ${resolved}` : match;
    }
  );

  return content;
}

// Recursively find all markdown files in a directory (both .md and .mdx)
function findMarkdownFiles(dir, fileList = [], baseDir = dir) {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      findMarkdownFiles(filePath, fileList, baseDir);
    } else if (file.endsWith('.md') || file.endsWith('.mdx')) {
      // Store relative path from base directory
      const relativePath = path.relative(baseDir, filePath);
      fileList.push(relativePath);
    }
  });

  return fileList;
}

/*
 * --- Blog plugin URL scheme (@docusaurus/plugin-content-blog) ---
 * For docs content, emitted `.md` paths typically mirror each source file’s path
 * under docsDir. Exception: `slug: /` in front matter (docs home page) maps to
 * `index.md` or `{docsRouteBase}.md`, matching the HTML route instead of the filename.
 * Blog posts differ: the live URL is baseUrl + routeBasePath + slug, where slug is
 * optional front matter `slug:` or else derived from the filename (including
 * date-based filenames)—not necessarily the same as the file’s relative path on disk.
 * The helpers below only fix output path + pageUrlDir so `.md` URLs match those HTML
 * routes (e.g. `/releases/foo/` ↔ `/releases/foo.md`). Markdown cleaning uses the same
 * pipeline as docs; only routing math differs here.
 *
 * Exception: root-level `index.md` / `index.mdx` backs the blog list route
 * `/{routeBasePath}/`, whose `.md` twin is `/{routeBasePath}.md`, not `.../index.md`.
 */
const DATE_FILENAME_REGEX =
  /^(?<folder>.*)(?<date>\d{4}[-/]\d{1,2}[-/]\d{1,2})[-/]?(?<text>.*?)(?:\/index)?\.mdx?$/;

/** Same filename → slug mapping as plugin-content-blog (`parseBlogFileName`). */
function parseBlogFileName(blogSourceRelative) {
  const dateFilenameMatch = blogSourceRelative.match(DATE_FILENAME_REGEX);
  if (dateFilenameMatch) {
    const { folder, text, date: dateString } = dateFilenameMatch.groups;
    const slugDate = dateString.replace(/-/g, '/');
    const slug = `/${slugDate}/${folder}${text}`;
    return { slug };
  }
  const text = blogSourceRelative.replace(/(?:\/index)?\.mdx?$/, '');
  const slug = `/${text}`;
  return { slug };
}

/** Optional YAML `slug:` override — same source as plugin-content-blog. */
function parseSlugFromFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return undefined;
  const yaml = match[1];
  const slugMatch = yaml.match(/^\s*slug:\s*(.+)$/m);
  if (!slugMatch) return undefined;
  let raw = slugMatch[1].trim();
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    raw = raw.slice(1, -1).trim();
  }
  if (!raw) return undefined;
  return raw;
}

/** Resolves slug exactly like blog posts: front matter wins, else filename rules. */
function resolveBlogPostSlug(blogSourceRelative, fileContent) {
  const fromFm = parseSlugFromFrontmatter(fileContent);
  if (fromFm) {
    return fromFm.startsWith('/') ? fromFm : `/${fromFm}`;
  }
  const posixRel = blogSourceRelative.replace(/\\/g, '/');
  return parseBlogFileName(posixRel).slug;
}

function isBlogMarkdownExcluded(mdRelativePath, excludeList) {
  // Mirrors typical plugin-content-blog `exclude` (basename or relative path).
  if (!excludeList || excludeList.length === 0) return false;
  const norm = mdRelativePath.replace(/\\/g, '/');
  return excludeList.some(
    (pat) => pat === norm || pat === path.basename(mdRelativePath)
  );
}

function assertSafeBlogSlugSegments(slugTrim, mdFile) {
  if (!slugTrim || slugTrim.includes('\\')) {
    throw new Error(`Invalid blog slug for ${mdFile}`);
  }
  for (const seg of slugTrim.split('/')) {
    if (seg === '' || seg === '.' || seg === '..') {
      throw new Error(`Invalid blog slug segment in ${mdFile}: ${slugTrim}`);
    }
  }
}

/** Resolved absolute path inside buildDir, or throws if dest escapes buildDir. */
function resolveSafeDestPath(buildDir, destRelPosix) {
  const parts = String(destRelPosix)
    .replace(/\\/g, '/')
    .split('/')
    .filter((p) => p !== '' && p !== '.');
  if (parts.some((p) => p === '..')) {
    throw new Error(`Unsafe output path: ${destRelPosix}`);
  }
  const resolvedBuild = path.resolve(buildDir);
  const resolvedDest = path.resolve(resolvedBuild, ...parts);
  const rel = path.relative(resolvedBuild, resolvedDest);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`Output path escapes build directory: ${destRelPosix}`);
  }
  return resolvedDest;
}

async function writeProcessedMarkdownToBuild({
  sourcePath,
  mdFileRelativeForCleaning,
  destPath,
  pageUrlDir,
  docsPath,
  assetBasePath,
  directive,
  fullyQualifiedLinks,
  siteUrl,
  docsPrefix,
  extraLinkPrefixes = [],
  fileContent,
  pluginContext,
}) {
  await fs.ensureDir(path.dirname(destPath));
  const content = fileContent ?? (await fs.readFile(sourcePath, 'utf8'));
  let cleanedContent = cleanMarkdownForDisplay(
    content,
    mdFileRelativeForCleaning,
    docsPath,
    assetBasePath,
    pluginContext
  );
  if (directive) {
    cleanedContent = directive + '\n\n' + cleanedContent;
  }
  if (fullyQualifiedLinks) {
    cleanedContent = convertLinksToAbsoluteUrls(
      cleanedContent,
      pageUrlDir,
      siteUrl,
      docsPrefix,
      extraLinkPrefixes
    );
  }
  await fs.writeFile(destPath, cleanedContent, 'utf8');
}

// Copy image directories from docs to build
async function copyImageDirectories(docsDir, buildDir) {
  const imageDirs = [];

  // Recursively find all 'img' directories in docs
  function findImgDirs(dir, baseDir = dir) {
    const files = fs.readdirSync(dir);

    files.forEach((file) => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        if (file === 'img') {
          // Found an img directory, store its relative path
          const relativePath = path.relative(baseDir, dir);
          imageDirs.push({ source: filePath, relativePath });
        } else {
          // Continue searching in subdirectories
          findImgDirs(filePath, baseDir);
        }
      }
    });
  }

  // Find all img directories
  findImgDirs(docsDir);

  // Copy each img directory to build
  let copiedCount = 0;
  for (const { source, relativePath } of imageDirs) {
    const destination = path.join(buildDir, relativePath, 'img');

    try {
      await fs.copy(source, destination);
      const imageCount = fs.readdirSync(source).length;
      console.log(`  ✓ Copied: ${relativePath}/img/ (${imageCount} images)`);
      copiedCount++;
    } catch (error) {
      console.error(`  ✗ Failed to copy ${relativePath}/img/:`, error.message);
    }
  }

  return copiedCount;
}

function markdownSourcePlugin(context, options = {}) {
  // Configurable options with defaults for backwards compatibility
  const docsPath = options.docsPath || '/docs/';
  const docsDirName = options.docsDir || 'docs';
  // Widget type: 'button' (simple copy button) or 'dropdown' (with multiple actions)
  const widgetType = options.widgetType || 'button';
  // CSS selector for where to inject the widget
  const containerSelector = options.containerSelector || 'article .markdown header';
  // Configurable button text
  const copyButtonText = options.copyButtonText || 'Copy page';
  const copiedButtonText = options.copiedButtonText || 'Copied';
  const supportDirectoryIndex = options.supportDirectoryIndex || false;
  const fullyQualifiedLinks = options.fullyQualifiedLinks || false;
  const directive = options.directive || null;
  const htmlDirective = options.htmlDirective || null;
  /**
   * Extra markdown trees served by @docusaurus/plugin-content-blog (see blog plugin
   * `path` / `routeBasePath`). Each entry uses blog slug rules for output paths only.
   * @type {{ path: string; routeBasePath?: string; exclude?: string[] }[]}
   */
  const blog = options.blog || [];

  return {
    name: 'markdown-source-plugin',

    // Provide theme components from the plugin (eliminates need for manual copying)
    getThemePath() {
      return path.resolve(__dirname, './theme');
    },

    // Expose config to client-side via globalData
    async contentLoaded({ actions }) {
      const { setGlobalData } = actions;
      setGlobalData({ docsPath, widgetType, containerSelector, copyButtonText, copiedButtonText, supportDirectoryIndex, directive });
    },

    injectHtmlTags() {
      if (!htmlDirective) return {};
      return {
        preBodyTags: [
          {
            tagName: 'blockquote',
            attributes: { class: 'llms-directive' },
            innerHTML: htmlDirective,
          },
        ],
      };
    },

    async postBuild({ outDir }) {
      const docsDir = path.join(context.siteDir, docsDirName);
      const buildDir = outDir;
      const siteUrl = fullyQualifiedLinks
        ? (options.siteUrl || (context.siteConfig.url + (context.siteConfig.baseUrl || '/'))).replace(/\/$/, '')
        : '';
      // docsPath prefix without trailing slash, used to strip the routing
      // prefix from site-root-absolute links (e.g. '/docs' from '/docs/foo')
      const docsPrefix = fullyQualifiedLinks
        ? docsPath.replace(/\/+$/, '')
        : '';

      const blogLinkPrefixes = [];
      for (const root of blog) {
        const rb = String(root.routeBasePath ?? root.path).replace(/^\/+|\/+$/g, '');
        if (rb && !rb.split('/').some((s) => s === '..')) {
          const pref = `/${rb}`;
          if (!blogLinkPrefixes.includes(pref)) blogLinkPrefixes.push(pref);
        }
      }

      const includeTemplates = {};
      const includesDir = path.join(context.siteDir, docsDirName, '_includes');
      for (const [key, file] of [['install-modular', 'install-modular.mdx'], ['install-openai', 'install-openai.mdx']]) {
        const p = path.join(includesDir, file);
        if (fs.existsSync(p)) {
          includeTemplates[key] = fs.readFileSync(p, 'utf8');
        }
      }

      const pluginContext = {
        siteDir: context.siteDir,
        docsDirName,
        includeTemplates,
      };

      console.log('[markdown-source-plugin] Copying markdown source files...');

      // Find all markdown files in docs directory
      const mdFiles = findMarkdownFiles(docsDir);

      let copiedCount = 0;

      // Process each markdown file to build directory
      for (const mdFile of mdFiles) {
        const sourcePath = path.join(docsDir, mdFile);
        // Convert .mdx to .md for the destination (URLs use .md extension)
        let destFile = mdFile.replace(/\.mdx$/, '.md');

        // When supportDirectoryIndex is off, rewrite index.md to parent path
        // so trailing-slash URLs resolve correctly (e.g., /foo/ -> /foo.md)
        if (!supportDirectoryIndex && path.basename(destFile) === 'index.md') {
          const parentDir = path.dirname(destFile);
          destFile = parentDir === '.' ? 'index.md' : parentDir + '.md';
        }

        const fileDir = path.posix.dirname(mdFile);
        let pageUrlDir = fileDir === '.' ? '/' : '/' + fileDir + '/';

        try {
          const raw = await fs.readFile(sourcePath, 'utf8');

          // Docs home page: slug: / serves index.html, so emit index.md (not the filename)
          if (parseSlugFromFrontmatter(raw) === '/') {
            const docsRouteBase = docsPath.replace(/^\/+|\/+$/g, '');
            destFile = docsRouteBase ? `${docsRouteBase}.md` : 'index.md';
            pageUrlDir = docsRouteBase ? `/${docsRouteBase}/` : '/';
          }

          const destPath = resolveSafeDestPath(buildDir, destFile);

          await writeProcessedMarkdownToBuild({
            sourcePath,
            mdFileRelativeForCleaning: mdFile,
            destPath,
            pageUrlDir,
            docsPath,
            directive,
            fullyQualifiedLinks,
            siteUrl,
            docsPrefix,
            extraLinkPrefixes: blogLinkPrefixes,
            fileContent: raw,
            pluginContext,
          });
          copiedCount++;

          console.log(`  ✓ Processed: ${mdFile} -> ${destFile}`);
        } catch (error) {
          console.error(`  ✗ Failed to process ${mdFile}:`, error.message);
        }
      }

      const docsMdCount = copiedCount;
      console.log(
        `[markdown-source-plugin] Docs: ${docsMdCount} markdown file(s)`
      );

      // Copy image directories from docs
      console.log('[markdown-source-plugin] Copying image directories...');
      let imgDirCount = await copyImageDirectories(docsDir, buildDir);
      console.log(`[markdown-source-plugin] Successfully copied ${imgDirCount} image directories`);

      // Blog instances: emit .md files under routeBasePath using plugin-content-blog slug URLs.
      for (const root of blog) {
        const blogDir = path.join(context.siteDir, root.path);
        // Mirrors plugin-content-blog: omit routeBasePath to use the same segment as `path`.
        const routeBasePath = String(root.routeBasePath ?? root.path).replace(
          /^\/+|\/+$/g,
          ''
        );
        if (
          !routeBasePath ||
          routeBasePath.split('/').some((s) => s === '..' || s === '')
        ) {
          console.warn(
            `[markdown-source-plugin] blog: invalid routeBasePath for ${root.path}, skipping`
          );
          continue;
        }
        const exclude = root.exclude || [];

        if (!(await fs.pathExists(blogDir))) {
          console.warn(
            `[markdown-source-plugin] blog: missing directory ${blogDir}`
          );
          continue;
        }

        console.log(
          `[markdown-source-plugin] Blog (${root.path}) -> /${routeBasePath}/…`
        );

        const blogMdFiles = findMarkdownFiles(blogDir);
        let blogCopied = 0;

        for (const mdFile of blogMdFiles) {
          if (isBlogMarkdownExcluded(mdFile, exclude)) {
            console.log(`  ⊗ Skipped (exclude): ${mdFile}`);
            continue;
          }

          const sourcePath = path.join(blogDir, mdFile);

          try {
            const raw = await fs.readFile(sourcePath, 'utf8');
            const posixMd = mdFile.replace(/\\/g, '/');
            const isBlogListPageSource =
              posixMd === 'index.md' || posixMd === 'index.mdx';

            let destFile;
            let pageUrlDir;
            const mdFileForCleaning = path.posix.join(routeBasePath, posixMd);

            if (isBlogListPageSource) {
              // Blog list URL is /{routeBasePath}/; append-.md convention is /{routeBasePath}.md
              destFile = `${routeBasePath}.md`;
              pageUrlDir = `/${routeBasePath}/`;
            } else {
              // Output path mirrors blog permalink (routeBasePath + slug), not raw fs path.
              const slug = resolveBlogPostSlug(mdFile, raw);
              const slugTrim = slug.startsWith('/') ? slug.slice(1) : slug;
              assertSafeBlogSlugSegments(slugTrim, mdFile);
              destFile = path.posix.normalize(
                path.posix.join(routeBasePath, `${slugTrim}.md`)
              );
              pageUrlDir =
                '/' + path.posix.join(routeBasePath, slugTrim) + '/';
            }

            const destPath = resolveSafeDestPath(buildDir, destFile);
            const blogAssetBase = `/${routeBasePath}/`;
            await writeProcessedMarkdownToBuild({
              sourcePath,
              mdFileRelativeForCleaning: mdFileForCleaning,
              destPath,
              pageUrlDir,
              docsPath,
              assetBasePath: blogAssetBase,
              directive,
              fullyQualifiedLinks,
              siteUrl,
              docsPrefix,
              extraLinkPrefixes: blogLinkPrefixes,
              fileContent: raw,
              pluginContext,
            });
            blogCopied++;
            copiedCount++;
            console.log(`  ✓ Processed blog: ${mdFile} -> ${destFile}`);
          } catch (error) {
            console.error(`  ✗ Failed to process blog file ${mdFile}:`, error.message);
          }
        }

        console.log(
          `[markdown-source-plugin] Blog segment "${root.path}": ${blogCopied} markdown file(s)`
        );

        const blogImgCount = await copyImageDirectories(blogDir, buildDir);
        imgDirCount += blogImgCount;
        if (blogImgCount > 0) {
          console.log(
            `[markdown-source-plugin] Copied ${blogImgCount} image directories under "${root.path}"`
          );
        }
      }

      console.log(
        `[markdown-source-plugin] Total markdown files emitted: ${copiedCount}`
      );
    },
  };
}

module.exports = markdownSourcePlugin;

module.exports._internals = {
  cleanMarkdownForDisplay,
  protectFencedCodeBlocks,
  restoreFencedCodeBlocks,
  convertCodeBlockToMarkdown,
  convertConditionalVersionDocsToMarkdown,
  convertAdmonitionToMarkdown,
  convertFigureToMarkdown,
  convertInstallModularToMarkdown,
  convertInstallOpenAIToMarkdown,
  unwrapMdxComponents,
};
