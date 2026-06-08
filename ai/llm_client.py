import json
import os

from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

# ── Gemini 2.5 Flash via Google's OpenAI-compatible API ───────────────────────
# Docs: https://ai.google.dev/gemini-api/docs/openai
# The OpenAI client works because Google mirrors the OpenAI API contract.
client = OpenAI(
    api_key=os.environ.get("GEMINI_API_KEY"),
    base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
)

MODEL_NAME = "gemini-2.5-flash"


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

    try:
        response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": system_content},
                {"role": "user", "content": prompt},
            ],
            max_tokens=512,
            temperature=0.3,
        )
    except Exception as e:
        print(f"[llm_guided_search] Error: {e}")
        return None

    answer = response.choices[0].message.content.strip() if response.choices else None
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

    try:
        response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": system_content},
                {"role": "user", "content": prompt},
            ],
            max_tokens=512,
            temperature=0.3,
        )
    except Exception as e:
        print(f"[cold_llm_search] Error: {e}")
        return None

    answer = response.choices[0].message.content.strip() if response.choices else None
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

    try:
        response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": system_content},
                {"role": "user", "content": prompt},
            ],
            max_tokens=8192,
            temperature=0.2,
        )
    except Exception as e:
        print(f"[llm_guided_batch] Error: {e}")
        return []

    answer = response.choices[0].message.content.strip() if response.choices else None
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

    try:
        response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": system_content},
                {"role": "user", "content": prompt},
            ],
            max_tokens=8192,
            temperature=0.2,
        )
    except Exception as e:
        print(f"[cold_llm_batch] Error: {e}")
        return []

    answer = response.choices[0].message.content.strip() if response.choices else None
    return _parse_batch_response(answer)
