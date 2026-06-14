/**
 * api.js
 * ──────
 * All backend API calls. Every request includes the Supabase JWT
 * in the Authorization header for authentication.
 */

import supabase from "../lib/supabaseClient";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

// ── Auth header helper ──────────────────────────────────────────────────────

async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

// ── Response helper ─────────────────────────────────────────────────────────

async function handleResponse(response) {
  if (response.ok) {
    // 204 No Content (e.g. DELETE /api/glossary/{id}) has no JSON body
    if (response.status === 204) {
      return null;
    }
    const text = await response.text();
    if (!text) {
      return null;
    }
    return JSON.parse(text);
  }

  // Handle 401 — redirect to login
  if (response.status === 401) {
    // Session expired or invalid — sign out and redirect
    await supabase.auth.signOut();
    window.location.href = "/login";
    throw new Error("Session expired. Please sign in again.");
  }

  let message = "Request failed";
  try {
    const data = await response.json();
    message = data?.detail || data?.message || message;
  } catch (error) {
    // Fallback to default message when body is not JSON.
  }

  throw new Error(message);
}

// ── Upload ──────────────────────────────────────────────────────────────────

export async function uploadDocument(file) {
  const formData = new FormData();
  formData.append("file", file);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/upload-document`, {
      method: "POST",
      headers: { ...authHeaders },
      body: formData,
      signal: controller.signal,
    });

    return handleResponse(response);
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Upload timed out. Please try a smaller file or retry.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ── Validate ────────────────────────────────────────────────────────────────

export async function validateText(rawText, docId) {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/validate`, {
    method: "POST",
    headers: {
      ...authHeaders,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      raw_text: rawText,
      doc_id: docId,
    }),
  });

  return handleResponse(response);
}

// ── Translate ───────────────────────────────────────────────────────────────

export async function translateSentences(sentences, sourceLang, targetLang) {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/translate`, {
    method: "POST",
    headers: {
      ...authHeaders,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sentences,
      source_lang: sourceLang,
      target_lang: targetLang,
    }),
  });

  return handleResponse(response);
}

// ── Approve ─────────────────────────────────────────────────────────────────

export async function approveTranslations(reviewed) {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/approve`, {
    method: "POST",
    headers: {
      ...authHeaders,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      reviewed,
    }),
  });

  return handleResponse(response);
}

// ── Dashboard ───────────────────────────────────────────────────────────────

export async function fetchDashboardStats() {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/dashboard-stats`, {
    headers: { ...authHeaders },
  });
  return handleResponse(response);
}

// ── Glossary ────────────────────────────────────────────────────────────────

export async function fetchGlossary({ targetLang, search } = {}) {
  const params = new URLSearchParams();
  if (targetLang) params.set("target_lang", targetLang);
  if (search) params.set("search", search);
  const qs = params.toString() ? `?${params.toString()}` : "";
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/glossary${qs}`, {
    headers: { ...authHeaders },
  });
  return handleResponse(response);
}

export async function addGlossaryTerm(term) {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/glossary`, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify(term),
  });
  return handleResponse(response);
}

export async function updateGlossaryTerm(id, patch) {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/glossary/${id}`, {
    method: "PATCH",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return handleResponse(response);
}

export async function deleteGlossaryTerm(id) {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/glossary/${id}`, {
    method: "DELETE",
    headers: { ...authHeaders },
  });
  return handleResponse(response);
}

// ── Export ───────────────────────────────────────────────────────────────────

/**
 * POST /api/export
 *
 * Sends translations to the backend, receives a DOCX blob,
 * and triggers a browser "Save As" download dialog.
 *
 * @param {Object} payload
 * @param {string} payload.doc_id
 * @param {string} payload.filename        — original upload filename
 * @param {string} payload.source_lang
 * @param {string} payload.target_lang
 * @param {Array}  payload.translations    — [{ source, translation, match_type }]
 */
export async function exportDocument(payload) {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/export`, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    if (response.status === 401) {
      await supabase.auth.signOut();
      window.location.href = "/login";
      throw new Error("Session expired.");
    }
    let message = "Export failed.";
    try {
      const data = await response.json();
      message = data?.detail || data?.message || message;
    } catch (_) { /* ignore */ }
    throw new Error(message);
  }

  const blob = await response.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");

  const base = (payload.filename || "document").replace(/\.[^/.]+$/, "");
  a.href     = url;
  a.download = `translated_${base}_${payload.target_lang}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Batch Export ─────────────────────────────────────────────────────────────

/**
 * POST /api/export/batch
 *
 * Sends an array of documents to the backend, receives a ZIP blob
 * containing one translated DOCX per document, and triggers download.
 *
 * @param {Array} documents — [{ doc_id, filename, source_lang, target_lang, raw_text, translations }]
 */
export async function exportBatch(documents) {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/export/batch`, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ documents }),
  });

  if (!response.ok) {
    if (response.status === 401) {
      await supabase.auth.signOut();
      window.location.href = "/login";
      throw new Error("Session expired.");
    }
    let message = "Batch export failed.";
    try {
      const data = await response.json();
      message = data?.detail || data?.message || message;
    } catch (_) { /* ignore */ }
    throw new Error(message);
  }

  const blob = await response.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `transsync_batch_${Date.now()}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
