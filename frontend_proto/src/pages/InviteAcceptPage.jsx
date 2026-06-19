/**
 * InviteAcceptPage.jsx
 * ────────────────────
 * Route: /invite/:token
 *
 * Flow:
 *   1. Read :token from URL params
 *   2. GET /api/auth/accept-invite?token= → get org_name, role, email
 *   3. Show "You're invited to join [OrgName] as [Role]"
 *   4. User enters a password → supabase.auth.signUp()
 *   5. POST /api/auth/accept-invite → backend activates membership
 *   6. Redirect to /dashboard
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

function InviteAcceptPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { signUp } = useAuth();

  // Invite validation state
  const [invite, setInvite] = useState(null);       // { email, role, org_name }
  const [validating, setValidating] = useState(true);
  const [validationError, setValidationError] = useState('');

  // Sign-up form state
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // ── 1. Validate the token on mount ─────────────────────────────────────
  useEffect(() => {
    async function validateToken() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/accept-invite?token=${token}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.detail || 'Invalid or expired invitation.');
        }
        const data = await res.json();
        setInvite(data);
      } catch (err) {
        setValidationError(err.message);
      } finally {
        setValidating(false);
      }
    }
    validateToken();
  }, [token]);

  // ── 2. Handle sign-up + accept ─────────────────────────────────────────
  const handleAccept = async (e) => {
    e.preventDefault();
    setSubmitError('');

    if (password.length < 6) {
      setSubmitError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setSubmitError('Passwords do not match.');
      return;
    }

    setSubmitting(true);

    try {
      // Sign up via Supabase Auth
      const { user } = await signUp(invite.email, password);

      if (!user) {
        throw new Error('Sign-up succeeded but no user returned. Check your email for a confirmation link.');
      }

      // Activate membership via backend
      const res = await fetch(`${API_BASE_URL}/api/auth/accept-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, user_id: user.id }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || 'Failed to activate membership.');
      }

      // Success — navigate to dashboard
      navigate('/dashboard');
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0e0e0e] text-on-surface font-sans selection:bg-primary-container selection:text-background flex flex-col relative overflow-hidden">

      {/* Background Ambient Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary-container/10 blur-[150px] rounded-full z-0 pointer-events-none"></div>

      <main className="flex-1 flex flex-col items-center justify-center p-6 relative z-10 w-full mb-12">

        {/* Logo */}
        <div className="mb-12 text-center">
          <Link to="/" className="inline-block">
            <Logo variant="full" className="h-20 mx-auto" />
          </Link>
          <p className="text-[#a0a09f] text-[10px] uppercase tracking-[0.3em] mt-3">Join Your Team</p>
        </div>

        {/* Card */}
        <div className="bg-[#1a1a1a] p-10 rounded-[32px] w-full max-w-[460px] shadow-[0_40px_80px_rgba(0,0,0,0.6)]">

          {/* Loading */}
          {validating && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="w-10 h-10 border-2 border-primary-container border-t-transparent rounded-full animate-spin" />
              <p className="text-[#8c8c8b] text-sm">Validating invitation…</p>
            </div>
          )}

          {/* Validation Error */}
          {!validating && validationError && (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
                <span className="text-red-400 text-2xl">✕</span>
              </div>
              <h2 className="text-white text-xl font-bold mb-2">Invalid Invitation</h2>
              <p className="text-[#8c8c8b] text-sm mb-6">{validationError}</p>
              <Link
                to="/login"
                className="text-primary-container text-sm font-bold uppercase tracking-wider hover:text-primary transition-colors"
              >
                Go to Login →
              </Link>
            </div>
          )}

          {/* Invite Details + Sign-Up Form */}
          {!validating && invite && (
            <>
              <h1 className="font-display text-[26px] font-bold text-white mb-2 tracking-tight">
                You're invited!
              </h1>
              <p className="text-[#8c8c8b] text-[15px] mb-6 font-sans">
                Join <span className="text-white font-semibold">{invite.org_name}</span> as{' '}
                <span className="text-primary-container font-semibold capitalize">{invite.role}</span>
              </p>

              {/* Pre-filled email */}
              <div className="mb-6 p-3 rounded-[12px] bg-[#222222] border border-[#333]">
                <span className="text-[#8c8c8b] text-xs font-bold uppercase tracking-wider block mb-1">Email</span>
                <span className="text-white text-sm font-sans">{invite.email}</span>
              </div>

              {submitError && (
                <div className="mb-6 p-3 rounded-[12px] bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-sans">
                  {submitError}
                </div>
              )}

              <form onSubmit={handleAccept} className="space-y-5">
                <div className="space-y-2">
                  <label htmlFor="invite-password" className="text-[#8c8c8b] text-xs font-bold uppercase tracking-wider block">
                    Create Password
                  </label>
                  <input
                    id="invite-password"
                    type="password"
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full bg-[#222222] border border-transparent rounded-[12px] px-4 py-3.5 text-white focus:outline-none focus:border-primary-container/50 focus:bg-[#2a2a2a] transition-all placeholder:text-[#555555] font-sans tracking-[0.2em]"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="invite-confirm" className="text-[#8c8c8b] text-xs font-bold uppercase tracking-wider block">
                    Confirm Password
                  </label>
                  <input
                    id="invite-confirm"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full bg-[#222222] border border-transparent rounded-[12px] px-4 py-3.5 text-white focus:outline-none focus:border-primary-container/50 focus:bg-[#2a2a2a] transition-all placeholder:text-[#555555] font-sans tracking-[0.2em]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-primary-container text-[#0a0a0a] font-bold text-base px-6 py-4 rounded-full mt-4 hover:bg-primary transition-colors shadow-[0_0_30px_rgba(197,254,0,0.2)] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-[#0a0a0a] border-t-transparent rounded-full animate-spin" />
                      Creating account…
                    </>
                  ) : (
                    <>Accept & Join <span className="text-lg leading-none">&rarr;</span></>
                  )}
                </button>
              </form>
            </>
          )}
        </div>

      </main>

      <footer className="absolute bottom-6 w-full text-center flex justify-center gap-8 text-[10px] text-[#555555] uppercase tracking-widest font-bold">
        <a href="#" className="hover:text-[#a0a09f] transition-colors">Privacy Policy</a>
        <a href="#" className="hover:text-[#a0a09f] transition-colors">Terms of Service</a>
      </footer>
    </div>
  );
}

export default InviteAcceptPage;
