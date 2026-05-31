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

function matchTypeBadgeStyle(mt) {
  switch (mt) {
    case 'tm_exact':
      return 'bg-[#1a2010] text-[#c5fe00] border border-[#2a2e16]';
    case 'faiss_direct':
      return 'bg-[#101820] text-[#00c5fe] border border-[#162030]';
    case 'llm_guided':
      return 'bg-[#1a1020] text-[#c500fe] border border-[#2a1630]';
    case 'llm_cold':
      return 'bg-[#262626] text-[#8c8c8b]';
    default:
      return 'bg-[#262626] text-[#8c8c8b]';
  }
}

// ── Skeleton Components ───────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-[#131313] border border-[#262626] border-opacity-50 rounded-[28px] p-8 animate-pulse">
      <div className="h-3 w-24 bg-[#262626] rounded mb-6"></div>
      <div className="h-12 w-32 bg-[#1e1e1e] rounded"></div>
    </div>
  );
}

function SkeletonInsight() {
  return (
    <div className="bg-[#151515] border border-[#262626] border-opacity-70 rounded-[24px] p-6 space-y-3 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-4 h-4 rounded bg-[#262626]"></div>
        <div className="h-3 w-36 bg-[#262626] rounded"></div>
      </div>
      <div className="h-3 w-full bg-[#1e1e1e] rounded"></div>
      <div className="h-3 w-3/4 bg-[#1e1e1e] rounded"></div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-[#262626] animate-pulse">
      <td className="py-6 px-8"><div className="h-3 w-48 bg-[#1e1e1e] rounded"></div></td>
      <td className="py-6 px-8"><div className="h-3 w-20 bg-[#1e1e1e] rounded"></div></td>
      <td className="py-6 px-8"><div className="h-2 w-28 bg-[#1e1e1e] rounded-full"></div></td>
      <td className="py-6 px-8"><div className="h-5 w-16 bg-[#1e1e1e] rounded-full"></div></td>
      <td className="py-6 px-8 text-right"><div className="h-4 w-4 bg-[#1e1e1e] rounded ml-auto"></div></td>
    </tr>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

function DashboardPage() {
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

  useEffect(() => {
    loadStats();
  }, []);

  // Derived values from stats
  const total = stats?.total_translations ?? 0;
  const bd = stats?.match_type_breakdown ?? {};
  const tmHits = (bd.tm_exact ?? 0) + (bd.faiss_direct ?? 0);
  const llmCalls = (bd.llm_guided ?? 0) + (bd.llm_cold ?? 0);
  const recent = stats?.recent ?? [];
  const languages = stats?.languages ?? [];

  return (
    <div className="h-screen bg-[#0a0a0a] text-[#ffffff] font-sans flex flex-col overflow-hidden selection:bg-[#c5fe00] selection:text-[#0a0a0a]">

      {/* Top Navigation */}
      <nav className="h-[72px] border-b border-[#262626] border-opacity-50 flex items-center justify-between px-8 bg-[#0a0a0a] shrink-0 z-20">
        <div className="flex items-center gap-16">
          <Link to="/" className="inline-block">
            <span className="font-display font-bold text-xl tracking-tight text-[#c5fe00] block leading-none">
              TransSync <span className="text-[#ffffff]">AI</span>
            </span>
          </Link>

          <ul className="hidden md:flex items-center gap-8 text-[13px] font-semibold">
            <li className="text-[#c5fe00] cursor-pointer">Dashboard</li>
            <li className="text-[#8c8c8b] hover:text-[#ffffff] transition-colors cursor-pointer">Projects</li>
            <li className="text-[#8c8c8b] hover:text-[#ffffff] transition-colors cursor-pointer">Analytics</li>
          </ul>
        </div>

        <div className="flex items-center gap-6 text-[#8c8c8b]">
          {/* Refresh button */}
          <button
            onClick={loadStats}
            title="Refresh stats"
            className={`hover:text-[#ffffff] transition-colors ${loading ? 'animate-spin text-[#c5fe00]' : ''}`}
          >
            <RefreshCw size={16} />
          </button>
          <button className="hover:text-[#ffffff] transition-colors"><Bell size={18} /></button>
          <button className="hover:text-[#ffffff] transition-colors"><Settings size={18} /></button>
          <button className="w-8 h-8 rounded-full bg-[#1a1a1a] border border-[#262626] overflow-hidden ml-2">
            <img src="https://i.pravatar.cc/150?img=11" alt="User Avatar" className="w-full h-full object-cover" />
          </button>
        </div>
      </nav>

      {/* Body Layout */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* Left Sidebar */}
        <aside className="w-[260px] border-r border-[#262626] border-opacity-50 flex flex-col shrink-0 bg-[#0a0a0a] hidden md:flex">
          <div className="p-6 pb-2">

            {/* Workspace Selector */}
            <div className="flex items-center gap-3 mb-8">
              <div className="w-8 h-8 rounded-full bg-[#c5fe00] text-[#0a0a0a] flex items-center justify-center font-bold text-sm">
                A
              </div>
              <div className="flex flex-col">
                <span className="text-[#c5fe00] font-bold text-[11px] uppercase tracking-widest leading-none mb-1">TransSync</span>
                <span className="text-[#555555] font-bold text-[9px] uppercase tracking-widest leading-none">AI Studio</span>
              </div>
            </div>

            {/* CTA */}
            <Link to="/upload">
              <button className="w-full bg-[#c5fe00] text-[#0a0a0a] hover:bg-[#b9ef00] transition-colors rounded-full py-3.5 flex items-center justify-center gap-2 font-bold text-sm shadow-[0_0_15px_rgba(197,254,0,0.15)] mb-8">
                <Plus size={18} strokeWidth={2.5}/> New Project
              </button>
            </Link>

            {/* Menu Items */}
            <nav className="space-y-1">
              <div className="flex items-center gap-4 bg-[#1a1c10] text-[#c5fe00] border border-[#2a2e16] px-4 py-3 rounded-[12px] cursor-pointer">
                <LayoutDashboard size={18} />
                <span className="text-[11px] font-bold uppercase tracking-widest">Dashboard</span>
              </div>

              <Link to="/upload" className="flex items-center gap-4 text-[#8c8c8b] hover:text-[#ffffff] hover:bg-[#131313] transition-colors px-4 py-3 rounded-[12px] cursor-pointer">
                <FileUp size={18} />
                <span className="text-[11px] font-bold uppercase tracking-widest">Upload</span>
              </Link>

              <Link to="/validation" className="flex items-center gap-4 text-[#8c8c8b] hover:text-[#ffffff] hover:bg-[#131313] transition-colors px-4 py-3 rounded-[12px] cursor-pointer">
                <CheckCircle2 size={18} />
                <span className="text-[11px] font-bold uppercase tracking-widest">Validation</span>
              </Link>

              <Link to="/review" className="flex items-center gap-4 text-[#8c8c8b] hover:text-[#ffffff] hover:bg-[#131313] transition-colors px-4 py-3 rounded-[12px] cursor-pointer">
                <MessageSquare size={18} />
                <span className="text-[11px] font-bold uppercase tracking-widest">Review</span>
              </Link>

              <Link to="/glossary" className="flex items-center gap-4 text-[#8c8c8b] hover:text-[#ffffff] hover:bg-[#131313] transition-colors px-4 py-3 rounded-[12px] cursor-pointer">
                <Book size={18} />
                <span className="text-[11px] font-bold uppercase tracking-widest">Glossary</span>
              </Link>

              <Link to="/export" className="flex items-center gap-4 text-[#8c8c8b] hover:text-[#ffffff] hover:bg-[#131313] transition-colors px-4 py-3 rounded-[12px] cursor-pointer">
                <Download size={18} />
                <span className="text-[11px] font-bold uppercase tracking-widest">Export</span>
              </Link>
            </nav>
          </div>

          {/* Sidebar footer */}
          <div className="mt-auto p-6 space-y-1">
            {languages.length > 0 && (
              <div className="mb-4 px-4 py-3">
                <p className="text-[#555555] text-[9px] font-bold uppercase tracking-widest mb-2">Active Languages</p>
                <div className="flex flex-wrap gap-1.5">
                  {languages.map(l => (
                    <span key={l} className="bg-[#1a2010] text-[#c5fe00] text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-full border border-[#2a2e16]">
                      {l}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center gap-4 text-[#8c8c8b] hover:text-[#ffffff] hover:bg-[#131313] transition-colors px-4 py-3 rounded-[12px] cursor-pointer">
              <HelpCircle size={18} />
              <span className="text-[11px] font-bold uppercase tracking-widest">Help</span>
            </div>
            <div className="flex items-center gap-4 text-[#8c8c8b] hover:text-[#ffffff] hover:bg-[#131313] transition-colors px-4 py-3 rounded-[12px] cursor-pointer">
              <LogOut size={18} />
              <span className="text-[11px] font-bold uppercase tracking-widest">Logout</span>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-[#0a0a0a] relative layout-scrollbar">

          <div className="p-8 lg:p-12 max-w-7xl mx-auto space-y-12">

            {/* Header */}
            <div>
              <h1 className="font-display font-bold text-4xl mb-3 tracking-tight">Systems Overview</h1>
              <p className="text-[#8c8c8b] text-[15px]">
                Monitoring linguistic processing throughput and document health<br/>
                across all active translation nodes.
              </p>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="bg-[#1a0a0a] border border-[#4a1010] rounded-[16px] px-6 py-4 flex items-center justify-between">
                <span className="text-[#ff6b6b] text-sm font-medium">{error}</span>
                <button onClick={loadStats} className="text-[#ff6b6b] hover:text-white text-[11px] font-bold uppercase tracking-widest border border-[#4a1010] px-3 py-1.5 rounded-full transition-colors">
                  Retry
                </button>
              </div>
            )}

            {/* Top Stats Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Total Translations */}
              {loading ? <SkeletonCard /> : (
                <div className="bg-[#131313] border border-[#262626] border-opacity-50 rounded-[28px] p-8 relative overflow-hidden">
                  <p className="text-[#555555] font-bold text-[11px] uppercase tracking-widest mb-6">Total Translations</p>
                  <div className="flex items-baseline gap-3">
                    <span className="font-display font-bold text-5xl tracking-tight">
                      {total.toLocaleString()}
                    </span>
                    {total > 0 && (
                      <span className="text-[#c5fe00] font-bold text-sm tracking-widest">Active</span>
                    )}
                  </div>
                </div>
              )}

              {/* TM Hits */}
              {loading ? <SkeletonCard /> : (
                <div className="bg-[#131313] border border-[#262626] border-opacity-50 rounded-[28px] p-8 relative overflow-hidden">
                  <p className="text-[#555555] font-bold text-[11px] uppercase tracking-widest mb-6">Memory Hits</p>
                  <div className="flex items-baseline gap-3">
                    <span className="font-display font-bold text-5xl tracking-tight">{tmHits.toLocaleString()}</span>
                    <div className="flex gap-[3px] items-center h-5">
                      <Zap size={14} className="text-[#c5fe00]" />
                    </div>
                  </div>
                  <p className="text-[#555555] text-[11px] mt-3">TM Exact + FAISS direct lookups</p>
                </div>
              )}

              {/* LLM Calls */}
              {loading ? <SkeletonCard /> : (
                <div className="bg-[#131313] border border-[#262626] border-opacity-50 rounded-[28px] p-8 relative overflow-hidden">
                  <p className="text-[#555555] font-bold text-[11px] uppercase tracking-widest mb-6">LLM Calls</p>
                  <div className="flex items-baseline gap-3">
                    <span className="font-display font-bold text-5xl tracking-tight">{llmCalls.toLocaleString()}</span>
                    <Brain size={16} className="text-[#8c8c8b] mb-1" />
                  </div>
                  <p className="text-[#555555] text-[11px] mt-3">Guided + cold Groq invocations</p>
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
                    <p className="text-[#8c8c8b] text-[13px]">Translation tier distribution across all processed sentences</p>
                  </div>
                  <div className="border border-[#262626] bg-[#1a1a1a] px-3 py-1.5 rounded-[8px] text-[#555555] font-bold text-[9px] uppercase tracking-widest">
                    All Time
                  </div>
                </div>

                {/* Breakdown Bars */}
                <div className="bg-[#10130a] border border-[#1a2010] rounded-[24px] p-8 space-y-5">
                  {[
                    { key: 'tm_exact',    label: 'TM Exact',    color: '#c5fe00' },
                    { key: 'faiss_direct', label: 'FAISS Direct', color: '#00c5fe' },
                    { key: 'llm_guided',  label: 'LLM Guided',  color: '#c500fe' },
                    { key: 'llm_cold',    label: 'LLM Cold',    color: '#555555' },
                  ].map(({ key, label, color }) => {
                    const count = bd[key] ?? 0;
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                    return (
                      <div key={key}>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[#a0a09f] text-[12px] font-semibold">{label}</span>
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-[13px]">{count.toLocaleString()}</span>
                            <span className="text-[#555555] text-[11px] w-8 text-right">{pct}%</span>
                          </div>
                        </div>
                        <div className="h-2 rounded-full bg-[#1a1a1a] overflow-hidden">
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
                            <div className="h-3 w-24 bg-[#1e1e1e] rounded"></div>
                            <div className="h-3 w-16 bg-[#1e1e1e] rounded"></div>
                          </div>
                          <div className="h-2 bg-[#1a1a1a] rounded-full"></div>
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
                          <div key={i} className="bg-[#151515] border border-[#262626] border-opacity-70 rounded-[24px] p-6 space-y-4 hover:border-[#333333] transition-colors cursor-pointer group">
                            <div className="flex items-center gap-3">
                              <FileText size={16} className="text-[#a0a09f] shrink-0" />
                              <span className="font-bold text-[13px] truncate">{r.source_text}</span>
                            </div>
                            <p className="text-[#8c8c8b] text-[13px] italic leading-relaxed line-clamp-2">
                              "{r.translated_text}"
                            </p>
                            <div className="flex justify-between items-center pt-1">
                              <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-full ${matchTypeBadgeStyle(r.match_type)}`}>
                                {matchTypeLabel(r.match_type)}
                              </span>
                              <span className="text-[#555555] text-[10px] font-bold tracking-widest uppercase">{timeAgo(r.created_at)}</span>
                            </div>
                          </div>
                        ))
                      : (
                        <div className="bg-[#151515] border border-[#262626] border-opacity-70 rounded-[24px] p-6 text-center">
                          <p className="text-[#555555] text-sm">No translations yet.</p>
                          <Link to="/upload" className="text-[#c5fe00] text-[11px] font-bold uppercase tracking-widest mt-2 block hover:underline">
                            Upload a document →
                          </Link>
                        </div>
                      )
                  }
                </div>
              </div>
            </div>

            {/* Bottom Row: Recent Translations Table */}
            <div className="border border-[#262626] border-opacity-80 rounded-[28px] overflow-hidden">
              <div className="p-8 border-b border-[#262626] flex justify-between items-end">
                <h3 className="font-display font-bold text-[22px] tracking-tight">Recent Activity</h3>
                <Link to="/review" className="text-[#8c8c8b] text-[11px] font-bold tracking-widest uppercase hover:text-white transition-colors">
                  Go to Review →
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr>
                      <th className="py-4 px-8 text-[#555555] text-[10px] font-bold tracking-widest uppercase border-b border-[#262626] w-2/5">Source</th>
                      <th className="py-4 px-8 text-[#555555] text-[10px] font-bold tracking-widest uppercase border-b border-[#262626] w-2/5">Translation</th>
                      <th className="py-4 px-8 text-[#555555] text-[10px] font-bold tracking-widest uppercase border-b border-[#262626]">Lang</th>
                      <th className="py-4 px-8 text-[#555555] text-[10px] font-bold tracking-widest uppercase border-b border-[#262626]">Tier</th>
                      <th className="py-4 px-8 text-[#555555] text-[10px] font-bold tracking-widest uppercase border-b border-[#262626] text-right">When</th>
                    </tr>
                  </thead>
                  <tbody className="text-[13px]">
                    {loading
                      ? [1,2,3,4,5].map(i => <SkeletonRow key={i} />)
                      : recent.length > 0
                        ? recent.map((r, i) => (
                            <tr key={i} className={`border-b border-[#262626] hover:bg-[#131313] transition-colors ${i === recent.length - 1 ? 'border-b-0' : ''}`}>
                              <td className="py-5 px-8 font-medium max-w-0">
                                <p className="truncate text-[#ffffff]">{r.source_text}</p>
                              </td>
                              <td className="py-5 px-8 text-[#8c8c8b] max-w-0">
                                <p className="truncate">{r.translated_text}</p>
                              </td>
                              <td className="py-5 px-8">
                                <span className="bg-[#1a1a1a] border border-[#262626] text-[#8c8c8b] text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-full">
                                  {r.target_lang}
                                </span>
                              </td>
                              <td className="py-5 px-8">
                                <span className={`inline-flex items-center text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full ${matchTypeBadgeStyle(r.match_type)}`}>
                                  {matchTypeLabel(r.match_type)}
                                </span>
                              </td>
                              <td className="py-5 px-8 text-right text-[#555555] text-[11px] font-bold uppercase tracking-widest whitespace-nowrap">
                                {timeAgo(r.created_at)}
                              </td>
                            </tr>
                          ))
                        : (
                          <tr>
                            <td colSpan={5} className="py-12 text-center text-[#555555] text-sm">
                              No translations stored yet. Upload and approve a document to see activity here.
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
