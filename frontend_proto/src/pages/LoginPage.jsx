import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';

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
    <div className="min-h-screen bg-[#0e0e0e] text-on-surface font-sans selection:bg-primary-container selection:text-background flex flex-col relative overflow-hidden">
      
      {/* Background Ambient Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary-container/10 blur-[150px] rounded-full z-0 pointer-events-none"></div>

      {/* Main Container */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 relative z-10 w-full mb-12">
        
        {/* Header / Logo Component */}
        <div className="mb-12 text-center">
          <Link to="/" className="inline-block">
            <Logo variant="full" className="h-20 mx-auto" />
          </Link>
          <p className="text-[#a0a09f] text-[10px] uppercase tracking-[0.3em] mt-3">Document Translation, With Memory</p>
        </div>

        {/* Login Card */}
        <div className="bg-[#1a1a1a] p-10 rounded-[32px] w-full max-w-[420px] shadow-[0_40px_80px_rgba(0,0,0,0.6)]">
          <h1 className="font-display text-[28px] font-bold text-white mb-2 tracking-tight">Welcome back</h1>
          <p className="text-[#8c8c8b] text-[15px] mb-8 font-sans">Enter your credentials to access your studio.</p>

          {/* Error message */}
          {error && (
            <div className="mb-6 p-3 rounded-[12px] bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-sans">
              {error}
            </div>
          )}

          {/* Reset sent success */}
          {resetSent && (
            <div className="mb-6 p-3 rounded-[12px] bg-primary-container/10 border border-primary-container/20 text-primary-container text-sm font-sans">
              Password reset email sent. Check your inbox.
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            
            {/* Email Field */}
            <div className="space-y-2">
              <label htmlFor="login-email" className="text-[#8c8c8b] text-xs font-bold uppercase tracking-wider block">Email Address</label>
              <input 
                id="login-email"
                type="email" 
                placeholder="name@transsync.ai" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-[#222222] border border-transparent rounded-[12px] px-4 py-3.5 text-white focus:outline-none focus:border-primary-container/50 focus:bg-[#2a2a2a] transition-all placeholder:text-[#555555] font-sans" 
              />
            </div>
            
            {/* Password Field */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label htmlFor="login-password" className="text-[#8c8c8b] text-xs font-bold uppercase tracking-wider block">Password</label>
                <a
                  href="#"
                  onClick={handleForgotPassword}
                  className="text-primary-container text-[10px] font-bold uppercase tracking-widest hover:text-primary transition-colors"
                >
                  Forgot Password?
                </a>
              </div>
              <input 
                id="login-password"
                type="password" 
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-[#222222] border border-transparent rounded-[12px] px-4 py-3.5 text-white focus:outline-none focus:border-primary-container/50 focus:bg-[#2a2a2a] transition-all placeholder:text-[#555555] font-sans tracking-[0.2em]" 
              />
            </div>

            {/* Submit Button */}
            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-primary-container text-[#0a0a0a] font-bold text-base px-6 py-4 rounded-full mt-8 hover:bg-primary transition-colors shadow-[0_0_30px_rgba(197,254,0,0.2)] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-[#0a0a0a] border-t-transparent rounded-full animate-spin" />
                  Signing in…
                </>
              ) : (
                <>Sign In <span className="text-lg leading-none">&rarr;</span></>
              )}
            </button>
          </form>

          {/* New User Link */}
          <div className="mt-8 text-center text-[13px] text-[#8c8c8b] font-medium font-sans">
            New to the platform? <span className="text-primary-container/60 cursor-default">Contact your admin for an invitation</span>
          </div>
        </div>

      </main>

      {/* Simplified Footer */}
      <footer className="absolute bottom-6 w-full text-center flex justify-center gap-8 text-[10px] text-[#555555] uppercase tracking-widest font-bold">
        <a href="#" className="hover:text-[#a0a09f] transition-colors">Privacy Policy</a>
        <a href="#" className="hover:text-[#a0a09f] transition-colors">Terms of Service</a>
        <a href="#" className="hover:text-[#a0a09f] transition-colors">System Status</a>
      </footer>

    </div>
  );
}

export default LoginPage;
