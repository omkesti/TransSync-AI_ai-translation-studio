import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { approveTranslations, translateSentences } from "../services/api";
import { useAppContext } from "../context/AppContext";
import { languageLabel } from "../constants/languages";
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
  CheckCircle,
  MoreHorizontal,
  Sparkles,
  Zap,
  Languages,
  Loader2,
  ArrowRight,
  Download,
} from "lucide-react";

// ── Match-type helpers ────────────────────────────────────────────────────────

const SKIP_MATCH_TYPES = new Set(["tm_exact", "faiss_direct"]);

const matchLabel = (matchType) => {
  if (!matchType) return "Pending";
  switch (matchType) {
    case "tm_exact":    return "TM Exact";
    case "faiss_direct": return "FAISS Direct";
    case "llm_guided":  return "LLM Guided";
    case "llm_cold":    return "LLM Cold";
    default:            return matchType.replace("_", " ").toUpperCase();
  }
};

const matchBadgeCls = (matchType) => {
  switch (matchType) {
    case "tm_exact":
      return "bg-[#1a2010] text-[#c5fe00] border border-[#2a2e16]";
    case "faiss_direct":
      return "bg-[#101820] text-[#00c5fe] border border-[#162030]";
    case "llm_guided":
      return "bg-[#1a1020] text-[#c500fe] border border-[#2a1630]";
    case "llm_cold":
    default:
      return "bg-[#1a200a] text-[#c5fe00] border border-[#2a2e16]";
  }
};

// ── Sidebar ───────────────────────────────────────────────────────────────────

function Sidebar() {
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
          <Link to="/dashboard" className="flex items-center gap-4 text-[#8c8c8b] hover:text-[#ffffff] hover:bg-[#131313] transition-colors px-4 py-3 rounded-[12px]">
            <LayoutDashboard size={18} />
            <span className="text-[11px] font-bold uppercase tracking-widest">Dashboard</span>
          </Link>
          <Link to="/upload" className="flex items-center gap-4 text-[#8c8c8b] hover:text-[#ffffff] hover:bg-[#131313] transition-colors px-4 py-3 rounded-[12px]">
            <FileUp size={18} />
            <span className="text-[11px] font-bold uppercase tracking-widest">Upload</span>
          </Link>
          <Link to="/validation" className="flex items-center gap-4 text-[#8c8c8b] hover:text-[#ffffff] hover:bg-[#131313] transition-colors px-4 py-3 rounded-[12px]">
            <CheckCircle2 size={18} />
            <span className="text-[11px] font-bold uppercase tracking-widest">Validation</span>
          </Link>
          <div className="flex items-center gap-4 bg-[#1a1c10] text-[#c5fe00] border border-[#2a2e16] px-4 py-3 rounded-[12px] shadow-[inset_0_0_10px_rgba(197,254,0,0.05)]">
            <MessageSquare size={18} />
            <span className="text-[11px] font-bold uppercase tracking-widest">Review</span>
          </div>
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
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

function ReviewPage() {
  // "idle" | "running" | "done" | "error"
  const [translationState, setTranslationState] = useState("idle");
  const [isApproving, setIsApproving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0);
  const [reviewedCount, setReviewedCount] = useState(0);

  const { sentences, results, setResults, sourceLang, targetLang, documents, activeDocIndex, setActiveDocIndex, updateDoc } = useAppContext();
  const multiDoc = documents.length > 1;

  // If results already exist in context (user navigated back), treat as done immediately
  const initialState = results && results.length > 0 ? "done" : "idle";
  const [state] = useState(initialState);

  // Use whichever is truthy — state set at mount, translationState updated dynamically
  const effectiveState = translationState === "idle" && state === "done" ? "done" : translationState;

  const hasResults = results && results.length > 0;
  const totalCount = results.length;

  // ── Start Translation ─────────────────────────────────────────────────────

  const handleStartTranslation = async () => {
    if (!sentences || sentences.length === 0) {
      setErrorMessage("No validated sentences found. Please validate the document first.");
      setTranslationState("error");
      return;
    }
    if (!targetLang) {
      setErrorMessage("Target language is missing. Please select a language on the upload page.");
      setTranslationState("error");
      return;
    }

    setTranslationState("running");
    setErrorMessage("");

    try {
      const response = await translateSentences(sentences, sourceLang, targetLang);
      setResults(response.results || []);
      setCurrentBatchIndex(0);
      setReviewedCount(0);
      setTranslationState("done");
    } catch (error) {
      setErrorMessage(error.message || "Translation failed.");
      setTranslationState("error");
    }
  };

  // ── Batching ──────────────────────────────────────────────────────────────

  const batches = useMemo(() => {
    const chunkSize = 10;
    const items = hasResults ? results : [];
    const output = [];
    for (let i = 0; i < items.length; i += chunkSize) {
      output.push(items.slice(i, i + chunkSize));
    }
    return output;
  }, [hasResults, results]);

  const displayResults = useMemo(() => {
    if (!batches.length) return [];
    return batches[currentBatchIndex] || [];
  }, [batches, currentBatchIndex]);

  const totalBatches = batches.length;
  const pendingCount = Math.max(0, totalCount - reviewedCount);
  const progressPercent = totalCount > 0 ? Math.round((reviewedCount / totalCount) * 100) : 0;

  // ── Approve (with duplicate-insertion fix) ────────────────────────────────

  const buildApprovedPayload = (batch) =>
    batch
      .filter((item) => !SKIP_MATCH_TYPES.has(item.match_type))
      .map((item) => ({
        source_text:     item.source,
        translated_text: item.translation,
        target_lang:     targetLang,
        match_type:      item.match_type,
        action:          "approved",
        faiss_index:     item.faiss_index ?? null,
      }));

  const advanceBatch = (batchSize) => {
    setReviewedCount((prev) => prev + batchSize);
    setCurrentBatchIndex((prev) => prev + 1);
  };

  const handleApprove = async () => {
    if (!displayResults.length || isApproving) return;

    setIsApproving(true);
    setErrorMessage("");

    try {
      const payload = buildApprovedPayload(displayResults);
      // Only call API if there are LLM-derived sentences to store
      if (payload.length > 0) {
        await approveTranslations(payload);
      }
      advanceBatch(displayResults.length);
    } catch (error) {
      setErrorMessage(error.message || "Approval failed.");
    } finally {
      setIsApproving(false);
    }
  };

  const handleDiscard = () => {
    if (!displayResults.length || isApproving) return;
    advanceBatch(displayResults.length);
  };

  // ── Count how many in current batch are skipped (already in DB) ───────────
  const skippedInBatch = displayResults.filter(
    (item) => SKIP_MATCH_TYPES.has(item.match_type)
  ).length;

  // ── Determine effective state (context results present = skip idle) ────────
  const isIdle    = effectiveState === "idle";
  const isRunning = translationState === "running";
  const isDone    = effectiveState === "done" || hasResults;
  const isError   = translationState === "error";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="h-screen bg-[#0a0a0a] text-[#ffffff] font-sans flex overflow-hidden selection:bg-[#c5fe00] selection:text-[#0a0a0a]">
      <Sidebar />

      <div className="flex flex-col flex-1 relative w-full h-full overflow-hidden bg-[#0e0e0e]">
        {/* Top Header */}
        <header className="h-[80px] w-full border-b border-[#262626] bg-[#0a0a0a] flex items-center justify-between px-8 shrink-0 z-40">
          <div className="flex items-center gap-4">
            <Link to="/" className="inline-block">
              <span className="font-display font-bold text-xl tracking-tight text-[#c5fe00] leading-none">TransSync</span>
            </Link>
            <div className="w-px h-6 bg-[#262626]"></div>
            <div className="flex items-center gap-2">
              <span className="text-[#555555] font-bold text-[10px] uppercase tracking-widest">Target:</span>
              <span className="text-[#ffffff] text-[13px] font-bold">
                {targetLang ? `${languageLabel(targetLang)} (${targetLang})` : "—"}
              </span>
            </div>
          </div>

          {/* Live Sync Badge */}
          {isDone && (
            <div className="hidden lg:flex items-center gap-3 bg-[#1a1a1a] border border-[#262626] px-4 py-2 rounded-full absolute left-1/2 -translate-x-1/2">
              <div className="w-2.5 h-2.5 bg-[#c5fe00] rounded-full animate-pulse"></div>
              <span className="text-[#a0a09f] font-bold text-[9px] uppercase tracking-widest leading-none">
                Live Sync<br />Active
              </span>
            </div>
          )}

          <div className="flex items-center gap-6">
            <button className="text-[#8c8c8b] hover:text-[#ffffff] transition-colors"><Bell size={18} /></button>
            <button className="text-[#8c8c8b] hover:text-[#ffffff] transition-colors"><HelpCircle size={18} /></button>
            <button className="text-[#8c8c8b] hover:text-[#ffffff] transition-colors"><Settings size={18} /></button>
            <button className="w-8 h-8 rounded-full bg-[#1a1a1a] border border-[#262626] overflow-hidden ml-2">
              <img src="https://i.pravatar.cc/150?img=11" alt="User Avatar" className="w-full h-full object-cover" />
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden w-full pb-[100px]">
          <main className="flex-1 overflow-y-auto layout-scrollbar bg-[#0a0a0a]">
            <div className="p-8 max-w-5xl mx-auto space-y-6">

              {/* ── Multi-doc tabs ── */}
              {multiDoc && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {documents.map((doc, i) => (
                    <button
                      key={doc.docId}
                      onClick={() => { setActiveDocIndex(i); setTranslationState("idle"); setCurrentBatchIndex(0); setReviewedCount(0); setErrorMessage(""); }}
                      className={`px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-widest border transition-colors ${
                        i === activeDocIndex
                          ? "bg-[#1a1c10] text-[#c5fe00] border-[#2a2e16]"
                          : doc.status === "approved"
                          ? "bg-[#111111] text-[#8c8c8b] border-[#2a2e16]"
                          : doc.status === "translated"
                          ? "bg-[#111111] text-[#a0a09f] border-[#262626]"
                          : doc.status === "error"
                          ? "bg-[#1a0a0a] text-[#ff6b6b] border-[#4a1010]"
                          : "bg-[#111111] text-[#555555] border-[#262626] hover:text-[#8c8c8b]"
                      }`}
                    >
                      {doc.filename.length > 20 ? doc.filename.slice(0, 18) + "…" : doc.filename}
                      {doc.status === "approved" && " ✓"}
                      {doc.status === "error" && " ✗"}
                    </button>
                  ))}
                </div>
              )}

              {/* ── Translate All button ── */}
              {documents.filter(d => d.status === "validated").length > 0 && (
                <button
                  onClick={async () => {
                    setTranslationState("running");
                    for (let i = 0; i < documents.length; i++) {
                      const doc = documents[i];
                      if (doc.status !== "validated" || !doc.sentences || doc.sentences.length === 0) continue;
                      try {
                        const response = await translateSentences(doc.sentences, sourceLang, targetLang);
                        updateDoc(doc.docId, { results: response.results || [], status: "translated" });
                      } catch (err) {
                        updateDoc(doc.docId, { status: "error", error: err.message || "Translation failed" });
                      }
                    }
                    setTranslationState("done");
                    setErrorMessage("");
                  }}
                  disabled={translationState === "running"}
                  className="border border-[#2a2e16] text-[#c5fe00] hover:bg-[#1a1c10] rounded-full px-6 py-3 font-bold text-[10px] uppercase tracking-widest transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <Zap size={14} /> Translate All ({documents.filter(d => d.status === "validated").length} pending)
                </button>
              )}

              {/* Error Banner */}
              {isError && errorMessage && (
                <div className="bg-[#2a1313] border border-[#ff4d4d] rounded-[24px] p-6 flex items-center justify-between">
                  <span className="text-[#ff4d4d] text-sm">{errorMessage}</span>
                  <button
                    onClick={() => setTranslationState("idle")}
                    className="text-[#ff4d4d] hover:text-white text-[11px] font-bold uppercase tracking-widest border border-[#4a1010] px-3 py-1.5 rounded-full transition-colors ml-4 shrink-0"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* ── IDLE STATE ── */}
              {isIdle && !isError && (
                <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
                  <div className="w-20 h-20 rounded-full bg-[#1a1c10] border border-[#2a2e16] flex items-center justify-center mb-8 shadow-[0_0_40px_rgba(197,254,0,0.08)]">
                    <Languages size={32} className="text-[#c5fe00]" />
                  </div>
                  <h2 className="font-display font-bold text-3xl tracking-tight mb-3">Ready to Translate</h2>
                  <p className="text-[#8c8c8b] text-[15px] mb-2 max-w-md leading-relaxed">
                    {sentences && sentences.length > 0
                      ? `${sentences.length} validated sentence${sentences.length > 1 ? "s" : ""} ready for translation into ${targetLang ? languageLabel(targetLang) : "your target language"}.`
                      : "No validated sentences found. Please go back and validate your document first."}
                  </p>
                  {sentences && sentences.length > 0 && (
                    <p className="text-[#555555] text-[12px] mb-10 uppercase tracking-widest font-bold">
                      This may take a few seconds depending on document size.
                    </p>
                  )}
                  {sentences && sentences.length > 0 ? (
                    <button
                      onClick={handleStartTranslation}
                      className="bg-[#c5fe00] hover:bg-[#b9ef00] text-[#0a0a0a] rounded-full px-10 py-4 font-black flex items-center gap-3 text-xs uppercase tracking-widest shadow-[0_0_30px_rgba(197,254,0,0.25)] hover:scale-[1.02] transform transition-all"
                    >
                      <Zap size={16} strokeWidth={3} className="fill-[#0a0a0a]" />
                      Start Translation
                    </button>
                  ) : (
                    <Link
                      to="/validation"
                      className="border border-[#262626] text-[#8c8c8b] hover:text-white hover:border-[#555555] rounded-full px-8 py-4 font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-colors"
                    >
                      <ArrowRight size={14} /> Go to Validation
                    </Link>
                  )}
                </div>
              )}

              {/* ── RUNNING STATE ── */}
              {isRunning && (
                <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
                  <div className="w-20 h-20 rounded-full bg-[#1a1c10] border border-[#2a2e16] flex items-center justify-center mb-8 shadow-[0_0_40px_rgba(197,254,0,0.08)]">
                    <Loader2 size={32} className="text-[#c5fe00] animate-spin" />
                  </div>
                  <h2 className="font-display font-bold text-3xl tracking-tight mb-3">Translating…</h2>
                  <p className="text-[#8c8c8b] text-[15px] max-w-md leading-relaxed">
                    Running {sentences?.length || 0} sentences through TM lookup, FAISS search, and the Groq LLM. This may take 10–30 seconds.
                  </p>
                  <div className="mt-8 flex gap-[4px]">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="w-2 h-2 bg-[#c5fe00] rounded-full animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                    ))}
                  </div>
                </div>
              )}

              {/* ── DONE STATE — no more batches ── */}
              {isDone && !isRunning && displayResults.length === 0 && (
                <div className="flex flex-col items-center justify-center min-h-[300px] text-center">
                  <div className="w-16 h-16 rounded-full bg-[#1a2010] border border-[#2a2e16] flex items-center justify-center mb-6">
                    <CheckCircle size={28} className="text-[#c5fe00]" />
                  </div>
                  <h2 className="font-display font-bold text-2xl tracking-tight mb-2">All Batches Reviewed</h2>
                  <p className="text-[#8c8c8b] text-[14px] mb-8">
                    {hasResults
                      ? `${reviewedCount} sentences reviewed. Approved translations have been saved.`
                      : "No translation results available."}
                  </p>
                  <div className="flex items-center gap-4">
                    <Link
                      to="/export"
                      className="bg-[#c5fe00] hover:bg-[#b9ef00] text-[#0a0a0a] rounded-full px-8 py-3.5 font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(197,254,0,0.2)] hover:scale-[1.02]"
                    >
                      <ArrowRight size={14} /> Download Translated Document
                    </Link>
                    <Link
                      to="/dashboard"
                      className="border border-[#262626] text-[#8c8c8b] hover:text-white hover:border-[#555555] rounded-full px-6 py-3.5 font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-colors"
                    >
                      Back to Dashboard
                    </Link>
                  </div>
                </div>
              )}

              {/* ── DONE STATE — current batch ── */}
              {isDone && !isRunning && displayResults.length > 0 && (
                <div className="bg-[#111111] border border-[#262626] rounded-[24px] overflow-hidden">
                  <div className="px-8 py-5 border-b border-[#262626] flex items-center justify-between">
                    <span className="text-[#c5fe00] text-[10px] font-bold uppercase tracking-[0.2em]">
                      Batch {currentBatchIndex + 1} / {totalBatches}
                    </span>
                    <div className="flex items-center gap-4">
                      {skippedInBatch > 0 && (
                        <span className="text-[#555555] text-[10px] font-bold uppercase tracking-widest">
                          {skippedInBatch} already in TM — will not be re-saved
                        </span>
                      )}
                      <span className="text-[#555555] text-[10px] font-bold uppercase tracking-[0.2em]">
                        {displayResults.length} sentences
                      </span>
                    </div>
                  </div>

                  <div className="divide-y divide-[#262626]">
                    {displayResults.map((item, index) => (
                      <div key={`${item.source}-${index}`} className="grid grid-cols-1 md:grid-cols-2">
                        <div className="p-6 border-r border-[#262626]">
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-[#555555] text-[10px] font-bold uppercase tracking-widest">
                              Source — {sourceLang?.toUpperCase() || "EN"}
                            </span>
                          </div>
                          <p className="text-[#a0a09f] text-[15px] leading-[1.6] font-sans">{item.source}</p>
                        </div>

                        <div className="p-6">
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-[#555555] text-[10px] font-bold uppercase tracking-widest">
                              Target — {targetLang ? languageLabel(targetLang) : "TBD"}
                            </span>
                            <span className={`text-[9px] font-bold uppercase tracking-widest rounded-full px-3 py-1.5 shadow-[inset_0_0_10px_rgba(197,254,0,0.05)] ${matchBadgeCls(item.match_type)}`}>
                              {matchLabel(item.match_type)}
                            </span>
                          </div>
                          <p className="text-[#ffffff] text-[15px] leading-[1.6] font-sans">{item.translation}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </main>

          {/* Right Context Panel */}
          <aside className="w-[360px] border-l border-[#262626] bg-[#0e0e0e] shrink-0 flex flex-col overflow-y-auto layout-scrollbar">
            <div className="flex items-center gap-6 border-b border-[#262626] px-8 pt-8">
              <div className="text-[#c5fe00] text-[10px] font-bold uppercase tracking-widest pb-4 border-b-2 border-[#c5fe00]">Context</div>
              <div className="text-[#555555] text-[10px] font-bold uppercase tracking-widest pb-4">Activity</div>
            </div>

            <div className="p-8 space-y-10">
              {/* Session Stats */}
              <div>
                <h4 className="text-[#555555] font-bold text-[10px] uppercase tracking-[0.2em] mb-6">Session Stats</h4>
                <div className="space-y-3">
                  <div className="bg-[#111111] border border-[#1a1a1a] rounded-[16px] p-4 flex items-center justify-between">
                    <span className="text-[#8c8c8b] text-[13px]">Total Sentences</span>
                    <span className="font-bold text-[16px]">{totalCount}</span>
                  </div>
                  <div className="bg-[#111111] border border-[#1a1a1a] rounded-[16px] p-4 flex items-center justify-between">
                    <span className="text-[#8c8c8b] text-[13px]">Reviewed</span>
                    <span className="font-bold text-[16px] text-[#c5fe00]">{reviewedCount}</span>
                  </div>
                  <div className="bg-[#111111] border border-[#1a1a1a] rounded-[16px] p-4 flex items-center justify-between">
                    <span className="text-[#8c8c8b] text-[13px]">Pending</span>
                    <span className="font-bold text-[16px] text-[#8c8c8b]">{pendingCount}</span>
                  </div>
                </div>
              </div>

              {/* Match Type Legend */}
              <div>
                <h4 className="text-[#555555] font-bold text-[10px] uppercase tracking-[0.2em] mb-6">Match Types</h4>
                <div className="space-y-3">
                  {[
                    { type: "tm_exact",    desc: "Exact match from Translation Memory. Already stored — not re-saved." },
                    { type: "faiss_direct", desc: "FAISS similarity ≥ 0.95. Already stored — not re-saved." },
                    { type: "llm_guided",  desc: "LLM translation guided by a reference pair." },
                    { type: "llm_cold",    desc: "LLM cold translation with no reference." },
                  ].map(({ type, desc }) => (
                    <div key={type} className="bg-[#111111] border border-[#1a1a1a] rounded-[16px] p-4">
                      <span className={`text-[9px] font-bold uppercase tracking-widest rounded-full px-2 py-1 inline-block mb-2 ${matchBadgeCls(type)}`}>
                        {matchLabel(type)}
                      </span>
                      <p className="text-[#555555] text-[11px] leading-relaxed">{desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Draft Settings */}
              <div>
                <h4 className="text-[#555555] font-bold text-[10px] uppercase tracking-[0.2em] mb-6">Draft Settings</h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-[#8c8c8b]">Tone of Voice</span>
                    <span className="text-[#c5fe00] font-bold">Sophisticated</span>
                  </div>
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-[#8c8c8b]">Formality</span>
                    <div className="w-[100px] h-1.5 rounded-full bg-[#262626] overflow-hidden">
                      <div className="w-[85%] h-full bg-[#c5fe00] rounded-full"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>

        {/* Footer Action Bar — only shown when reviewing */}
        {isDone && !isRunning && (
          <div className="absolute w-full bottom-0 h-[88px] border-t border-[#262626] bg-[#0a0a0a]/90 backdrop-blur-md flex items-center justify-between px-8 z-50">
            {/* Progress */}
            <div className="flex items-center gap-12">
              <div className="flex flex-col gap-2 w-[240px]">
                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-[0.2em] text-[#555555]">
                  <span>Progress</span>
                  <span className="text-[#ffffff]">{progressPercent}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[#262626] overflow-hidden">
                  <div className="h-full bg-[#c5fe00] rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }} />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-8 text-[#a0a09f] text-[11px] font-bold tracking-[0.1em] uppercase">
              <div className="flex items-center gap-2">
                <CheckCircle size={14} className="text-[#c5fe00]" /> {reviewedCount} Reviewed
              </div>
              <div className="flex items-center gap-2">
                <MoreHorizontal size={14} className="text-[#8c8c8b]" /> {pendingCount} Pending
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-6">
              <button
                className="text-[#a0a09f] hover:text-[#ff4d4d] transition-colors font-bold text-xs uppercase tracking-widest disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={handleDiscard}
                disabled={!displayResults.length || isApproving}
              >
                Discard Batch
              </button>
              <button
                className="bg-[#c5fe00] hover:bg-[#b9ef00] transition-colors text-[#0a0a0a] rounded-full px-8 py-4 font-black flex items-center gap-3 text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(197,254,0,0.2)] hover:scale-[1.02] transform duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={handleApprove}
                disabled={!displayResults.length || isApproving}
              >
                {isApproving ? (
                  <><Loader2 size={14} className="animate-spin" /> Approving…</>
                ) : (
                  "Approve & Next"
                )}
              </button>
            </div>
          </div>
        )}

        {/* Footer — idle/running states: show start button */}
        {(isIdle || isRunning) && !isError && (
          <div className="absolute w-full bottom-0 h-[88px] border-t border-[#262626] bg-[#0a0a0a]/90 backdrop-blur-md flex items-center justify-between px-8 z-50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#1a200a] text-[#c5fe00] border border-[#2a2e16] flex items-center justify-center">
                <Sparkles size={14} />
              </div>
              <p className="text-[#8c8c8b] text-[12px] font-medium">
                {isRunning ? "Translation in progress…" : "Click Start Translation when ready."}
              </p>
            </div>
            <button
              onClick={handleStartTranslation}
              disabled={isRunning || !sentences?.length}
              className="bg-[#c5fe00] hover:bg-[#b9ef00] transition-colors text-[#0a0a0a] rounded-full px-8 py-4 font-black flex items-center gap-3 text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(197,254,0,0.2)] hover:scale-[1.02] transform duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isRunning
                ? <><Loader2 size={14} className="animate-spin" /> Translating…</>
                : <><Zap size={14} strokeWidth={3} className="fill-[#0a0a0a]" /> Start Translation</>
              }
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

export default ReviewPage;
