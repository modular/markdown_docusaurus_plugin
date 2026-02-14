import React, { useState, useRef, useEffect } from 'react';
import useMarkdownCopy from '../hooks/useMarkdownCopy';
import { CopyIcon, CheckIcon, ChevronDownIcon, ExternalLinkIcon } from '../icons';

/**
 * Dropdown component with multiple markdown actions
 * Provides options to view markdown in new tab or copy to clipboard
 * 
 * @param {Object} props
 * @param {string} props.docsPath - Base path for docs pages (default: '/docs/')
 */
export default function MarkdownActionsDropdown({ docsPath = '/docs/' }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  
  const { 
    copied, 
    isDocsPage, 
    copyMarkdown, 
    openMarkdown 
  } = useMarkdownCopy(docsPath);

  // Handle click outside to close dropdown
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Don't render on non-docs pages
  if (!isDocsPage) {
    return null;
  }

  const handleOpenMarkdown = () => {
    openMarkdown();
    setIsOpen(false);
  };

  const handleCopyMarkdown = async () => {
    await copyMarkdown();
    // Close dropdown after a short delay to show the "Copied" state
    setTimeout(() => setIsOpen(false), 1500);
  };

  return (
    <div
      ref={dropdownRef}
      className={`dropdown ${isOpen ? 'dropdown--show' : ''}`}
    >
      <button
        className="button button--secondary button--sm markdown-copy-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <CopyIcon size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
        Copy page
        <ChevronDownIcon size={12} style={{ marginLeft: '6px', verticalAlign: 'middle' }} />
      </button>

      <ul className="dropdown__menu">
        <li>
          <button
            className="dropdown__link"
            onClick={handleOpenMarkdown}
            style={{ 
              cursor: 'pointer', 
              border: 'none', 
              background: 'none', 
              width: '100%', 
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <ExternalLinkIcon size={16} style={{ marginRight: '8px' }} />
            View as Markdown
          </button>
        </li>
        <li>
          <button
            className="dropdown__link"
            onClick={handleCopyMarkdown}
            disabled={copied}
            style={{ 
              cursor: 'pointer', 
              border: 'none', 
              background: 'none', 
              width: '100%', 
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            {copied ? (
              <>
                <CheckIcon size={16} style={{ marginRight: '8px' }} />
                Copied!
              </>
            ) : (
              <>
                <CopyIcon size={16} style={{ marginRight: '8px' }} />
                Copy Page as Markdown
              </>
            )}
          </button>
        </li>
      </ul>
    </div>
  );
}
