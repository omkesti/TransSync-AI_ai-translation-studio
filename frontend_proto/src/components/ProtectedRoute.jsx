/**
 * ProtectedRoute.jsx
 * ──────────────────
 * Wraps routes that require authentication.
 * - Shows a loading spinner while the auth session is being checked.
 * - Redirects to /login if the user is not authenticated.
 * - Renders children if authenticated.
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0e0e0e] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-primary-container border-t-transparent rounded-full animate-spin" />
          <p className="text-[#8c8c8b] text-sm font-sans tracking-wide">
            Checking session…
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
