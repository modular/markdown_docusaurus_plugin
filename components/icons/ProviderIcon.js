import React from 'react';
import { ICON_PATHS, GENERIC_ICON_PATH } from '../../lib/ai-icons';

/**
 * Brand mark for a built-in AI provider id (see lib/ai-providers.js); custom
 * entries get a generic four-point star. Adapted from upstream's
 * components/MarkdownActionsDropdown/ProviderIcon.js.
 *
 * @param {Object} props
 * @param {string} props.id - Provider id, e.g. 'chatgpt' or 'custom-0'
 * @param {number} props.size - Icon size in pixels (default: 16)
 * @param {Object} props.style - Additional inline styles
 */
export default function ProviderIcon({ id, size = 16, style = {} }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      fillRule="evenodd"
      style={style}
      aria-hidden="true"
    >
      <path d={ICON_PATHS[id] || GENERIC_ICON_PATH} />
    </svg>
  );
}
