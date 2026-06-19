import React, { useMemo, useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { approveTranslations, translateSentences } from "../services/api";
import { useAppContext } from "../context/AppContext";
import { languageLabel, TARGET_LANGUAGES } from "../constants/languages";
import UserProfileBlock from "../components/UserProfileBlock";
import NavAvatar from "../components/NavAvatar";
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
  Globe,
  ChevronDown,
  AlertTriangle,
} from "lucide-react";

// ── Match-type helpers ────────────────────────────────────────────────────────

const SKIP_MATCH_TYPES = new Set(["tm_exact", "faiss_direct"]);

const matchLabel = (matchType) => {
  if (!matchType) return "Pending";
  switch (matchType) {
    case "tm_exact":
      return "TM Exact";
    case "faiss_direct":
      return "FAISS Direct";
    case "llm_guided":
      return "LLM Guided";
    case "llm_cold":
      return "LLM Cold";
    default:
      return matchType.replace("_", " ").toUpperCase();
  }
};

const matchBadgeCls = (matchType) => {
  switch (matchType) {
    case "tm_exact":
      return "bg-[#1a2010] text-[#c5fe00] border-[#2a2e16]"; // Green
    case "faiss_direct":
      return "bg-[#201c00] text-[#ffcc00] border-[#3a3000]"; // Yellow
    case "llm_guided":
      return "bg-[#2a130a] text-[#ff8800] border-[#4a2310]"; // Orange
    case "llm_cold":
    default:
      return "bg-[#2a0a0a] text-[#ff4d4d] border-[#4a1010]"; // Red
  }
};

const ORDERED_MATCH_TYPES = [
  "llm_cold",
  "llm_guided",
  "faiss_direct",
  "tm_exact",
];

const EMPTY_OFFSETS = { llm_cold: 0, llm_guided: 0, faiss_direct: 0, tm_exact: 0 };

// Bucket translation results by their match_type tier.
function groupByMatchType(list) {
  const groups = { llm_cold: [], llm_guided: [], faiss_direct: [], tm_exact: [] };
  (list || []).forEach((r) => {
    (groups[r.match_type] || groups.llm_cold).push(r);
  });
  return groups;
}

// The first tier (in review order) that still has unreviewed batches, given the
// per-tier reviewed offsets. Falls back to the first populated tier, then cold.
function firstPendingSection(groups, offsets) {
  return (
    ORDERED_MATCH_TYPES.find(
      (mt) => groups[mt]?.length > 0 && (offsets?.[mt] || 0) < groups[mt].length,
    ) ||
    ORDERED_MATCH_TYPES.find((mt) => groups[mt]?.length > 0) ||
    "llm_cold"
  );
}

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
            <span className="font-display text-[#c5fe00] font-black text-sm tracking-tight leading-none mb-1">
              TransSync
            </span>
            <span className="text-[#555555] font-bold text-[9px] uppercase tracking-widest leading-none">
              AI Studio
            </span>
          </div>
        </div>

        <nav className="space-y-1">
          <Link
            to="/dashboard"
            className="flex items-center gap-4 text-[#8c8c8b] hover:text-[#ffffff] hover:bg-[#131313] transition-colors px-4 py-3 rounded-[12px]"
          >
            <LayoutDashboard size={18} />
            <span className="text-[11px] font-bold uppercase tracking-widest">
              Dashboard
            </span>
          </Link>
          <Link
            to="/upload"
            className="flex items-center gap-4 text-[#8c8c8b] hover:text-[#ffffff] hover:bg-[#131313] transition-colors px-4 py-3 rounded-[12px]"
          >
            <FileUp size={18} />
            <span className="text-[11px] font-bold uppercase tracking-widest">
              Upload
            </span>
          </Link>
          <Link
            to="/validation"
            className="flex items-center gap-4 text-[#8c8c8b] hover:text-[#ffffff] hover:bg-[#131313] transition-colors px-4 py-3 rounded-[12px]"
          >
            <CheckCircle2 size={18} />
            <span className="text-[11px] font-bold uppercase tracking-widest">
              Validation
            </span>
          </Link>
          <div className="flex items-center gap-4 bg-[#1a1c10] text-[#c5fe00] border border-[#2a2e16] px-4 py-3 rounded-[12px] shadow-[inset_0_0_10px_rgba(197,254,0,0.05)]">
            <MessageSquare size={18} />
            <span className="text-[11px] font-bold uppercase tracking-widest">
              Review
            </span>
          </div>
          <Link
            to="/glossary"
            className="flex items-center gap-4 text-[#8c8c8b] hover:text-[#ffffff] hover:bg-[#131313] transition-colors px-4 py-3 rounded-[12px]"
          >
            <Book size={18} />
            <span className="text-[11px] font-bold uppercase tracking-widest">
              Glossary
            </span>
          </Link>
          <Link
            to="/export"
            className="flex items-center gap-4 text-[#8c8c8b] hover:text-[#ffffff] hover:bg-[#131313] transition-colors px-4 py-3 rounded-[12px]"
          >
            <Download size={18} />
            <span className="text-[11px] font-bold uppercase tracking-widest">
              Export
            </span>
          </Link>
        </nav>
      </div>

      <div className="p-6 space-y-1 pb-8">
        <UserProfileBlock />
      </div>
    </aside>
  );
}

// ── Review Section Component ──────────────────────────────────────────────────

function ReviewSection({
  matchType,
  items,
  offset,
  onApprove,
  onDiscard,
  isApproving,
  sourceLang,
  targetLang,
}) {
  if (!items || items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] text-center bg-[#111111] border border-[#262626] rounded-[24px]">
        <div className="w-16 h-16 rounded-full bg-[#1a1a1a] border border-[#262626] flex items-center justify-center mb-6">
          <Languages size={28} className="text-[#555555]" />
        </div>
        <h2 className="font-display font-bold text-xl tracking-tight mb-2 text-[#8c8c8b]">
          No {matchLabel(matchType)} Matches
        </h2>
        <p className="text-[#555555] text-[13px] max-w-sm">
          There are no sentences that matched this translation layer in the
          current document.
        </p>
      </div>
    );
  }

  const CHUNK_SIZE = 10;
  const isCompleted = offset >= items.length;

  if (isCompleted) {
    return (
      <div className="bg-[#111111] border border-[#262626] rounded-[24px] p-6 text-center mb-6">
        <CheckCircle size={24} className="mx-auto mb-2 text-[#555555]" />
        <p className="text-[11px] uppercase tracking-widest font-bold text-[#8c8c8b]">
          All {matchLabel(matchType)} reviewed
        </p>
      </div>
    );
  }

  const batch = items.slice(offset, offset + CHUNK_SIZE);
  const currentBatchNum = Math.floor(offset / CHUNK_SIZE) + 1;
  const totalBatches = Math.ceil(items.length / CHUNK_SIZE);
  const skippedInBatch = batch.filter((item) =>
    SKIP_MATCH_TYPES.has(item.match_type),
  ).length;

  return (
    <div className="bg-[#111111] border border-[#262626] rounded-[24px] overflow-hidden mb-6">
      <div className="px-8 py-5 border-b border-[#262626] flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span
            className={`text-[9px] font-bold uppercase tracking-widest rounded-full px-3 py-1.5 shadow-[inset_0_0_10px_rgba(197,254,0,0.05)] ${matchBadgeCls(matchType)}`}
          >
            {matchLabel(matchType)}
          </span>
          <span className="text-[#8c8c8b] text-[10px] font-bold uppercase tracking-[0.2em]">
            Batch {currentBatchNum} / {totalBatches}
          </span>
        </div>
        <div className="flex items-center gap-4">
          {skippedInBatch > 0 && (
            <span className="text-[#555555] text-[10px] font-bold uppercase tracking-widest">
              {skippedInBatch} already in TM
            </span>
          )}
          <span className="text-[#555555] text-[10px] font-bold uppercase tracking-[0.2em]">
            {batch.length} sentences
          </span>
        </div>
      </div>

      <div className="divide-y divide-[#262626]">
        {batch.map((item, index) => {
          const conf =
            item.score !== undefined && item.score !== null
              ? Math.max(0, Math.round(100 - item.score * 100))
              : null;

          return (
            <div
              key={`${item.source}-${index}`}
              className="grid grid-cols-1 md:grid-cols-2"
            >
              <div className="p-6 border-r border-[#262626]">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[#555555] text-[10px] font-bold uppercase tracking-widest">
                    Source — {sourceLang?.toUpperCase() || "EN"}
                  </span>
                </div>
                <p className="text-[#a0a09f] text-[15px] leading-[1.6] font-sans">
                  {item.source}
                </p>
              </div>

              <div className="p-6">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[#555555] text-[10px] font-bold uppercase tracking-widest">
                    Target — {targetLang ? languageLabel(targetLang) : "TBD"}
                  </span>

                  {conf !== null && item.match_type !== "llm_cold" && (
                    <span
                      className={`text-[9px] font-bold uppercase tracking-widest rounded-full px-2 py-1 ${matchBadgeCls(matchType)} bg-opacity-20`}
                    >
                      {conf}% Confidence
                    </span>
                  )}
                </div>
                <p className="text-[#ffffff] text-[15px] leading-[1.6] font-sans">
                  {item.translation}
                </p>

                {/* Back-translation QA warning — informational signal only */}
                {item.back_translation_failed && (
                  <div
                    title="The back-translation diverged from the original source meaning. Please review this sentence carefully."
                    className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#4a2310] bg-[#2a130a] px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-[#ff8800]"
                  >
                    <AlertTriangle size={11} />
                    Possibly inaccurate — back-translation diverged
                    {item.back_translation_score !== null &&
                      item.back_translation_score !== undefined && (
                        <span className="text-[#a0a09f] normal-case tracking-normal">
                          ({Math.round(item.back_translation_score * 100)}% match)
                        </span>
                      )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Section Footer Actions */}
      <div className="p-6 bg-[#0a0a0a] border-t border-[#262626] flex justify-end gap-4">
        <button
          className="text-[#a0a09f] hover:text-[#ff4d4d] transition-colors font-bold text-[11px] uppercase tracking-widest disabled:opacity-60 disabled:cursor-not-allowed px-6 py-3 border border-[#262626] rounded-full"
          onClick={() => onDiscard(batch, matchType)}
          disabled={isApproving}
        >
          Discard Batch
        </button>
        <button
          className="bg-[#c5fe00] hover:bg-[#b9ef00] transition-colors text-[#0a0a0a] rounded-full px-6 py-3 font-bold flex items-center gap-2 text-[11px] uppercase tracking-widest disabled:opacity-60 disabled:cursor-not-allowed"
          onClick={() => onApprove(batch, matchType)}
          disabled={isApproving}
        >
          {isApproving ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Approving…
            </>
          ) : (
            "Approve & Next"
          )}
        </button>
      </div>
    </div>
  );
}

// ── Target Language Selector ─────────────────────────────────────────────────

function TargetLanguageSelector() {
  const { documents, activeDocIndex, updateDoc, targetLang, setTargetLang } = useAppContext();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const activeDoc = documents[activeDocIndex] || null;
  // Active doc's lang takes precedence; fall back to global targetLang
  const currentLang = activeDoc?.targetLang || targetLang || "";
  const currentLabel = currentLang ? languageLabel(currentLang) : null;

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSelect = (code) => {
    // Update global lang
    setTargetLang(code);
    // Also update every document's targetLang so translation uses it
    documents.forEach((doc) => {
      if (!doc.targetLang || doc.status === "uploaded" || doc.status === "validated") {
        updateDoc(doc.docId, { targetLang: code });
      }
    });
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2.5 bg-[#111111] hover:bg-[#1a1a1a] border border-[#262626] hover:border-[#333333] rounded-full px-4 py-2 transition-colors"
      >
        <Globe size={13} className="text-[#c5fe00] shrink-0" />
        <span className="text-[#555555] font-bold text-[9px] uppercase tracking-widest">
          Target:
        </span>
        <span className={`text-[13px] font-bold ${currentLabel ? "text-white" : "text-[#555555]"}`}>
          {currentLabel ? `${currentLabel} (${currentLang})` : "Select language"}
        </span>
        <ChevronDown size={13} className={`text-[#555555] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-[220px] bg-[#111111] border border-[#262626] rounded-[16px] overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.6)] z-50">
          <div className="px-4 py-3 border-b border-[#1a1a1a]">
            <span className="text-[#555555] font-bold text-[9px] uppercase tracking-widest">Target Language</span>
          </div>
          <div className="py-1">
            {TARGET_LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleSelect(lang.code)}
                className={`w-full text-left px-4 py-2.5 flex items-center justify-between transition-colors text-[13px] ${
                  currentLang === lang.code
                    ? "bg-[#1a1c10] text-[#c5fe00]"
                    : "text-[#a0a09f] hover:bg-[#1a1a1a] hover:text-white"
                }`}
              >
                <span>{lang.label}</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#555555]">{lang.code}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

function ReviewPage() {
  const [isApproving, setIsApproving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const {
    docId,
    filename,
    sentences,
    results,
    setResults,
    sourceLang,
    docTargetLang,
    targetLang,
    documents,
    activeDocIndex,
    setActiveDocIndex,
    updateDoc,
  } = useAppContext();
  const multiDoc = documents.length > 1;
  // Only docs that have been validated (or further) are relevant in Review
  const reviewableDocs = documents.filter(d =>
    ["validated", "translating", "translated", "approved"].includes(d.status)
  );
  const showDocTabs = reviewableDocs.length > 1;

  const hasResults = results && results.length > 0;
  const totalCount = results?.length || 0;

  // ── Restore offsets + reviewedCount from AppContext on mount / doc switch ──
  const activeDoc = documents[activeDocIndex] || null;
  const savedOffsets = activeDoc?.reviewOffsets;
  const savedReviewedCount = activeDoc?.reviewedCount;

  const [offsets, setOffsets] = useState(() =>
    savedOffsets || { llm_cold: 0, llm_guided: 0, faiss_direct: 0, tm_exact: 0 }
  );
  const [reviewedCount, setReviewedCount] = useState(() => savedReviewedCount ?? 0);

  const [activeSection, setActiveSection] = useState("llm_cold");
  const [sidebarTab, setSidebarTab] = useState("match_types");

  // Group results by match_type
  const groupedResults = useMemo(() => groupByMatchType(results), [results]);

  const initialState = results && results.length > 0 ? "done" : "idle";
  const [translationState, setTranslationState] = useState(initialState);

  // ── On mount: auto-select the first reviewable doc if current one isn't ready ──
  useEffect(() => {
    const currentDoc = documents[activeDocIndex];
    const isReviewable = currentDoc && ["validated", "translating", "translated", "approved"].includes(currentDoc.status);
    if (!isReviewable) {
      const firstReviewableIndex = documents.findIndex(d =>
        ["validated", "translating", "translated", "approved"].includes(d.status)
      );
      if (firstReviewableIndex !== -1) {
        setActiveDocIndex(firstReviewableIndex);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync offsets + reviewedCount + landing section whenever the active doc changes ──
  // Switching documents lands on that doc's first still-pending tier. This runs
  // ONLY on doc switch (keyed by docId) — NOT on every approval — so approving a
  // batch can't snap the view back to another section.
  useEffect(() => {
    const doc = documents[activeDocIndex];
    const docOffsets = doc?.reviewOffsets || { ...EMPTY_OFFSETS };
    setOffsets(docOffsets);
    setReviewedCount(doc?.reviewedCount ?? 0);
    if (doc?.results && doc.results.length > 0) {
      setActiveSection(firstPendingSection(groupByMatchType(doc.results), docOffsets));
    }
  }, [activeDocIndex, docId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Track translation lifecycle state (does NOT touch the active section) ──
  useEffect(() => {
    if (results && results.length > 0) {
      setTranslationState("done");
    } else {
      const activeDoc = documents[activeDocIndex];
      setTranslationState(activeDoc?.status === "translating" ? "running" : "idle");
    }
  }, [results, docId, documents, activeDocIndex]);

  const handleStartTranslation = async (translateAll = true) => {
    const pendingDocs = documents.filter(
      (d) => d.status === "validated" && d.sentences?.length > 0,
    );
    const isMultiMode = documents.length > 1 && translateAll;

    if (!isMultiMode && (!sentences || sentences.length === 0)) {
      setErrorMessage(
        "No validated sentences found. Please validate the document first.",
      );
      setTranslationState("error");
      return;
    }

    if (isMultiMode && pendingDocs.length === 0) {
      setErrorMessage("No documents are ready for translation.");
      setTranslationState("error");
      return;
    }

    const effectiveLang = docTargetLang || targetLang;
    if (!effectiveLang) {
      setErrorMessage(
        "Target language is missing. Please select a language on the upload page.",
      );
      setTranslationState("error");
      return;
    }

    setTranslationState("running");
    setErrorMessage("");

    // Results for the doc currently in view — used to land on its first tier.
    let activeResultsAfter = null;

    try {
      if (isMultiMode) {
        let currentDocResponse = null;
        for (let i = 0; i < documents.length; i++) {
          const doc = documents[i];
          if (
            doc.status !== "validated" ||
            !doc.sentences ||
            doc.sentences.length === 0
          )
            continue;

          updateDoc(doc.docId, { status: "translating" });

          const effLang = doc.targetLang || targetLang;
          const response = await translateSentences(
            doc.sentences,
            sourceLang,
            effLang,
            doc.filename,
          );
          updateDoc(doc.docId, {
            results: response.results || [],
            // Persist the language the doc was actually translated into, so it
            // travels with the results/translations into Review & Approval.
            targetLang: effLang,
            status: "translated",
            reviewOffsets: { llm_cold: 0, llm_guided: 0, faiss_direct: 0, tm_exact: 0 },
            reviewedCount: 0,
          });

          if (doc.docId === docId) {
            currentDocResponse = response;
          }
        }

        if (currentDocResponse) {
          activeResultsAfter = currentDocResponse.results || [];
          setResults(activeResultsAfter);
        }
      } else {
        const effLang = docTargetLang || targetLang;
        const response = await translateSentences(
          sentences,
          sourceLang,
          effLang,
          filename,
        );
        activeResultsAfter = response.results || [];
        setResults(activeResultsAfter);
        updateDoc(docId, {
          results: response.results || [],
          // Persist the language the doc was actually translated into, so it
          // travels with the results/translations into Review & Approval.
          targetLang: effLang,
          status: "translated",
          reviewOffsets: { llm_cold: 0, llm_guided: 0, faiss_direct: 0, tm_exact: 0 },
          reviewedCount: 0,
        });
      }

      setOffsets({ ...EMPTY_OFFSETS });
      setReviewedCount(0);
      // Land on the first populated tier for the doc now in view.
      if (activeResultsAfter && activeResultsAfter.length > 0) {
        setActiveSection(
          firstPendingSection(groupByMatchType(activeResultsAfter), EMPTY_OFFSETS),
        );
      }
      setTranslationState("done");
    } catch (error) {
      setErrorMessage(error.message || "Translation failed.");
      setTranslationState("error");
    }
  };

  const pendingCount = Math.max(0, totalCount - reviewedCount);
  const progressPercent =
    totalCount > 0 ? Math.round((reviewedCount / totalCount) * 100) : 0;

  // Advance to the next pending tier ONLY when the tier just acted on is fully
  // reviewed. While a tier still has batches left, the view stays put — so
  // approving one batch never jumps the reviewer to another section.
  const advanceSectionAfter = (newOffsets, matchType) => {
    const current = groupedResults[matchType];
    if (current && newOffsets[matchType] < current.length) return; // still pending → stay
    const next = firstPendingSection(groupedResults, newOffsets);
    setActiveSection(next);
  };

  const handleApproveBatch = async (batch, matchType) => {
    if (!batch.length || isApproving) return;

    setIsApproving(true);
    setErrorMessage("");

    try {
      // Fall back to the global targetLang if the per-doc value is somehow
      // unset, so approvals are never saved with an empty target language.
      const effLang = docTargetLang || targetLang;
      if (!effLang) {
        setErrorMessage(
          "Target language is missing — cannot approve. Please select a target language first.",
        );
        setIsApproving(false);
        return;
      }

      const payload = batch
        .filter((item) => !SKIP_MATCH_TYPES.has(item.match_type))
        .map((item) => ({
          source_text: item.source,
          translated_text: item.translation,
          target_lang: effLang,
          match_type: item.match_type,
          action: "approved",
          faiss_index: item.faiss_index ?? null,
        }));

      if (payload.length > 0) {
        await approveTranslations(payload);
      }

      const newReviewedCount = reviewedCount + batch.length;
      const newOffsets = { ...offsets, [matchType]: offsets[matchType] + batch.length };
      setReviewedCount(newReviewedCount);
      setOffsets(newOffsets);
      updateDoc(docId, { reviewOffsets: newOffsets, reviewedCount: newReviewedCount });
      advanceSectionAfter(newOffsets, matchType);
    } catch (error) {
      setErrorMessage(error.message || "Approval failed.");
    } finally {
      setIsApproving(false);
    }
  };

  const handleDiscardBatch = (batch, matchType) => {
    if (!batch.length || isApproving) return;
    const newReviewedCount = reviewedCount + batch.length;
    const newOffsets = { ...offsets, [matchType]: offsets[matchType] + batch.length };
    setReviewedCount(newReviewedCount);
    setOffsets(newOffsets);
    updateDoc(docId, { reviewOffsets: newOffsets, reviewedCount: newReviewedCount });
    advanceSectionAfter(newOffsets, matchType);
  };

  const isIdle = translationState === "idle";
  const isRunning = translationState === "running";
  const isDone = translationState === "done" || hasResults;
  const isError = translationState === "error";

  // Translation can only start once a target language has been chosen (the
  // selector lives in the header). Gate the Start Translation controls on it.
  const hasTargetLang = Boolean(docTargetLang || targetLang);

  // Check if ALL sections are fully reviewed
  const allReviewed =
    hasResults &&
    ORDERED_MATCH_TYPES.every((mt) => offsets[mt] >= groupedResults[mt].length);

  // ── Mark doc as approved in AppContext when all sections are reviewed ──────
  useEffect(() => {
    if (allReviewed && docId && documents.find(d => d.docId === docId)?.status === "translated") {
      updateDoc(docId, { status: "approved" });
    }
  }, [allReviewed, docId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="h-screen bg-[#0a0a0a] text-[#ffffff] font-sans flex overflow-hidden selection:bg-[#c5fe00] selection:text-[#0a0a0a]">
      <Sidebar />

      <div className="flex flex-col flex-1 relative w-full h-full overflow-hidden bg-[#0e0e0e]">
        {/* Top Header */}
        <header className="h-[80px] w-full border-b border-[#262626] bg-[#0a0a0a] flex items-center justify-between px-8 shrink-0 z-40">
          <div className="flex items-center gap-4">
            <Link to="/" className="inline-block">
              <span className="font-display font-bold text-xl tracking-tight text-[#c5fe00] leading-none">
                TransSync
              </span>
            </Link>
            <div className="w-px h-6 bg-[#262626]"></div>
            {/* ── Target Language Selector ── */}
            <TargetLanguageSelector />
          </div>

          {/* Live Sync Badge */}
          {translationState === "done" && (
            <div className="hidden lg:flex items-center gap-3 bg-[#1a1a1a] border border-[#262626] px-4 py-2 rounded-full absolute left-1/2 -translate-x-1/2">
              <div className="w-2.5 h-2.5 bg-[#c5fe00] rounded-full animate-pulse"></div>
              <span className="text-[#a0a09f] font-bold text-[9px] uppercase tracking-widest leading-none">
                Live Sync
                <br />
                Active
              </span>
            </div>
          )}

          <div className="flex items-center gap-6">
            <button className="text-[#8c8c8b] hover:text-[#ffffff] transition-colors">
              <Bell size={18} />
            </button>
            <button className="text-[#8c8c8b] hover:text-[#ffffff] transition-colors">
              <HelpCircle size={18} />
            </button>
            <button className="text-[#8c8c8b] hover:text-[#ffffff] transition-colors">
              <Settings size={18} />
            </button>
            <NavAvatar />
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden w-full pb-[88px]">
          <main className="flex-1 overflow-y-auto layout-scrollbar bg-[#0a0a0a]">
            <div className="p-8 max-w-5xl mx-auto space-y-6">
              {/* ── Multi-doc tabs — only validated/translated/approved docs ── */}
              {showDocTabs && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {reviewableDocs.map((doc) => {
                    const i = documents.indexOf(doc);
                    return (
                      <button
                        key={doc.docId}
                        onClick={() => {
                          setActiveDocIndex(i);
                          setErrorMessage("");
                        }}
                        className={`px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-widest border transition-colors ${
                          i === activeDocIndex
                            ? "bg-[#1a1c10] text-[#c5fe00] border-[#2a2e16]"
                            : doc.status === "approved"
                              ? "bg-[#111111] text-[#8c8c8b] border-[#2a2e16]"
                              : doc.status === "translated"
                                ? "bg-[#111111] text-[#a0a09f] border-[#262626]"
                                : doc.status === "translating"
                                  ? "bg-[#1a1c10] text-[#c5fe00] border-[#2a2e16] opacity-60 animate-pulse"
                                  : "bg-[#111111] text-[#555555] border-[#262626] hover:text-[#8c8c8b]"
                        }`}
                      >
                        {doc.filename.length > 20
                          ? doc.filename.slice(0, 18) + "…"
                          : doc.filename}
                        {doc.status === "approved" && " ✓"}
                        {doc.status === "translating" && " ⟳"}
                      </button>
                    );
                  })}
                </div>
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
              {translationState === "idle" && !isError && (
                <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
                  <div className="w-20 h-20 rounded-full bg-[#1a1c10] border border-[#2a2e16] flex items-center justify-center mb-8 shadow-[0_0_40px_rgba(197,254,0,0.08)]">
                    <Languages size={32} className="text-[#c5fe00]" />
                  </div>
                  <h2 className="font-display font-bold text-3xl tracking-tight mb-3">
                    Ready to Translate
                  </h2>
                  <p className="text-[#8c8c8b] text-[15px] mb-2 max-w-md leading-relaxed">
                    {sentences && sentences.length > 0
                      ? `${sentences.length} validated sentence${sentences.length > 1 ? "s" : ""} ready for translation into ${docTargetLang ? languageLabel(docTargetLang) : "your target language"}.`
                      : "No validated sentences found. Please go back and validate your document first."}
                  </p>
                  {sentences && sentences.length > 0 && (
                    <p className="text-[#555555] text-[12px] mb-10 uppercase tracking-widest font-bold">
                      This may take a few seconds depending on document size.
                    </p>
                  )}
                  {sentences && sentences.length > 0 ? (
                    hasTargetLang ? (
                      <div className="flex flex-col sm:flex-row gap-4 items-center">
                        {reviewableDocs.filter((d) => d.status === "validated").length > 1 && (
                          <button
                            onClick={() => handleStartTranslation(true)}
                            className="bg-[#c5fe00] hover:bg-[#b9ef00] text-[#0a0a0a] rounded-full px-10 py-4 font-black flex items-center gap-3 text-xs uppercase tracking-widest shadow-[0_0_30px_rgba(197,254,0,0.25)] hover:scale-[1.02] transform transition-all"
                          >
                            <Zap size={16} strokeWidth={3} className="fill-[#0a0a0a]" />
                            {`Translate All ${reviewableDocs.filter((d) => d.status === "validated").length} Docs`}
                          </button>
                        )}
                        <button
                          onClick={() => handleStartTranslation(false)}
                          className={
                            reviewableDocs.filter((d) => d.status === "validated").length > 1
                              ? "border border-[#555555] hover:border-[#c5fe00] hover:text-[#c5fe00] text-[#ffffff] rounded-full px-10 py-4 font-black flex items-center gap-3 text-xs uppercase tracking-widest transition-colors"
                              : "bg-[#c5fe00] hover:bg-[#b9ef00] text-[#0a0a0a] rounded-full px-10 py-4 font-black flex items-center gap-3 text-xs uppercase tracking-widest shadow-[0_0_30px_rgba(197,254,0,0.25)] hover:scale-[1.02] transform transition-all"
                          }
                        >
                          <Zap size={16} strokeWidth={3} className={reviewableDocs.filter((d) => d.status === "validated").length > 1 ? "" : "fill-[#0a0a0a]"} />
                          {reviewableDocs.filter((d) => d.status === "validated").length > 1 ? "Translate Current Doc" : "Start Translation"}
                        </button>
                      </div>
                    ) : (
                      /* No target language picked yet — point to the header selector. */
                      <div className="flex flex-col items-center gap-3 bg-[#15170d] border border-[#2a2e16] rounded-[20px] px-8 py-6">
                        <Globe size={22} className="text-[#c5fe00]" />
                        <p className="text-[#ffffff] text-sm font-bold">
                          Select a target language to begin
                        </p>
                        <p className="text-[#8c8c8b] text-[12px] max-w-xs leading-relaxed">
                          Use the <span className="text-[#c5fe00] font-bold">Target</span> selector
                          in the header above to choose a language. The Start Translation button
                          appears once it's set.
                        </p>
                      </div>
                    )
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
              {translationState === "running" && (
                <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
                  <div className="w-20 h-20 rounded-full bg-[#1a1c10] border border-[#2a2e16] flex items-center justify-center mb-8 shadow-[0_0_40px_rgba(197,254,0,0.08)]">
                    <Loader2
                      size={32}
                      className="text-[#c5fe00] animate-spin"
                    />
                  </div>
                  <h2 className="font-display font-bold text-3xl tracking-tight mb-3">
                    Translating…
                  </h2>
                  <p className="text-[#8c8c8b] text-[15px] max-w-md leading-relaxed">
                    Running {sentences?.length || 0} sentences through TM
                    lookup, FAISS search, and the Groq LLM. This may take 10–30
                    seconds.
                  </p>
                  <div className="mt-8 flex gap-[4px]">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="w-2 h-2 bg-[#c5fe00] rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 150}ms` }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* ── DONE STATE — ALL REVIEWED ── */}
              {translationState === "done" && !isRunning && allReviewed && (
                <div className="flex flex-col items-center justify-center min-h-[300px] text-center">
                  <div className="w-16 h-16 rounded-full bg-[#1a2010] border border-[#2a2e16] flex items-center justify-center mb-6">
                    <CheckCircle size={28} className="text-[#c5fe00]" />
                  </div>
                  <h2 className="font-display font-bold text-2xl tracking-tight mb-2">
                    All Sections Reviewed
                  </h2>
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

              {/* ── DONE STATE (Review UI) ── */}
              {translationState === "done" && hasResults && !allReviewed && (
                <div className="space-y-8">
                  <ReviewSection
                    matchType={activeSection}
                    items={groupedResults[activeSection]}
                    offset={offsets[activeSection]}
                    onApprove={handleApproveBatch}
                    onDiscard={handleDiscardBatch}
                    isApproving={isApproving}
                    sourceLang={sourceLang}
                    targetLang={docTargetLang}
                  />
                </div>
              )}
            </div>
          </main>

          {/* Right Context Panel */}
          <aside className="w-[360px] border-l border-[#262626] bg-[#0e0e0e] shrink-0 flex flex-col overflow-y-auto layout-scrollbar">
            <div className="flex items-center gap-6 border-b border-[#262626] px-8 pt-8">
              <button
                onClick={() => setSidebarTab("match_types")}
                className={`text-[10px] font-bold uppercase tracking-widest pb-4 border-b-2 transition-colors ${sidebarTab === "match_types" ? "text-[#c5fe00] border-[#c5fe00]" : "text-[#555555] border-transparent hover:text-[#8c8c8b]"}`}
              >
                Match Types
              </button>
              <button
                onClick={() => setSidebarTab("context")}
                className={`text-[10px] font-bold uppercase tracking-widest pb-4 border-b-2 transition-colors ${sidebarTab === "context" ? "text-[#c5fe00] border-[#c5fe00]" : "text-[#555555] border-transparent hover:text-[#8c8c8b]"}`}
              >
                Context
              </button>
            </div>

            <div className="p-8 space-y-10">
              {sidebarTab === "context" && (
                <div>
                  <h4 className="text-[#555555] font-bold text-[10px] uppercase tracking-[0.2em] mb-6">
                    Draft Settings
                  </h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-[#8c8c8b]">Tone of Voice</span>
                      <span className="text-[#c5fe00] font-bold">
                        Sophisticated
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-[#8c8c8b]">Formality</span>
                      <div className="w-[100px] h-1.5 rounded-full bg-[#262626] overflow-hidden">
                        <div className="w-[85%] h-full bg-[#c5fe00] rounded-full"></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {sidebarTab === "match_types" && (
                <div>
                  <h4 className="text-[#555555] font-bold text-[10px] uppercase tracking-[0.2em] mb-6">
                    Match Types
                  </h4>
                  <div className="space-y-3">
                    {[
                      {
                        type: "llm_cold",
                        desc: "LLM cold translation with no reference.",
                      },
                      {
                        type: "llm_guided",
                        desc: "LLM translation guided by a reference pair.",
                      },
                      {
                        type: "faiss_direct",
                        desc: "FAISS similarity ≥ 0.95.",
                      },
                      {
                        type: "tm_exact",
                        desc: "Exact match from Translation Memory.",
                      },
                    ].map(({ type, desc }) => {
                      const count = groupedResults
                        ? groupedResults[type]?.length || 0
                        : 0;
                      const isActive = activeSection === type;
                      return (
                        <button
                          key={type}
                          onClick={() => setActiveSection(type)}
                          className={`w-full text-left bg-[#111111] border rounded-[16px] p-4 transition-colors ${
                            isActive
                              ? "border-[#c5fe00]"
                              : "border-[#1a1a1a] hover:border-[#333333]"
                          }`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <span
                              className={`text-[9px] font-bold uppercase tracking-widest rounded-full px-2 py-1 inline-block ${matchBadgeCls(type)}`}
                            >
                              {matchLabel(type)}
                            </span>
                            <span
                              className={`text-[10px] font-bold ${isActive ? "text-[#ffffff]" : "text-[#555555]"}`}
                            >
                              {count} pending
                            </span>
                          </div>
                          <p className="text-[#555555] text-[11px] leading-relaxed">
                            {desc}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>

        {/* Footer Action Bar — only shown when reviewing */}
        {translationState === "done" && !isRunning && (
          <div className="absolute w-full bottom-0 h-[88px] border-t border-[#262626] bg-[#0a0a0a]/90 backdrop-blur-md flex items-center justify-between px-8 z-50">
            {/* Progress */}
            <div className="flex items-center gap-12">
              <div className="flex flex-col gap-2 w-[240px]">
                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-[0.2em] text-[#555555]">
                  <span>Overall Progress</span>
                  <span className="text-[#ffffff]">{progressPercent}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[#262626] overflow-hidden">
                  <div
                    className="h-full bg-[#c5fe00] rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-8 text-[#a0a09f] text-[11px] font-bold tracking-[0.1em] uppercase">
              <div className="flex items-center gap-2">
                <CheckCircle size={14} className="text-[#c5fe00]" />{" "}
                {reviewedCount} Reviewed
              </div>
              <div className="flex items-center gap-2">
                <MoreHorizontal size={14} className="text-[#8c8c8b]" />{" "}
                {pendingCount} Pending
              </div>
            </div>

            {/* Actions are now managed per-section, so we keep this space clean or put something else here */}
            <div className="flex items-center gap-6">
              <span className="text-[#555555] text-[10px] uppercase tracking-widest font-bold">
                Approve items in the sections above
              </span>
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
                {isRunning
                  ? "Translation in progress…"
                  : hasTargetLang
                    ? "Click Start Translation when ready."
                    : "Select a target language in the header to begin."}
              </p>
            </div>
            {/* Start Translation only appears once a target language is selected. */}
            {hasTargetLang ? (
              <button
                onClick={() => handleStartTranslation()}
                disabled={isRunning || !sentences?.length}
                className="bg-[#c5fe00] hover:bg-[#b9ef00] transition-colors text-[#0a0a0a] rounded-full px-8 py-4 font-black flex items-center gap-3 text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(197,254,0,0.2)] hover:scale-[1.02] transform duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isRunning ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Translating…
                  </>
                ) : (
                  <>
                    <Zap size={14} strokeWidth={3} className="fill-[#0a0a0a]" />{" "}
                    Start Translation
                  </>
                )}
              </button>
            ) : (
              <span className="flex items-center gap-2 text-[#c5fe00] text-[11px] font-bold uppercase tracking-widest border border-[#2a2e16] bg-[#15170d] rounded-full px-5 py-3">
                <Globe size={14} /> Target language required
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ReviewPage;
