import React from 'react';

/**
 * Chevron down icon (dropdown indicator)
 * @param {Object} props
 * @param {number} props.size - Icon size in pixels (default: 12)
 * @param {Object} props.style - Additional inline styles
 */
export default function ChevronDownIcon({ size = 12, style = {} }) {
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
        d="M4.427 6.427l3.396 3.396a.25.25 0 00.354 0l3.396-3.396a.25.25 0 00-.177-.427H4.604a.25.25 0 00-.177.427z"
      />
    </svg>
  );
}
