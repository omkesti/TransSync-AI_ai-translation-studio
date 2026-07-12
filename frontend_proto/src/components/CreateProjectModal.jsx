import React, { useState } from "react";
import { X, Loader2, FolderPlus, Check } from "lucide-react";
import { createProject } from "../services/api";
import { TARGET_LANGUAGES } from "../constants/languages";
import { PROJECT_DOMAINS } from "../constants/projects";

/**
 * CreateProjectModal
 * ──────────────────
 * Collects new-project metadata and POSTs it to /api/projects. On success it
 * hands the created project back to the parent via onCreated(project).
 *
 * Fields: name (required), description, source language (default English),
 * target language (required), domain (optional), deadline (optional),
 * inherit org glossary (toggle, default on).
 */
function CreateProjectModal({ open, onClose, onCreated }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState("en");
  const [targetLanguage, setTargetLanguage] = useState("");
  const [domain, setDomain] = useState("");
  const [deadline, setDeadline] = useState("");
  const [inheritGlossary, setInheritGlossary] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const reset = () => {
    setName(""); setDescription(""); setSourceLanguage("en");
    setTargetLanguage(""); setDomain(""); setDeadline("");
    setInheritGlossary(true); setError(""); setSubmitting(false);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose?.();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setError("Project name is required."); return; }
    if (!targetLanguage) { setError("Target language is required."); return; }

    setSubmitting(true);
    setError("");
    try {
      const project = await createProject({
        name: name.trim(),
        description: description.trim() || null,
        source_language: sourceLanguage || "en",
        target_language: targetLanguage,
        domain: domain || null,
        deadline: deadline || null,
        inherit_org_glossary: inheritGlossary,
        status: "Active",
      });
      reset();
      onCreated?.(project);
    } catch (err) {
      setError(err.message || "Failed to create project.");
      setSubmitting(false);
    }
  };

  const inputCls =
    "w-full bg-[#1c1c1c] border border-transparent focus:border-primary-container/50 rounded-xl px-4 py-3 text-[14px] text-white placeholder-[#555555] outline-none transition-colors";
  const labelCls = "text-[#8c8c8b] font-mono font-bold text-[10px] uppercase tracking-[0.18em] mb-2 block";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />

      {/* Panel */}
      <div className="relative w-full max-w-lg bg-surface-container-low rounded-3xl shadow-[0_30px_80px_rgba(0,0,0,0.6)] max-h-[92vh] overflow-y-auto layout-scrollbar">
        <div className="flex items-center justify-between px-8 py-6 border-b border-white/8 sticky top-0 bg-surface-container-low z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#1a2010] flex items-center justify-center">
              <FolderPlus size={18} className="text-primary-container" />
            </div>
            <h2 className="font-grotesk font-bold text-xl tracking-tight">New Project</h2>
          </div>
          <button onClick={handleClose} className="text-[#555555] hover:text-white transition-colors" disabled={submitting}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-8 py-6 space-y-5">
          <div>
            <label className={labelCls}>Project Name *</label>
            <input
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Q3 Legal Filings"
              autoFocus
            />
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <textarea
              className={`${inputCls} resize-none h-20`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional — what this project covers"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Source Language</label>
              <select className={inputCls} value={sourceLanguage} onChange={(e) => setSourceLanguage(e.target.value)}>
                <option value="en">English</option>
                {TARGET_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>{l.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Target Language *</label>
              <select className={inputCls} value={targetLanguage} onChange={(e) => setTargetLanguage(e.target.value)}>
                <option value="">Select…</option>
                {TARGET_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>{l.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Domain</label>
              <select className={inputCls} value={domain} onChange={(e) => setDomain(e.target.value)}>
                <option value="">None</option>
                {PROJECT_DOMAINS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Deadline</label>
              <input type="date" className={inputCls} value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
          </div>

          {/* Inherit org glossary toggle */}
          <button
            type="button"
            onClick={() => setInheritGlossary((v) => !v)}
            className="w-full flex items-center justify-between bg-[#1c1c1c] rounded-xl px-4 py-3.5 hover:bg-[#222222] transition-colors"
          >
            <div className="text-left">
              <span className="text-[13px] font-semibold text-white block">Inherit organization glossary</span>
              <span className="text-[#555555] text-[11px]">Verified org terms apply on top of project terms</span>
            </div>
            <span className={`w-11 h-6 rounded-full flex items-center px-0.5 transition-colors ${inheritGlossary ? "bg-primary-container" : "bg-[#262626]"}`}>
              <span className={`w-5 h-5 rounded-full bg-background flex items-center justify-center transition-transform ${inheritGlossary ? "translate-x-5" : ""}`}>
                {inheritGlossary && <Check size={12} className="text-primary-container" />}
              </span>
            </span>
          </button>

          {error && (
            <div className="bg-[#1c0f0c] rounded-xl px-4 py-3 text-error text-[12px]">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="px-6 py-3 rounded-full border border-white/8 text-[#8c8c8b] hover:text-white hover:border-[#555555] font-mono font-bold text-[11px] uppercase tracking-widest transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-7 py-3 rounded-full bg-primary-container hover:bg-primary text-background font-black text-[11px] uppercase tracking-widest flex items-center gap-2 shadow-[0_0_20px_rgba(197,254,0,0.2)] transition-all disabled:opacity-60"
            >
              {submitting ? (<><Loader2 size={14} className="animate-spin" /> Creating…</>) : "Create Project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateProjectModal;
