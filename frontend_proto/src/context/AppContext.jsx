import React, { createContext, useCallback, useContext, useMemo, useState, useEffect, useRef } from "react";
import { updateDocument as apiUpdateDocument } from "../services/api";

const AppContext = createContext(null);

/**
 * Multi-document state shape (per document):
 *
 *   {
 *     docId:      "uuid",        // stable key within the documents array
 *     documentId: "uuid|null",   // Supabase documents.id when the doc is DB-backed
 *     filename:   "report.pdf",
 *     rawText:    "full extracted text…",
 *     sentences:  ["sentence 1", …],
 *     results:    [{ source, translation, match_type }, …],
 *     validationResult: { status, errors, sentence_count },
 *     targetLang: "fr",
 *     status:     "uploaded" | "validating" | "validated" | "translating" | "translated" | "approved" | "error",
 *     error:      null | "message",
 *     reviewOffsets, reviewedCount, originalDocxB64 (runtime-only),
 *   }
 *
 * Persistence:
 *   • localStorage is a fast session cache (originalDocxB64 stripped — too large).
 *   • When a document is DB-backed (has documentId) and belongs to the current
 *     project, meaningful state changes are written through to Supabase so the
 *     project can be resumed from any device. The DB is the source of truth on
 *     load; localStorage only accelerates the first paint.
 */

// AppContext document status ↔ Supabase documents.stage. The DB uses "in_review"
// for the review phase; the frontend has historically called it "translated".
const STAGE_TO_DB = {
  uploaded: "uploaded",
  validating: "validating",
  validated: "validated",
  translating: "translating",
  translated: "in_review",
  approved: "approved",
  exported: "exported",
  error: "error",
};
const DB_TO_STAGE = {
  uploaded: "uploaded",
  validating: "validating",
  validated: "validated",
  translating: "translating",
  in_review: "translated",
  approved: "approved",
  exported: "exported",
  error: "error",
};

const EMPTY_OFFSETS = { llm_cold: 0, llm_guided: 0, faiss_direct: 0, tm_exact: 0 };

// Map a Supabase documents row into the AppContext document shape (rehydration).
export function dbDocToAppDoc(row) {
  return {
    docId: row.id,
    documentId: row.id,
    filename: row.filename || "document",
    rawText: row.raw_text || "",
    originalDocxB64: null, // not held in the DB row; the original .docx lives in
                           // Supabase Storage and the export route restores it by
                           // doc_id, so format-preserving export still works here.
    sentences: row.sentences || [],
    results: row.results || [],
    validationResult: row.validation_result || null,
    status: DB_TO_STAGE[row.stage] || "uploaded",
    error: row.error || null,
    targetLang: row.target_lang || "",
    reviewOffsets:
      row.review_offsets && Object.keys(row.review_offsets).length
        ? row.review_offsets
        : { ...EMPTY_OFFSETS },
    reviewedCount: row.reviewed_count ?? 0,
  };
}

export function AppProvider({ children }) {
  const [documents, setDocuments] = useState(() => {
    try {
      const saved = localStorage.getItem("ts_documents");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.warn("Failed to load documents from localStorage", e);
      return [];
    }
  });

  const [activeDocIndex, setActiveDocIndex] = useState(() => {
    try {
      const saved = localStorage.getItem("ts_activeDocIndex");
      return saved ? parseInt(saved, 10) : 0;
    } catch (e) {
      return 0;
    }
  });

  const [sourceLang, setSourceLang] = useState(() => {
    try {
      return localStorage.getItem("ts_sourceLang") || "en";
    } catch (e) {
      return "en";
    }
  });

  const [targetLang, setTargetLang] = useState(() => {
    try {
      return localStorage.getItem("ts_targetLang") || "";
    } catch (e) {
      return "";
    }
  });

  // The project the workflow pages are currently operating inside (or "" / null
  // for the legacy project-less flow). Persisted so a page refresh mid-flow
  // keeps the project scope.
  const [currentProjectId, setCurrentProjectId] = useState(() => {
    try {
      return localStorage.getItem("ts_currentProjectId") || null;
    } catch (e) {
      return null;
    }
  });

  // Live mirror of `documents` so callbacks can read the freshest doc without
  // being re-created on every change.
  const documentsRef = useRef(documents);
  useEffect(() => {
    documentsRef.current = documents;
  }, [documents]);

  const currentProjectIdRef = useRef(currentProjectId);
  useEffect(() => {
    currentProjectIdRef.current = currentProjectId;
  }, [currentProjectId]);

  // ── Sync to localStorage ──────────────────────────────────────────────────
  useEffect(() => {
    try {
      // Strip originalDocxB64 before persisting — the base64 of an uploaded
      // .docx can be several MB and would blow the ~5MB localStorage quota.
      const persistable = documents.map(({ originalDocxB64, ...rest }) => rest);
      localStorage.setItem("ts_documents", JSON.stringify(persistable));
    } catch (e) {
      console.warn("Failed to save documents to localStorage", e);
    }
  }, [documents]);

  useEffect(() => {
    try {
      localStorage.setItem("ts_activeDocIndex", activeDocIndex.toString());
    } catch (e) {}
  }, [activeDocIndex]);

  useEffect(() => {
    try {
      localStorage.setItem("ts_sourceLang", sourceLang);
    } catch (e) {}
  }, [sourceLang]);

  useEffect(() => {
    try {
      localStorage.setItem("ts_targetLang", targetLang);
    } catch (e) {}
  }, [targetLang]);

  useEffect(() => {
    try {
      if (currentProjectId) localStorage.setItem("ts_currentProjectId", currentProjectId);
      else localStorage.removeItem("ts_currentProjectId");
    } catch (e) {}
  }, [currentProjectId]);

  // ── DB write-through ───────────────────────────────────────────────────────
  // Translate a local doc patch into a Supabase documents patch and persist it
  // (best-effort, fire-and-forget). Only DB-backed docs (with documentId) are
  // written; the legacy project-less flow is a no-op here.
  const persistDocToDb = useCallback((doc, patch) => {
    if (!doc?.documentId) return;
    const dbPatch = {};
    if ("status" in patch) dbPatch.stage = STAGE_TO_DB[patch.status] || patch.status;
    if ("sentences" in patch) {
      dbPatch.sentences = patch.sentences || [];
      dbPatch.sentence_count = (patch.sentences || []).length;
    }
    if ("results" in patch) dbPatch.results = patch.results || [];
    if ("validationResult" in patch) dbPatch.validation_result = patch.validationResult;
    if ("reviewOffsets" in patch) dbPatch.review_offsets = patch.reviewOffsets || {};
    if ("reviewedCount" in patch) dbPatch.reviewed_count = patch.reviewedCount ?? 0;
    if ("targetLang" in patch) dbPatch.target_lang = patch.targetLang || null;
    if ("filename" in patch) dbPatch.filename = patch.filename || "document";
    if ("error" in patch && patch.error) dbPatch.error = patch.error;
    if (Object.keys(dbPatch).length === 0) return;

    apiUpdateDocument(doc.documentId, dbPatch).catch((e) =>
      console.warn("Document state failed to persist to Supabase (non-fatal):", e?.message || e),
    );
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const addDocuments = useCallback((newDocs) => {
    setDocuments((prev) => [
      ...prev,
      ...newDocs.map((d) => ({
        docId:     d.docId     || "",
        documentId: d.documentId || null,
        filename:  d.filename  || "document",
        rawText:   d.rawText   || "",
        originalDocxB64: d.originalDocxB64 || null,
        sentences: d.sentences || [],
        results:   d.results   || [],
        validationResult: d.validationResult || null,
        status:    d.status    || "uploaded",
        error:     d.error     || null,
        targetLang: d.targetLang || "",
        reviewOffsets: d.reviewOffsets || { ...EMPTY_OFFSETS },
        reviewedCount: d.reviewedCount ?? 0,
      })),
    ]);
  }, []);

  const updateDoc = useCallback((docId, patch) => {
    setDocuments((prev) =>
      prev.map((doc) => (doc.docId === docId ? { ...doc, ...patch } : doc)),
    );
    // Write meaningful changes through to Supabase for DB-backed docs.
    const existing = documentsRef.current.find((d) => d.docId === docId);
    if (existing) persistDocToDb({ ...existing, ...patch }, patch);
  }, [persistDocToDb]);

  // Replace the working set with a project's documents fetched from Supabase.
  // localStorage is updated by the effect above; the DB stays the source of truth.
  const loadProjectDocuments = useCallback((rows, projectId) => {
    const mapped = (rows || []).map(dbDocToAppDoc);
    setDocuments(mapped);
    setActiveDocIndex(0);
    if (projectId !== undefined) setCurrentProjectId(projectId);
  }, []);

  const resetFlow = useCallback(() => {
    setDocuments([]);
    setActiveDocIndex(0);
    try {
      localStorage.removeItem("ts_documents");
      localStorage.removeItem("ts_activeDocIndex");
      localStorage.removeItem("ts_sourceLang");
      localStorage.removeItem("ts_targetLang");
    } catch (e) {}
  }, []);

  // Leave the current project context (back to dashboard). Keeps localStorage
  // cache but clears the active project + working set.
  const exitProject = useCallback(() => {
    setCurrentProjectId(null);
    setDocuments([]);
    setActiveDocIndex(0);
    try {
      localStorage.removeItem("ts_currentProjectId");
    } catch (e) {}
  }, []);

  // ── Active document shorthand (backward compat for single-doc pages) ───

  const activeDoc = documents[activeDocIndex] || null;

  const docId     = activeDoc?.docId     ?? "";
  const documentId = activeDoc?.documentId ?? null;
  const rawText   = activeDoc?.rawText   ?? "";
  const sentences = activeDoc?.sentences ?? [];
  const results   = activeDoc?.results   ?? [];
  const validationResult = activeDoc?.validationResult ?? null;
  const docTargetLang = activeDoc?.targetLang ?? "";
  const filename  = activeDoc?.filename  ?? "";

  const setDocId = useCallback((v) => {
    if (activeDoc) updateDoc(activeDoc.docId, { docId: v });
  }, [activeDoc, updateDoc]);

  const setRawText = useCallback((v) => {
    if (activeDoc) updateDoc(activeDoc.docId, { rawText: v });
  }, [activeDoc, updateDoc]);

  const setSentences = useCallback((v) => {
    if (activeDoc) updateDoc(activeDoc.docId, { sentences: v });
  }, [activeDoc, updateDoc]);

  const setResults = useCallback((v) => {
    if (activeDoc) updateDoc(activeDoc.docId, { results: v });
  }, [activeDoc, updateDoc]);

  const setValidationResult = useCallback((v) => {
    if (activeDoc) updateDoc(activeDoc.docId, { validationResult: v });
  }, [activeDoc, updateDoc]);

  const setDocTargetLang = useCallback((v) => {
    if (activeDoc) updateDoc(activeDoc.docId, { targetLang: v });
  }, [activeDoc, updateDoc]);

  const setFilename = useCallback((v) => {
    if (activeDoc) updateDoc(activeDoc.docId, { filename: v });
  }, [activeDoc, updateDoc]);

  // ── Context value ───────────────────────────────────────────────────────

  const value = useMemo(
    () => ({
      // Multi-doc state
      documents,
      setDocuments,
      activeDocIndex,
      setActiveDocIndex,
      addDocuments,
      updateDoc,

      // Project scope
      currentProjectId,
      setCurrentProjectId,
      loadProjectDocuments,
      exitProject,

      // Active doc shorthand (backward compat)
      docId,
      setDocId,
      documentId,
      rawText,
      setRawText,
      sentences,
      setSentences,
      results,
      setResults,
      validationResult,
      setValidationResult,
      filename,
      setFilename,
      docTargetLang,
      setDocTargetLang,

      // Global settings
      sourceLang,
      setSourceLang,
      targetLang,
      setTargetLang,

      resetFlow,
    }),
    [
      documents, activeDocIndex, addDocuments, updateDoc,
      currentProjectId, loadProjectDocuments, exitProject,
      docId, setDocId, documentId, rawText, setRawText, sentences, setSentences,
      results, setResults, validationResult, setValidationResult, filename, setFilename,
      docTargetLang, setDocTargetLang,
      sourceLang, targetLang, resetFlow,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used within AppProvider");
  }
  return context;
}
