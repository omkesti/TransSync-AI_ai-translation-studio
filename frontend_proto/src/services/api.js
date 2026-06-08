const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

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

  let message = "Request failed";
  try {
    const data = await response.json();
    message = data?.detail || data?.message || message;
  } catch (error) {
    // Fallback to default message when body is not JSON.
  }

  throw new Error(message);
}

export async function uploadDocument(file) {
  const formData = new FormData();
  formData.append("file", file);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch(`${API_BASE_URL}/api/upload-document`, {
      method: "POST",
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

export async function validateText(rawText, docId) {
  const response = await fetch(`${API_BASE_URL}/api/validate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      raw_text: rawText,
      doc_id: docId,
    }),
  });

  return handleResponse(response);
}

export async function translateSentences(sentences, sourceLang, targetLang) {
  const response = await fetch(`${API_BASE_URL}/api/translate`, {
    method: "POST",
    headers: {
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

export async function approveTranslations(reviewed) {
  const response = await fetch(`${API_BASE_URL}/api/approve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      reviewed,
    }),
  });

  return handleResponse(response);
}

// ── Dashboard ──────────────────────────────────────────────────────────────────

export async function fetchDashboardStats() {
  const response = await fetch(`${API_BASE_URL}/api/dashboard-stats`);
  return handleResponse(response);
}

// ── Glossary ───────────────────────────────────────────────────────────────────

export async function fetchGlossary({ targetLang, search } = {}) {
  const params = new URLSearchParams();
  if (targetLang) params.set("target_lang", targetLang);
  if (search) params.set("search", search);
  const qs = params.toString() ? `?${params.toString()}` : "";
  const response = await fetch(`${API_BASE_URL}/api/glossary${qs}`);
  return handleResponse(response);
}

export async function addGlossaryTerm(term) {
  const response = await fetch(`${API_BASE_URL}/api/glossary`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(term),
  });
  return handleResponse(response);
}

export async function updateGlossaryTerm(id, patch) {
  const response = await fetch(`${API_BASE_URL}/api/glossary/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return handleResponse(response);
}

export async function deleteGlossaryTerm(id) {
  const response = await fetch(`${API_BASE_URL}/api/glossary/${id}`, {
    method: "DELETE",
  });
  return handleResponse(response);
}

// ── Export ─────────────────────────────────────────────────────────────────────

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
  const response = await fetch(`${API_BASE_URL}/api/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
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

// ── Batch Export ───────────────────────────────────────────────────────────────

/**
 * POST /api/export/batch
 *
 * Sends an array of documents to the backend, receives a ZIP blob
 * containing one translated DOCX per document, and triggers download.
 *
 * @param {Array} documents — [{ doc_id, filename, source_lang, target_lang, raw_text, translations }]
 */
export async function exportBatch(documents) {
  const response = await fetch(`${API_BASE_URL}/api/export/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documents }),
  });

  if (!response.ok) {
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
