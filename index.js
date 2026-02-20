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

// Convert JavaScript export const arrays to readable markdown bullet lists
// Arrays of objects are converted to lists; other exports are removed
function convertExportsToMarkdown(content) {
  // First, convert array exports to bullet lists: export const name = [ ... ];
  content = content.replace(
    /export\s+const\s+(\w+)\s*=\s*\[([\s\S]*?)\];/g,
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

  // Then remove any remaining export statements (objects, functions, etc.)
  // Matches multiline exports: export const name = { ... } (with or without semicolon)
  content = content.replace(/export\s+const\s+\w+\s*=\s*\{[\s\S]*?\}\s*;?/g, '');
  // Matches simple exports: export const name = value;
  content = content.replace(/^export\s+const\s+\w+\s*=\s*[^{\[]*?;\s*$/gm, '');

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

// Unwrap MDX components by removing their tags but preserving inner content
function unwrapMdxComponents(content) {
  // List of MDX components to unwrap (keeps growing as we find more)
  // Note: ConditionalContent is handled separately by convertConditionalContentToMarkdown
  // Note: Requirements is handled separately by convertRequirementsToMarkdown
  const components = [
    'ModelSelector',
    'ModelDropdownTabs',
    'InstallModular'
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
function cleanMarkdownForDisplay(content, filepath, docsPath = '/docs/') {
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

  // 7. Unwrap MDX components (remove tags, preserve inner content)
  content = unwrapMdxComponents(content);

  // 7. Remove div tags (preserve inner content)
  content = removeDivTags(content);

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

  // 9. Remove custom React/MDX components (FAQStructuredData, etc.)
  // Matches both self-closing and paired tags: <Component ... /> or <Component ...>...</Component>
  // This runs AFTER Tabs/details conversion to preserve their content
  content = content.replace(/<[A-Z][a-zA-Z]*[\s\S]*?(?:\/>|<\/[A-Z][a-zA-Z]*>)/g, '');

  // 10. Convert relative image paths to absolute paths from docs root
  // Matches: ![alt](./img/file.png) or ![alt](img/file.png)
  content = content.replace(
    /!\[([^\]]*)\]\((\.\/)?img\/([^)]+)\)/g,
    (match, alt, relPrefix, filename) => {
      // Convert to absolute path using configurable docsPath
      // Ensure docsPath ends with / for proper path joining
      const normalizedDocsPath = docsPath.endsWith('/') ? docsPath : docsPath + '/';
      return `![${alt}](${normalizedDocsPath}${fileDir}img/${filename})`;
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

module.exports = function markdownSourcePlugin(context, options = {}) {
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

  return {
    name: 'markdown-source-plugin',

    // Provide theme components from the plugin (eliminates need for manual copying)
    getThemePath() {
      return path.resolve(__dirname, './theme');
    },

    // Expose config to client-side via globalData
    async contentLoaded({ actions }) {
      const { setGlobalData } = actions;
      setGlobalData({ docsPath, widgetType, containerSelector, copyButtonText, copiedButtonText, supportDirectoryIndex });
    },

    async postBuild({ outDir }) {
      const docsDir = path.join(context.siteDir, docsDirName);
      const buildDir = outDir;

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

        const destPath = path.join(buildDir, destFile);

        try {
          // Ensure destination directory exists
          await fs.ensureDir(path.dirname(destPath));

          // Read the markdown file
          const content = await fs.readFile(sourcePath, 'utf8');

          // Clean markdown for raw display
          const cleanedContent = cleanMarkdownForDisplay(content, mdFile, docsPath);

          // Write the cleaned content
          await fs.writeFile(destPath, cleanedContent, 'utf8');
          copiedCount++;

          console.log(`  ✓ Processed: ${mdFile} -> ${destFile}`);
        } catch (error) {
          console.error(`  ✗ Failed to process ${mdFile}:`, error.message);
        }
      }

      console.log(`[markdown-source-plugin] Successfully copied ${copiedCount} markdown files`);

      // Copy image directories
      console.log('[markdown-source-plugin] Copying image directories...');
      const imgDirCount = await copyImageDirectories(docsDir, buildDir);
      console.log(`[markdown-source-plugin] Successfully copied ${imgDirCount} image directories`);
    },
  };
};
