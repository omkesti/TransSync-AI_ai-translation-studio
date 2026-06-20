import React, { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { uploadDocument, createProjectDocument, uploadDocumentOriginal } from "../services/api";
import { useAppContext } from "../context/AppContext";
import UserProfileBlock from "../components/UserProfileBlock";
import NavAvatar from "../components/NavAvatar";
import {
  Bell,
  Settings,
  Plus,
  LayoutDashboard,
  FolderOpen,
  FileUp,
  CheckCircle2,
  MessageSquare,
  Book,
  HelpCircle,
  LogOut,
  Upload,
  Zap,
  Monitor,
  CloudUpload,
  FileText,
  File,
  Download,
  X,
} from "lucide-react";

function UploadPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(""); // "Uploading file 2 of 5…"
  const [error, setError] = useState("");

  const { addDocuments, setActiveDocIndex, resetFlow, currentProjectId, documents } =
    useAppContext();

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      setSelectedFiles((prev) => [...prev, ...files]);
      setError("");
    }
    // Reset input so the same file(s) can be re-selected
    event.target.value = "";
  };

  const handleDrop = (event) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files || []);
    if (files.length > 0) {
      setSelectedFiles((prev) => [...prev, ...files]);
      setError("");
    }
  };

  const removeFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Read a File into a bare base64 string (no data: URL prefix).
  // Used to retain the original .docx so the export step can perform
  // format-preserving OOXML run-level injection on the server.
  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || "");
        const comma = result.indexOf(",");
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      reader.onerror = () => reject(reader.error || new Error("File read failed"));
      reader.readAsDataURL(file);
    });

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setError("Please select at least one file to upload.");
      return;
    }

    setIsUploading(true);
    setError("");
    // Inside a project we APPEND to the project's existing documents (already
    // rehydrated into context by the workspace). Only the legacy project-less
    // flow resets the working set.
    if (!currentProjectId) resetFlow();

    const uploadedDocs = [];
    const errors = [];

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      setUploadProgress(`Uploading file ${i + 1} of ${selectedFiles.length}…`);

      try {
        const response = await uploadDocument(file);

        // Source language auto-detected by the backend; the user can override it
        // on the Validation page before validating/translating.
        const detectedSourceLang = response.detected_source_lang || "en";

        // Retain the original .docx (base64) so export can preserve formatting
        // via OOXML run-level injection. PDFs are read-only — no retention.
        let originalDocxB64 = null;
        const isDocx = /\.docx$/i.test(file.name || response.filename || "");
        if (isDocx) {
          try {
            originalDocxB64 = await fileToBase64(file);
          } catch (encodeError) {
            // Non-fatal: export will fall back to plain reconstruction.
            console.warn("Could not encode original .docx for format-preserving export", encodeError);
          }
        }

        // When inside a project, persist a DB document record so this file is
        // tracked server-side (stage + state) and resumable from any device.
        let documentId = null;
        if (currentProjectId) {
          try {
            const created = await createProjectDocument(currentProjectId, {
              filename: response.filename || file.name || "document",
              raw_text: response.raw_text || "",
              source_lang: detectedSourceLang,
              stage: "uploaded",
            });
            documentId = created?.id || null;
          } catch (docError) {
            console.warn("Could not create project document record (non-fatal):", docError?.message || docError);
          }

          // Persist the original .docx server-side (Supabase Storage) so a
          // format-preserving export still works after leaving and returning to
          // the project. Best-effort — export falls back to raw reconstruction
          // if this fails.
          if (documentId && originalDocxB64) {
            try {
              await uploadDocumentOriginal(documentId, originalDocxB64);
            } catch (storeError) {
              console.warn("Could not store original .docx for format-preserving export (non-fatal):", storeError?.message || storeError);
            }
          }
        }

        uploadedDocs.push({
          docId:    documentId || response.doc_id || "",
          documentId,
          rawText:  response.raw_text || "",
          filename: response.filename || file.name || "document",
          originalDocxB64,
          sourceLang: detectedSourceLang,
          status:   "uploaded",
        });
      } catch (uploadError) {
        errors.push(`${file.name}: ${uploadError.message || "Upload failed."}`);
        uploadedDocs.push({
          docId:    `error-${i}`,
          rawText:  "",
          filename: file.name || "document",
          status:   "error",
          error:    uploadError.message || "Upload failed.",
        });
      }
    }

    if (uploadedDocs.length > 0) {
      // In project mode we appended to existing docs — land on the first newly
      // uploaded one. In legacy mode the working set was reset, so index 0.
      const firstNewIndex = currentProjectId ? documents.length : 0;
      addDocuments(uploadedDocs);
      setActiveDocIndex(firstNewIndex);
    }

    if (errors.length > 0 && errors.length === selectedFiles.length) {
      // All files failed
      setError(`All uploads failed:\n${errors.join("\n")}`);
      setIsUploading(false);
      setUploadProgress("");
      return;
    }

    setIsUploading(false);
    setUploadProgress("");
    navigate("/validation");
  };

  return (
    <div className="h-screen bg-[#0a0a0a] text-[#ffffff] font-sans flex overflow-hidden selection:bg-[#c5fe00] selection:text-[#0a0a0a]">
      {/* Left Sidebar */}
      <aside className="w-[260px] border-r border-[#262626] border-opacity-50 flex flex-col shrink-0 bg-[#0a0a0a] hidden md:flex z-50 relative overflow-y-auto layout-scrollbar">
        <div className="p-6 pb-2 flex-1 flex flex-col">
          {/* Workspace Selector */}
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-full bg-[#c5fe00] text-[#0a0a0a] flex items-center justify-center p-2 shadow-[0_0_20px_rgba(197,254,0,0.2)]">
              <CloudUpload strokeWidth={2.5} size={22} />
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

          {/* Menu Items */}
          <nav className="space-y-1">
            <Link
              to="/dashboard"
              className="flex items-center gap-4 text-[#8c8c8b] hover:text-[#ffffff] hover:bg-[#131313] transition-colors px-4 py-3 rounded-[12px] cursor-pointer"
            >
              <LayoutDashboard size={18} />
              <span className="text-[11px] font-bold uppercase tracking-widest">
                Dashboard
              </span>
            </Link>

            {currentProjectId && (
              <Link
                to={`/projects/${currentProjectId}`}
                className="flex items-center gap-4 text-[#8c8c8b] hover:text-[#ffffff] hover:bg-[#131313] transition-colors px-4 py-3 rounded-[12px] cursor-pointer"
              >
                <FolderOpen size={18} />
                <span className="text-[11px] font-bold uppercase tracking-widest">
                  Project
                </span>
              </Link>
            )}

            <div className="flex items-center gap-4 bg-[#1a1c10] text-[#c5fe00] border border-[#2a2e16] px-4 py-3 rounded-[12px] cursor-pointer shadow-[inset_0_0_10px_rgba(197,254,0,0.05)]">
              <FileUp size={18} />
              <span className="text-[11px] font-bold uppercase tracking-widest">
                Upload
              </span>
            </div>

            <Link
              to="/validation"
              className="flex items-center gap-4 text-[#8c8c8b] hover:text-[#ffffff] hover:bg-[#131313] transition-colors px-4 py-3 rounded-[12px] cursor-pointer"
            >
              <CheckCircle2 size={18} />
              <span className="text-[11px] font-bold uppercase tracking-widest">
                Validation
              </span>
            </Link>

            <Link
              to="/review"
              className="flex items-center gap-4 text-[#8c8c8b] hover:text-[#ffffff] hover:bg-[#131313] transition-colors px-4 py-3 rounded-[12px] cursor-pointer"
            >
              <MessageSquare size={18} />
              <span className="text-[11px] font-bold uppercase tracking-widest">
                Review
              </span>
            </Link>

            <Link
              to="/glossary"
              className="flex items-center gap-4 text-[#8c8c8b] hover:text-[#ffffff] hover:bg-[#131313] transition-colors px-4 py-3 rounded-[12px] cursor-pointer"
            >
              <Book size={18} />
              <span className="text-[11px] font-bold uppercase tracking-widest">
                Glossary
              </span>
            </Link>

            <Link
              to="/export"
              className="flex items-center gap-4 text-[#8c8c8b] hover:text-[#ffffff] hover:bg-[#131313] transition-colors px-4 py-3 rounded-[12px] cursor-pointer"
            >
              <Download size={18} />
              <span className="text-[11px] font-bold uppercase tracking-widest">
                Export
              </span>
            </Link>
          </nav>
        </div>

        <div className="p-6 space-y-4">
          {/* Bottom Links */}
          <div className="space-y-1">
            <UserProfileBlock />
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col relative w-full h-full overflow-hidden">
        {/* Top Nav Centered — translucent blurred bar so labels stay readable
            over scrolled content (was fully transparent). */}
        <nav className="h-[80px] w-full flex items-center justify-between px-8 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-[#262626]/60 absolute top-0 z-50 pointer-events-none">
          <div className="w-1/3"></div>

          <div className="w-1/3 flex justify-center items-center gap-4 pointer-events-auto">
            <Link to="/" className="inline-block">
              <span className="font-display font-bold text-xl tracking-tight text-[#c5fe00] leading-none">
                TransSync
              </span>
            </Link>
            <div className="w-px h-6 bg-[#262626]"></div>
            <span className="text-[#8c8c8b] text-[13px] font-medium tracking-wide">
              Upload Documents
            </span>
          </div>

          <div className="w-1/3 flex justify-end items-center gap-4 text-[#8c8c8b] pointer-events-auto">
            <button className="hover:text-[#ffffff] transition-colors">
              <Bell size={18} />
            </button>
            <button className="hover:text-[#ffffff] transition-colors">
              <HelpCircle size={18} />
            </button>
            <button className="hover:text-[#ffffff] transition-colors">
              <Settings size={18} />
            </button>
            <NavAvatar />
          </div>
        </nav>

        {/* Scrollable Content — compact so the upload section fits in the
            viewport by default; it only scrolls once many files are added. */}
        <main className="flex-1 overflow-y-auto w-full pt-[100px] pb-[72px] px-8 flex flex-col items-center layout-scrollbar relative">
          {/* Background Highlight */}
          <div className="absolute top-0 right-[20%] w-[600px] h-[600px] bg-[#c5fe00] opacity-[0.03] blur-[120px] rounded-full pointer-events-none z-0"></div>

          {/* my-auto centers the block when it fits, but still allows full scroll
              (top stays reachable) once the content grows past the viewport. */}
          <div className="my-auto w-full flex flex-col items-center">

          {/* Hero Titles */}
          <div className="text-center w-full max-w-4xl z-10 space-y-3 mb-8 shrink-0">
            <h1 className="font-display font-black text-4xl md:text-5xl tracking-tighter leading-[0.95]">
              upload &amp; <span className="text-[#c5fe00]">prepare</span>
            </h1>
            <p className="text-[#a0a09f] max-w-xl mx-auto text-[15px] leading-relaxed font-sans">
              Add the PDFs or Word documents you want to translate. We'll extract
              the text and get them ready for validation.
            </p>
          </div>

          {/* Grid Container */}
          <div className="w-full max-w-[1000px] grid grid-cols-1 lg:grid-cols-3 gap-6 z-10">
            {/* Left Upload Dropzone (Span 2) */}
            <div
              className="lg:col-span-2 bg-[#13150d]/40 backdrop-blur-sm border border-[#262b14]/50 rounded-[32px] p-6 min-h-[320px] flex flex-col items-center justify-center group cursor-pointer hover:border-[#c5fe00]/30 transition-all hover:bg-[#171a0f]/60 relative overflow-hidden"
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(event) => event.preventDefault()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
              {/* Internal glowing ring */}
              <div className="w-16 h-16 rounded-full bg-[#c5fe00]/5 flex items-center justify-center mb-5 border border-[#c5fe00]/20 group-hover:scale-110 transition-transform duration-500 shadow-[0_0_40px_rgba(197,254,0,0.1)]">
                <Upload
                  size={28}
                  className="text-[#c5fe00]"
                  strokeWidth={2.5}
                />
              </div>

              <h3 className="font-display text-xl font-bold mb-2 tracking-tight">
                Drop your documents here
              </h3>
              <p className="text-[#8c8c8b] text-[13px] font-sans pb-3">
                Upload multiple files at once · Maximum file size: 50MB each
              </p>

              {/* Selected file list — capped height; scrolls internally once
                  many files are queued so the dropzone never balloons. */}
              {selectedFiles.length > 0 && (
                <div
                  className="w-full max-w-md space-y-2 mt-2 max-h-[168px] overflow-y-auto pr-1 layout-scrollbar"
                  onClick={(e) => e.stopPropagation()}
                >
                  {selectedFiles.map((file, i) => (
                    <div
                      key={`${file.name}-${i}`}
                      className="flex items-center justify-between bg-[#1a1c10] border border-[#2a2e16] rounded-[12px] px-4 py-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText size={14} className="text-[#c5fe00] shrink-0" />
                        <span className="text-[13px] font-medium truncate">{file.name}</span>
                        <span className="text-[#555555] text-[10px] font-bold tracking-widest shrink-0">
                          {formatFileSize(file.size)}
                        </span>
                      </div>
                      <button
                        onClick={() => removeFile(i)}
                        className="text-[#555555] hover:text-[#ff6b6b] transition-colors ml-2 shrink-0"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  <p className="text-[#555555] text-[10px] font-bold tracking-widest uppercase text-center pt-2">
                    {selectedFiles.length} file{selectedFiles.length !== 1 ? "s" : ""} selected
                  </p>
                </div>
              )}

              {selectedFiles.length === 0 && (
                <p className="text-[#555555] text-[11px] font-bold tracking-widest uppercase pb-3">
                  No files selected
                </p>
              )}

              {/* File Formats */}
              <div className="flex gap-4 mt-auto">
                <div className="bg-[#222222] border border-[#333333] text-[#a0a09f] flex items-center gap-2 px-5 py-2.5 rounded-full text-[11px] font-bold tracking-widest hover:text-[#ffffff] transition-colors">
                  <FileText size={14} /> PDF
                </div>
                <div className="bg-[#222222] border border-[#333333] text-[#a0a09f] flex items-center gap-2 px-5 py-2.5 rounded-full text-[11px] font-bold tracking-widest hover:text-[#ffffff] transition-colors">
                  <File size={14} /> DOCX
                </div>
              </div>
            </div>

            {/* Right Config Column */}
            <div className="flex flex-col gap-6">
              {/* Priority Row */}
              <div className="bg-[#15170d] border border-[#2a2e16] rounded-[32px] p-8 shadow-[0_20px_40px_rgba(197,254,0,0.05)] relative overflow-hidden group flex-1 flex flex-col justify-center">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#c5fe00] opacity-10 blur-[50px] rounded-full pointer-events-none group-hover:opacity-20 transition-opacity"></div>
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-8 h-8 rounded-full bg-[#1a200a] text-[#c5fe00] flex items-center justify-center shadow-[inset_0_0_10px_rgba(197,254,0,0.1)]">
                    <Zap size={14} className="fill-[#c5fe00]" />
                  </div>
                  <span className="text-[#c5fe00] font-bold text-[10px] tracking-widest uppercase">
                    Quick Start
                  </span>
                </div>

                <p className="text-[#555555] text-[12px] leading-relaxed mb-8 font-sans">
                  Drop in one or more PDF or DOCX files. You'll pick the target
                  language on the Review page once your documents are validated.
                </p>

                <button
                  className="w-full bg-[#c5fe00] text-[#0a0a0a] hover:bg-[#b9ef00] transition-colors rounded-full py-4 flex items-center justify-center gap-3 font-black text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(197,254,0,0.2)] hover:scale-[1.02] transform duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
                  onClick={handleUpload}
                  type="button"
                  disabled={isUploading}
                >
                  <Zap size={16} strokeWidth={3} className="fill-[#0a0a0a]" />
                  {isUploading
                    ? "Uploading..."
                    : selectedFiles.length > 1
                    ? `Upload ${selectedFiles.length} Files`
                    : "Upload & Continue"}
                </button>
                {error ? (
                  <p className="text-[#ff7351] text-[11px] font-bold tracking-widest uppercase mt-4">
                    {error}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
          </div>{/* end my-auto centering wrapper */}
        </main>

        {isUploading ? (
          <div className="absolute inset-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-[#15170d] border border-[#2a2e16] rounded-[24px] px-8 py-6 text-center shadow-[0_0_30px_rgba(197,254,0,0.08)]">
              <p className="text-[#c5fe00] text-[10px] font-bold uppercase tracking-[0.2em] mb-2">
                Uploading
              </p>
              <p className="text-[#ffffff] text-sm">
                {uploadProgress || "Processing your documents..."}
              </p>
            </div>
          </div>
        ) : null}

        {/* Global Footer Status Bar */}
        <footer className="absolute bottom-0 w-full h-[48px] bg-[#0a0a0a]/90 backdrop-blur-md border-t border-[#262626] flex items-center justify-between px-8 text-[9px] font-bold tracking-[0.2em] uppercase text-[#555555] z-50 pointer-events-none">
          <div className="flex items-center gap-8 pointer-events-auto">
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-[#c5fe00] rounded-full"></span>{" "}
              System Live
            </span>
            <span className="flex items-center gap-2 hidden md:flex">
              Formats <span className="text-[#c5fe00]">PDF · DOCX</span>
            </span>
            <span className="flex items-center gap-2 hidden md:flex">
              Max Size <span className="text-[#c5fe00]">50MB / file</span>
            </span>
          </div>

          <div className="flex items-center gap-3 pointer-events-auto">
            TransSync AI Studio <Monitor size={12} className="text-[#a0a09f]" />
          </div>
        </footer>
      </div>
    </div>
  );
}

export default UploadPage;
