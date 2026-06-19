import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import InviteAcceptPage from './pages/InviteAcceptPage';
import DashboardPage from './pages/DashboardPage';
import UploadPage from './pages/UploadPage';
import ValidationPage from './pages/ValidationPage';
import ReviewPage from './pages/ReviewPage';
import GlossaryPage from './pages/GlossaryPage';
import ExportPage from './pages/ExportPage';
import ProfilePage from './pages/ProfilePage';

/**
 * RedirectIfAuth — redirects authenticated users away from /login and /
 * to /dashboard.
 */
function RedirectIfAuth({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--tk-bg2)] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-primary-container border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/"      element={<LandingPage />} />
        <Route path="/login" element={<RedirectIfAuth><LoginPage /></RedirectIfAuth>} />
        <Route path="/invite/:token" element={<InviteAcceptPage />} />

        {/* Protected routes */}
        <Route path="/dashboard"  element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/upload"     element={<ProtectedRoute><UploadPage /></ProtectedRoute>} />
        <Route path="/validation" element={<ProtectedRoute><ValidationPage /></ProtectedRoute>} />
        <Route path="/review"     element={<ProtectedRoute><ReviewPage /></ProtectedRoute>} />
        <Route path="/glossary"   element={<ProtectedRoute><GlossaryPage /></ProtectedRoute>} />
        <Route path="/export"     element={<ProtectedRoute><ExportPage /></ProtectedRoute>} />
        <Route path="/profile"    element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
