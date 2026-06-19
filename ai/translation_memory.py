import asyncio
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', 'backend', '.env'))
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))  # fallback

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")
supabase = create_client(url, key)


def _normalize(lang: str) -> str:
    """Minimal lang-code normaliser kept inside ai/ to avoid circular imports.
    Strips, lowercases, and maps common display names to ISO codes."""
    _ALIASES = {
        "german": "de", "deutsch": "de",
        "french": "fr", "français": "fr", "francais": "fr",
        "spanish": "es", "español": "es", "espanol": "es",
        "japanese": "ja",
        "english": "en",
        "hindi": "hi",
        "marathi": "mar",
    }
    if not lang:
        return ""
    cleaned = str(lang).strip().lower()
    return _ALIASES.get(cleaned, cleaned)


def _query_exact(sentence: str, normalized: str, org_id: str, project_id: str | None, scope: str) -> str | None:
    """
    One exact (source_text, target_lang, org_id) lookup, scoped.

    scope == "project":  filter project_id == project_id
    scope == "org":      filter project_id IS NULL  (original org-scoped rows)

    Returns the stored translated_text or None. Synchronous — call inside a
    worker thread (the Supabase client is blocking and not thread-safe across
    connections).
    """
    try:
        query = (
            supabase.from_("translation_memory")
            .select("translated_text")
            .eq("source_text", sentence)
            .eq("target_lang", normalized)
            .eq("org_id", org_id)
        )
        if scope == "project":
            query = query.eq("project_id", project_id)
        else:
            query = query.is_("project_id", "null")
        response = query.limit(1).execute()
    except Exception as e:
        print(f"[tm] Error fetching exact match from Supabase ({scope}): {e}")
        return None

    if response.data:
        return response.data[0]["translated_text"]
    return None


async def exact_match_lookup(
    sentence: str, target_lang: str, org_id: str, project_id: str | None = None
) -> str | None:
    """
    Returns the stored translated_text for an exact (source_text, target_lang,
    org_id) match, or None if no row exists.

    Project-first / org-fallback: when project_id is supplied the project-scoped
    row wins; if there is none we fall through to the org-scoped row
    (project_id IS NULL). When project_id is None only org-scoped rows are
    considered — the original behaviour.
    """
    normalized = _normalize(target_lang)

    def _lookup() -> str | None:
        if project_id:
            hit = _query_exact(sentence, normalized, org_id, project_id, "project")
            if hit is not None:
                return hit
        return _query_exact(sentence, normalized, org_id, None, "org")

    return await asyncio.to_thread(_lookup)


async def exact_match_lookup_batch(
    sentences: list[str], target_lang: str, org_id: str, project_id: str | None = None
) -> dict[str, str]:
    """
    Batch version of exact_match_lookup.

    Returns a dict { source_text: translated_text } for the sentences that have
    an exact match, applying the same project-first / org-fallback resolution as
    exact_match_lookup per sentence.

    Implementation notes (unchanged from the original):
        - De-duplicates the sentences; identical sentences share one lookup.
        - Runs SEQUENTIALLY inside a SINGLE worker thread. The Supabase client is
          synchronous and shares one non-thread-safe httpx connection, so firing
          lookups across threads corrupts it. Looping in one thread is safe.
        - Uses per-sentence `.eq()` rather than `.in_(...)` because PostgREST's
          comma-separated `in` filter breaks on text containing commas/quotes.
    """
    if not sentences:
        return {}

    normalized = _normalize(target_lang)
    # De-duplicate while preserving order; identical sentences share one lookup.
    unique_sentences = list(dict.fromkeys(sentences))

    def _lookup_all() -> dict[str, str]:
        found: dict[str, str] = {}
        for sentence in unique_sentences:
            text = None
            if project_id:
                text = _query_exact(sentence, normalized, org_id, project_id, "project")
            if text is None:
                text = _query_exact(sentence, normalized, org_id, None, "org")
            if text is not None:
                found[sentence] = text
        return found

    return await asyncio.to_thread(_lookup_all)
