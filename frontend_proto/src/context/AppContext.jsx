import React, { createContext, useCallback, useContext, useMemo, useState, useEffect } from "react";

const AppContext = createContext(null);

/**
 * Multi-document state shape:
 *
 * documents = [
 *   {
 *     docId:     "uuid",
 *     filename:  "report.pdf",
 *     rawText:   "full extracted text…",
 *     sentences: ["sentence 1", …],
 *     results:   [{ source, translation, match_type }, …],
 *     validationResult: { status: "ok", errors: [], sentence_count: 0 },
 *     targetLang: "fr",
 *     status:    "uploaded" | "validated" | "translated" | "approved" | "error",
 *     error:     null | "message",
 *   },
 *   …
 * ]
 */

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

  // ── Sync to localStorage ──────────────────────────────────────────────────
  useEffect(() => {
    try {
      localStorage.setItem("ts_documents", JSON.stringify(documents));
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

  // ── Helpers ──────────────────────────────────────────────────────────────

  const addDocuments = useCallback((newDocs) => {
    // newDocs = [{ docId, filename, rawText, … }]
    setDocuments((prev) => [
      ...prev,
      ...newDocs.map((d) => ({
        docId:     d.docId     || "",
        filename:  d.filename  || "document",
        rawText:   d.rawText   || "",
        sentences: d.sentences || [],
        results:   d.results   || [],
        validationResult: d.validationResult || null,
        status:    d.status    || "uploaded",
        error:     d.error     || null,
        targetLang: d.targetLang || "",
        reviewOffsets: d.reviewOffsets || { llm_cold: 0, llm_guided: 0, faiss_direct: 0, tm_exact: 0 },
        reviewedCount: d.reviewedCount ?? 0,
      })),
    ]);
  }, []);

  const updateDoc = useCallback((docId, patch) => {
    setDocuments((prev) =>
      prev.map((doc) =>
        doc.docId === docId ? { ...doc, ...patch } : doc
      )
    );
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

  // ── Active document shorthand (backward compat for single-doc pages) ───

  const activeDoc = documents[activeDocIndex] || null;

  // Legacy single-doc getters derived from active document
  const docId     = activeDoc?.docId     ?? "";
  const rawText   = activeDoc?.rawText   ?? "";
  const sentences = activeDoc?.sentences ?? [];
  const results   = activeDoc?.results   ?? [];
  const validationResult = activeDoc?.validationResult ?? null;
  const docTargetLang = activeDoc?.targetLang ?? "";
  const filename  = activeDoc?.filename  ?? "";

  // Legacy single-doc setters that delegate to updateDoc
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

      // Active doc shorthand (backward compat)
      docId,
      setDocId,
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
      docId, setDocId, rawText, setRawText, sentences, setSentences,
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
