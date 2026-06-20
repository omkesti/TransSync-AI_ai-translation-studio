"""
Best-effort source-language detection.

Used to pre-fill the source-language selector on upload and as a fallback when
the frontend does not send an explicit ``source_lang`` to ``/api/validate``.
Always degrades to ``"en"`` rather than raising — detection is a convenience,
never a hard requirement.
"""

from __future__ import annotations

from backend.utils.language_codes import normalize_lang_code

# langdetect is non-deterministic by default; seed it for stable results.
try:
    from langdetect import detect, DetectorFactory
    DetectorFactory.seed = 0
    _AVAILABLE = True
except Exception:  # pragma: no cover - import guard
    _AVAILABLE = False

# langdetect emits ISO 639-1 codes that mostly match our canonical set, but a
# couple need mapping onto the project's codes.
_DETECT_OVERRIDES = {
    "mr": "mar",   # Marathi — project uses the non-standard "mar"
}


def detect_source_lang(text: str) -> str:
    """Return a canonical source-language code for ``text`` (default ``"en"``)."""
    if not _AVAILABLE or not text or not text.strip():
        return "en"
    try:
        raw = detect(text)
    except Exception:
        return "en"
    raw = _DETECT_OVERRIDES.get(raw, raw)
    return normalize_lang_code(raw) or "en"
