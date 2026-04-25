import React from 'react';
import { usePluginData } from '@docusaurus/useGlobalData';

function markdownToHtml(md) {
  return md
    .split('\n')
    .map(line => line.replace(/^>\s?/, ''))
    .join(' ')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

export default function LlmsDirective() {
  const { directive } = usePluginData('markdown-source-plugin') ?? {};
  if (!directive) return null;

  return (
    <blockquote
      className="llms-directive"
      dangerouslySetInnerHTML={{ __html: markdownToHtml(directive) }}
    />
  );
}
