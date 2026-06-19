import React, { useEffect, useState, useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, FileUp, FileText, Book, BarChart3, Loader2, Plus, RefreshCw,
  Globe, Tag, Calendar, CheckCircle, Trash2,
} from "lucide-react";
import {
  getProject, fetchGlossary, addGlossaryTerm, deleteDocument as apiDeleteDocument,
} from "../services/api";
import { useAppContext } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import NavAvatar from "../components/NavAvatar";
import { languageLabel } from "../constants/languages";
import { statusStyle, stageMeta } from "../constants/projects";

// Map a document stage to the workflow page that resumes it.
function routeForStage(stage) {
  switch (stage) {
    case "uploaded":
    case "validating":
      return "/validation";
    case "validated":
    case "translating":
    case "in_review":
    case "translated":
      return "/review";
    case "approved":
    case "exported":
      return "/export";
    default:
      return "/validation";
  }
}

const TIER_META = [
  { key: "tm_exact", label: "TM Exact", color: "#c5fe00" },
  { key: "faiss_direct", label: "FAISS Direct", color: "#00c5fe" },
  { key: "llm_guided", label: "LLM Guided", color: "#c500fe" },
  { key: "llm_cold", label: "LLM Cold", color: "#8c8c8b" },
];

function timeAgo(isoString) {
  if (!isoString) return "—";
  const diff = Date.now() - new Date(isoString).getTime();
  if (Number.isNaN(diff)) return "—";
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Documents tab ──────────────────────────────────────────────────────────────

function DocumentsTab({ documents, onOpen, onUpload, onDelete }) {
  if (!documents.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-[#1a1c10] border border-[#2a2e16] flex items-center justify-center mb-6">
          <FileText size={28} className="text-[#c5fe00]" />
        </div>
        <h3 className="font-display font-bold text-xl tracking-tight mb-2">No documents yet</h3>
        <p className="text-[#8c8c8b] text-[13px] max-w-sm mb-8">Upload PDFs or DOCX files to start translating inside this project.</p>
        <button onClick={onUpload} className="bg-[#c5fe00] hover:bg-[#b9ef00] text-[#0a0a0a] rounded-full px-8 py-3.5 font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(197,254,0,0.2)]">
          <FileUp size={14} /> Upload Documents
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[#111111] border border-[#262626] rounded-[24px] overflow-hidden">
      <table className="w-full text-left">
        <thead>
          <tr>
            <th className="py-4 px-6 text-[#555555] text-[10px] font-bold tracking-widest uppercase border-b border-[#262626] w-2/5">Document</th>
            <th className="py-4 px-6 text-[#555555] text-[10px] font-bold tracking-widest uppercase border-b border-[#262626]">Stage</th>
            <th className="py-4 px-6 text-[#555555] text-[10px] font-bold tracking-widest uppercase border-b border-[#262626]">Progress</th>
            <th className="py-4 px-6 text-[#555555] text-[10px] font-bold tracking-widest uppercase border-b border-[#262626] text-right">Updated</th>
            <th className="py-4 px-6 border-b border-[#262626]" />
          </tr>
        </thead>
        <tbody className="text-[13px]">
          {documents.map((d, i) => {
            const meta = stageMeta(d.stage);
            const total = d.sentence_count || 0;
            const reviewed = d.reviewed_count || 0;
            const pct = total > 0 ? Math.round((reviewed / total) * 100) : 0;
            return (
              <tr key={d.id} className={`border-b border-[#262626] hover:bg-[#161616] transition-colors ${i === documents.length - 1 ? "border-b-0" : ""}`}>
                <td className="py-4 px-6">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText size={15} className="text-[#a0a09f] shrink-0" />
                    <span className="truncate font-medium">{d.filename}</span>
                  </div>
                </td>
                <td className="py-4 px-6">
                  <span
                    className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border"
                    style={{ color: meta.color, borderColor: `${meta.color}33`, backgroundColor: `${meta.color}11` }}
                  >
                    {meta.label}
                  </span>
                </td>
                <td className="py-4 px-6">
                  <div className="flex items-center gap-3">
                    <div className="w-24 h-1.5 rounded-full bg-[#1a1a1a] overflow-hidden">
                      <div className="h-full bg-[#c5fe00] rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[#8c8c8b] text-[11px] font-bold">{pct}%</span>
                  </div>
                </td>
                <td className="py-4 px-6 text-right text-[#555555] text-[11px] font-bold uppercase tracking-widest whitespace-nowrap">
                  {timeAgo(d.updated_at)}
                </td>
                <td className="py-4 px-6 text-right whitespace-nowrap">
                  <button
                    onClick={() => onOpen(d)}
                    className="text-[#c5fe00] hover:text-[#b9ef00] text-[10px] font-bold uppercase tracking-widest border border-[#2a2e16] bg-[#1a1c10] rounded-full px-4 py-2 transition-colors"
                  >
                    Continue
                  </button>
                  <button
                    onClick={() => onDelete(d)}
                    title="Delete document"
                    className="ml-2 text-[#555555] hover:text-[#ff6b6b] transition-colors align-middle"
                  >
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Glossary tab ──────────────────────────────────────────────────────────────

function GlossaryTab({ projectId, targetLang }) {
  const [terms, setTerms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [src, setSrc] = useState("");
  const [tgt, setTgt] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchGlossary({ projectId });
      setTerms(data?.terms || []);
    } catch (e) {
      setError(e.message || "Failed to load glossary.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!src.trim() || !tgt.trim()) return;
    setAdding(true);
    setError("");
    try {
      await addGlossaryTerm({
        source_term: src.trim(),
        target_term: tgt.trim(),
        target_lang: targetLang || "fr",
        status: "VERIFIED",
        project_id: projectId,
      });
      setSrc(""); setTgt("");
      await load();
    } catch (e) {
      setError(e.message || "Failed to add term.");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleAdd} className="bg-[#111111] border border-[#262626] rounded-[20px] p-5 flex flex-col sm:flex-row gap-3 items-end">
        <div className="flex-1 w-full">
          <label className="text-[#555555] font-bold text-[9px] uppercase tracking-widest mb-1.5 block">Source Term</label>
          <input value={src} onChange={(e) => setSrc(e.target.value)} placeholder="Neural Interface"
            className="w-full bg-[#0e0e0e] border border-[#262626] focus:border-[#c5fe00] rounded-[12px] px-3 py-2.5 text-[13px] text-white placeholder-[#555555] outline-none" />
        </div>
        <div className="flex-1 w-full">
          <label className="text-[#555555] font-bold text-[9px] uppercase tracking-widest mb-1.5 block">Target Term ({targetLang ? languageLabel(targetLang) : "—"})</label>
          <input value={tgt} onChange={(e) => setTgt(e.target.value)} placeholder="Interface Neurale"
            className="w-full bg-[#0e0e0e] border border-[#262626] focus:border-[#c5fe00] rounded-[12px] px-3 py-2.5 text-[13px] text-white placeholder-[#555555] outline-none" />
        </div>
        <button type="submit" disabled={adding}
          className="bg-[#c5fe00] hover:bg-[#b9ef00] text-[#0a0a0a] rounded-full px-5 py-2.5 font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-colors disabled:opacity-60 shrink-0">
          {adding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Add
        </button>
      </form>

      {error && <div className="bg-[#2a1313] border border-[#4a2020] rounded-[12px] px-4 py-3 text-[#ff6b6b] text-[12px]">{error}</div>}

      <div className="bg-[#111111] border border-[#262626] rounded-[20px] overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-[#555555] text-sm"><Loader2 size={20} className="animate-spin mx-auto" /></div>
        ) : terms.length === 0 ? (
          <div className="p-10 text-center text-[#555555] text-sm">No project glossary terms yet.</div>
        ) : (
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr>
                <th className="py-3 px-6 text-[#555555] text-[10px] font-bold tracking-widest uppercase border-b border-[#262626]">Source</th>
                <th className="py-3 px-6 text-[#555555] text-[10px] font-bold tracking-widest uppercase border-b border-[#262626]">Target</th>
                <th className="py-3 px-6 text-[#555555] text-[10px] font-bold tracking-widest uppercase border-b border-[#262626]">Lang</th>
                <th className="py-3 px-6 text-[#555555] text-[10px] font-bold tracking-widest uppercase border-b border-[#262626]">Status</th>
              </tr>
            </thead>
            <tbody>
              {terms.map((t) => (
                <tr key={t.id} className="border-b border-[#262626] last:border-b-0">
                  <td className="py-3 px-6 font-medium">{t.source_term}</td>
                  <td className="py-3 px-6 text-[#a0a09f]">{t.target_term}</td>
                  <td className="py-3 px-6 text-[#8c8c8b] text-[11px] uppercase">{t.target_lang}</td>
                  <td className="py-3 px-6">
                    <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-full ${t.status === "VERIFIED" ? "bg-[#1a2010] text-[#c5fe00] border border-[#2a2e16]" : "bg-[#201c00] text-[#ffcc00] border border-[#3a3000]"}`}>
                      {t.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Stats tab ──────────────────────────────────────────────────────────────────

function StatsTab({ stats }) {
  const breakdown = stats?.tier_breakdown || {};
  const total = TIER_META.reduce((acc, t) => acc + (breakdown[t.key] || 0), 0);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Documents", value: stats?.document_count ?? 0, accent: "#c5fe00" },
          { label: "Sentences", value: stats?.total_sentences ?? 0, accent: "#00c5fe" },
          { label: "Reviewed", value: stats?.reviewed_count ?? 0, accent: "#c500fe" },
          { label: "Progress", value: `${stats?.progress_percent ?? 0}%`, accent: "#ffcc00" },
        ].map((s) => (
          <div key={s.label} className="bg-[#111111] border border-[#262626] rounded-[20px] p-6">
            <span className="text-[#555555] font-bold text-[9px] uppercase tracking-widest mb-3 block">{s.label}</span>
            <span className="font-display font-black text-3xl tracking-tight" style={{ color: s.accent }}>{s.value}</span>
          </div>
        ))}
      </div>

      <div className="bg-[#10130a] border border-[#1a2010] rounded-[24px] p-8 space-y-5">
        <div>
          <h3 className="font-display font-bold text-lg tracking-tight">TM Reuse Breakdown</h3>
          <p className="text-[#8c8c8b] text-[12px] mt-0.5">Match-type tier distribution across all documents in this project</p>
        </div>
        {total === 0 ? (
          <p className="text-[#555555] text-sm py-4">No translation activity yet.</p>
        ) : (
          TIER_META.map(({ key, label, color }) => {
            const count = breakdown[key] || 0;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div key={key}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[#a0a09f] text-[12px] font-semibold">{label}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-[13px]">{count}</span>
                    <span className="text-[#555555] text-[11px] w-8 text-right">{pct}%</span>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-[#1a1a1a] overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

function ProjectWorkspacePage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const { loadProjectDocuments, setActiveDocIndex, documents: ctxDocuments, setTargetLang } = useAppContext();

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("documents");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getProject(projectId);
      setDetail(data);
      // DB is the source of truth — rehydrate AppContext working set + scope.
      loadProjectDocuments(data?.documents || [], projectId);
      // Pre-select the project's target language so Review/translation default to it.
      if (data?.project?.target_language) setTargetLang(data.project.target_language);
    } catch (e) {
      setError(e.message || "Failed to load project.");
    } finally {
      setLoading(false);
    }
  }, [projectId, loadProjectDocuments]);

  useEffect(() => {
    if (accessToken) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, projectId]);

  const project = detail?.project;
  const docs = detail?.documents || [];

  const handleOpenDoc = (dbDoc) => {
    // Documents were loaded into AppContext in the same order as detail.documents.
    const idx = (ctxDocuments || []).findIndex((d) => d.documentId === dbDoc.id);
    if (idx >= 0) setActiveDocIndex(idx);
    navigate(routeForStage(dbDoc.stage));
  };

  const handleUpload = () => navigate("/upload");

  const handleDelete = async (dbDoc) => {
    try {
      await apiDeleteDocument(dbDoc.id);
      await load();
    } catch (e) {
      setError(e.message || "Failed to delete document.");
    }
  };

  return (
    <div className="h-screen bg-[#0a0a0a] text-[#ffffff] font-sans flex flex-col overflow-hidden selection:bg-[#c5fe00] selection:text-[#0a0a0a]">
      {/* Top nav */}
      <nav className="h-[72px] border-b border-[#262626] border-opacity-50 flex items-center justify-between px-8 bg-[#0a0a0a] shrink-0 z-20">
        <div className="flex items-center gap-4">
          <Link to="/dashboard" className="flex items-center gap-2 text-[#8c8c8b] hover:text-white transition-colors">
            <ArrowLeft size={18} />
            <span className="text-[11px] font-bold uppercase tracking-widest">Projects</span>
          </Link>
          <div className="w-px h-6 bg-[#262626]" />
          <span className="font-display font-bold text-lg tracking-tight truncate max-w-[40vw]">
            {project?.name || (loading ? "Loading…" : "Project")}
          </span>
        </div>
        <div className="flex items-center gap-6 text-[#8c8c8b]">
          <button onClick={load} title="Refresh" className={`hover:text-white transition-colors ${loading ? "animate-spin text-[#c5fe00]" : ""}`}>
            <RefreshCw size={16} />
          </button>
          <NavAvatar />
        </div>
      </nav>

      <div className="flex-1 overflow-y-auto layout-scrollbar">
        <div className="p-8 lg:p-12 max-w-6xl mx-auto space-y-8">

          {error && (
            <div className="bg-[#1a0a0a] border border-[#4a1010] rounded-[16px] px-6 py-4 flex items-center justify-between">
              <span className="text-[#ff6b6b] text-sm font-medium">{error}</span>
              <button onClick={load} className="text-[#ff6b6b] hover:text-white text-[11px] font-bold uppercase tracking-widest border border-[#4a1010] px-3 py-1.5 rounded-full">Retry</button>
            </div>
          )}

          {project && (
            <>
              {/* Header / metadata */}
              <div className="flex items-start justify-between gap-6 flex-wrap">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="font-display font-bold text-3xl tracking-tight">{project.name}</h1>
                    <span className={`text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border ${statusStyle(project.status)}`}>
                      {project.status}
                    </span>
                  </div>
                  {project.description && <p className="text-[#8c8c8b] text-[14px] max-w-2xl leading-relaxed">{project.description}</p>}
                  <div className="flex flex-wrap items-center gap-2 mt-4">
                    <span className="inline-flex items-center gap-1.5 bg-[#1a1a1a] border border-[#262626] text-[#a0a09f] text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full">
                      <Globe size={11} className="text-[#c5fe00]" />
                      {(project.source_language || "en").toUpperCase()} → {project.target_language ? languageLabel(project.target_language) : "—"}
                    </span>
                    {project.domain && (
                      <span className="inline-flex items-center gap-1.5 bg-[#1a1a1a] border border-[#262626] text-[#a0a09f] text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full">
                        <Tag size={11} className="text-[#00c5fe]" /> {project.domain}
                      </span>
                    )}
                    {project.deadline && (
                      <span className="inline-flex items-center gap-1.5 bg-[#1a1a1a] border border-[#262626] text-[#a0a09f] text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full">
                        <Calendar size={11} className="text-[#ffcc00]" /> {project.deadline}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5 bg-[#1a1a1a] border border-[#262626] text-[#a0a09f] text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full">
                      <CheckCircle size={11} className="text-[#c5fe00]" /> {detail?.stats?.progress_percent ?? 0}% done
                    </span>
                  </div>
                </div>
                <button onClick={handleUpload}
                  className="bg-[#c5fe00] hover:bg-[#b9ef00] text-[#0a0a0a] rounded-full px-6 py-3.5 font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(197,254,0,0.2)] hover:scale-[1.02]">
                  <FileUp size={14} /> Upload Documents
                </button>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-8 border-b border-[#262626]">
                {[
                  { key: "documents", label: "Documents", Icon: FileText },
                  { key: "glossary", label: "Glossary", Icon: Book },
                  { key: "stats", label: "Stats", Icon: BarChart3 },
                ].map(({ key, label, Icon }) => (
                  <button key={key} onClick={() => setTab(key)}
                    className={`flex items-center gap-2 pb-4 -mb-px border-b-2 text-[11px] font-bold uppercase tracking-widest transition-colors ${tab === key ? "text-[#c5fe00] border-[#c5fe00]" : "text-[#555555] border-transparent hover:text-[#8c8c8b]"}`}>
                    <Icon size={14} /> {label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              {tab === "documents" && (
                <DocumentsTab documents={docs} onOpen={handleOpenDoc} onUpload={handleUpload} onDelete={handleDelete} />
              )}
              {tab === "glossary" && (
                <GlossaryTab projectId={projectId} targetLang={project.target_language} />
              )}
              {tab === "stats" && <StatsTab stats={detail?.stats} />}
            </>
          )}

          {loading && !project && (
            <div className="py-24 text-center text-[#555555]"><Loader2 size={28} className="animate-spin mx-auto" /></div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProjectWorkspacePage;
