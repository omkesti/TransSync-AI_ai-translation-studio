/**
 * SettingsMenu.jsx
 * ────────────────
 * The navbar Settings icon. Opens a dropdown containing the appearance
 * (theme) control: a System / Light / Dark segmented toggle.
 *
 * Drop-in replacement for the old static `<Settings />` buttons. Pass
 * `buttonClassName` to match a page's specific icon styling; `align`
 * controls which edge the dropdown anchors to.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Settings, Monitor, Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const OPTIONS = [
  { value: 'system', label: 'System', Icon: Monitor },
  { value: 'light',  label: 'Light',  Icon: Sun },
  { value: 'dark',   label: 'Dark',   Icon: Moon },
];

export default function SettingsMenu({
  buttonClassName = 'text-[var(--tk-text-muted)] hover:text-[var(--tk-text)] transition-colors',
  align = 'right',
}) {
  const { mode, setMode } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative flex items-center">
      <button
        onClick={() => setOpen((v) => !v)}
        className={buttonClassName}
        title="Settings"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Settings size={18} />
      </button>

      {open && (
        <div
          className={`absolute top-full mt-2 w-60 bg-[var(--tk-surface2)] border border-[var(--tk-border)] rounded-2xl shadow-2xl z-50 p-3 ${align === 'right' ? 'right-0' : 'left-0'}`}
        >
          <p className="px-1 pb-2 text-[10px] font-bold uppercase tracking-widest text-[var(--tk-text-faint)]">
            Appearance
          </p>

          <div className="flex gap-1 p-1 bg-[var(--tk-surface4)] rounded-xl">
            {OPTIONS.map(({ value, label, Icon }) => {
              const active = mode === value;
              return (
                <button
                  key={value}
                  onClick={() => setMode(value)}
                  className={`flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-lg text-[11px] font-bold transition-colors ${
                    active
                      ? 'bg-[var(--tk-surface1)] text-[#c5fe00] shadow-sm'
                      : 'text-[var(--tk-text-muted)] hover:text-[var(--tk-text)]'
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
