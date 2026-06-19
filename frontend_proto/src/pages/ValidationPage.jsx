import React, { useState, useCallback, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { validateText } from "../services/api";
import { useAppContext } from "../context/AppContext";
import UserProfileBlock from "../components/UserProfileBlock";
import {
  Bell,
  LayoutDashboard,
  FileUp,
  CheckCircle2,
  MessageSquare,
  Book,
  HelpCircle,
  Settings,
  LogOut,
  FileText,
  AlertTriangle,
  AlertCircle,
  Info,
  Activity,
  ArrowRight,
  Sparkles,
  CheckCircle,
  Loader2,
  ShieldCheck,
  Download,
  Zap,
} from "lucide-react";

// ── Severity classification ───────────────────────────────────────────────────

const HIGH_KEYWORDS   = ["empty", "too short", "minimum", "invalid", "too few", "no text", "cannot", "failed"];
const MEDIUM_KEYWORDS = ["warning", "mixed", "language", "encoding", "length", "unusual", "short"];

function classifyError(errorStr) {
  const lower = errorStr.toLowerCase();
  if (HIGH_KEYWORDS.some((k) => lower.includes(k))) return "high";
  if (MEDIUM_KEYWORDS.some((k) => lower.includes(k))) return "medium";
  return "low";
}

function computeHealthScore(errors) {
  const highCount   = errors.filter((e) => classifyError(e) === "high").length;
  const mediumCount = errors.filter((e) => classifyError(e) === "medium").length;
  return Math.max(0, 100 - highCount * 20 - mediumCount * 8);
}

// ── Error Card ────────────────────────────────────────────────────────────────

function ErrorCard({ errorText, index }) {
  const severity = classifyError(errorText);

  const config = {
    high: {
      label:   "High Severity",
      color:   "#ff3333",
      bg:      "#2a1313",
      iconBg:  "#2a1313",
      glow:    "#ff4d4d",
      Icon:    AlertTriangle,
    },
    medium: {
      label:   "Medium Severity",
      color:   "#ffd166",
      bg:      "#262111",
      iconBg:  "#262111",
      glow:    "#ffd166",
      Icon:    AlertCircle,
    },
    low: {
      label:   "Low / Info",
      color:   "#8c8c8b",
      bg:      "#1a1a1a",
      iconBg:  "#222222",
      glow:    "#555555",
      Icon:    Info,
    },
  }[severity];

  const { label, color, bg, iconBg, glow, Icon } = config;

  return (
    <div className="bg-[#151515] border border-[#262626] rounded-[32px] p-8 relative overflow-hidden transition-colors hover:border-[#333333]">
      {/* Ambient glow */}
      <div
        className="absolute top-0 left-0 w-64 h-64 opacity-[0.04] blur-[60px] pointer-events-none rounded-full -translate-x-1/2 -translate-y-1/2"
        style={{ backgroundColor: glow }}
      />

      <div className="flex justify-between items-start mb-6 relative z-10">
        <div className="flex items-start gap-5">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: iconBg }}
          >
            <Icon size={20} strokeWidth={2.5} style={{ color }} />
          </div>
          <div>
            <span
              className="text-[9px] font-bold uppercase tracking-[0.2em] leading-none mb-2 block"
              style={{ color }}
            >
              {label}
            </span>
            <h3 className="font-display font-bold text-xl tracking-tight text-white">
              Issue #{index + 1}
            </h3>
          </div>
        </div>
      </div>

      <p className="text-[#a0a09f] text-[14px] leading-relaxed max-w-xl font-sans relative z-10">
        {errorText}
      </p>
    </div>
  );
}

// ── Success Banner ────────────────────────────────────────────────────────────

function SuccessBanner({ sentenceCount }) {
  return (
    <div className="bg-[#15170d] border border-[#2a2e16] rounded-[32px] p-8 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-64 h-64 bg-[#c5fe00] opacity-[0.04] blur-[60px] pointer-events-none rounded-full -translate-x-1/2 -translate-y-1/2" />
      <div className="flex items-start gap-5 relative z-10">
        <div className="w-12 h-12 rounded-full bg-[#1a2010] flex items-center justify-center shrink-0 border border-[#2a2e16]">
          <CheckCircle size={22} className="text-[#c5fe00]" />
        </div>
        <div>
          <span className="text-[#c5fe00] text-[9px] font-bold uppercase tracking-[0.2em] leading-none mb-2 block">
            Validation Passed
          </span>
          <h3 className="font-display font-bold text-2xl tracking-tight text-white mb-3">
            Document is clean and ready
          </h3>
          <p className="text-[#8c8c8b] text-[14px] leading-relaxed max-w-xl font-sans">
            {sentenceCount} sentence{sentenceCount !== 1 ? "s" : ""} extracted successfully.
            No critical issues detected. You may proceed to translation.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

function ValidationPage() {
  const navigate = useNavigate();

  const { docId, rawText, setSentences, documents, activeDocIndex, setActiveDocIndex, updateDoc, validationResult, setValidationResult } = useAppContext();
  
  const activeDoc = documents[activeDocIndex];
  const activeDocStatus = activeDoc?.status || "uploaded";
  const isAnyValidating = documents.some(d => d.status === "validating");
  
  const [errorMessage, setErrorMessage] = useState("");

  let validationState = "idle";
  if (activeDocStatus === "validating") {
    validationState = "running";
  } else if (errorMessage || activeDocStatus === "error") {
    validationState = "error";
  } else if (validationResult || activeDocStatus === "validated" || activeDocStatus === "translated" || activeDocStatus === "approved") {
    validationState = "done";
  }

  const displayError = errorMessage || activeDoc?.error || "";
  
  const multiDoc = documents.length > 1;
  const validatedCount = documents.filter(d => d.status === "validated" || d.status === "translated" || d.status === "approved").length;

  const pendingDocsCount = documents.filter(d => d.status === "uploaded" || d.status === "error").length;

  // ── Validation trigger ──────────────────────────────────────────────────────

  const handleStartValidation = async (validateAll = false) => {
    if (!docId || !rawText) {
      setErrorMessage("No document loaded. Please upload a document first.");
      return;
    }

    setErrorMessage("");

    const pendingDocs = documents.filter(d => d.status === "uploaded" || d.status === "error");
    const isMultiMode = validateAll && pendingDocs.length > 1;

    try {
      if (isMultiMode) {
        pendingDocs.forEach(doc => updateDoc(doc.docId, { status: "validating", error: null, validationResult: null }));
        
        for (let i = 0; i < pendingDocs.length; i++) {
          const doc = pendingDocs[i];
          const result = await validateText(doc.rawText, doc.docId);
          if (result.status === "ok") {
            updateDoc(doc.docId, { sentences: result.sentences || [], status: "validated", validationResult: result, error: null });
          } else {
            updateDoc(doc.docId, { status: "error", error: (result.errors || []).join(", "), validationResult: result });
          }
        }
      } else {
        updateDoc(docId, { status: "validating", error: null, validationResult: null });
        const result = await validateText(rawText, docId);
        if (result.status === "ok") {
          updateDoc(docId, { sentences: result.sentences || [], status: "validated", validationResult: result, error: null });
        } else {
          updateDoc(docId, { status: "error", error: (result.errors || []).join(", "), validationResult: result });
        }
      }
    } catch (err) {
      setErrorMessage(err.message || "Validation failed. Please try again.");
    }
  };

  // ── Derived values from API response ───────────────────────────────────────

  const apiStatus      = validationResult?.status ?? null;
  const apiErrors      = validationResult?.errors ?? [];
  const sentenceCount  = validationResult?.sentence_count ?? 0;
  const canProceed     = validationState === "done" && apiStatus === "ok";

  const highErrors   = apiErrors.filter((e) => classifyError(e) === "high");
  const medErrors    = apiErrors.filter((e) => classifyError(e) === "medium");
  const lowErrors    = apiErrors.filter((e) => classifyError(e) === "low");

  const healthScore  = validationState === "done"
    ? (apiStatus === "ok" ? 100 : computeHealthScore(apiErrors))
    : null;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="h-screen bg-[#0a0a0a] text-[#ffffff] font-sans flex overflow-hidden selection:bg-[#c5fe00] selection:text-[#0a0a0a]">

      {/* Left Sidebar */}
      <aside className="w-[260px] border-r border-[#262626] border-opacity-50 flex flex-col shrink-0 bg-[#0a0a0a] hidden md:flex z-50 overflow-y-auto layout-scrollbar">
        <div className="p-6 pb-2 flex-1 flex flex-col">
          <div className="mb-12">
            <h1 className="font-display font-black text-2xl tracking-tight text-[#c5fe00] leading-none mb-1">TransSync</h1>
            <p className="text-[#555555] font-bold text-[9px] uppercase tracking-widest leading-none">AI Studio</p>
          </div>

          <nav className="space-y-1">
            <Link to="/dashboard" className="flex items-center gap-4 text-[#8c8c8b] hover:text-[#ffffff] hover:bg-[#131313] transition-colors px-4 py-3 rounded-[12px]">
              <LayoutDashboard size={18} />
              <span className="text-[11px] font-bold uppercase tracking-widest">Dashboard</span>
            </Link>
            <Link to="/upload" className="flex items-center gap-4 text-[#8c8c8b] hover:text-[#ffffff] hover:bg-[#131313] transition-colors px-4 py-3 rounded-[12px]">
              <FileUp size={18} />
              <span className="text-[11px] font-bold uppercase tracking-widest">Upload</span>
            </Link>
            <div className="flex items-center gap-4 bg-[#1a1c10] text-[#c5fe00] border border-[#2a2e16] px-4 py-3 rounded-[12px] shadow-[inset_0_0_10px_rgba(197,254,0,0.05)]">
              <CheckCircle2 size={18} />
              <span className="text-[11px] font-bold uppercase tracking-widest">Validation</span>
            </div>
            <Link to="/review" className="flex items-center gap-4 text-[#8c8c8b] hover:text-[#ffffff] hover:bg-[#131313] transition-colors px-4 py-3 rounded-[12px]">
              <MessageSquare size={18} />
              <span className="text-[11px] font-bold uppercase tracking-widest">Review</span>
            </Link>
            <Link to="/glossary" className="flex items-center gap-4 text-[#8c8c8b] hover:text-[#ffffff] hover:bg-[#131313] transition-colors px-4 py-3 rounded-[12px]">
              <Book size={18} />
              <span className="text-[11px] font-bold uppercase tracking-widest">Glossary</span>
            </Link>
            <Link to="/export" className="flex items-center gap-4 text-[#8c8c8b] hover:text-[#ffffff] hover:bg-[#131313] transition-colors px-4 py-3 rounded-[12px]">
              <Download size={18} />
              <span className="text-[11px] font-bold uppercase tracking-widest">Export</span>
            </Link>
          </nav>
        </div>

        <div className="p-6 space-y-1 pb-8">

          <UserProfileBlock />
        </div>
      </aside>

      {/* Main Framework */}
      <div className="flex flex-col flex-1 relative w-full h-full overflow-hidden bg-[#0e0e0e]">

        {/* Top Header */}
        <header className="h-[88px] w-full border-b border-[#262626] bg-[#0e0e0e] flex items-center justify-between px-8 shrink-0 z-40">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <FileText size={12} className="text-[#c5fe00]" strokeWidth={3} />
              <span className="text-[#c5fe00] text-[9px] font-bold uppercase tracking-[0.2em] leading-none">Active File</span>
            </div>
            <h2 className="font-display text-[22px] font-bold tracking-tight text-white leading-none">
              {docId ? `Doc: ${docId.slice(0, 16)}…` : "No active document"}
            </h2>
          </div>

          <div className="flex items-center gap-12">
            {/* Health Score */}
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <Activity size={12} className="text-[#c5fe00]" />
                <span className="text-[#8c8c8b] text-[9px] font-bold uppercase tracking-[0.2em] leading-none">Health Score</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-[100px] h-1.5 rounded-full bg-[#262626] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${healthScore ?? 0}%`,
                      backgroundColor: healthScore === null ? "#262626" : healthScore >= 80 ? "#c5fe00" : healthScore >= 50 ? "#ffd166" : "#ff4d4d",
                    }}
                  />
                </div>
                <span className="font-display font-bold text-xl leading-none">
                  {healthScore !== null ? `${healthScore}%` : "—"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4 border-l border-[#262626] pl-8">
              <button className="w-10 h-10 rounded-full bg-[#151515] border border-[#262626] flex items-center justify-center text-[#8c8c8b] hover:text-white hover:bg-[#222222] transition-all">
                <HelpCircle size={18} />
              </button>
              <button className="w-10 h-10 rounded-full bg-[#151515] border border-[#262626] flex items-center justify-center text-[#8c8c8b] hover:text-white hover:bg-[#222222] transition-all">
                <Settings size={18} />
              </button>
              <button className="w-10 h-10 rounded-full bg-[#151515] border border-[#262626] flex items-center justify-center text-[#8c8c8b] hover:text-white hover:bg-[#222222] transition-all">
                <Bell size={18} />
              </button>
              <button className="w-10 h-10 rounded-full bg-[#151515] border border-[#262626] flex items-center justify-center overflow-hidden">
                <img src="https://i.pravatar.cc/150?img=11" alt="User Avatar" className="w-full h-full object-cover" />
              </button>
            </div>
          </div>
        </header>

        {/* Scrollable Main Area */}
        <div className="flex-1 overflow-y-auto layout-scrollbar pb-[100px]">
          <div className="p-8 lg:p-12 max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 relative">

            {/* Left: Validation Stream (8 cols) */}
            <main className="lg:col-span-8 flex flex-col">
              <div className="mb-12">
                <h1 className="font-display font-black text-[40px] tracking-tight mb-4">source validation</h1>

              {/* ── Multi-doc tabs ── */}
              {multiDoc && (
                <div className="flex flex-wrap gap-2 mb-6">
                  {documents.map((doc, i) => (
                    <button
                      key={doc.docId}
                      onClick={() => { setActiveDocIndex(i); setErrorMessage(""); }}
                      className={`px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-widest border transition-colors ${
                        i === activeDocIndex
                          ? "bg-[#1a1c10] text-[#c5fe00] border-[#2a2e16]"
                          : doc.status === "validated" || doc.status === "translated" || doc.status === "approved"
                          ? "bg-[#111111] text-[#8c8c8b] border-[#2a2e16]"
                          : doc.status === "error"
                          ? "bg-[#1a0a0a] text-[#ff6b6b] border-[#4a1010]"
                          : "bg-[#111111] text-[#555555] border-[#262626] hover:text-[#8c8c8b]"
                      }`}
                    >
                      {doc.filename.length > 20 ? doc.filename.slice(0, 18) + "…" : doc.filename}
                      {(doc.status === "validated" || doc.status === "translated" || doc.status === "approved") && " ✓"}
                      {doc.status === "error" && " ✗"}
                    </button>
                  ))}
                </div>
              )}

              {/* ── Document List & Description ── */}
                <p className="text-[#a0a09f] text-[15px] leading-relaxed max-w-2xl font-sans mt-4">
                  {validationState === "idle"
                    ? "Click 'Start Validation' to run the NLP quality check on your uploaded document."
                    : validationState === "running"
                    ? "Analysing your document for structural and semantic quality…"
                    : apiStatus === "ok"
                    ? "Validation complete. Your document passed all quality checks."
                    : "Issues detected in your source document. Review the findings below before proceeding."}
                </p>
              </div>

              <div className="space-y-8">

                {/* ── Network error banner ── */}
                {validationState === "error" && displayError && (
                  <div className="bg-[#2a1313] border border-[#ff4d4d] rounded-[24px] p-6 flex items-center justify-between">
                    <span className="text-[#ff4d4d] text-sm">{displayError}</span>
                    <button
                      onClick={() => { setErrorMessage(""); updateDoc(docId, { status: "uploaded", error: null }); }}
                      className="text-[#ff4d4d] hover:text-white text-[11px] font-bold uppercase tracking-widest border border-[#4a1010] px-3 py-1.5 rounded-full transition-colors ml-4 shrink-0"
                    >
                      Retry
                    </button>
                  </div>
                )}

                {/* ── IDLE STATE ── */}
                {validationState === "idle" && !displayError && (
                  <div className="flex flex-col items-center justify-center min-h-[320px] text-center bg-[#111111] border border-[#1a1a1a] rounded-[32px] p-12">
                    <div className="w-16 h-16 rounded-full bg-[#1a1c10] border border-[#2a2e16] flex items-center justify-center mb-8">
                      <ShieldCheck size={28} className="text-[#c5fe00]" />
                    </div>
                    <h3 className="font-display font-bold text-2xl tracking-tight mb-3">
                      {docId ? "Ready to Validate" : "No Document Loaded"}
                    </h3>
                    <p className="text-[#555555] text-[13px] max-w-sm leading-relaxed mb-8">
                      {docId
                        ? "The NLP pipeline will check your document for encoding issues, empty sections, sentence quality, and more."
                        : "Please upload a document first before running validation."}
                    </p>
                    {docId ? (
                      <div className="flex flex-row gap-4 items-center">
                        {multiDoc && pendingDocsCount > 1 && (
                          <button
                            onClick={() => handleStartValidation(true)}
                            className="bg-[#c5fe00] hover:bg-[#b9ef00] text-[#0a0a0a] rounded-full px-8 py-4 font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(197,254,0,0.2)] hover:scale-[1.02]"
                          >
                            <Zap size={16} className="fill-current" />
                            Validate All {pendingDocsCount} Docs
                          </button>
                        )}
                        <button
                          onClick={() => handleStartValidation(false)}
                          className={multiDoc && pendingDocsCount > 1
                            ? "bg-transparent border border-[#555555] hover:border-[#c5fe00] hover:text-[#c5fe00] text-white rounded-full px-8 py-4 font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-colors"
                            : "bg-[#c5fe00] hover:bg-[#b9ef00] text-[#0a0a0a] rounded-full px-8 py-4 font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(197,254,0,0.2)] hover:scale-[1.02]"}
                        >
                          <ShieldCheck size={16} />
                          {multiDoc && pendingDocsCount > 1 ? "Validate Current Doc" : "Start Validation"}
                        </button>
                      </div>
                    ) : (
                      <Link
                        to="/upload"
                        className="border border-[#262626] text-[#8c8c8b] hover:text-white hover:border-[#555555] rounded-full px-8 py-4 font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-colors"
                      >
                        Go to Upload <ArrowRight size={14} />
                      </Link>
                    )}
                  </div>
                )}

                {/* ── RUNNING STATE ── */}
                {validationState === "running" && (
                  <div className="flex flex-col items-center justify-center min-h-[320px] text-center bg-[#111111] border border-[#1a1a1a] rounded-[32px] p-12">
                    <div className="w-16 h-16 rounded-full bg-[#1a1c10] border border-[#2a2e16] flex items-center justify-center mb-8">
                      <Loader2 size={28} className="text-[#c5fe00] animate-spin" />
                    </div>
                    <h3 className="font-display font-bold text-2xl tracking-tight mb-3">Validating…</h3>
                    <p className="text-[#555555] text-[13px] max-w-sm leading-relaxed">
                      Running NLP quality checks and sentence segmentation on your document.
                    </p>
                    <div className="mt-8 flex gap-[4px]">
                      {[0, 1, 2].map(i => (
                        <div key={i} className="w-2 h-2 bg-[#c5fe00] rounded-full animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                      ))}
                    </div>
                  </div>
                )}

                {/* ── DONE: SUCCESS ── */}
                {validationState === "done" && apiStatus === "ok" && (
                  <SuccessBanner sentenceCount={sentenceCount} />
                )}

                {/* ── DONE: ERRORS ── */}
                {validationState === "done" && apiStatus !== "ok" && apiErrors.length > 0 && (
                  <>
                    {apiErrors.map((errText, i) => (
                      <ErrorCard key={i} errorText={errText} index={i} />
                    ))}
                  </>
                )}

                {/* ── DONE: no errors array but status error (unexpected) ── */}
                {validationState === "done" && apiStatus !== "ok" && apiErrors.length === 0 && (
                  <div className="bg-[#2a1313] border border-[#ff4d4d] rounded-[24px] p-6 text-[#ff4d4d] text-sm">
                    Validation returned an error with no details. Please try again.
                  </div>
                )}

                {/* ── DONE: Re-validate button ── */}
                {validationState === "done" && docId && (
                  <div className="flex justify-center mt-4">
                    <button
                      onClick={() => handleStartValidation(false)}
                      className="bg-transparent border border-[#555555] hover:border-[#c5fe00] hover:text-[#c5fe00] text-[#8c8c8b] rounded-full px-8 py-3 font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-colors"
                    >
                      <ShieldCheck size={14} />
                      Re-validate This Document
                    </button>
                  </div>
                )}

              </div>
            </main>

            {/* Right: Context Metrics (4 cols) */}
            <aside className="lg:col-span-4 flex flex-col gap-12 mt-4 lg:mt-0">

              {/* Validation Summary */}
              <div>
                <h4 className="text-[#555555] font-bold text-[10px] uppercase tracking-[0.2em] mb-6">Validation Summary</h4>
                <div className="space-y-3">
                  <div className="bg-[#111111] border border-[#1a1a1a] rounded-[20px] p-5 flex items-center justify-between">
                    <span className="text-[#a0a09f] text-[13px] font-medium">Critical Issues</span>
                    <span className="font-display font-bold text-xl" style={{ color: highErrors.length > 0 ? "#ff4d4d" : "#c5fe00" }}>
                      {validationState === "done" ? highErrors.length : "—"}
                    </span>
                  </div>
                  <div className="bg-[#111111] border border-[#1a1a1a] rounded-[20px] p-5 flex items-center justify-between">
                    <span className="text-[#a0a09f] text-[13px] font-medium">Warnings</span>
                    <span className="font-display font-bold text-xl" style={{ color: medErrors.length > 0 ? "#ffd166" : "#8c8c8b" }}>
                      {validationState === "done" ? medErrors.length : "—"}
                    </span>
                  </div>
                  <div className="bg-[#111111] border border-[#1a1a1a] rounded-[20px] p-5 flex items-center justify-between">
                    <span className="text-[#a0a09f] text-[13px] font-medium">Sentences Extracted</span>
                    <span className="font-display font-bold text-xl text-[#c5fe00]">
                      {validationState === "done" ? sentenceCount : "—"}
                    </span>
                  </div>
                  <div className="bg-[#111111] border border-[#1a1a1a] rounded-[20px] p-5 flex items-center justify-between">
                    <span className="text-[#a0a09f] text-[13px] font-medium">Info Notices</span>
                    <span className="font-display font-bold text-xl text-[#8c8c8b]">
                      {validationState === "done" ? lowErrors.length : "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quality Metrics */}
              <div>
                <h4 className="text-[#555555] font-bold text-[10px] uppercase tracking-[0.2em] mb-6">Quality Metrics</h4>
                <div className="bg-[#111111] border border-[#1a1a1a] rounded-[24px] p-6 space-y-6">
                  {/* Health Score bar */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-[11px] font-sans">
                      <span className="text-[#a0a09f]">Health Score</span>
                      <span className="font-bold" style={{ color: healthScore !== null ? (healthScore >= 80 ? "#c5fe00" : healthScore >= 50 ? "#ffd166" : "#ff4d4d") : "#555555" }}>
                        {healthScore !== null ? `${healthScore}%` : "—"}
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-[#222222] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${healthScore ?? 0}%`,
                          backgroundColor: healthScore !== null ? (healthScore >= 80 ? "#c5fe00" : healthScore >= 50 ? "#ffd166" : "#ff4d4d") : "#262626",
                        }}
                      />
                    </div>
                  </div>

                  {/* Sentence density */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-[11px] font-sans">
                      <span className="text-[#a0a09f]">Document Status</span>
                      <span className={`font-bold text-[10px] uppercase tracking-widest px-2 py-1 rounded-full ${
                        validationState === "done"
                          ? apiStatus === "ok"
                            ? "text-[#c5fe00] bg-[#1a2010] border border-[#2a2e16]"
                            : "text-[#ff4d4d] bg-[#2a1313] border border-[#4a2020]"
                          : "text-[#555555] bg-[#1a1a1a]"
                      }`}>
                        {validationState === "idle" ? "Pending"
                          : validationState === "running" ? "Checking…"
                          : apiStatus === "ok" ? "Passed"
                          : "Issues Found"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* What we check */}
              <div className="bg-[#151515] border border-[#2a2e16] rounded-[24px] p-8 shadow-[0_20px_40px_rgba(197,254,0,0.03)] mt-auto relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-32 h-32 bg-[#c5fe00] opacity-[0.03] blur-[40px] pointer-events-none rounded-full group-hover:opacity-10 transition-opacity" />
                <h4 className="font-display text-white font-bold text-[18px] mb-3 relative z-10">What we check</h4>
                <p className="text-[#8c8c8b] text-[12px] leading-relaxed mb-5 font-sans relative z-10">
                  Before translation, every document is run through the NLP pipeline:
                </p>
                <ul className="space-y-2.5 relative z-10">
                  {[
                    "Grammar & spelling (LanguageTool)",
                    "Sentence segmentation (spaCy)",
                    "Empty, encoding & length issues",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-[#a0a09f] text-[12px] leading-relaxed">
                      <CheckCircle size={13} className="text-[#c5fe00] shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

            </aside>
          </div>
        </div>

        {/* Global Action Footer */}
        <div className="absolute w-full bottom-0 h-[88px] border-t border-[#262626] bg-[#0a0a0a]/90 backdrop-blur-md flex items-center justify-between px-8 lg:px-12 z-50">

          {/* Left status */}
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-[#1a200a] text-[#c5fe00] border border-[#2a2e16] flex items-center justify-center relative shadow-[inset_0_0_10px_rgba(197,254,0,0.1)]">
              {validationState === "running"
                ? <Loader2 size={16} className="animate-spin" />
                : <Sparkles size={16} />
              }
              {validationState !== "running" && (
                <div className="absolute right-0 bottom-0 w-2.5 h-2.5 bg-[#c5fe00] rounded-full border border-[#0a0a0a] animate-pulse" />
              )}
            </div>
            <p className="text-[#8c8c8b] text-[12px] font-medium font-sans">
              {validationState === "idle"    && "Click 'Start Validation' to begin."}
              {validationState === "running" && "NLP engine is processing your document…"}
              {validationState === "done" && apiStatus === "ok"  && "Validation passed. You may proceed to translation."}
              {validationState === "done" && apiStatus !== "ok" && "Review the issues above before proceeding."}
              {validationState === "error"   && "Validation encountered an error."}
            </p>
          </div>

          {/* Right CTA */}
          {(validationState === "idle" || validationState === "error") && (
            <div className="flex items-center gap-3">
              {multiDoc && pendingDocsCount > 1 && (
                <button
                  onClick={() => handleStartValidation(true)}
                  disabled={!docId}
                  className="bg-[#c5fe00] hover:bg-[#b9ef00] transition-colors text-[#0a0a0a] rounded-full px-8 py-4 font-black flex items-center gap-3 text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(197,254,0,0.2)] hover:scale-[1.02] transform duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <ShieldCheck size={14} strokeWidth={2.5} />
                  Validate All {pendingDocsCount} Docs
                </button>
              )}
              <button
                onClick={() => handleStartValidation(false)}
                disabled={!docId}
                className={multiDoc && pendingDocsCount > 1
                  ? "border border-[#555555] hover:border-[#c5fe00] hover:text-[#c5fe00] text-white transition-colors rounded-full px-8 py-4 font-black flex items-center gap-3 text-xs uppercase tracking-widest disabled:opacity-60 disabled:cursor-not-allowed"
                  : "bg-[#c5fe00] hover:bg-[#b9ef00] transition-colors text-[#0a0a0a] rounded-full px-8 py-4 font-black flex items-center gap-3 text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(197,254,0,0.2)] hover:scale-[1.02] transform duration-300 disabled:opacity-60 disabled:cursor-not-allowed"}
              >
                <ShieldCheck size={14} strokeWidth={2.5} />
                {multiDoc && pendingDocsCount > 1 ? "Validate Current Doc" : "Start Validation"}
              </button>
            </div>
          )}

          {validationState === "running" && (
            <button
              disabled
              className="bg-[#c5fe00] opacity-60 cursor-not-allowed text-[#0a0a0a] rounded-full px-8 py-4 font-black flex items-center gap-3 text-xs uppercase tracking-widest"
            >
              <Loader2 size={14} className="animate-spin" /> Validating…
            </button>
          )}

          {validationState === "done" && (
            <button
              onClick={() => navigate("/review")}
              disabled={!canProceed}
              className="bg-[#c5fe00] hover:bg-[#b9ef00] transition-colors text-[#0a0a0a] rounded-full px-8 py-4 font-black flex items-center gap-3 text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(197,254,0,0.2)] hover:scale-[1.02] transform duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
              title={canProceed ? "" : "Fix all validation issues before proceeding"}
            >
              Proceed to Review <ArrowRight strokeWidth={3} size={16} />
            </button>
          )}

        </div>
      </div>
    </div>
  );
}

export default ValidationPage;
