/**
 * AuthContext.jsx
 * ───────────────
 * Provides auth state to the entire app:
 *   - user, session, org, role, loading
 *   - signIn(), signOut()
 *   - accessToken for api.js
 *
 * Uses supabase.auth.onAuthStateChange() to stay in sync.
 * After session is established, fetches org + role from memberships table.
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import supabase from '../lib/supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [org, setOrg] = useState(null);       // { id, name, slug }
  const [role, setRole] = useState(null);      // "owner" | "admin" | "translator" | "reviewer" | "viewer"
  const [displayName, setDisplayName] = useState('User'); // editable on the Profile page
  const [loading, setLoading] = useState(true);

  // ── Fetch org + role from backend ────────────────────────────────────────
  const fetchMembership = useCallback(async (accessToken) => {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        console.warn('[auth] Failed to fetch membership from backend:', response.status);
        setOrg(null);
        setRole(null);
        return;
      }

      const data = await response.json();
      setRole(data.role);
      setOrg(data.organizations || { id: data.org_id, name: 'Unknown', slug: '' });
      setDisplayName(data.display_name || 'User');
    } catch (err) {
      console.error('[auth] Failed to fetch membership:', err);
      setOrg(null);
      setRole(null);
    }
  }, []);

  // Re-fetch membership (role/org/display_name) — e.g. after a profile edit.
  const refreshProfile = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (token) await fetchMembership(token);
  }, [fetchMembership]);

  // ── Listen to auth state changes ─────────────────────────────────────────
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user ?? null);

      if (initialSession?.user && initialSession?.access_token) {
        fetchMembership(initialSession.access_token).then(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // Subscribe to changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user && newSession?.access_token) {
          await fetchMembership(newSession.access_token);
        } else {
          setOrg(null);
          setRole(null);
          setDisplayName('User');
        }

        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchMembership]);

  // ── Auth actions ─────────────────────────────────────────────────────────
  const signIn = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  }, []);

  const signUp = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) throw error;
    return data;
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
    setSession(null);
    setOrg(null);
    setRole(null);
    setDisplayName('User');
  }, []);

  const resetPassword = useCallback(async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  }, []);

  // ── Derived values ───────────────────────────────────────────────────────
  const accessToken = session?.access_token ?? null;

  const value = useMemo(
    () => ({
      user,
      session,
      org,
      role,
      displayName,
      loading,
      accessToken,
      signIn,
      signUp,
      signOut,
      resetPassword,
      refreshProfile,
    }),
    [user, session, org, role, displayName, loading, accessToken, signIn, signUp, signOut, resetPassword, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
