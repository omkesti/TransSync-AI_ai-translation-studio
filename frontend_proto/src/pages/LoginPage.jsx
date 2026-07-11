import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';

const EASE = [0.22, 1, 0.36, 1];

function LoginPage() {
  const { signIn, resetPassword } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Sign in failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!email) {
      setError('Enter your email address first, then click Forgot Password.');
      return;
    }
    try {
      await resetPassword(email);
      setResetSent(true);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to send reset email.');
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background font-grotesk text-on-surface selection:bg-primary-container selection:text-background">
      <div className="noise-overlay" aria-hidden="true" />
      <div aria-hidden="true" className="dot-grid pointer-events-none absolute inset-0 opacity-[0.05]" />

      {/* Light spill + ambient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_50%_-8%,rgba(255,255,255,0.07),transparent_65%)]"
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-container/[0.06] blur-[150px]"
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Giant ghost wordmark backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center overflow-hidden"
      >
        <span className="text-ghost whitespace-nowrap font-hero text-[16vw] font-black uppercase leading-none tracking-tight opacity-50">
          TransSync
        </span>
      </div>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-16">
        {/* Wordmark */}
        <motion.div
          initial={{ opacity: 0, y: -18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE }}
          className="mb-12 text-center"
        >
          <Link
            to="/"
            className="font-hero text-lg font-bold uppercase tracking-[0.35em] text-on-surface"
          >
            TransSync <span className="text-primary-container">AI</span>
          </Link>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.3em] text-on-surface-variant">
            Document translation, with memory
          </p>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 36 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: EASE, delay: 0.15 }}
          className="w-full max-w-[440px] rounded-[28px] bg-surface-container-low/90 p-10 shadow-[0_60px_120px_-20px_rgba(0,0,0,0.7)] backdrop-blur-md"
        >
          <h1 className="mb-2 text-[30px] leading-tight tracking-tight">
            <span className="font-hero font-black uppercase">Welcome</span>{' '}
            <span className="font-serif italic text-primary-container">back.</span>
          </h1>
          <p className="mb-9 text-sm text-on-surface-variant">
            Enter your credentials to access your studio.
          </p>

          {/* Error message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 rounded-xl bg-error/10 p-3 text-sm text-error"
            >
              {error}
            </motion.div>
          )}

          {/* Reset sent success */}
          {resetSent && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 rounded-xl bg-primary-container/10 p-3 text-sm text-primary-container"
            >
              Password reset email sent. Check your inbox.
            </motion.div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Email Field */}
            <div className="space-y-2">
              <label
                htmlFor="login-email"
                className="block font-mono text-[10px] uppercase tracking-[0.25em] text-on-surface-variant"
              >
                Email address
              </label>
              <input
                id="login-email"
                type="email"
                placeholder="name@transsync.ai"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-xl border border-transparent bg-[#1c1c1c] px-4 py-3.5 text-on-surface transition-all placeholder:text-[#555555] focus:border-primary-container/50 focus:bg-[#222222] focus:outline-none"
              />
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="login-password"
                  className="block font-mono text-[10px] uppercase tracking-[0.25em] text-on-surface-variant"
                >
                  Password
                </label>
                <a
                  href="#"
                  onClick={handleForgotPassword}
                  className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary-container transition-colors hover:text-primary"
                >
                  Forgot password?
                </a>
              </div>
              <input
                id="login-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-xl border border-transparent bg-[#1c1c1c] px-4 py-3.5 tracking-[0.2em] text-on-surface transition-all placeholder:text-[#555555] focus:border-primary-container/50 focus:bg-[#222222] focus:outline-none"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="group mt-8 flex w-full items-center justify-center gap-2 rounded-full bg-primary-container px-6 py-4 text-base font-bold text-background shadow-[0_0_30px_rgba(197,254,0,0.2)] transition-all hover:bg-primary hover:shadow-[0_0_40px_rgba(197,254,0,0.35)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-background border-t-transparent" />
                  Signing in…
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight
                    size={17}
                    className="transition-transform duration-300 group-hover:translate-x-1"
                  />
                </>
              )}
            </button>
          </form>

          {/* New User Link */}
          <div className="mt-8 text-center text-[13px] text-on-surface-variant">
            New to the platform?{' '}
            <span className="cursor-default text-primary-container/70">
              Contact your admin for an invitation
            </span>
          </div>
        </motion.div>
      </main>

      {/* Simplified Footer */}
      <footer className="relative z-10 flex w-full justify-center gap-8 pb-8 font-mono text-[9px] uppercase tracking-[0.25em] text-[#555555]">
        <a href="#" className="transition-colors hover:text-on-surface-variant">
          Privacy Policy
        </a>
        <a href="#" className="transition-colors hover:text-on-surface-variant">
          Terms of Service
        </a>
        <a href="#" className="transition-colors hover:text-on-surface-variant">
          System Status
        </a>
      </footer>
    </div>
  );
}

export default LoginPage;
