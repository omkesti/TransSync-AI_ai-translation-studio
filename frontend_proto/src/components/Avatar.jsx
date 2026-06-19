/**
 * Avatar.jsx
 * ──────────
 * The single source of truth for the user's profile picture across the app.
 * Rendering both the navbar avatar and the sidebar avatar through this one
 * component guarantees they always match (feature requirement #2).
 *
 * It derives initials from the display name when set (and not the default
 * "User"), otherwise from the email — so it stays meaningful before the user
 * has chosen a name.
 */

import React from 'react';

export function initialsFor(name, email) {
  const trimmed = (name || '').trim();
  const usable = trimmed && trimmed.toLowerCase() !== 'user' ? trimmed : (email || '').trim();
  if (!usable) return '?';
  const parts = usable.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return usable.charAt(0).toUpperCase();
}

export default function Avatar({ name, email, size = 36, className = '' }) {
  const initials = initialsFor(name, email);
  return (
    <div
      className={`rounded-full bg-[var(--tk-accent-surface)] flex items-center justify-center flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
      aria-label={name || email || 'User avatar'}
    >
      <span
        className="text-[var(--tk-accent-text)] font-bold leading-none"
        style={{ fontSize: Math.round(size * 0.4) }}
      >
        {initials}
      </span>
    </div>
  );
}
