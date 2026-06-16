import React, { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { exportDocument, exportBatch } from "../services/api";
import { useAppContext } from "../context/AppContext";
import UserProfileBlock from "../components/UserProfileBlock";
import {
  Bell,
  Settings,
  LayoutDashboard,
  FileUp,
  CheckCircle2,
  MessageSquare,
  Book,
  HelpCircle,
  LogOut,
  Download,
  FileText,
  Languages,
  Zap,
  CheckCircle,
  MoreHorizontal,
  Sparkles,
  Loader2,
  ArrowRight,
  RefreshCw,
  FileDown,
} from "lucide-react";

// ── Match badge ───────────────────────────────────────────────────────────────

const MATCH_COLORS = {
  tm_exact:    { bg: "bg-[#1a2010] border-[#2a2e16] text-[#c5fe00]",  label: "TM Exact"    },
  faiss_direct:{ bg: "bg-[#101820] border-[#162030] text-[#00c5fe]",  label: "FAISS"       },
  llm_guided:  { bg: "bg-[#1a1020] border-[#2a1630] text-[#c500fe]",  label: "LLM Guided"  },
  llm_cold:    { bg: "bg-[#1a1a1a] border-[#262626] text-[#8c8c8b]",  label: "LLM Cold"    },
};

function MatchBadge({ matchType }) {
  const cfg = MATCH_COLORS[matchType] || MATCH_COLORS.llm_cold;
  return (
    <span className={`text-[9px] font-bold uppercase tracking-widest rounded-full px-2.5 py-1 border ${cfg.bg} ${cfg.label ? "" : ""} whitespace-nowrap`}
      style={{ color: cfg.bg.includes("c5fe00") ? "#c5fe00" : cfg.bg.includes("00c5fe") ? "#00c5fe" : cfg.bg.includes("c500fe") ? "#c500fe" : "#8c8c8b" }}
    >
      {cfg.label}
    </span>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="bg-[#111111] border border-[#1a1a1a] rounded-[24px] p-6 relative overflow-hidden group hover:border-[#262626] transition-colors">
      {accent && (
        <div className="absolute top-0 right-0 w-24 h-24 opacity-[0.06] blur-[30px] rounded-full pointer-events-none" style={{ backgroundColor: accent }} />
      )}
      <span className="text-[#555555] font-bold text-[9px] uppercase tracking-widest mb-3 block">{label}</span>
      <span className="font-display font-black text-3xl tracking-tight leading-none block mb-1" style={{ color: accent || "#ffffff" }}>
        {value}
      </span>
      {sub && <span className="text-[#555555] text-[11px] font-medium">{sub}</span>}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

function ExportPage() {
  const navigate = useNavigate();
  const {
    results,
    sourceLang,
    docTargetLang,
    targetLang,
    filename,
    docId,
    rawText,
    resetFlow,
    documents,
    activeDocIndex,
    setActiveDocIndex,
  } = useAppContext();

  const multiDoc = documents.length > 1;
  const docsWithResults = documents.filter(d => d.results && d.results.length > 0);
  const effectiveTargetLang = docTargetLang || targetLang;

  // A doc is fully approved when status === "approved"
  const activeDocApproved = documents[activeDocIndex]?.status === "approved";
  const allDocsApproved = docsWithResults.length > 0 && docsWithResults.every(d => d.status === "approved");

  // "idle" | "exporting" | "done" | "error"
  const [exportState, setExportState] = useState("idle");
  const [batchExportState, setBatchExportState] = useState("idle");
  const [exportError, setExportError] = useState("");
  const [previewPage, setPreviewPage] = useState(1);
  const PREVIEW_PER_PAGE = 10;

  // ── Derived stats ──────────────────────────────────────────────────────────
  const tmHits   = useMemo(() => results.filter(r => ["tm_exact", "faiss_direct"].includes(r.match_type)).length, [results]);
  const llmCount = useMemo(() => results.filter(r => ["llm_guided", "llm_cold"].includes(r.match_type)).length, [results]);
  const tmRate   = results.length > 0 ? Math.round((tmHits / results.length) * 100) : 0;

  // ── Preview pagination ─────────────────────────────────────────────────────
  const totalPreviewPages = Math.max(1, Math.ceil(results.length / PREVIEW_PER_PAGE));
  const previewRows = results.slice((previewPage - 1) * PREVIEW_PER_PAGE, previewPage * PREVIEW_PER_PAGE);

  // ── Export handler ─────────────────────────────────────────────────────────
  const handleDownload = async () => {
    if (results.length === 0) return;
    setExportState("exporting");
    setExportError("");

    try {
      await exportDocument({
        doc_id:      docId || "unknown",
        filename:    filename || "document",
        source_lang: sourceLang || "en",
        target_lang: effectiveTargetLang || "xx",
        raw_text:    rawText || "",
        translations: results.map(r => ({
          source:      r.source,
          translation: r.translation,
          match_type:  r.match_type || null,
        })),
      });
      setExportState("done");
    } catch (err) {
      setExportError(err.message || "Export failed.");
      setExportState("error");
    }
  };

  const handleNewTranslation = () => {
    resetFlow();
    navigate("/upload");
  };

  // ── Batch export handler ───────────────────────────────────────────────────
  const handleBatchDownload = async () => {
    if (docsWithResults.length === 0) return;
    setBatchExportState("exporting");
    setExportError("");
    try {
      await exportBatch(
        docsWithResults.map(doc => ({
          doc_id:      doc.docId || "unknown",
          filename:    doc.filename || "document",
          source_lang: sourceLang || "en",
          target_lang: doc.targetLang || targetLang || "xx",
          raw_text:    doc.rawText || "",
          translations: (doc.results || []).map(r => ({
            source:      r.source,
            translation: r.translation,
            match_type:  r.match_type || null,
          })),
        }))
      );
      setBatchExportState("done");
    } catch (err) {
      setExportError(err.message || "Batch export failed.");
      setBatchExportState("error");
    }
  };

  // ── Single-doc download helper ─────────────────────────────────────────────
  const handleSingleDownload = async (doc) => {
    try {
      await exportDocument({
        doc_id:      doc.docId || "unknown",
        filename:    doc.filename || "document",
        source_lang: sourceLang || "en",
        target_lang: doc.targetLang || targetLang || "xx",
        raw_text:    doc.rawText || "",
        translations: (doc.results || []).map(r => ({
          source:      r.source,
          translation: r.translation,
          match_type:  r.match_type || null,
        })),
      });
    } catch (err) {
      setExportError(err.message || "Export failed.");
    }
  };

  // ── Empty state ────────────────────────────────────────────────────────────
  if (results.length === 0 && docsWithResults.length === 0) {
    return (
      <div className="h-screen bg-[#0a0a0a] text-white font-sans flex overflow-hidden selection:bg-[#c5fe00] selection:text-[#0a0a0a]">
        <Sidebar active="export" />
        <div className="flex-1 flex flex-col items-center justify-center bg-[#0e0e0e]">
          <div className="w-20 h-20 rounded-full bg-[#1a1a1a] border border-[#262626] flex items-center justify-center mb-8">
            <FileDown size={32} className="text-[#555555]" />
          </div>
          <h2 className="font-display font-bold text-3xl tracking-tight mb-3 text-center">No Translation Data</h2>
          <p className="text-[#8c8c8b] text-[15px] mb-10 text-center max-w-sm leading-relaxed">
            Complete a translation workflow first before downloading your document.
          </p>
          <Link
            to="/upload"
            className="bg-[#c5fe00] hover:bg-[#b9ef00] text-[#0a0a0a] rounded-full px-8 py-4 font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(197,254,0,0.2)] hover:scale-[1.02]"
          >
            <FileUp size={14} /> Start a Translation
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#0a0a0a] text-white font-sans flex overflow-hidden selection:bg-[#c5fe00] selection:text-[#0a0a0a]">
      <Sidebar active="export" />

      <div className="flex-1 flex flex-col relative w-full h-full overflow-hidden bg-[#0e0e0e]">

        {/* Top Nav */}
        <nav className="h-[80px] w-full flex items-center justify-between px-8 border-b border-[#1a1a1a] bg-[#0a0a0a] shrink-0 z-40">
          <div className="flex items-center gap-4">
            <Link to="/" className="font-display font-bold text-xl tracking-tight text-[#c5fe00] leading-none">TransSync</Link>
            <div className="w-px h-6 bg-[#262626]" />
            <span className="text-[#8c8c8b] text-[13px] font-medium">
              {filename || "Document"} → <span className="text-white font-bold">{effectiveTargetLang?.toUpperCase() || "—"}</span>
            </span>
          </div>
          <div className="flex items-center gap-6">
            <button className="text-[#8c8c8b] hover:text-white transition-colors"><Bell size={18} /></button>
            <button className="text-[#8c8c8b] hover:text-white transition-colors"><HelpCircle size={18} /></button>
            <button className="text-[#8c8c8b] hover:text-white transition-colors"><Settings size={18} /></button>
            <button className="w-8 h-8 rounded-full bg-[#1a1a1a] border border-[#262626] overflow-hidden ml-2">
              <img src="https://i.pravatar.cc/150?img=11" alt="avatar" className="w-full h-full object-cover" />
            </button>
          </div>
        </nav>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto layout-scrollbar">
          <div className="p-8 lg:p-12 max-w-[1400px] mx-auto">

            {/* Ambient glow */}
            <div className="fixed top-0 left-[30%] w-[700px] h-[400px] bg-[#c5fe00] opacity-[0.03] blur-[160px] rounded-full pointer-events-none z-0" />

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 relative z-10 gap-6">
              <div>
                <h1 className="font-display font-black text-5xl tracking-tight mb-3 leading-none">
                  export &amp; <br className="hidden md:block" />download
                </h1>
                <p className="text-[#8c8c8b] text-[15px] font-sans max-w-lg leading-relaxed">
                  Your translated document is ready. Download it as a formatted DOCX file, or start a new translation.
                </p>
              </div>
              <button
                onClick={handleNewTranslation}
                className="border border-[#262626] text-[#8c8c8b] hover:text-white hover:border-[#555555] rounded-full px-6 py-3 font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-colors whitespace-nowrap"
              >
                <RefreshCw size={13} /> New Translation
              </button>
            </div>

            {/* ── Multi-doc Document Table ── */}
            {multiDoc && docsWithResults.length > 0 && (
              <div className="bg-[#111111] border border-[#1a1a1a] rounded-[32px] overflow-hidden mb-8 relative z-10">
                <div className="px-8 py-6 border-b border-[#1a1a1a] flex items-center justify-between">
                  <div>
                    <h3 className="font-display font-bold text-lg tracking-tight">Documents</h3>
                    <p className="text-[#555555] text-[11px] mt-0.5">{docsWithResults.length} document{docsWithResults.length !== 1 ? "s" : ""} ready</p>
                  </div>
                  <button
                    onClick={handleBatchDownload}
                    disabled={batchExportState === "exporting" || !allDocsApproved}
                    title={!allDocsApproved ? "All documents must be fully approved before batch download" : ""}
                    className="bg-[#c5fe00] hover:bg-[#b9ef00] text-[#0a0a0a] rounded-full px-6 py-3 font-black flex items-center gap-2 text-[10px] uppercase tracking-widest shadow-[0_0_15px_rgba(197,254,0,0.2)] hover:scale-[1.02] transform transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100"
                  >
                    {batchExportState === "exporting" ? (
                      <><Loader2 size={12} className="animate-spin" /> Zipping…</>
                    ) : batchExportState === "done" ? (
                      <><CheckCircle size={12} /> Downloaded ZIP!</>
                    ) : (
                      <><Download size={12} /> Download All as ZIP</>
                    )}
                  </button>
                </div>
                <div className="divide-y divide-[#1a1a1a]">
                  {docsWithResults.map((doc, i) => {
                    const docTm = (doc.results || []).filter(r => ["tm_exact", "faiss_direct"].includes(r.match_type)).length;
                    const docLlm = (doc.results || []).filter(r => ["llm_guided", "llm_cold"].includes(r.match_type)).length;
                    const isActive = documents.indexOf(doc) === activeDocIndex;
                    return (
                      <div
                        key={doc.docId}
                        onClick={() => setActiveDocIndex(documents.indexOf(doc))}
                        className={`grid grid-cols-12 gap-4 px-8 py-5 cursor-pointer transition-colors ${
                          isActive ? "bg-[#1a1c10]/50" : "hover:bg-[#141414]"
                        }`}
                      >
                        <div className="col-span-4 flex items-center gap-3 min-w-0">
                          <FileText size={14} className="text-[#c5fe00] shrink-0" />
                          <span className="text-[13px] font-medium truncate">{doc.filename}</span>
                        </div>
                        <div className="col-span-2 flex items-center">
                          <span className="text-[#8c8c8b] text-[12px]">{(doc.results || []).length} sentences</span>
                        </div>
                        <div className="col-span-2 flex items-center">
                          <span className="text-[#00c5fe] text-[12px] font-bold">{docTm} TM</span>
                        </div>
                        <div className="col-span-2 flex items-center">
                          <span className="text-[#c500fe] text-[12px] font-bold">{docLlm} LLM</span>
                        </div>
                        <div className="col-span-2 flex items-center justify-end">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleSingleDownload(doc); }}
                            disabled={doc.status !== "approved"}
                            title={doc.status !== "approved" ? "Approve all batches for this document first" : "Download"}
                            className="text-[#c5fe00] hover:text-[#b9ef00] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Download size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Stats Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 relative z-10">
              <StatCard
                label="Total Sentences"
                value={results.length.toLocaleString()}
                sub="translated & reviewed"
                accent="#c5fe00"
              />
              <StatCard
                label="TM Hits"
                value={tmHits.toLocaleString()}
                sub={`${tmRate}% memory reuse`}
                accent="#00c5fe"
              />
              <StatCard
                label="LLM Translations"
                value={llmCount.toLocaleString()}
                sub="new translations saved"
                accent="#c500fe"
              />
              <StatCard
                label="Language Pair"
                value={`${(sourceLang || "en").toUpperCase()} → ${(effectiveTargetLang || "—").toUpperCase()}`}
                sub={filename || "document"}
              />
            </div>

            {/* Main grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">

              {/* Download Card — left */}
              <div className="lg:col-span-4 flex flex-col gap-6">

                {/* Primary download card */}
                <div className="bg-[#15170d] border border-[#2a2e16] rounded-[32px] p-8 relative overflow-hidden shadow-[0_20px_60px_rgba(197,254,0,0.04)]">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-[#c5fe00] opacity-[0.06] blur-[60px] rounded-full pointer-events-none" />
                  <div className="relative z-10">

                    {/* File icon */}
                    <div className="w-14 h-14 rounded-[16px] bg-[#1a2010] border border-[#2a2e16] flex items-center justify-center mb-6">
                      <FileText size={24} className="text-[#c5fe00]" />
                    </div>

                    <h3 className="font-display font-bold text-xl tracking-tight mb-2">Translated DOCX</h3>
                    <p className="text-[#555555] text-[12px] font-medium mb-1">
                      {filename ? `translated_${filename.replace(/\.[^/.]+$/, "")}_${effectiveTargetLang}.docx` : `translated_document_${effectiveTargetLang}.docx`}
                    </p>
                    <p className="text-[#555555] text-[11px] mb-8">
                      {results.length} sentences · {effectiveTargetLang?.toUpperCase()} · DOCX format
                    </p>

                    {/* Error */}
                    {exportState === "error" && (
                      <div className="bg-[#2a1313] border border-[#4a2020] rounded-[12px] px-4 py-3 mb-4 text-[#ff6b6b] text-[12px]">
                        {exportError}
                      </div>
                    )}

                    {/* Download button */}
                    <button
                      onClick={handleDownload}
                      disabled={exportState === "exporting" || !activeDocApproved}
                      title={!activeDocApproved ? "Complete review and approve all batches before downloading" : ""}
                      className="w-full bg-[#c5fe00] hover:bg-[#b9ef00] text-[#0a0a0a] rounded-full py-4 font-black flex items-center justify-center gap-3 text-xs uppercase tracking-widest shadow-[0_0_25px_rgba(197,254,0,0.25)] hover:scale-[1.02] transform transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100"
                    >
                      {exportState === "exporting" ? (
                        <><Loader2 size={14} className="animate-spin" /> Generating…</>
                      ) : exportState === "done" ? (
                        <><CheckCircle size={14} /> Downloaded!</>
                      ) : (
                        <><Download size={14} strokeWidth={2.5} /> Download DOCX</>
                      )}
                    </button>

                    {!activeDocApproved && (
                      <p className="text-[#555555] text-[11px] text-center mt-3 leading-relaxed">
                        Approve all translation batches in the Review page to unlock download.
                      </p>
                    )}

                    {exportState === "done" && (
                      <p className="text-[#555555] text-[11px] text-center mt-3">
                        File saved to your Downloads folder.
                      </p>
                    )}
                  </div>
                </div>

                {/* Pipeline Breakdown */}
                <div className="bg-[#111111] border border-[#1a1a1a] rounded-[32px] p-8">
                  <h4 className="text-[#555555] font-bold text-[10px] uppercase tracking-widest mb-6">Pipeline Breakdown</h4>
                  <div className="space-y-4">
                    {[
                      { label: "TM Exact",     count: results.filter(r => r.match_type === "tm_exact").length,    color: "#c5fe00" },
                      { label: "FAISS Direct",  count: results.filter(r => r.match_type === "faiss_direct").length, color: "#00c5fe" },
                      { label: "LLM Guided",    count: results.filter(r => r.match_type === "llm_guided").length,  color: "#c500fe" },
                      { label: "LLM Cold",      count: results.filter(r => r.match_type === "llm_cold").length,    color: "#8c8c8b" },
                    ].map(({ label, count, color }) => (
                      <div key={label}>
                        <div className="flex justify-between text-[11px] font-medium mb-1.5">
                          <span className="text-[#8c8c8b]">{label}</span>
                          <span style={{ color }} className="font-bold">{count}</span>
                        </div>
                        <div className="w-full h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: results.length > 0 ? `${(count / results.length) * 100}%` : "0%",
                              backgroundColor: color,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Translation Preview — right */}
              <div className="lg:col-span-8 bg-[#111111] border border-[#1a1a1a] rounded-[32px] overflow-hidden flex flex-col">

                {/* Preview header */}
                <div className="px-8 py-6 border-b border-[#1a1a1a] flex items-center justify-between">
                  <div>
                    <h3 className="font-display font-bold text-lg tracking-tight">Translation Preview</h3>
                    <p className="text-[#555555] text-[11px] mt-0.5">{results.length} sentences total</p>
                  </div>
                  <div className="flex items-center gap-2 text-[#555555] text-[11px] font-bold">
                    <Languages size={14} />
                    <span>{(sourceLang || "EN").toUpperCase()} → {(effectiveTargetLang || "—").toUpperCase()}</span>
                  </div>
                </div>

                {/* Table header */}
                <div className="grid grid-cols-10 gap-0 px-6 py-3 bg-[#0e0e0e] border-b border-[#1a1a1a]">
                  <span className="col-span-4 text-[#555555] font-bold text-[9px] uppercase tracking-widest">#  Source</span>
                  <span className="col-span-4 text-[#555555] font-bold text-[9px] uppercase tracking-widest">Translation</span>
                  <span className="col-span-2 text-[#555555] font-bold text-[9px] uppercase tracking-widest text-right">Match</span>
                </div>

                {/* Table rows */}
                <div className="flex-1 overflow-y-auto layout-scrollbar divide-y divide-[#1a1a1a]">
                  {previewRows.map((row, i) => {
                    const globalIndex = (previewPage - 1) * PREVIEW_PER_PAGE + i + 1;
                    return (
                      <div key={i} className="grid grid-cols-10 gap-0 px-6 py-4 hover:bg-[#141414] transition-colors">
                        <div className="col-span-4 pr-4">
                          <span className="text-[#555555] text-[10px] font-bold mr-2">{globalIndex}.</span>
                          <span className="text-[#a0a09f] text-[13px] leading-snug">{row.source}</span>
                        </div>
                        <div className="col-span-4 pr-4">
                          <span className="text-white text-[13px] leading-snug">{row.translation}</span>
                        </div>
                        <div className="col-span-2 flex items-start justify-end pt-0.5">
                          <MatchBadge matchType={row.match_type} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination */}
                {totalPreviewPages > 1 && (
                  <div className="px-8 py-5 border-t border-[#1a1a1a] flex items-center justify-between">
                    <span className="text-[#555555] text-[11px] font-medium">
                      Page {previewPage} of {totalPreviewPages}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPreviewPage(p => Math.max(1, p - 1))}
                        disabled={previewPage === 1}
                        className="text-[#555555] hover:text-white disabled:opacity-30 font-bold text-[11px] uppercase tracking-widest transition-colors"
                      >
                        ← Prev
                      </button>
                      <div className="flex gap-1">
                        {Array.from({ length: Math.min(totalPreviewPages, 5) }, (_, i) => i + 1).map(p => (
                          <button
                            key={p}
                            onClick={() => setPreviewPage(p)}
                            className={`w-7 h-7 rounded-full text-[11px] font-bold transition-colors ${
                              p === previewPage
                                ? "bg-[#1a1c10] text-[#c5fe00] border border-[#2a2e16]"
                                : "text-[#555555] hover:text-white"
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => setPreviewPage(p => Math.min(totalPreviewPages, p + 1))}
                        disabled={previewPage === totalPreviewPages}
                        className="text-[#555555] hover:text-white disabled:opacity-30 font-bold text-[11px] uppercase tracking-widest transition-colors"
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function Sidebar({ active }) {
  const navItems = [
    { to: "/dashboard",  Icon: LayoutDashboard, label: "Dashboard"  },
    { to: "/upload",     Icon: FileUp,           label: "Upload"     },
    { to: "/validation", Icon: CheckCircle2,     label: "Validation" },
    { to: "/review",     Icon: MessageSquare,    label: "Review"     },
    { to: "/glossary",   Icon: Book,             label: "Glossary"   },
    { to: "/export",     Icon: Download,         label: "Export"     },
  ];

  return (
    <aside className="w-[260px] border-r border-[#262626] border-opacity-50 flex flex-col shrink-0 bg-[#0a0a0a] hidden md:flex z-50 overflow-y-auto layout-scrollbar">
      <div className="p-6 pb-2 flex-1 flex flex-col">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-10 h-10 rounded-full bg-[#c5fe00] text-[#0a0a0a] flex items-center justify-center p-2 shadow-[0_0_20px_rgba(197,254,0,0.2)]">
            <Sparkles strokeWidth={2.5} size={22} />
          </div>
          <div className="flex flex-col">
            <span className="font-display text-[#c5fe00] font-black text-sm tracking-tight leading-none mb-1">TransSync</span>
            <span className="text-[#555555] font-bold text-[9px] uppercase tracking-widest leading-none">AI Studio</span>
          </div>
        </div>

        <nav className="space-y-1">
          {navItems.map(({ to, Icon, label }) =>
            to === "/export" && active === "export" ? (
              <div key={to} className="flex items-center gap-4 bg-[#1a1c10] text-[#c5fe00] border border-[#2a2e16] px-4 py-3 rounded-[12px] shadow-[inset_0_0_10px_rgba(197,254,0,0.05)]">
                <Icon size={18} />
                <span className="text-[11px] font-bold uppercase tracking-widest">{label}</span>
              </div>
            ) : (
              <Link key={to} to={to} className="flex items-center gap-4 text-[#8c8c8b] hover:text-white hover:bg-[#131313] transition-colors px-4 py-3 rounded-[12px]">
                <Icon size={18} />
                <span className="text-[11px] font-bold uppercase tracking-widest">{label}</span>
              </Link>
            )
          )}
        </nav>
      </div>

      <div className="p-6 space-y-1 pb-8">
        <UserProfileBlock />
      </div>
    </aside>
  );
}

export default ExportPage;
