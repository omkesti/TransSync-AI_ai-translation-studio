import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

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
 *     status:    "uploaded" | "validated" | "translated" | "approved" | "error",
 *     error:     null | "message",
 *   },
 *   …
 * ]
 */

export function AppProvider({ children }) {
  const [documents, setDocuments] = useState([]);
  const [activeDocIndex, setActiveDocIndex] = useState(0);
  const [sourceLang, setSourceLang] = useState("en");
  const [targetLang, setTargetLang] = useState("");

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
        status:    d.status    || "uploaded",
        error:     d.error     || null,
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
  }, []);

  // ── Active document shorthand (backward compat for single-doc pages) ───

  const activeDoc = documents[activeDocIndex] || null;

  // Legacy single-doc getters derived from active document
  const docId     = activeDoc?.docId     ?? "";
  const rawText   = activeDoc?.rawText   ?? "";
  const sentences = activeDoc?.sentences ?? [];
  const results   = activeDoc?.results   ?? [];
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
      filename,
      setFilename,

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
      results, setResults, filename, setFilename,
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
