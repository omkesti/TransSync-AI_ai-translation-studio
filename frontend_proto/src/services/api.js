const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

async function handleResponse(response) {
  if (response.ok) {
    return response.json();
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

  const response = await fetch(`${API_BASE_URL}/api/upload-document`, {
    method: "POST",
    body: formData,
  });

  return handleResponse(response);
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
