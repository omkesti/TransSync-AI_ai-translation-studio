"""
Canonical BCP-47 language code normalization.

Maps display names and common aliases to ISO 639-1 base codes so glossary
lookups and translation routes use consistent identifiers.
"""

from __future__ import annotations

# Aliases (lowercase keys) → canonical base code
_LANG_ALIASES: dict[str, str] = {
    # German
    "german": "de",
    "deutsch": "de",
    "de": "de",
    # French
    "french": "fr",
    "français": "fr",
    "francais": "fr",
    "fr": "fr",
    # Spanish / LATAM
    "spanish": "es",
    "spanish (latam)": "es",
    "spanish latam": "es",
    "español": "es",
    "espanol": "es",
    "es": "es",
    "es-419": "es",
    "es-mx": "es",
    "es-latam": "es",
    # Japanese
    "japanese": "ja",
    "ja": "ja",
    # English
    "english": "en",
    "en": "en",
    # Hindi / Marathi (common project languages)
    "hindi": "hi",
    "hi": "hi",
    "marathi": "mar",
    "mar": "mar",
}


# Canonical code → human-readable language name. Passed to the LLM instead of a
# bare code so prompts are unambiguous for every source/target (e.g. "en" →
# "English", "mar" → "Marathi") regardless of pair direction.
LANGUAGE_NAMES: dict[str, str] = {
    "en": "English",
    "de": "German",
    "fr": "French",
    "es": "Spanish",
    "ja": "Japanese",
    "hi": "Hindi",
    "mar": "Marathi",
}


def language_name(code: str) -> str:
    """Return the human-readable name for a language code, falling back to the
    normalized code itself when unknown (so the LLM still gets *something*)."""
    if not code:
        return ""
    normalized = normalize_lang_code(code)
    return LANGUAGE_NAMES.get(normalized, normalized or code)


def normalize_lang_code(raw: str) -> str:
    """
    Return canonical BCP-47 base code (lowercase).

    Known display names and aliases map to ISO codes; unknown input is
    lowercased/stripped. Regional tags (e.g. es-419) map to base subtag (es).
    """
    if not raw or not str(raw).strip():
        return ""

    cleaned = str(raw).strip().lower()

    if cleaned in _LANG_ALIASES:
        return _LANG_ALIASES[cleaned]

    # Try base subtag before alias lookup on hyphenated codes
    if "-" in cleaned:
        base = cleaned.split("-", 1)[0]
        if base in _LANG_ALIASES:
            return _LANG_ALIASES[base]
        return base

    return cleaned


def glossary_lookup_codes(normalized: str) -> list[str]:
    """
    Return language codes to try for glossary DB lookup, most specific first.

    For regional codes, try the full tag then the base subtag (e.g. es-419 → es).
    """
    if not normalized:
        return []

    codes: list[str] = []
    if normalized not in codes:
        codes.append(normalized)

    if "-" in normalized:
        base = normalized.split("-", 1)[0]
        if base not in codes:
            codes.append(base)

    return codes
