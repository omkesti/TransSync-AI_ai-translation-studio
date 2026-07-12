import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell, Settings, Plus, LayoutDashboard, Home, FileText, Book, HelpCircle,
  Download, FolderOpen, RefreshCw, Clock, Globe, Tag, Zap, Brain,
} from 'lucide-react';
import { listProjects, fetchDashboardStats } from '../services/api';
import UserProfileBlock from '../components/UserProfileBlock';
import NavAvatar from '../components/NavAvatar';
import CreateProjectModal from '../components/CreateProjectModal';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import { languageLabel } from '../constants/languages';
import { statusStyle } from '../constants/projects';

// ── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(isoString) {
  if (!isoString) return '—';
  const diff = Date.now() - new Date(isoString).getTime();
  if (Number.isNaN(diff)) return '—';
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function matchTypeLabel(mt) {
  switch (mt) {
    case 'tm_exact':     return 'TM Exact';
    case 'faiss_direct': return 'FAISS';
    case 'llm_guided':   return 'LLM Guided';
    case 'llm_cold':     return 'LLM Cold';
    default:             return mt || '—';
  }
}

// Tier dot colors for the per-document distribution mini-legend.
const TIER_META = [
  { key: 'tm_exact',     label: 'TM',     color: '#c5fe00' },
  { key: 'faiss_direct', label: 'FAISS',  color: '#00c5fe' },
  { key: 'llm_guided',   label: 'Guided', color: '#c500fe' },
  { key: 'llm_cold',     label: 'Cold',   color: '#8c8c8b' },
];

function matchTypeBadgeStyle(mt) {
  switch (mt) {
    case 'tm_exact':
      return 'bg-[#1a2010] text-primary-container border border-primary-container/20';
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

const MEMBER_COLORS = ['#c5fe00', '#00c5fe', '#c500fe', '#ffcc00', '#ff8800'];

function MemberAvatars({ members = [] }) {
  if (!members.length) {
    return <span className="text-[#555555] text-[11px]">No members</span>;
  }
  const shown = members.slice(0, 4);
  const extra = members.length - shown.length;
  return (
    <div className="flex items-center -space-x-2">
      {shown.map((m, i) => (
        <div
          key={m.id || m.user_id || i}
          title={`${(m.role || 'Member')}`}
          className="w-7 h-7 rounded-full border-2 border-[#131313] flex items-center justify-center text-[10px] font-black text-background"
          style={{ backgroundColor: MEMBER_COLORS[i % MEMBER_COLORS.length] }}
        >
          {(m.role || 'M').charAt(0).toUpperCase()}
        </div>
      ))}
      {extra > 0 && (
        <div className="w-7 h-7 rounded-full border-2 border-[#131313] bg-[#262626] flex items-center justify-center text-[10px] font-bold text-[#a0a09f]">
          +{extra}
        </div>
      )}
    </div>
  );
}

// ── Project Card ──────────────────────────────────────────────────────────────

function ProjectCard({ project, onOpen }) {
  const stats = project.stats || {};
  const progress = stats.progress_percent ?? 0;
  const docCount = stats.document_count ?? 0;

  return (
    <button
      onClick={() => onOpen(project)}
      className="text-left bg-surface-container-low hover:bg-[#181818] rounded-2xl p-7 transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_40px_rgba(0,0,0,0.4)] group flex flex-col"
    >
      {/* Header: name + status */}
      <div className="flex items-start justify-between mb-4 gap-3">
        <div className="min-w-0">
          <h3 className="font-grotesk font-bold text-lg tracking-tight truncate group-hover:text-primary-container transition-colors">
            {project.name}
          </h3>
          {project.description && (
            <p className="text-[#8c8c8b] text-[12px] mt-1 line-clamp-2 leading-relaxed">{project.description}</p>
          )}
        </div>
        <span className={`shrink-0 text-[9px] font-mono font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border ${statusStyle(project.status)}`}>
          {project.status}
        </span>
      </div>

      {/* Meta chips */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <span className="inline-flex items-center gap-1.5 bg-[#1c1c1c] text-[#a0a09f] text-[10px] font-mono font-bold uppercase tracking-widest px-2.5 py-1 rounded-full">
          <Globe size={11} className="text-primary-container" />
          {project.target_language ? languageLabel(project.target_language) : '—'}
        </span>
        {project.domain && (
          <span className="inline-flex items-center gap-1.5 bg-[#1c1c1c] text-[#a0a09f] text-[10px] font-mono font-bold uppercase tracking-widest px-2.5 py-1 rounded-full">
            <Tag size={11} className="text-[#00c5fe]" />
            {project.domain}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 bg-[#1c1c1c] text-[#a0a09f] text-[10px] font-mono font-bold uppercase tracking-widest px-2.5 py-1 rounded-full">
          <FileText size={11} />
          {docCount} doc{docCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Progress */}
      <div className="mb-5">
        <div className="flex justify-between items-center mb-2">
          <span className="text-[#555555] text-[10px] font-mono font-bold uppercase tracking-widest">Progress</span>
          <span className="text-white text-[12px] font-bold">{progress}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-[#1c1c1c] overflow-hidden">
          <div className="h-full bg-primary-container rounded-full transition-all duration-700" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Footer: members + last activity */}
      <div className="mt-auto flex items-center justify-between pt-1">
        <MemberAvatars members={project.members} />
        <span className="flex items-center gap-1.5 text-[#555555] text-[10px] font-mono font-bold uppercase tracking-widest">
          <Clock size={11} />
          {timeAgo(stats.last_activity)}
        </span>
      </div>
    </button>
  );
}

// ── Sidebar ─────────────────────────────────────────────────────────────────

function SidebarButton({ Icon, label, active, onClick }) {
  const base = "w-full flex items-center gap-4 px-4 py-3 rounded-xl cursor-pointer transition-colors";
  if (active) {
    return (
      <button onClick={onClick} className={`${base} bg-[#1a1c10] text-primary-container`}>
        <Icon size={18} />
        <span className="text-[11px] font-mono font-bold uppercase tracking-widest">{label}</span>
      </button>
    );
  }
  return (
    <button onClick={onClick} className={`${base} text-[#8c8c8b] hover:text-on-surface hover:bg-surface-container-low`}>
      <Icon size={18} />
      <span className="text-[11px] font-mono font-bold uppercase tracking-widest">{label}</span>
    </button>
  );
}

function SidebarLink({ to, Icon, label }) {
  return (
    <Link to={to} className="w-full flex items-center gap-4 px-4 py-3 rounded-xl cursor-pointer transition-colors text-[#8c8c8b] hover:text-on-surface hover:bg-surface-container-low">
      <Icon size={18} />
      <span className="text-[11px] font-mono font-bold uppercase tracking-widest">{label}</span>
    </Link>
  );
}

// ── Skeletons ─────────────────────────────────────────────────────────────────

function SkeletonProjectCard() {
  return (
    <div className="bg-surface-container-low rounded-2xl p-7 animate-pulse">
      <div className="h-4 w-32 bg-[#1e1e1e] rounded mb-4" />
      <div className="flex gap-2 mb-5">
        <div className="h-5 w-16 bg-[#1e1e1e] rounded-full" />
        <div className="h-5 w-16 bg-[#1e1e1e] rounded-full" />
      </div>
      <div className="h-1.5 w-full bg-[#1e1e1e] rounded-full mb-5" />
      <div className="h-7 w-24 bg-[#1e1e1e] rounded-full" />
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-surface-container-low rounded-3xl p-8 animate-pulse">
      <div className="h-3 w-24 bg-[#262626] rounded mb-6"></div>
      <div className="h-12 w-32 bg-[#1e1e1e] rounded"></div>
    </div>
  );
}

function SkeletonInsight() {
  return (
    <div className="bg-[#161616] rounded-2xl p-6 space-y-3 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-4 h-4 rounded bg-[#262626]"></div>
        <div className="h-3 w-36 bg-[#262626] rounded"></div>
      </div>
      <div className="h-3 w-full bg-[#1e1e1e] rounded"></div>
      <div className="h-3 w-3/4 bg-[#1e1e1e] rounded"></div>
    </div>
  );
}

function SkeletonDocRow() {
  return (
    <tr className="border-b border-white/8 animate-pulse">
      <td className="py-6 px-8"><div className="h-3 w-48 bg-[#1e1e1e] rounded"></div></td>
      <td className="py-6 px-8"><div className="h-5 w-12 bg-[#1e1e1e] rounded-full"></div></td>
      <td className="py-6 px-8"><div className="h-2 w-28 bg-[#1e1e1e] rounded-full"></div></td>
      <td className="py-6 px-8"><div className="h-3 w-10 bg-[#1e1e1e] rounded"></div></td>
      <td className="py-6 px-8 text-right"><div className="h-3 w-16 bg-[#1e1e1e] rounded ml-auto"></div></td>
    </tr>
  );
}

// ── Recent Project Card (compact, for Home view) ──────────────────────────────

function RecentProjectCard({ project, onOpen }) {
  const stats = project.stats || {};
  const progress = stats.progress_percent ?? 0;
  const docCount = stats.document_count ?? 0;

  return (
    <button
      onClick={() => onOpen(project)}
      className="text-left bg-surface-container-low hover:bg-[#181818] rounded-2xl p-5 transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)] group flex flex-col"
    >
      <div className="flex items-start justify-between mb-3 gap-2">
        <h3 className="font-grotesk font-bold text-[15px] tracking-tight truncate group-hover:text-primary-container transition-colors min-w-0">
          {project.name}
        </h3>
        <span className={`shrink-0 text-[8px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${statusStyle(project.status)}`}>
          {project.status}
        </span>
      </div>

      <div className="flex items-center gap-2 mb-4 text-[#8c8c8b]">
        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-widest">
          <Globe size={11} className="text-primary-container" />
          {project.target_language ? languageLabel(project.target_language) : '—'}
        </span>
        <span className="text-[#262626]">•</span>
        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-widest">
          <FileText size={11} />
          {docCount} doc{docCount !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="mt-auto">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-white text-[11px] font-bold">{progress}%</span>
          <span className="flex items-center gap-1 text-[#555555] text-[9px] font-mono font-bold uppercase tracking-widest">
            <Clock size={10} />
            {timeAgo(stats.last_activity)}
          </span>
        </div>
        <div className="h-1 rounded-full bg-[#1c1c1c] overflow-hidden">
          <div className="h-full bg-primary-container rounded-full transition-all duration-700" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </button>
  );
}

function SkeletonRecentProject() {
  return (
    <div className="bg-surface-container-low rounded-2xl p-5 animate-pulse">
      <div className="h-3 w-24 bg-[#1e1e1e] rounded mb-4" />
      <div className="h-3 w-20 bg-[#1e1e1e] rounded mb-5" />
      <div className="h-1 w-full bg-[#1e1e1e] rounded-full" />
    </div>
  );
}

// ── Home (Overview) View ──────────────────────────────────────────────────────

function HomeView({ stats, loading, error, onRetry, projects, projectsLoading, onOpenProject, onViewAllProjects, onCreateProject }) {
  const total = stats?.total_translations ?? 0;
  const bd = stats?.match_type_breakdown ?? {};
  const tmHits = (bd.tm_exact ?? 0) + (bd.faiss_direct ?? 0);
  const llmCalls = (bd.llm_guided ?? 0) + (bd.llm_cold ?? 0);
  const recent = stats?.recent ?? [];
  const recentDocuments = stats?.recent_documents ?? [];

  // Most recently worked-on projects (active only), newest activity first.
  const recentProjects = [...(projects || [])]
    .filter((p) => p.status !== 'Archived')
    .sort((a, b) => {
      const ta = new Date(a.stats?.last_activity || a.updated_at || 0).getTime();
      const tb = new Date(b.stats?.last_activity || b.updated_at || 0).getTime();
      return tb - ta;
    })
    .slice(0, 4);

  return (
    <div className="animate-rise p-8 lg:p-12 max-w-7xl mx-auto space-y-12">

      {/* Header */}
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-on-surface-variant mb-3">(01) — Your studio</p>
        <h1 className="font-hero font-black uppercase text-4xl md:text-5xl mb-3 tracking-tight leading-none">Overview</h1>
        <p className="text-[#8c8c8b] text-[15px]">
          Your translation activity at a glance — memory reuse, LLM usage,<br />
          and the most recent documents across your organization.
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-[#1c0f0c] rounded-2xl px-6 py-4 flex items-center justify-between">
          <span className="text-error text-sm font-medium">{error}</span>
          <button onClick={onRetry} className="text-error hover:text-white text-[11px] font-mono font-bold uppercase tracking-widest border border-error/25 px-3 py-1.5 rounded-full transition-colors">
            Retry
          </button>
        </div>
      )}

      {/* Top Stats Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {loading ? <SkeletonCard /> : (
          <div className="bg-surface-container-low rounded-3xl p-8 relative overflow-hidden">
            <p className="text-[#555555] font-mono font-bold text-[11px] uppercase tracking-widest mb-6">Total Translations</p>
            <div className="flex items-baseline gap-3">
              <span className="font-hero font-black text-5xl tracking-tight">{total.toLocaleString()}</span>
              {total > 0 && <span className="text-primary-container font-bold text-sm tracking-widest">Active</span>}
            </div>
          </div>
        )}

        {loading ? <SkeletonCard /> : (
          <div className="bg-surface-container-low rounded-3xl p-8 relative overflow-hidden">
            <p className="text-[#555555] font-mono font-bold text-[11px] uppercase tracking-widest mb-6">Memory Hits</p>
            <div className="flex items-baseline gap-3">
              <span className="font-hero font-black text-5xl tracking-tight">{tmHits.toLocaleString()}</span>
              <div className="flex gap-[3px] items-center h-5">
                <Zap size={14} className="text-primary-container" />
              </div>
            </div>
            <p className="text-[#555555] text-[11px] mt-3">TM Exact + FAISS direct lookups</p>
          </div>
        )}

        {loading ? <SkeletonCard /> : (
          <div className="bg-surface-container-low rounded-3xl p-8 relative overflow-hidden">
            <p className="text-[#555555] font-mono font-bold text-[11px] uppercase tracking-widest mb-6">LLM Calls</p>
            <div className="flex items-baseline gap-3">
              <span className="font-hero font-black text-5xl tracking-tight">{llmCalls.toLocaleString()}</span>
              <Brain size={16} className="text-[#8c8c8b] mb-1" />
            </div>
            <p className="text-[#555555] text-[11px] mt-3">Guided + cold LLM invocations</p>
          </div>
        )}

      </div>

      {/* Recently Worked On — quick jump back into active projects */}
      <div className="space-y-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h3 className="font-grotesk font-bold text-[22px] tracking-tight mb-1">Recently Worked On</h3>
            <p className="text-[#8c8c8b] text-[13px]">Jump back into the projects you touched most recently</p>
          </div>
          <button
            onClick={onViewAllProjects}
            className="shrink-0 text-primary-container hover:text-white text-[11px] font-mono font-bold uppercase tracking-widest border border-primary-container/20 hover:border-primary-container bg-[#1a1c10] px-4 py-2 rounded-full transition-colors"
          >
            View all →
          </button>
        </div>

        {projectsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <SkeletonRecentProject key={i} />)}
          </div>
        ) : recentProjects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {recentProjects.map((p) => (
              <RecentProjectCard key={p.id} project={p} onOpen={onOpenProject} />
            ))}
          </div>
        ) : (
          <div className="bg-surface-container-low rounded-2xl px-6 py-8 flex items-center justify-between gap-4 flex-wrap">
            <p className="text-[#8c8c8b] text-sm">No projects yet — create one to get started.</p>
            <button
              onClick={onCreateProject}
              className="bg-primary-container text-background hover:bg-primary transition-colors rounded-full px-5 py-2.5 flex items-center gap-2 font-black text-[11px] uppercase tracking-widest"
            >
              <Plus size={14} strokeWidth={3} /> Create Project
            </button>
          </div>
        )}
      </div>

      {/* Middle Section: Chart & Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">

        {/* Left Col (Span 2): Match Type Breakdown */}
        <div className="lg:col-span-2 flex flex-col space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-grotesk font-bold text-[22px] tracking-tight mb-1">Pipeline Breakdown</h3>
              <p className="text-[#8c8c8b] text-[13px]">Translation tier distribution across all processed sentences</p>
            </div>
            <div className="border border-white/8 bg-[#1c1c1c] px-3 py-1.5 rounded-[8px] text-[#555555] font-mono font-bold text-[9px] uppercase tracking-widest">
              All Time
            </div>
          </div>

          <div className="bg-[#10130a] rounded-2xl p-8 space-y-5">
            {[
              { key: 'tm_exact',     label: 'TM Exact',     color: '#c5fe00' },
              { key: 'faiss_direct', label: 'FAISS Direct', color: '#00c5fe' },
              { key: 'llm_guided',   label: 'LLM Guided',   color: '#c500fe' },
              { key: 'llm_cold',     label: 'LLM Cold',     color: '#555555' },
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
                  <div className="h-2 rounded-full bg-[#1c1c1c] overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                </div>
              );
            })}
            {loading && (
              <div className="space-y-5 animate-pulse">
                {[1, 2, 3, 4].map(i => (
                  <div key={i}>
                    <div className="flex justify-between mb-2">
                      <div className="h-3 w-24 bg-[#1e1e1e] rounded"></div>
                      <div className="h-3 w-16 bg-[#1e1e1e] rounded"></div>
                    </div>
                    <div className="h-2 bg-[#1c1c1c] rounded-full"></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Col (Span 1): Recent Translations */}
        <div className="space-y-6">
          <h3 className="font-grotesk font-bold text-[22px] tracking-tight mb-2">Recent Translations</h3>

          <div className="space-y-4">
            {loading
              ? [1, 2, 3].map(i => <SkeletonInsight key={i} />)
              : recent.slice(0, 3).length > 0
                ? recent.slice(0, 3).map((r, i) => (
                    <div key={i} className="bg-[#161616] rounded-2xl p-6 space-y-4 hover:border-white/12 transition-colors cursor-pointer group">
                      <div className="flex items-center gap-3">
                        <FileText size={16} className="text-[#a0a09f] shrink-0" />
                        <span className="font-bold text-[13px] truncate">{r.source_text}</span>
                      </div>
                      <p className="text-[#8c8c8b] text-[13px] italic leading-relaxed line-clamp-2">
                        "{r.translated_text}"
                      </p>
                      <div className="flex justify-between items-center pt-1">
                        <span className={`text-[9px] font-mono font-bold uppercase tracking-widest px-2 py-1 rounded-full ${matchTypeBadgeStyle(r.match_type)}`}>
                          {matchTypeLabel(r.match_type)}
                        </span>
                        <span className="text-[#555555] text-[10px] font-mono font-bold tracking-widest uppercase">{timeAgo(r.created_at)}</span>
                      </div>
                    </div>
                  ))
                : (
                  <div className="bg-[#161616] rounded-2xl p-6 text-center">
                    <p className="text-[#555555] text-sm">No translations yet.</p>
                  </div>
                )
            }
          </div>
        </div>
      </div>

      {/* Bottom Row: Recent Activity — recently translated DOCUMENTS */}
      <div className="border border-white/8 border-opacity-80 rounded-3xl overflow-hidden">
        <div className="p-8 border-b border-white/8 flex justify-between items-end">
          <div>
            <h3 className="font-grotesk font-bold text-[22px] tracking-tight">Recent Activity</h3>
            <p className="text-[#8c8c8b] text-[13px] mt-1">Documents translated recently across your organization</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="py-4 px-8 text-[#555555] text-[10px] font-mono font-bold tracking-widest uppercase border-b border-white/8 w-2/5">Document</th>
                <th className="py-4 px-8 text-[#555555] text-[10px] font-mono font-bold tracking-widest uppercase border-b border-white/8">Lang</th>
                <th className="py-4 px-8 text-[#555555] text-[10px] font-mono font-bold tracking-widest uppercase border-b border-white/8 w-1/3">Tier Mix</th>
                <th className="py-4 px-8 text-[#555555] text-[10px] font-mono font-bold tracking-widest uppercase border-b border-white/8 text-right">Sentences</th>
                <th className="py-4 px-8 text-[#555555] text-[10px] font-mono font-bold tracking-widest uppercase border-b border-white/8 text-right">Last Activity</th>
              </tr>
            </thead>
            <tbody className="text-[13px]">
              {loading
                ? [1, 2, 3, 4, 5].map(i => <SkeletonDocRow key={i} />)
                : recentDocuments.length > 0
                  ? recentDocuments.map((d, i) => {
                      const count = d.sentence_count || 0;
                      const bdown = d.breakdown || {};
                      return (
                        <tr key={i} className={`border-b border-white/8 hover:bg-surface-container-low transition-colors ${i === recentDocuments.length - 1 ? 'border-b-0' : ''}`}>
                          <td className="py-5 px-8 font-medium max-w-0">
                            <div className="flex items-center gap-3 min-w-0">
                              <FileText size={15} className="text-[#a0a09f] shrink-0" />
                              <p className="truncate text-on-surface">{d.source_document}</p>
                            </div>
                          </td>
                          <td className="py-5 px-8">
                            <span className="bg-[#1c1c1c] text-[#8c8c8b] text-[9px] font-mono font-bold uppercase tracking-widest px-2 py-1 rounded-full">
                              {d.target_lang || '—'}
                            </span>
                          </td>
                          <td className="py-5 px-8">
                            <div className="flex h-2 w-full max-w-[220px] rounded-full overflow-hidden bg-[#1c1c1c]">
                              {TIER_META.map(({ key, color }) => {
                                const c = bdown[key] ?? 0;
                                const pct = count > 0 ? (c / count) * 100 : 0;
                                if (pct <= 0) return null;
                                return (
                                  <div key={key} title={`${matchTypeLabel(key)}: ${c}`} style={{ width: `${pct}%`, backgroundColor: color }} />
                                );
                              })}
                            </div>
                          </td>
                          <td className="py-5 px-8 text-right font-bold text-on-surface whitespace-nowrap">
                            {count.toLocaleString()}
                          </td>
                          <td className="py-5 px-8 text-right text-[#555555] text-[11px] font-mono font-bold uppercase tracking-widest whitespace-nowrap">
                            {timeAgo(d.last_activity)}
                          </td>
                        </tr>
                      );
                    })
                  : (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-[#555555] text-sm">
                        No documents translated yet. Create a project and translate a document to see activity here.
                      </td>
                    </tr>
                  )
              }
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

// ── Projects View ─────────────────────────────────────────────────────────────

function ProjectsView({ projects, loading, error, onRetry, onOpen, onCreate }) {
  const activeProjects = projects.filter((p) => p.status !== 'Archived');
  const archivedProjects = projects.filter((p) => p.status === 'Archived');

  return (
    <div className="animate-rise p-8 lg:p-12 max-w-7xl mx-auto space-y-10">

      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-on-surface-variant mb-3">(02) — Workspaces</p>
          <h1 className="font-hero font-black uppercase text-4xl md:text-5xl mb-3 tracking-tight leading-none">Projects</h1>
          <p className="text-[#8c8c8b] text-[15px]">
            Every translation effort lives in a project — its documents, memory,<br />
            glossary and progress all scoped together.
          </p>
        </div>
        <button
          onClick={onCreate}
          className="bg-primary-container text-background hover:bg-primary transition-colors rounded-full px-6 py-3.5 flex items-center gap-2 font-black text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(197,254,0,0.2)] hover:scale-[1.02]"
        >
          <Plus size={16} strokeWidth={3} /> Create Project
        </button>
      </div>

      {error && (
        <div className="bg-[#1c0f0c] rounded-2xl px-6 py-4 flex items-center justify-between">
          <span className="text-error text-sm font-medium">{error}</span>
          <button onClick={onRetry} className="text-error hover:text-white text-[11px] font-mono font-bold uppercase tracking-widest border border-error/25 px-3 py-1.5 rounded-full transition-colors">
            Retry
          </button>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => <SkeletonProjectCard key={i} />)}
        </div>
      ) : activeProjects.length === 0 && archivedProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-20 h-20 rounded-full bg-[#1a1c10] border border-primary-container/20 flex items-center justify-center mb-8">
            <FolderOpen size={32} className="text-primary-container" />
          </div>
          <h3 className="font-grotesk font-bold text-2xl tracking-tight mb-3">No projects yet</h3>
          <p className="text-[#8c8c8b] text-[14px] max-w-sm leading-relaxed mb-8">
            Create your first project to start uploading and translating documents.
          </p>
          <button
            onClick={onCreate}
            className="bg-primary-container text-background hover:bg-primary transition-colors rounded-full px-8 py-4 flex items-center gap-2 font-black text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(197,254,0,0.2)]"
          >
            <Plus size={16} strokeWidth={3} /> Create Project
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {activeProjects.map((p) => (
              <ProjectCard key={p.id} project={p} onOpen={onOpen} />
            ))}
          </div>

          {archivedProjects.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-[#555555] font-mono font-bold text-[11px] uppercase tracking-[0.2em]">Archived</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 opacity-60">
                {archivedProjects.map((p) => (
                  <ProjectCard key={p.id} project={p} onOpen={onOpen} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

function DashboardPage() {
  const { accessToken } = useAuth();
  const { exitProject, loadProjectDocuments } = useAppContext();
  const navigate = useNavigate();

  // Active dashboard section: 'home' (overview, default) or 'projects'.
  const [view, setView] = useState('home');
  const [modalOpen, setModalOpen] = useState(false);

  // Projects state
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState(null);

  // Home (overview) stats state
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(null);

  const loadProjects = async () => {
    setProjectsLoading(true);
    setProjectsError(null);
    try {
      const data = await listProjects();
      setProjects(data?.projects || []);
    } catch (err) {
      setProjectsError(err.message || 'Failed to load projects.');
    } finally {
      setProjectsLoading(false);
    }
  };

  const loadStats = async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const data = await fetchDashboardStats();
      setStats(data);
    } catch (err) {
      setStatsError(err.message || 'Failed to load dashboard data.');
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    // Landing on the dashboard means we're not inside any project workspace.
    exitProject();
    if (accessToken) {
      loadStats();
      loadProjects();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const refreshActive = () => (view === 'home' ? loadStats() : loadProjects());
  const activeLoading = view === 'home' ? statsLoading : projectsLoading;

  const openProject = (project) => {
    navigate(`/projects/${project.id}`);
  };

  const handleCreated = (project) => {
    setModalOpen(false);
    // Fresh project has no documents yet; start the workspace clean.
    loadProjectDocuments([], project.id);
    navigate(`/projects/${project.id}`);
  };

  return (
    <div className="h-screen bg-background text-on-surface font-grotesk flex flex-col overflow-hidden selection:bg-primary-container selection:text-background">

      {/* Top Navigation */}
      <nav className="h-[72px] border-b border-white/8 border-opacity-50 flex items-center justify-between px-8 bg-background shrink-0 z-20">
        <div className="flex items-center gap-16">
          <Link to="/" className="inline-block">
            <span className="font-hero text-[13px] font-bold uppercase tracking-[0.3em] text-on-surface block leading-none">
              TransSync <span className="text-primary-container">AI</span>
            </span>
          </Link>
          <ul className="hidden md:flex items-center gap-2">
            <li>
              <button
                onClick={() => setView('home')}
                className={`flex items-center gap-2.5 px-5 py-2.5 rounded-full text-[14px] font-bold tracking-tight transition-colors ${
                  view === 'home'
                    ? 'bg-[#1a1c10] text-primary-container'
                    : 'text-[#8c8c8b] hover:text-on-surface hover:bg-surface-container-low border border-transparent'
                }`}
              >
                <Home size={18} strokeWidth={2.2} /> Home
              </button>
            </li>
            <li>
              <button
                onClick={() => setView('projects')}
                className={`flex items-center gap-2.5 px-5 py-2.5 rounded-full text-[14px] font-bold tracking-tight transition-colors ${
                  view === 'projects'
                    ? 'bg-[#1a1c10] text-primary-container'
                    : 'text-[#8c8c8b] hover:text-on-surface hover:bg-surface-container-low border border-transparent'
                }`}
              >
                <LayoutDashboard size={18} strokeWidth={2.2} /> Projects
              </button>
            </li>
          </ul>
        </div>
        <div className="flex items-center gap-6 text-[#8c8c8b]">
          <button onClick={refreshActive} title="Refresh" className={`hover:text-on-surface transition-colors ${activeLoading ? 'animate-spin text-primary-container' : ''}`}>
            <RefreshCw size={16} />
          </button>
          <button className="hover:text-on-surface transition-colors"><Bell size={18} /></button>
          <button className="hover:text-on-surface transition-colors"><HelpCircle size={18} /></button>
          <button className="hover:text-on-surface transition-colors"><Settings size={18} /></button>
          <NavAvatar />
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar */}
        <aside className="w-[260px] border-r border-white/8 border-opacity-50 flex flex-col shrink-0 bg-background hidden md:flex overflow-y-auto layout-scrollbar">
          <div className="p-6 pb-2 flex-1 flex flex-col">
            <button
              onClick={() => setModalOpen(true)}
              className="w-full bg-primary-container text-background hover:bg-primary transition-colors rounded-full py-3.5 flex items-center justify-center gap-2 font-bold text-sm shadow-[0_0_15px_rgba(197,254,0,0.15)] mb-8"
            >
              <Plus size={18} strokeWidth={2.5} /> Create Project
            </button>

            <nav className="space-y-1">
              <SidebarButton Icon={Home} label="Home" active={view === 'home'} onClick={() => setView('home')} />
              <SidebarLink to="/glossary" Icon={Book} label="Glossary" />
            </nav>
          </div>
          <div className="mt-auto p-6">
            <UserProfileBlock />
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-y-auto bg-background relative layout-scrollbar">
          {view === 'home' ? (
            <HomeView
              stats={stats}
              loading={statsLoading}
              error={statsError}
              onRetry={loadStats}
              projects={projects}
              projectsLoading={projectsLoading}
              onOpenProject={openProject}
              onViewAllProjects={() => setView('projects')}
              onCreateProject={() => setModalOpen(true)}
            />
          ) : (
            <ProjectsView
              projects={projects}
              loading={projectsLoading}
              error={projectsError}
              onRetry={loadProjects}
              onOpen={openProject}
              onCreate={() => setModalOpen(true)}
            />
          )}
        </main>
      </div>

      <CreateProjectModal open={modalOpen} onClose={() => setModalOpen(false)} onCreated={handleCreated} />
    </div>
  );
}

export default DashboardPage;
