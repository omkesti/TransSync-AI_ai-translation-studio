/**
 * Logo.jsx
 * ────────
 * The TransSync-AI brand mark. Two assets live in /public:
 *   - variant="full" → name.png    (icon + "TransSync-AI" wordmark)
 *   - variant="icon" → no_name.png (icon only)
 *
 * Both are transparent PNGs, so they sit cleanly on the dark UI. Size via
 * className (e.g. "h-9 w-9 object-contain").
 */

import React from 'react';

export default function Logo({ variant = 'icon', className = '', alt = 'TransSync-AI' }) {
  const src = variant === 'full' ? '/name.png' : '/no_name.png';
  return (
    <img
      src={src}
      alt={alt}
      draggable={false}
      className={`object-contain select-none ${className}`}
    />
  );
}
