/**
 * ProfilePage.jsx
 * ───────────────
 * The user's profile. Shows the avatar, an editable display name, role,
 * organization, the logged-in email, the documents this user has translated,
 * and a log-out button.
 */

import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  FolderOpen,
  LogOut,
  Check,
  Pencil,
  X,
  FileText,
  Mail,
  Building2,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import { updateProfile, fetchMyDocuments } from '../services/api';
import Avatar from '../components/Avatar';

const ROLE_COLORS = {
  owner:      'bg-amber-500/20 text-amber-400',
  admin:      'bg-purple-500/20 text-purple-400',
  translator: 'bg-blue-500/20 text-blue-400',
  reviewer:   'bg-emerald-500/20 text-emerald-400',
  viewer:     'bg-gray-500/20 text-gray-400',
};

function timeAgo(isoString) {
  if (!isoString) return '—';
  const diff = Date.now() - new Date(isoString).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function ProfilePage() {
  const { user, role, org, displayName, accessToken, signOut, refreshProfile } = useAuth();
  const { currentProjectId } = useAppContext();
  const navigate = useNavigate();

  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(displayName || 'User');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const [docs, setDocs] = useState([]);
  const [docsLoading, setDocsLoading] = useState(true);

  // Keep the draft in sync when the context name changes.
  useEffect(() => {
    if (!editing) setNameDraft(displayName || 'User');
  }, [displayName, editing]);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    setDocsLoading(true);
    fetchMyDocuments()
      .then((data) => {
        if (!cancelled) setDocs(data?.documents ?? []);
      })
      .catch((err) => {
        console.error('Failed to load documents:', err);
        if (!cancelled) setDocs([]);
      })
      .finally(() => {
        if (!cancelled) setDocsLoading(false);
      });
    return () => { cancelled = true; };
  }, [accessToken]);

  const email = user?.email || '';
  const roleColor = ROLE_COLORS[role] || ROLE_COLORS.viewer;

  const handleSave = async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      setSaveError('Name cannot be empty.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await updateProfile(trimmed);
      await refreshProfile();
      setEditing(false);
    } catch (err) {
      setSaveError(err.message || 'Failed to save name.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (err) {
      console.error('Sign-out failed:', err);
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-surface font-grotesk selection:bg-primary-container selection:text-background">
      {/* Top nav */}
      <nav className="h-[72px] border-b border-white/8 border-opacity-50 flex items-center justify-between px-8">
        <div className="flex items-center gap-6">
          <Link to="/dashboard" className="flex items-center gap-2 text-[#8c8c8b] hover:text-white transition-colors text-sm font-semibold">
            <ArrowLeft size={18} />
            Back
          </Link>
          {currentProjectId && (
            <Link to={`/projects/${currentProjectId}`} className="flex items-center gap-2 text-[#8c8c8b] hover:text-white transition-colors text-sm font-semibold">
              <FolderOpen size={18} />
              Project
            </Link>
          )}
          <Link to="/" className="inline-block">
            <span className="font-hero text-[13px] font-bold uppercase tracking-[0.3em] text-on-surface block leading-none">
              TransSync <span className="text-primary-container">AI</span>
            </span>
          </Link>
        </div>
      </nav>

      <div className="animate-rise max-w-4xl mx-auto px-6 py-12 space-y-10">

        {/* Identity card */}
        <section className="bg-surface-container-low rounded-3xl p-8">
          <div className="flex items-start gap-6">
            <Avatar name={displayName} email={email} size={88} />

            <div className="flex-1 min-w-0">
              {/* Name (editable) */}
              {editing ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    autoFocus
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
                    maxLength={80}
                    className="bg-background border border-[#333] focus:border-primary-container outline-none rounded-lg px-3 py-2 text-2xl font-grotesk font-bold text-white w-full max-w-xs transition-colors"
                  />
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="p-2 rounded-lg bg-primary-container text-background hover:bg-primary transition-colors disabled:opacity-50"
                    title="Save"
                  >
                    <Check size={18} />
                  </button>
                  <button
                    onClick={() => { setEditing(false); setSaveError(null); }}
                    className="p-2 rounded-lg bg-[#1f1f1f] text-[#999] hover:text-white transition-colors"
                    title="Cancel"
                  >
                    <X size={18} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <h1 className="font-hero font-black text-3xl tracking-tight truncate">
                    {displayName || 'User'}
                  </h1>
                  <button
                    onClick={() => setEditing(true)}
                    className="p-2 rounded-lg text-[#666] hover:text-primary-container hover:bg-[#1c1c1c] transition-colors"
                    title="Edit name"
                  >
                    <Pencil size={16} />
                  </button>
                </div>
              )}

              {saveError && <p className="text-red-400 text-xs mt-2">{saveError}</p>}

              <span className={`inline-block text-[10px] uppercase tracking-wider font-mono font-bold px-2.5 py-1 rounded-full mt-3 ${roleColor}`}>
                {role || 'member'}
              </span>
            </div>

            {/* Logout */}
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 text-[#999] hover:text-red-400 border border-white/8 hover:border-red-500/40 px-4 py-2 rounded-full transition-colors text-sm font-semibold"
            >
              <LogOut size={16} />
              Log out
            </button>
          </div>

          {/* Detail rows */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8 pt-8 border-t border-white/8">
            <Detail icon={<Mail size={15} />} label="Email" value={email} />
            <Detail icon={<Building2 size={15} />} label="Organization" value={org?.name || '—'} />
            <Detail icon={<ShieldCheck size={15} />} label="Role" value={role || 'member'} />
          </div>
        </section>

        {/* Documents translated */}
        <section>
          <div className="flex items-end justify-between mb-5">
            <div>
              <h2 className="font-grotesk font-bold text-[22px] tracking-tight">Your Translations</h2>
              <p className="text-[#8c8c8b] text-[13px] mt-1">Documents you have translated</p>
            </div>
            <Link to="/upload" className="text-primary-container text-[11px] font-mono font-bold uppercase tracking-widest hover:underline">
              New Project →
            </Link>
          </div>

          <div className="border border-white/8 border-opacity-80 rounded-2xl overflow-hidden">
            {docsLoading ? (
              <div className="divide-y divide-white/5">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4 px-6 py-5 animate-pulse">
                    <div className="w-4 h-4 rounded bg-[#1e1e1e]" />
                    <div className="h-3 w-48 bg-[#1e1e1e] rounded" />
                    <div className="ml-auto h-3 w-16 bg-[#1e1e1e] rounded" />
                  </div>
                ))}
              </div>
            ) : docs.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <p className="text-[#555] text-sm">You haven't translated any documents yet.</p>
                <Link to="/upload" className="text-primary-container text-[11px] font-mono font-bold uppercase tracking-widest mt-2 inline-block hover:underline">
                  Upload a document →
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {docs.map((d, i) => (
                  <div key={i} className="flex items-center gap-4 px-6 py-5 hover:bg-surface-container-low transition-colors">
                    <FileText size={16} className="text-[#a0a09f] shrink-0" />
                    <p className="truncate text-sm text-white flex-1 min-w-0">{d.source_document}</p>
                    <span className="bg-[#1c1c1c] text-[#8c8c8b] text-[9px] font-mono font-bold uppercase tracking-widest px-2 py-1 rounded-full">
                      {d.target_lang || '—'}
                    </span>
                    <span className="text-[#8c8c8b] text-xs font-medium whitespace-nowrap w-20 text-right">
                      {d.sentence_count} {d.sentence_count === 1 ? 'sentence' : 'sentences'}
                    </span>
                    <span className="text-[#555] text-[10px] font-mono font-bold uppercase tracking-widest whitespace-nowrap w-20 text-right">
                      {timeAgo(d.last_activity)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Detail({ icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <div className="text-[#666] mt-0.5">{icon}</div>
      <div className="min-w-0">
        <p className="text-[#555] text-[10px] font-mono font-bold uppercase tracking-widest mb-1">{label}</p>
        <p className="text-white text-sm truncate">{value}</p>
      </div>
    </div>
  );
}
