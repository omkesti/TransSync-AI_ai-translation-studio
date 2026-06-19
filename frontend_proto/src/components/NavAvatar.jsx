/**
 * NavAvatar.jsx
 * ─────────────
 * The navbar profile button, shown on every page. Renders the shared Avatar
 * (so it matches the sidebar) and links to the Profile page on click.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';

export default function NavAvatar() {
  const { user, displayName } = useAuth();

  return (
    <Link
      to="/profile"
      title="Profile"
      className="ml-2 rounded-full ring-2 ring-transparent hover:ring-[#c5fe00]/40 transition-all"
    >
      <Avatar name={displayName} email={user?.email} size={32} />
    </Link>
  );
}
