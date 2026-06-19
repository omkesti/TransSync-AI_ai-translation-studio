/**
 * UserProfileBlock.jsx
 * ────────────────────
 * Sidebar user block. Shows the shared avatar, display name and role (no
 * email). Clicking it opens a dropdown with:
 *   - Profile  → navigates to the Profile page
 *   - Log out  → signs the user out
 */

import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, User, ChevronUp } from 'lucide-react';
import Avatar from './Avatar';

const ROLE_COLORS = {
  owner:      'bg-amber-500/20 text-amber-400',
  admin:      'bg-purple-500/20 text-purple-400',
  translator: 'bg-blue-500/20 text-blue-400',
  reviewer:   'bg-emerald-500/20 text-emerald-400',
  viewer:     'bg-gray-500/20 text-gray-400',
};

export default function UserProfileBlock() {
  const { user, role, org, displayName, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close the dropdown on outside click / Escape.
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

  if (!user) return null;

  const roleColor = ROLE_COLORS[role] || ROLE_COLORS.viewer;

  const handleSignOut = async () => {
    setOpen(false);
    try {
      await signOut();
      navigate('/login');
    } catch (err) {
      console.error('Sign-out failed:', err);
    }
  };

  return (
    <div ref={ref} className="border-t border-[var(--tk-border2)] pt-4 mt-4 relative">
      {/* Org name */}
      {org?.name && (
        <p className="text-[var(--tk-text-faint)] text-[10px] uppercase tracking-widest font-bold mb-3 truncate">
          {org.name}
        </p>
      )}

      {/* Dropdown menu (opens upward, above the trigger) */}
      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-[var(--tk-surface2)] border border-[var(--tk-border2)] rounded-xl shadow-xl overflow-hidden z-30">
          <button
            onClick={() => { setOpen(false); navigate('/profile'); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[var(--tk-text)] hover:bg-[var(--tk-surface3)] hover:text-[var(--tk-text)] transition-colors"
          >
            <User size={16} />
            Profile
          </button>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[var(--tk-text)] hover:bg-[var(--tk-surface3)] hover:text-red-400 transition-colors border-t border-[var(--tk-border2)]"
          >
            <LogOut size={16} />
            Log out
          </button>
        </div>
      )}

      {/* Trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center gap-3 rounded-xl px-1.5 py-1.5 transition-colors ${open ? 'bg-[var(--tk-surface3)]' : 'hover:bg-[var(--tk-surface3)]'}`}
        title="Account"
      >
        <Avatar name={displayName} email={user.email} size={36} />

        <div className="flex-1 min-w-0 text-left">
          <p className="text-[var(--tk-text)] text-sm truncate">{displayName || 'User'}</p>
          <span className={`inline-block text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full mt-0.5 ${roleColor}`}>
            {role || 'member'}
          </span>
        </div>

        <ChevronUp
          size={16}
          className={`text-[var(--tk-text-faint)] flex-shrink-0 transition-transform ${open ? '' : 'rotate-180'}`}
        />
      </button>
    </div>
  );
}
