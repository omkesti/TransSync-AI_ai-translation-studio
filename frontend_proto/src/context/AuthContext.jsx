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
  const [loading, setLoading] = useState(true);

  // ── Fetch org + role from memberships ────────────────────────────────────
  const fetchMembership = useCallback(async (userId) => {
    try {
      const { data, error } = await supabase
        .from('memberships')
        .select('org_id, role, organizations(id, name, slug)')
        .eq('user_id', userId)
        .limit(1)
        .single();

      if (error || !data) {
        console.warn('[auth] No membership found for user:', userId);
        setOrg(null);
        setRole(null);
        return;
      }

      setRole(data.role);
      setOrg(data.organizations || { id: data.org_id, name: 'Unknown', slug: '' });
    } catch (err) {
      console.error('[auth] Failed to fetch membership:', err);
      setOrg(null);
      setRole(null);
    }
  }, []);

  // ── Listen to auth state changes ─────────────────────────────────────────
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user ?? null);

      if (initialSession?.user) {
        fetchMembership(initialSession.user.id).then(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // Subscribe to changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          await fetchMembership(newSession.user.id);
        } else {
          setOrg(null);
          setRole(null);
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
      loading,
      accessToken,
      signIn,
      signUp,
      signOut,
      resetPassword,
    }),
    [user, session, org, role, loading, accessToken, signIn, signUp, signOut, resetPassword]
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
