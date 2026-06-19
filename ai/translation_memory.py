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


async def exact_match_lookup(sentence: str, target_lang: str, org_id: str) -> str | None:
    """
    Returns the stored translated_text for an exact (source_text, target_lang, org_id)
    match, or None if no row exists.

    Both source_text AND target_lang AND org_id must match — prevents returning
    translations from other organizations or wrong languages.
    """
    normalized = _normalize(target_lang)

    try:
        response = (
            supabase.from_("translation_memory")
            .select("translated_text")
            .eq("source_text", sentence)
            .eq("target_lang", normalized)
            .eq("org_id", org_id)
            .limit(1)
            .execute()
        )
    except Exception as e:
        print(f"[tm] Error fetching exact match from Supabase: {e}")
        return None

    if response.data:
        return response.data[0]["translated_text"]
    return None


async def exact_match_lookup_batch(
    sentences: list[str], target_lang: str, org_id: str
) -> dict[str, str]:
    """
    Batch version of exact_match_lookup.

    Returns a dict { source_text: translated_text } for the sentences that have
    an exact (source_text, target_lang, org_id) match.

    Implementation: de-duplicates the sentences, then runs each one's exact
    lookup SEQUENTIALLY inside a SINGLE worker thread. This preserves the
    original per-sentence `.eq(...).limit(1)` query exactly — so the translation
    for any given sentence is identical to exact_match_lookup — while moving the
    blocking I/O off the event loop in one `to_thread` hop.

    Why sequential and not concurrent:
        The Supabase client is synchronous and shares ONE underlying httpx
        HTTP/2 connection that is NOT thread-safe. Firing the lookups across many
        threads corrupted that connection ("deque mutated during iteration" /
        "ConnectionTerminated"). Looping in one thread is safe; de-duplication
        keeps the call count down.

    Why not `.in_("source_text", [...])`:
        PostgREST encodes `in` as a comma-separated filter list, which is
        corrupted by source text containing commas, quotes, or parentheses
        (→ HTTP 400). Per-sentence `.eq()` encodes each value safely.
    """
    if not sentences:
        return {}

    normalized = _normalize(target_lang)
    # De-duplicate while preserving order; identical sentences share one lookup.
    unique_sentences = list(dict.fromkeys(sentences))

    def _lookup_all() -> dict[str, str]:
        found: dict[str, str] = {}
        for sentence in unique_sentences:
            try:
                response = (
                    supabase.from_("translation_memory")
                    .select("translated_text")
                    .eq("source_text", sentence)
                    .eq("target_lang", normalized)
                    .eq("org_id", org_id)
                    .limit(1)
                    .execute()
                )
            except Exception as e:
                print(f"[tm] Error fetching exact match from Supabase: {e}")
                continue
            if response.data:
                found[sentence] = response.data[0]["translated_text"]
        return found

    return await asyncio.to_thread(_lookup_all)
