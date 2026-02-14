import React from 'react';

/**
 * External link / open in new tab icon
 * @param {Object} props
 * @param {number} props.size - Icon size in pixels (default: 16)
 * @param {Object} props.style - Additional inline styles
 */
export default function ExternalLinkIcon({ size = 16, style = {} }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      style={style}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M3.75 2h3.5a.75.75 0 010 1.5h-3.5a.25.25 0 00-.25.25v8.5c0 .138.112.25.25.25h8.5a.25.25 0 00.25-.25v-3.5a.75.75 0 011.5 0v3.5A1.75 1.75 0 0112.25 14h-8.5A1.75 1.75 0 012 12.25v-8.5C2 2.784 2.784 2 3.75 2z"
      />
      <path
        fill="currentColor"
        d="M9.25 1a.75.75 0 000 1.5h2.94L6.47 8.22a.75.75 0 001.06 1.06l5.72-5.72v2.94a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5z"
      />
    </svg>
  );
}
