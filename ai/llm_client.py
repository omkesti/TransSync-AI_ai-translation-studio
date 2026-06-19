import json
import os
import time

from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

# ── Primary: Gemini 2.5 Flash via Google's OpenAI-compatible API ──────────────
# Docs: https://ai.google.dev/gemini-api/docs/openai
# The OpenAI client works because Google mirrors the OpenAI API contract.
client = OpenAI(
    api_key=os.environ.get("GEMINI_API_KEY"),
    base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
)

MODEL_NAME = "gemini-2.5-flash"

# ── Fallback: Llama 3.3 70B via Groq ──────────────────────────────────────────
# When Gemini errors (e.g. rate limits on large documents), we transparently
# retry the same request against Groq's Llama 3.3 70B. The Groq SDK mirrors the
# OpenAI chat-completions contract, so the call site is identical.
# The client is built lazily so a missing GROQ_API_KEY never breaks import —
# the fallback is simply skipped if no key is configured.
FALLBACK_MODEL_NAME = "llama-3.3-70b-versatile"

_groq_client = None


def _get_groq_client():
    """Lazily construct the Groq client. Returns None if no API key is set."""
    global _groq_client
    if _groq_client is not None:
        return _groq_client
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        return None
    from groq import Groq
    _groq_client = Groq(api_key=api_key)
    return _groq_client


# ── Rate-limit circuit breaker ────────────────────────────────────────────────
# When Gemini returns rate-limit (HTTP 429 / quota) errors several times in a
# row, we stop hammering it: the circuit "opens" and subsequent requests skip
# Gemini and go STRAIGHT to the Groq fallback for a short cooldown. After the
# cooldown one request probes Gemini again (half-open); success closes the
# circuit, another rate limit re-opens it. This avoids paying a guaranteed-429
# round-trip on every sentence batch once Gemini is clearly throttling us.
RATE_LIMIT_TRIP_THRESHOLD = 3      # consecutive 429s before opening the circuit
CIRCUIT_COOLDOWN_SECONDS = 60.0    # how long to bypass Gemini once opened

_consecutive_rate_limits = 0
_circuit_open_until = 0.0           # monotonic deadline; <= now means "closed"


def _is_rate_limit_error(exc: Exception) -> bool:
    """Best-effort detection of a rate-limit / quota error across SDKs."""
    # openai.RateLimitError (Gemini uses the OpenAI-compatible surface).
    try:
        from openai import RateLimitError
        if isinstance(exc, RateLimitError):
            return True
    except Exception:
        pass
    status = getattr(exc, "status_code", None) or getattr(
        getattr(exc, "response", None), "status_code", None
    )
    if status == 429:
        return True
    text = str(exc).lower()
    return "429" in text or "rate limit" in text or "quota" in text or "resource_exhausted" in text


def _groq_completion(messages, *, max_tokens, temperature, label):
    """Run a completion against the Groq fallback. Returns content or None."""
    groq_client = _get_groq_client()
    if groq_client is None:
        print(f"[{label}] No GROQ_API_KEY configured — fallback unavailable.")
        return None
    try:
        response = groq_client.chat.completions.create(
            model=FALLBACK_MODEL_NAME,
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
        )
        content = response.choices[0].message.content if response.choices else None
        return content.strip() if content else None
    except Exception as fallback_error:
        print(f"[{label}] Groq fallback error: {fallback_error}")
        return None


def _chat_completion(messages: list[dict], *, max_tokens: int, temperature: float, label: str):
    """
    Run a chat completion against Gemini, falling back to Groq's Llama 3.3 70B
    on any error (rate limit, timeout, server error, etc.).

    A circuit breaker tracks consecutive Gemini rate-limit errors: once
    RATE_LIMIT_TRIP_THRESHOLD is reached, Gemini is bypassed entirely for
    CIRCUIT_COOLDOWN_SECONDS and requests go directly to Groq.

    Returns the assistant message content string, or None if both providers
    fail (or the fallback is unavailable). `label` is used only for logging.
    """
    global _consecutive_rate_limits, _circuit_open_until

    # Circuit OPEN → skip Gemini entirely, go straight to the fallback.
    if time.monotonic() < _circuit_open_until:
        return _groq_completion(messages, max_tokens=max_tokens, temperature=temperature, label=label)

    try:
        response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
        )
        content = response.choices[0].message.content if response.choices else None
        _consecutive_rate_limits = 0      # success → reset / close the circuit
        return content.strip() if content else None
    except Exception as primary_error:
        if _is_rate_limit_error(primary_error):
            _consecutive_rate_limits += 1
            print(
                f"[{label}] Gemini rate-limited "
                f"({_consecutive_rate_limits}/{RATE_LIMIT_TRIP_THRESHOLD}) — "
                f"falling back to {FALLBACK_MODEL_NAME}"
            )
            if _consecutive_rate_limits >= RATE_LIMIT_TRIP_THRESHOLD:
                _circuit_open_until = time.monotonic() + CIRCUIT_COOLDOWN_SECONDS
                print(
                    f"[{label}] Gemini circuit OPEN — routing directly to "
                    f"{FALLBACK_MODEL_NAME} for {CIRCUIT_COOLDOWN_SECONDS:.0f}s"
                )
        else:
            # Non-rate-limit error: don't trip the breaker, just fall back once.
            print(f"[{label}] Gemini error: {primary_error} — falling back to {FALLBACK_MODEL_NAME}")

    return _groq_completion(messages, max_tokens=max_tokens, temperature=temperature, label=label)


def back_translate(text: str, source_lang: str) -> str | None:
    """
    Back-translate `text` into `source_lang` using Groq's Llama 3.3 70B DIRECTLY.

    Separation of duties: this NEVER routes through Gemini (the forward-pass
    generator). The validator model must be independent of the model that
    produced the translation, so back-translation always uses the Groq Llama
    model regardless of which model did the forward translation.

    Returns the back-translated string, or None if Groq is unavailable or the
    call fails — callers treat None as "skip verification for this sentence".
    """
    if not text or not source_lang:
        return None

    groq_client = _get_groq_client()
    if groq_client is None:
        print("[back_translate] No GROQ_API_KEY configured — verification skipped.")
        return None

    prompt = f"""Translate the following text into {source_lang}.

Rules:
- Output ONLY the translated text — nothing else
- No explanations, notes, quotes, or alternatives
- Preserve the meaning exactly

Text: {text}"""

    try:
        response = groq_client.chat.completions.create(
            model=FALLBACK_MODEL_NAME,
            messages=[
                {"role": "system", "content": "You are a professional translator."},
                {"role": "user", "content": prompt},
            ],
            max_tokens=512,
            temperature=0.0,
        )
        content = response.choices[0].message.content if response.choices else None
        return content.strip() if content else None
    except Exception as e:
        print(f"[back_translate] Groq error: {e} — verification skipped.")
        return None


def _build_glossary_block(hints: dict) -> str:
    """
    Builds a formatted 'Mandatory Terminology' constraint block for LLM prompts.
    Returns an empty string if no hints are provided, so prompts are unchanged
    when there are no relevant glossary terms for a sentence.

    Example output:
        Mandatory Terminology (MUST be followed exactly):
          - "neural interface" MUST be translated as "Interface Neurale"
          - "data breach" MUST be translated as "violation de données"
    """
    if not hints:
        return ""
    lines = "\n".join(
        f'  - "{src}" MUST be translated as "{tgt}"'
        for src, tgt in hints.items()
    )
    return f"\nMandatory Terminology (MUST be followed exactly):\n{lines}\n"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_batch_response(answer: str) -> list[dict]:
    """
    Parse structured JSON response from an LLM batch prompt.
    Strips markdown code fences that Gemini sometimes wraps around JSON.
    """
    if not answer:
        return []

    # Strip ```json ... ``` or ``` ... ``` wrappers
    cleaned = answer.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        lines = [l for l in lines if not l.strip().startswith("```")]
        cleaned = "\n".join(lines).strip()

    try:
        payload = json.loads(cleaned)
    except json.JSONDecodeError:
        return []

    results: list[dict] = []
    for item in payload.get("translations", []):
        try:
            index = int(item.get("index"))
            translation = (item.get("translation") or "").strip()
        except (TypeError, ValueError):
            continue
        if translation:
            results.append({"index": index, "translation": translation})

    return results


# ── Single-sentence LLM functions (fallback when batch JSON parse fails) ──────

async def llm_guided_search(
    sentence: str,
    matched_source: str,
    matched_translation: str,
    target_lang: str,
    glossary_hints: dict | None = None,
) -> dict | None:
    """
    Translate a single mid-similarity sentence with a TM reference for guidance.
    Glossary hints are injected into a system message for maximum authority.
    """
    glossary_block = _build_glossary_block(glossary_hints or {})
    system_content = f"You are a professional translator.{glossary_block}"

    prompt = f"""Translate the following sentence to {target_lang}.

A similar sentence was previously translated as a reference for terminology and style:
  Source:      "{matched_source}"
  Translation: "{matched_translation}"

Rules:
- Output ONLY the translated sentence — nothing else
- No explanations, notes, or alternatives
- Preserve the original tone, formality, and meaning exactly
- If the sentence contains technical or legal terminology, translate it accurately
- You MUST strictly obey all Mandatory Terminology above — no exceptions

Sentence: "{sentence}"
"""

    answer = _chat_completion(
        [
            {"role": "system", "content": system_content},
            {"role": "user", "content": prompt},
        ],
        max_tokens=512,
        temperature=0.3,
        label="llm_guided_search",
    )
    if not answer:
        return None
    return {"source": sentence, "translation": answer}


async def cold_llm_search(
    sentence: str,
    target_lang: str,
    glossary_hints: dict | None = None,
) -> dict | None:
    """
    Translate a sentence that has never been seen by the pipeline before.
    Glossary hints are injected into a system message for maximum authority.
    """
    glossary_block = _build_glossary_block(glossary_hints or {})
    system_content = f"You are a professional translator.{glossary_block}"

    prompt = f"""Translate the following sentence into {target_lang}.

Rules:
- Output ONLY the translated sentence — nothing else
- No explanations, notes, or alternatives
- Preserve the original tone, formality, and meaning exactly
- If the sentence contains technical or legal terminology, translate it accurately
- You MUST strictly obey all Mandatory Terminology in the system instructions — no exceptions

Sentence: {sentence}

Translation:"""

    answer = _chat_completion(
        [
            {"role": "system", "content": system_content},
            {"role": "user", "content": prompt},
        ],
        max_tokens=512,
        temperature=0.3,
        label="cold_llm_search",
    )
    if not answer:
        return None
    return {"source": sentence, "translation": answer}


# ── Batch LLM functions (ONE API call for the entire queue) ───────────────────

async def llm_guided_batch(items: list[dict], target_lang: str) -> list[dict]:
    """
    Translate ALL mid-similarity sentences in a single API call.
    """
    if not items:
        return []

    all_hints: dict = {}
    for item in items:
        all_hints.update(item.get("glossary_hints") or {})
    glossary_block = _build_glossary_block(all_hints)
    system_content = f"You are a professional translator.{glossary_block}"

    prompt = f"""Translate each item to {target_lang}.

Each item includes a reference translation to enforce terminology and style consistency.
You MUST strictly obey all Mandatory Terminology in the system instructions — no exceptions.

Return ONLY valid JSON (no markdown, no explanation) with this schema:
{{
  "translations": [
    {{"index": 0, "translation": "..."}},
    {{"index": 1, "translation": "..."}}
  ]
}}

Items:
{json.dumps(items, ensure_ascii=False)}
"""

    answer = _chat_completion(
        [
            {"role": "system", "content": system_content},
            {"role": "user", "content": prompt},
        ],
        max_tokens=8192,
        temperature=0.2,
        label="llm_guided_batch",
    )
    return _parse_batch_response(answer)


async def cold_llm_batch(items: list[dict], target_lang: str) -> list[dict]:
    """
    Translate ALL cold sentences in a single API call.
    """
    if not items:
        return []

    all_hints: dict = {}
    for item in items:
        all_hints.update(item.get("glossary_hints") or {})
    glossary_block = _build_glossary_block(all_hints)
    system_content = f"You are a professional translator.{glossary_block}"

    prompt = f"""Translate each sentence into {target_lang}.

You MUST strictly obey all Mandatory Terminology in the system instructions — no exceptions.

Return ONLY valid JSON (no markdown, no explanation) with this schema:
{{
  "translations": [
    {{"index": 0, "translation": "..."}},
    {{"index": 1, "translation": "..."}}
  ]
}}

Items:
{json.dumps(items, ensure_ascii=False)}
"""

    answer = _chat_completion(
        [
            {"role": "system", "content": system_content},
            {"role": "user", "content": prompt},
        ],
        max_tokens=8192,
        temperature=0.2,
        label="cold_llm_batch",
    )
    return _parse_batch_response(answer)
