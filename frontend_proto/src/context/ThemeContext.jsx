/**
 * ThemeContext.jsx
 * ────────────────
 * Light / dark / system theme for the authenticated app.
 *
 * The theme is applied by toggling a `light` / `dark` class on <html>. The
 * actual colors live as CSS variables in index.css (`:root`/`.dark` = dark,
 * `.light` = light), so flipping the class re-themes the whole app.
 *
 * - mode: 'system' | 'light' | 'dark' (persisted in localStorage)
 * - 'system' follows the OS preference and reacts to live changes.
 *
 * The landing page is intentionally NOT themed — it keeps the fixed dark brand
 * palette (it uses the @theme tokens, which this context never overrides).
 */

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';

const ThemeContext = createContext(null);
const STORAGE_KEY = 'transsync-theme';

function prefersLight() {
  return typeof window !== 'undefined'
    && window.matchMedia
    && window.matchMedia('(prefers-color-scheme: light)').matches;
}

function resolveLight(mode) {
  return mode === 'light' || (mode === 'system' && prefersLight());
}

function applyTheme(mode) {
  const root = document.documentElement;
  const light = resolveLight(mode);
  root.classList.toggle('light', light);
  root.classList.toggle('dark', !light);
}

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || 'system';
    } catch {
      return 'system';
    }
  });

  // Apply + persist whenever the mode changes.
  useEffect(() => {
    applyTheme(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* ignore storage failures (private mode, etc.) */
    }
  }, [mode]);

  // While in 'system' mode, react to OS theme changes live.
  useEffect(() => {
    if (mode !== 'system' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const handler = () => applyTheme('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [mode]);

  const value = useMemo(
    () => ({ mode, setMode, isLight: resolveLight(mode) }),
    [mode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
