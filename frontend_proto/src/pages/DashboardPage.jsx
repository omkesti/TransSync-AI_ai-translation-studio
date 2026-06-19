import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell, Settings, Plus, LayoutDashboard, FileUp, CheckCircle2, MessageSquare,
  Book, HelpCircle, Download, FolderOpen, RefreshCw, Clock, FileText, Globe, Tag,
} from 'lucide-react';
import { listProjects } from '../services/api';
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
          className="w-7 h-7 rounded-full border-2 border-[#131313] flex items-center justify-center text-[10px] font-black text-[#0a0a0a]"
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
      className="text-left bg-[#131313] border border-[#262626] hover:border-[#3a3a3a] rounded-[24px] p-7 transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_40px_rgba(0,0,0,0.4)] group flex flex-col"
    >
      {/* Header: name + status */}
      <div className="flex items-start justify-between mb-4 gap-3">
        <div className="min-w-0">
          <h3 className="font-display font-bold text-lg tracking-tight truncate group-hover:text-[#c5fe00] transition-colors">
            {project.name}
          </h3>
          {project.description && (
            <p className="text-[#8c8c8b] text-[12px] mt-1 line-clamp-2 leading-relaxed">{project.description}</p>
          )}
        </div>
        <span className={`shrink-0 text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border ${statusStyle(project.status)}`}>
          {project.status}
        </span>
      </div>

      {/* Meta chips */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <span className="inline-flex items-center gap-1.5 bg-[#1a1a1a] border border-[#262626] text-[#a0a09f] text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full">
          <Globe size={11} className="text-[#c5fe00]" />
          {project.target_language ? languageLabel(project.target_language) : '—'}
        </span>
        {project.domain && (
          <span className="inline-flex items-center gap-1.5 bg-[#1a1a1a] border border-[#262626] text-[#a0a09f] text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full">
            <Tag size={11} className="text-[#00c5fe]" />
            {project.domain}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 bg-[#1a1a1a] border border-[#262626] text-[#a0a09f] text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full">
          <FileText size={11} />
          {docCount} doc{docCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Progress */}
      <div className="mb-5">
        <div className="flex justify-between items-center mb-2">
          <span className="text-[#555555] text-[10px] font-bold uppercase tracking-widest">Progress</span>
          <span className="text-white text-[12px] font-bold">{progress}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-[#1a1a1a] overflow-hidden">
          <div className="h-full bg-[#c5fe00] rounded-full transition-all duration-700" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Footer: members + last activity */}
      <div className="mt-auto flex items-center justify-between pt-1">
        <MemberAvatars members={project.members} />
        <span className="flex items-center gap-1.5 text-[#555555] text-[10px] font-bold uppercase tracking-widest">
          <Clock size={11} />
          {timeAgo(stats.last_activity)}
        </span>
      </div>
    </button>
  );
}

// ── Sidebar ─────────────────────────────────────────────────────────────────

function SidebarLink({ to, Icon, label, active }) {
  const base = "flex items-center gap-4 px-4 py-3 rounded-[12px] cursor-pointer transition-colors";
  if (active) {
    return (
      <div className={`${base} bg-[#1a1c10] text-[#c5fe00] border border-[#2a2e16]`}>
        <Icon size={18} />
        <span className="text-[11px] font-bold uppercase tracking-widest">{label}</span>
      </div>
    );
  }
  return (
    <Link to={to} className={`${base} text-[#8c8c8b] hover:text-[#ffffff] hover:bg-[#131313]`}>
      <Icon size={18} />
      <span className="text-[11px] font-bold uppercase tracking-widest">{label}</span>
    </Link>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-[#131313] border border-[#262626] rounded-[24px] p-7 animate-pulse">
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

// ── Main ──────────────────────────────────────────────────────────────────────

function DashboardPage() {
  const { accessToken } = useAuth();
  const { exitProject, loadProjectDocuments } = useAppContext();
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const loadProjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listProjects();
      setProjects(data?.projects || []);
    } catch (err) {
      setError(err.message || 'Failed to load projects.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Landing on the dashboard means we're not inside any project workspace.
    exitProject();
    if (accessToken) loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const openProject = (project) => {
    navigate(`/projects/${project.id}`);
  };

  const handleCreated = (project) => {
    setModalOpen(false);
    // Fresh project has no documents yet; start the workspace clean.
    loadProjectDocuments([], project.id);
    navigate(`/projects/${project.id}`);
  };

  const activeProjects = projects.filter((p) => p.status !== 'Archived');
  const archivedProjects = projects.filter((p) => p.status === 'Archived');

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
            <li className="text-[#c5fe00] cursor-pointer">Projects</li>
          </ul>
        </div>
        <div className="flex items-center gap-6 text-[#8c8c8b]">
          <button onClick={loadProjects} title="Refresh" className={`hover:text-[#ffffff] transition-colors ${loading ? 'animate-spin text-[#c5fe00]' : ''}`}>
            <RefreshCw size={16} />
          </button>
          <button className="hover:text-[#ffffff] transition-colors"><Bell size={18} /></button>
          <button className="hover:text-[#ffffff] transition-colors"><HelpCircle size={18} /></button>
          <button className="hover:text-[#ffffff] transition-colors"><Settings size={18} /></button>
          <NavAvatar />
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar */}
        <aside className="w-[260px] border-r border-[#262626] border-opacity-50 flex flex-col shrink-0 bg-[#0a0a0a] hidden md:flex overflow-y-auto layout-scrollbar">
          <div className="p-6 pb-2 flex-1 flex flex-col">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-8 h-8 rounded-full bg-[#c5fe00] text-[#0a0a0a] flex items-center justify-center font-bold text-sm">A</div>
              <div className="flex flex-col">
                <span className="text-[#c5fe00] font-bold text-[11px] uppercase tracking-widest leading-none mb-1">TransSync</span>
                <span className="text-[#555555] font-bold text-[9px] uppercase tracking-widest leading-none">AI Studio</span>
              </div>
            </div>

            <button
              onClick={() => setModalOpen(true)}
              className="w-full bg-[#c5fe00] text-[#0a0a0a] hover:bg-[#b9ef00] transition-colors rounded-full py-3.5 flex items-center justify-center gap-2 font-bold text-sm shadow-[0_0_15px_rgba(197,254,0,0.15)] mb-8"
            >
              <Plus size={18} strokeWidth={2.5} /> Create Project
            </button>

            <nav className="space-y-1">
              <SidebarLink to="/dashboard" Icon={LayoutDashboard} label="Projects" active />
              <SidebarLink to="/glossary" Icon={Book} label="Glossary" />
            </nav>
          </div>
          <div className="mt-auto p-6">
            <UserProfileBlock />
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-y-auto bg-[#0a0a0a] relative layout-scrollbar">
          <div className="p-8 lg:p-12 max-w-7xl mx-auto space-y-10">

            <div className="flex items-end justify-between gap-6 flex-wrap">
              <div>
                <h1 className="font-display font-bold text-4xl mb-3 tracking-tight">Projects</h1>
                <p className="text-[#8c8c8b] text-[15px]">
                  Every translation effort lives in a project — its documents, memory,<br />
                  glossary and progress all scoped together.
                </p>
              </div>
              <button
                onClick={() => setModalOpen(true)}
                className="bg-[#c5fe00] text-[#0a0a0a] hover:bg-[#b9ef00] transition-colors rounded-full px-6 py-3.5 flex items-center gap-2 font-black text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(197,254,0,0.2)] hover:scale-[1.02]"
              >
                <Plus size={16} strokeWidth={3} /> Create Project
              </button>
            </div>

            {error && (
              <div className="bg-[#1a0a0a] border border-[#4a1010] rounded-[16px] px-6 py-4 flex items-center justify-between">
                <span className="text-[#ff6b6b] text-sm font-medium">{error}</span>
                <button onClick={loadProjects} className="text-[#ff6b6b] hover:text-white text-[11px] font-bold uppercase tracking-widest border border-[#4a1010] px-3 py-1.5 rounded-full transition-colors">
                  Retry
                </button>
              </div>
            )}

            {/* Grid */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => <SkeletonCard key={i} />)}
              </div>
            ) : activeProjects.length === 0 && archivedProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-20 h-20 rounded-full bg-[#1a1c10] border border-[#2a2e16] flex items-center justify-center mb-8">
                  <FolderOpen size={32} className="text-[#c5fe00]" />
                </div>
                <h3 className="font-display font-bold text-2xl tracking-tight mb-3">No projects yet</h3>
                <p className="text-[#8c8c8b] text-[14px] max-w-sm leading-relaxed mb-8">
                  Create your first project to start uploading and translating documents.
                </p>
                <button
                  onClick={() => setModalOpen(true)}
                  className="bg-[#c5fe00] text-[#0a0a0a] hover:bg-[#b9ef00] transition-colors rounded-full px-8 py-4 flex items-center gap-2 font-black text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(197,254,0,0.2)]"
                >
                  <Plus size={16} strokeWidth={3} /> Create Project
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {activeProjects.map((p) => (
                    <ProjectCard key={p.id} project={p} onOpen={openProject} />
                  ))}
                </div>

                {archivedProjects.length > 0 && (
                  <div className="space-y-4">
                    <h2 className="text-[#555555] font-bold text-[11px] uppercase tracking-[0.2em]">Archived</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 opacity-60">
                      {archivedProjects.map((p) => (
                        <ProjectCard key={p.id} project={p} onOpen={openProject} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      <CreateProjectModal open={modalOpen} onClose={() => setModalOpen(false)} onCreated={handleCreated} />
    </div>
  );
}

export default DashboardPage;
