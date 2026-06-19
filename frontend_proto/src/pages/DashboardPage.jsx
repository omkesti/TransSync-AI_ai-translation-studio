import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  Settings,
  Plus,
  LayoutDashboard,
  FileUp,
  CheckCircle2,
  MessageSquare,
  Book,
  HelpCircle,
  LogOut,
  FileText,
  MoreHorizontal,
  Zap,
  Brain,
  RefreshCw,
  Download,
} from 'lucide-react';
import { fetchDashboardStats } from '../services/api';
import UserProfileBlock from '../components/UserProfileBlock';
import NavAvatar from '../components/NavAvatar';
import Logo from '../components/Logo';
import SettingsMenu from '../components/SettingsMenu';
import { useAuth } from '../context/AuthContext';

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function matchTypeLabel(mt) {
  switch (mt) {
    case 'tm_exact':    return 'TM Exact';
    case 'faiss_direct': return 'FAISS';
    case 'llm_guided':  return 'LLM Guided';
    case 'llm_cold':    return 'LLM Cold';
    default:            return mt || '—';
  }
}

// Tier dot colors for the per-document distribution mini-legend.
const TIER_META = [
  { key: 'tm_exact',     label: 'TM',     color: '#c5fe00' },
  { key: 'faiss_direct', label: 'FAISS',  color: '#00c5fe' },
  { key: 'llm_guided',   label: 'Guided', color: '#c500fe' },
  { key: 'llm_cold',     label: 'Cold',   color: 'var(--tk-text-muted)' },
];

function matchTypeBadgeStyle(mt) {
  switch (mt) {
    case 'tm_exact':
      return 'bg-[var(--tk-accent-surface)] text-[var(--tk-accent-text)] border border-[var(--tk-accent-border)]';
    case 'faiss_direct':
      return 'bg-[#101820] text-[#00c5fe] border border-[#162030]';
    case 'llm_guided':
      return 'bg-[#1a1020] text-[#c500fe] border border-[#2a1630]';
    case 'llm_cold':
      return 'bg-[var(--tk-border)] text-[var(--tk-text-muted)]';
    default:
      return 'bg-[var(--tk-border)] text-[var(--tk-text-muted)]';
  }
}

// ── Skeleton Components ───────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-[var(--tk-surface1)] border border-[var(--tk-border)] border-opacity-50 rounded-[28px] p-8 animate-pulse">
      <div className="h-3 w-24 bg-[var(--tk-border)] rounded mb-6"></div>
      <div className="h-12 w-32 bg-[var(--tk-surface4)] rounded"></div>
    </div>
  );
}

function SkeletonInsight() {
  return (
    <div className="bg-[var(--tk-surface2)] border border-[var(--tk-border)] border-opacity-70 rounded-[24px] p-6 space-y-3 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-4 h-4 rounded bg-[var(--tk-border)]"></div>
        <div className="h-3 w-36 bg-[var(--tk-border)] rounded"></div>
      </div>
      <div className="h-3 w-full bg-[var(--tk-surface4)] rounded"></div>
      <div className="h-3 w-3/4 bg-[var(--tk-surface4)] rounded"></div>
    </div>
  );
}

function SkeletonDocRow() {
  return (
    <tr className="border-b border-[var(--tk-border)] animate-pulse">
      <td className="py-6 px-8"><div className="h-3 w-48 bg-[var(--tk-surface4)] rounded"></div></td>
      <td className="py-6 px-8"><div className="h-5 w-12 bg-[var(--tk-surface4)] rounded-full"></div></td>
      <td className="py-6 px-8"><div className="h-2 w-28 bg-[var(--tk-surface4)] rounded-full"></div></td>
      <td className="py-6 px-8"><div className="h-3 w-10 bg-[var(--tk-surface4)] rounded"></div></td>
      <td className="py-6 px-8 text-right"><div className="h-3 w-16 bg-[var(--tk-surface4)] rounded ml-auto"></div></td>
    </tr>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

function DashboardPage() {
  const { accessToken } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDashboardStats();
      setStats(data);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  // Only fetch once we have a valid session token
  useEffect(() => {
    if (accessToken) loadStats();
  }, [accessToken]);

  // Derived values from stats
  const total = stats?.total_translations ?? 0;
  const bd = stats?.match_type_breakdown ?? {};
  const tmHits = (bd.tm_exact ?? 0) + (bd.faiss_direct ?? 0);
  const llmCalls = (bd.llm_guided ?? 0) + (bd.llm_cold ?? 0);
  const recent = stats?.recent ?? [];
  const recentDocuments = stats?.recent_documents ?? [];
  const languages = stats?.languages ?? [];

  return (
    <div className="h-screen bg-[var(--tk-bg)] text-[var(--tk-text)] font-sans flex flex-col overflow-hidden selection:bg-[#c5fe00] selection:text-[var(--tk-on-accent)]">

      {/* Top Navigation */}
      <nav className="h-[72px] border-b border-[var(--tk-border)] border-opacity-50 flex items-center justify-between px-8 bg-[var(--tk-bg)] shrink-0 z-20">
        <div className="flex items-center gap-16">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <Logo variant="icon" className="h-8 w-8" />
            <span className="font-display font-bold text-xl tracking-tight text-[var(--tk-accent-text)] block leading-none">
              TransSync <span className="text-[var(--tk-text)]">AI</span>
            </span>
          </Link>

          <ul className="hidden md:flex items-center gap-8 text-[13px] font-semibold">
            <li className="text-[var(--tk-accent-text)] cursor-pointer">Dashboard</li>
            <li className="text-[var(--tk-text-muted)] hover:text-[var(--tk-text)] transition-colors cursor-pointer">Projects</li>
            <li className="text-[var(--tk-text-muted)] hover:text-[var(--tk-text)] transition-colors cursor-pointer">Analytics</li>
          </ul>
        </div>

        <div className="flex items-center gap-6 text-[var(--tk-text-muted)]">
          {/* Refresh button */}
          <button
            onClick={loadStats}
            title="Refresh stats"
            className={`hover:text-[var(--tk-text)] transition-colors ${loading ? 'animate-spin text-[var(--tk-accent-text)]' : ''}`}
          >
            <RefreshCw size={16} />
          </button>
          <button className="hover:text-[var(--tk-text)] transition-colors"><Bell size={18} /></button>
          <button className="hover:text-[var(--tk-text)] transition-colors"><HelpCircle size={18} /></button>
          <SettingsMenu />
          <NavAvatar />
        </div>
      </nav>

      {/* Body Layout */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* Left Sidebar */}
        <aside className="w-[260px] border-r border-[var(--tk-border)] border-opacity-50 flex flex-col shrink-0 bg-[var(--tk-bg)] hidden md:flex overflow-y-auto layout-scrollbar">
          <div className="p-6 pb-2">

            {/* Workspace Selector */}
            <div className="flex items-center gap-3 mb-8">
              <Logo variant="icon" className="w-9 h-9" />
              <div className="flex flex-col">
                <span className="text-[var(--tk-accent-text)] font-bold text-[11px] uppercase tracking-widest leading-none mb-1">TransSync</span>
                <span className="text-[var(--tk-text-faint)] font-bold text-[9px] uppercase tracking-widest leading-none">AI Studio</span>
              </div>
            </div>

            {/* CTA */}
            <Link to="/upload">
              <button className="w-full bg-[#c5fe00] text-[var(--tk-on-accent)] hover:bg-[#b9ef00] transition-colors rounded-full py-3.5 flex items-center justify-center gap-2 font-bold text-sm shadow-[0_0_15px_rgba(197,254,0,0.15)] mb-8">
                <Plus size={18} strokeWidth={2.5}/> New Project
              </button>
            </Link>

            {/* Menu Items */}
            <nav className="space-y-1">
              <div className="flex items-center gap-4 bg-[var(--tk-accent-surface)] text-[var(--tk-accent-text)] border border-[var(--tk-accent-border)] px-4 py-3 rounded-[12px] cursor-pointer">
                <LayoutDashboard size={18} />
                <span className="text-[11px] font-bold uppercase tracking-widest">Dashboard</span>
              </div>

              <Link to="/upload" className="flex items-center gap-4 text-[var(--tk-text-muted)] hover:text-[var(--tk-text)] hover:bg-[var(--tk-surface1)] transition-colors px-4 py-3 rounded-[12px] cursor-pointer">
                <FileUp size={18} />
                <span className="text-[11px] font-bold uppercase tracking-widest">Upload</span>
              </Link>

              <Link to="/validation" className="flex items-center gap-4 text-[var(--tk-text-muted)] hover:text-[var(--tk-text)] hover:bg-[var(--tk-surface1)] transition-colors px-4 py-3 rounded-[12px] cursor-pointer">
                <CheckCircle2 size={18} />
                <span className="text-[11px] font-bold uppercase tracking-widest">Validation</span>
              </Link>

              <Link to="/review" className="flex items-center gap-4 text-[var(--tk-text-muted)] hover:text-[var(--tk-text)] hover:bg-[var(--tk-surface1)] transition-colors px-4 py-3 rounded-[12px] cursor-pointer">
                <MessageSquare size={18} />
                <span className="text-[11px] font-bold uppercase tracking-widest">Review</span>
              </Link>

              <Link to="/glossary" className="flex items-center gap-4 text-[var(--tk-text-muted)] hover:text-[var(--tk-text)] hover:bg-[var(--tk-surface1)] transition-colors px-4 py-3 rounded-[12px] cursor-pointer">
                <Book size={18} />
                <span className="text-[11px] font-bold uppercase tracking-widest">Glossary</span>
              </Link>

              <Link to="/export" className="flex items-center gap-4 text-[var(--tk-text-muted)] hover:text-[var(--tk-text)] hover:bg-[var(--tk-surface1)] transition-colors px-4 py-3 rounded-[12px] cursor-pointer">
                <Download size={18} />
                <span className="text-[11px] font-bold uppercase tracking-widest">Export</span>
              </Link>
            </nav>
          </div>

          {/* Sidebar footer */}
          <div className="mt-auto p-6 space-y-1">
            {languages.length > 0 && (
              <div className="mb-4 px-4 py-3">
                <p className="text-[var(--tk-text-faint)] text-[9px] font-bold uppercase tracking-widest mb-2">Active Languages</p>
                <div className="flex flex-wrap gap-1.5">
                  {languages.map(l => (
                    <span key={l} className="bg-[var(--tk-accent-surface)] text-[var(--tk-accent-text)] text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-full border border-[var(--tk-accent-border)]">
                      {l}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <UserProfileBlock />
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-[var(--tk-bg)] relative layout-scrollbar">

          <div className="p-8 lg:p-12 max-w-7xl mx-auto space-y-12">

            {/* Header */}
            <div>
              <h1 className="font-display font-bold text-4xl mb-3 tracking-tight">Overview</h1>
              <p className="text-[var(--tk-text-muted)] text-[15px]">
                Your translation activity at a glance — memory reuse, LLM usage,<br/>
                and the most recent documents across your organization.
              </p>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="bg-[var(--tk-danger-surface)] border border-[var(--tk-danger-border)] rounded-[16px] px-6 py-4 flex items-center justify-between">
                <span className="text-[#ff6b6b] text-sm font-medium">{error}</span>
                <button onClick={loadStats} className="text-[#ff6b6b] hover:text-[var(--tk-text)] text-[11px] font-bold uppercase tracking-widest border border-[var(--tk-danger-border)] px-3 py-1.5 rounded-full transition-colors">
                  Retry
                </button>
              </div>
            )}

            {/* Top Stats Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Total Translations */}
              {loading ? <SkeletonCard /> : (
                <div className="bg-[var(--tk-surface1)] border border-[var(--tk-border)] border-opacity-50 rounded-[28px] p-8 relative overflow-hidden">
                  <p className="text-[var(--tk-text-faint)] font-bold text-[11px] uppercase tracking-widest mb-6">Total Translations</p>
                  <div className="flex items-baseline gap-3">
                    <span className="font-display font-bold text-5xl tracking-tight">
                      {total.toLocaleString()}
                    </span>
                    {total > 0 && (
                      <span className="text-[var(--tk-accent-text)] font-bold text-sm tracking-widest">Active</span>
                    )}
                  </div>
                </div>
              )}

              {/* TM Hits */}
              {loading ? <SkeletonCard /> : (
                <div className="bg-[var(--tk-surface1)] border border-[var(--tk-border)] border-opacity-50 rounded-[28px] p-8 relative overflow-hidden">
                  <p className="text-[var(--tk-text-faint)] font-bold text-[11px] uppercase tracking-widest mb-6">Memory Hits</p>
                  <div className="flex items-baseline gap-3">
                    <span className="font-display font-bold text-5xl tracking-tight">{tmHits.toLocaleString()}</span>
                    <div className="flex gap-[3px] items-center h-5">
                      <Zap size={14} className="text-[var(--tk-accent-text)]" />
                    </div>
                  </div>
                  <p className="text-[var(--tk-text-faint)] text-[11px] mt-3">TM Exact + FAISS direct lookups</p>
                </div>
              )}

              {/* LLM Calls */}
              {loading ? <SkeletonCard /> : (
                <div className="bg-[var(--tk-surface1)] border border-[var(--tk-border)] border-opacity-50 rounded-[28px] p-8 relative overflow-hidden">
                  <p className="text-[var(--tk-text-faint)] font-bold text-[11px] uppercase tracking-widest mb-6">LLM Calls</p>
                  <div className="flex items-baseline gap-3">
                    <span className="font-display font-bold text-5xl tracking-tight">{llmCalls.toLocaleString()}</span>
                    <Brain size={16} className="text-[var(--tk-text-muted)] mb-1" />
                  </div>
                  <p className="text-[var(--tk-text-faint)] text-[11px] mt-3">Guided + cold Groq invocations</p>
                </div>
              )}

            </div>

            {/* Middle Section: Chart & Insights */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">

              {/* Left Col (Span 2): Match Type Breakdown */}
              <div className="lg:col-span-2 flex flex-col space-y-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-display font-bold text-[22px] tracking-tight mb-1">Pipeline Breakdown</h3>
                    <p className="text-[var(--tk-text-muted)] text-[13px]">Translation tier distribution across all processed sentences</p>
                  </div>
                  <div className="border border-[var(--tk-border)] bg-[var(--tk-surface3)] px-3 py-1.5 rounded-[8px] text-[var(--tk-text-faint)] font-bold text-[9px] uppercase tracking-widest">
                    All Time
                  </div>
                </div>

                {/* Breakdown Bars */}
                <div className="bg-[var(--tk-accent-surface)] border border-[var(--tk-accent-surface)] rounded-[24px] p-8 space-y-5">
                  {[
                    { key: 'tm_exact',    label: 'TM Exact',    color: '#c5fe00' },
                    { key: 'faiss_direct', label: 'FAISS Direct', color: '#00c5fe' },
                    { key: 'llm_guided',  label: 'LLM Guided',  color: '#c500fe' },
                    { key: 'llm_cold',    label: 'LLM Cold',    color: 'var(--tk-text-faint)' },
                  ].map(({ key, label, color }) => {
                    const count = bd[key] ?? 0;
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                    return (
                      <div key={key}>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[var(--tk-text-muted2)] text-[12px] font-semibold">{label}</span>
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-[13px]">{count.toLocaleString()}</span>
                            <span className="text-[var(--tk-text-faint)] text-[11px] w-8 text-right">{pct}%</span>
                          </div>
                        </div>
                        <div className="h-2 rounded-full bg-[var(--tk-surface3)] overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${pct}%`, backgroundColor: color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {loading && (
                    <div className="space-y-5 animate-pulse">
                      {[1,2,3,4].map(i => (
                        <div key={i}>
                          <div className="flex justify-between mb-2">
                            <div className="h-3 w-24 bg-[var(--tk-surface4)] rounded"></div>
                            <div className="h-3 w-16 bg-[var(--tk-surface4)] rounded"></div>
                          </div>
                          <div className="h-2 bg-[var(--tk-surface3)] rounded-full"></div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Col (Span 1): Context Insights */}
              <div className="space-y-6">
                <h3 className="font-display font-bold text-[22px] tracking-tight mb-2">Recent Translations</h3>

                <div className="space-y-4">
                  {loading
                    ? [1,2,3].map(i => <SkeletonInsight key={i} />)
                    : recent.slice(0, 3).length > 0
                      ? recent.slice(0, 3).map((r, i) => (
                          <div key={i} className="bg-[var(--tk-surface2)] border border-[var(--tk-border)] border-opacity-70 rounded-[24px] p-6 space-y-4 hover:border-[var(--tk-border3)] transition-colors cursor-pointer group">
                            <div className="flex items-center gap-3">
                              <FileText size={16} className="text-[var(--tk-text-muted2)] shrink-0" />
                              <span className="font-bold text-[13px] truncate">{r.source_text}</span>
                            </div>
                            <p className="text-[var(--tk-text-muted)] text-[13px] italic leading-relaxed line-clamp-2">
                              "{r.translated_text}"
                            </p>
                            <div className="flex justify-between items-center pt-1">
                              <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-full ${matchTypeBadgeStyle(r.match_type)}`}>
                                {matchTypeLabel(r.match_type)}
                              </span>
                              <span className="text-[var(--tk-text-faint)] text-[10px] font-bold tracking-widest uppercase">{timeAgo(r.created_at)}</span>
                            </div>
                          </div>
                        ))
                      : (
                        <div className="bg-[var(--tk-surface2)] border border-[var(--tk-border)] border-opacity-70 rounded-[24px] p-6 text-center">
                          <p className="text-[var(--tk-text-faint)] text-sm">No translations yet.</p>
                          <Link to="/upload" className="text-[var(--tk-accent-text)] text-[11px] font-bold uppercase tracking-widest mt-2 block hover:underline">
                            Upload a document →
                          </Link>
                        </div>
                      )
                  }
                </div>
              </div>
            </div>

            {/* Bottom Row: Recent Activity — recently translated DOCUMENTS */}
            <div className="border border-[var(--tk-border)] border-opacity-80 rounded-[28px] overflow-hidden">
              <div className="p-8 border-b border-[var(--tk-border)] flex justify-between items-end">
                <div>
                  <h3 className="font-display font-bold text-[22px] tracking-tight">Recent Activity</h3>
                  <p className="text-[var(--tk-text-muted)] text-[13px] mt-1">Documents translated recently across your organization</p>
                </div>
                <Link to="/review" className="text-[var(--tk-text-muted)] text-[11px] font-bold tracking-widest uppercase hover:text-[var(--tk-text)] transition-colors">
                  Go to Review →
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr>
                      <th className="py-4 px-8 text-[var(--tk-text-faint)] text-[10px] font-bold tracking-widest uppercase border-b border-[var(--tk-border)] w-2/5">Document</th>
                      <th className="py-4 px-8 text-[var(--tk-text-faint)] text-[10px] font-bold tracking-widest uppercase border-b border-[var(--tk-border)]">Lang</th>
                      <th className="py-4 px-8 text-[var(--tk-text-faint)] text-[10px] font-bold tracking-widest uppercase border-b border-[var(--tk-border)] w-1/3">Tier Mix</th>
                      <th className="py-4 px-8 text-[var(--tk-text-faint)] text-[10px] font-bold tracking-widest uppercase border-b border-[var(--tk-border)] text-right">Sentences</th>
                      <th className="py-4 px-8 text-[var(--tk-text-faint)] text-[10px] font-bold tracking-widest uppercase border-b border-[var(--tk-border)] text-right">Last Activity</th>
                    </tr>
                  </thead>
                  <tbody className="text-[13px]">
                    {loading
                      ? [1,2,3,4,5].map(i => <SkeletonDocRow key={i} />)
                      : recentDocuments.length > 0
                        ? recentDocuments.map((d, i) => {
                            const count = d.sentence_count || 0;
                            const bdown = d.breakdown || {};
                            return (
                              <tr key={i} className={`border-b border-[var(--tk-border)] hover:bg-[var(--tk-surface1)] transition-colors ${i === recentDocuments.length - 1 ? 'border-b-0' : ''}`}>
                                <td className="py-5 px-8 font-medium max-w-0">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <FileText size={15} className="text-[var(--tk-text-muted2)] shrink-0" />
                                    <p className="truncate text-[var(--tk-text)]">{d.source_document}</p>
                                  </div>
                                </td>
                                <td className="py-5 px-8">
                                  <span className="bg-[var(--tk-surface3)] border border-[var(--tk-border)] text-[var(--tk-text-muted)] text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-full">
                                    {d.target_lang || '—'}
                                  </span>
                                </td>
                                <td className="py-5 px-8">
                                  {/* Stacked tier bar */}
                                  <div className="flex h-2 w-full max-w-[220px] rounded-full overflow-hidden bg-[var(--tk-surface3)]">
                                    {TIER_META.map(({ key, color }) => {
                                      const c = bdown[key] ?? 0;
                                      const pct = count > 0 ? (c / count) * 100 : 0;
                                      if (pct <= 0) return null;
                                      return (
                                        <div
                                          key={key}
                                          title={`${matchTypeLabel(key)}: ${c}`}
                                          style={{ width: `${pct}%`, backgroundColor: color }}
                                        />
                                      );
                                    })}
                                  </div>
                                </td>
                                <td className="py-5 px-8 text-right font-bold text-[var(--tk-text)] whitespace-nowrap">
                                  {count.toLocaleString()}
                                </td>
                                <td className="py-5 px-8 text-right text-[var(--tk-text-faint)] text-[11px] font-bold uppercase tracking-widest whitespace-nowrap">
                                  {timeAgo(d.last_activity)}
                                </td>
                              </tr>
                            );
                          })
                        : (
                          <tr>
                            <td colSpan={5} className="py-12 text-center text-[var(--tk-text-faint)] text-sm">
                              No documents translated yet. Upload and translate a document to see activity here.
                            </td>
                          </tr>
                        )
                    }
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </main>
      </div>

    </div>
  );
}

export default DashboardPage;
