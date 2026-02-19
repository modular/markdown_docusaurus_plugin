/**
 * theme/Root.js - Plugin-provided theme component
 * 
 * This component wraps the entire Docusaurus app and injects the markdown
 * copy widget into article headers. It uses DOM injection via createRoot
 * rather than theme swizzling to avoid requiring user configuration.
 * 
 * Note: Components rendered via createRoot are outside the main React tree,
 * so hooks like usePluginData won't work directly in child components.
 * Config must be passed as props.
 */
import React, { useEffect } from 'react';
import { useLocation } from '@docusaurus/router';
import { usePluginData } from '@docusaurus/useGlobalData';
import { createRoot } from 'react-dom/client';
import MarkdownCopyButton from '../components/MarkdownCopyButton';
import MarkdownActionsDropdown from '../components/MarkdownActionsDropdown';

export default function Root({ children }) {
  const { hash, pathname } = useLocation();
  
  // Read config from globalData with fallback for backwards compatibility
  const pluginData = usePluginData('markdown-source-plugin') ?? {};
  const docsPath = pluginData.docsPath || '/docs/';
  const widgetType = pluginData.widgetType || 'button';
  const containerSelector = pluginData.containerSelector || 'article .markdown header';
  const copyButtonText = pluginData.copyButtonText || 'Copy page';
  const copiedButtonText = pluginData.copiedButtonText || 'Copied';
  const supportDirectoryIndex = pluginData.supportDirectoryIndex || false;

  // Scroll to hash on page load (handles deep links)
  useEffect(() => {
    if (hash) {
      const scrollToElement = () => {
        const id = decodeURIComponent(hash.substring(1));
        const element = document.getElementById(id);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
          return true;
        }
        return false;
      };

      if (!scrollToElement()) {
        const timeouts = [100, 300, 500, 1000];
        timeouts.forEach(delay => {
          setTimeout(scrollToElement, delay);
        });
        window.addEventListener('load', scrollToElement, { once: true });
      }
    }
  }, [hash]);

  // Inject widget into target container
  useEffect(() => {
    const injectWidget = () => {
      // Only inject on docs pages
      if (!pathname.startsWith(docsPath)) return;

      const targetContainer = document.querySelector(containerSelector);
      if (!targetContainer) return;

      // Check if already injected
      if (targetContainer.querySelector('.markdown-actions-container')) return;

      // Create container for the widget
      const container = document.createElement('div');
      container.className = 'markdown-actions-container';
      targetContainer.appendChild(container);

      // Select component based on widgetType config
      const WidgetComponent = widgetType === 'dropdown' 
        ? MarkdownActionsDropdown 
        : MarkdownCopyButton;

      // Render React component into container
      // Pass config as props since component is outside Docusaurus React tree
      const root = createRoot(container);
      root.render(
        <WidgetComponent 
          docsPath={docsPath} 
          copyButtonText={copyButtonText}
          copiedButtonText={copiedButtonText}
          supportDirectoryIndex={supportDirectoryIndex}
        />
      );
    };

    // Try to inject after short delays to ensure DOM is ready
    const timeouts = [0, 100, 300];
    timeouts.forEach(delay => {
      setTimeout(injectWidget, delay);
    });
  }, [pathname, docsPath, widgetType, containerSelector, copyButtonText, copiedButtonText, supportDirectoryIndex]);

  return <>{children}</>;
}
