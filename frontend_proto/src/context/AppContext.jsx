import React, { createContext, useContext, useMemo, useState } from "react";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [docId, setDocId] = useState("");
  const [rawText, setRawText] = useState("");
  const [sentences, setSentences] = useState([]);
  const [results, setResults] = useState([]);
  const [sourceLang, setSourceLang] = useState("en");
  const [targetLang, setTargetLang] = useState("");
  const [filename, setFilename] = useState("");

  const resetFlow = () => {
    setDocId("");
    setRawText("");
    setSentences([]);
    setResults([]);
    setFilename("");
  };

  const value = useMemo(
    () => ({
      docId,
      setDocId,
      rawText,
      setRawText,
      sentences,
      setSentences,
      results,
      setResults,
      sourceLang,
      setSourceLang,
      targetLang,
      setTargetLang,
      filename,
      setFilename,
      resetFlow,
    }),
    [docId, rawText, sentences, results, sourceLang, targetLang, filename],
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
