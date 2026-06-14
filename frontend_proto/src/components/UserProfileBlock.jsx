/**
 * UserProfileBlock.jsx
 * ────────────────────
 * Reusable user profile block for page sidebars.
 * Shows: initials avatar, email, role badge, sign-out button.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut } from 'lucide-react';

const ROLE_COLORS = {
  owner:      'bg-amber-500/20 text-amber-400',
  admin:      'bg-purple-500/20 text-purple-400',
  translator: 'bg-blue-500/20 text-blue-400',
  reviewer:   'bg-emerald-500/20 text-emerald-400',
  viewer:     'bg-gray-500/20 text-gray-400',
};

export default function UserProfileBlock() {
  const { user, role, org, signOut } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const email = user.email || '';
  const initials = email.charAt(0).toUpperCase();
  const roleColor = ROLE_COLORS[role] || ROLE_COLORS.viewer;

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (err) {
      console.error('Sign-out failed:', err);
    }
  };

  return (
    <div className="border-t border-[#2a2a2a] pt-4 mt-4">
      {/* Org name */}
      {org?.name && (
        <p className="text-[#555] text-[10px] uppercase tracking-widest font-bold mb-3 truncate">
          {org.name}
        </p>
      )}

      <div className="flex items-center gap-3">
        {/* Initials avatar */}
        <div className="w-9 h-9 rounded-full bg-primary-container/20 flex items-center justify-center flex-shrink-0">
          <span className="text-primary-container text-sm font-bold">{initials}</span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm truncate">{email}</p>
          <span className={`inline-block text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full mt-0.5 ${roleColor}`}>
            {role || 'member'}
          </span>
        </div>

        {/* Sign-out button */}
        <button
          onClick={handleSignOut}
          className="p-2 rounded-lg hover:bg-[#2a2a2a] transition-colors text-[#666] hover:text-red-400 flex-shrink-0"
          title="Sign out"
        >
          <LogOut size={16} />
        </button>
      </div>
    </div>
  );
}
