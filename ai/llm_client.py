import json
import os

from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

# ── Gemini 2.5 Flash via Google's OpenAI-compatible API ───────────────────────
# Docs: https://ai.google.dev/gemini-api/docs/openai
# The OpenAI client works because Google mirrors the OpenAI API contract.
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

client = OpenAI(
    api_key=GEMINI_API_KEY,
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


def _parse_batch_response(answer: str) -> list[dict]:
    """Parse structured JSON response from the LLM batch prompt."""
    if not answer:
        return []

    # Strip markdown code fences if present (Gemini sometimes wraps JSON)
    cleaned = answer.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        # Drop opening fence (```json or ```) and closing fence (```)
        lines = [l for l in lines if not l.strip().startswith("```")]
        cleaned = "\n".join(lines).strip()

    try:
        payload = json.loads(cleaned)
    except json.JSONDecodeError:
        return []

    translations = payload.get("translations", [])
    results: list[dict] = []

    for item in translations:
        try:
            index = int(item.get("index"))
            translation = (item.get("translation") or "").strip()
        except (TypeError, ValueError):
            continue

        if translation:
            results.append({"index": index, "translation": translation})

    return results


async def llm_guided_search(sentence, matched_source, matched_translation, target_lang, glossary_hints: dict = None) -> dict | None:
    """
    Translate a single mid-similarity sentence using a guided prompt.
    Glossary hints are injected into a system message for maximum authority.
    """
    glossary_block = _build_glossary_block(glossary_hints or {})
    system_content = f"You are a professional translator.{glossary_block}"

    prompt = f"""Translate the following sentence to {target_lang}.

    A similar sentence was previously translated as reference:
    Source: "{matched_source}"
    Translation: "{matched_translation}"

    Rules:
    - Output ONLY the translated sentence, nothing else
    - No explanations, no notes, no alternatives
    - Preserve the original tone, formality, and meaning exactly
    - If the sentence contains technical or legal terminology, translate it accurately
    - You MUST strictly obey all Mandatory Terminology above — no exceptions

    Now translate this new sentence, using the reference for terminology 
    and style consistency but adapting it accurately:
    Sentence: "{sentence}"
    """

    try:
        response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": system_content},
                {"role": "user",   "content": prompt},
            ],
            max_tokens=512,
            temperature=0.3
        )
    except Exception as e:
        print(f"Error during LLM generation: {e}")
        return None

    answer = response.choices[0].message.content.strip() if response.choices else None

    if not answer:
        return None

    return {
        "source": sentence,
        "translation": answer,
    }


async def llm_guided_batch(items: list[dict], target_lang: str) -> list[dict]:
    """Translate a batch of mid-similarity sentences using a guided prompt."""
    if not items:
        return []

    # Aggregate all per-sentence glossary hints into a single set for the batch system message
    all_hints: dict = {}
    for item in items:
        all_hints.update(item.get("glossary_hints") or {})
    glossary_block = _build_glossary_block(all_hints)
    system_content = f"You are a professional translator.{glossary_block}"

    prompt = f"""Translate each item to {target_lang}.

    Each item includes a reference translation to enforce terminology consistency.
    You MUST strictly obey all Mandatory Terminology in the system instructions — no exceptions.
    Return ONLY valid JSON with this schema:
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
                {"role": "user",   "content": prompt},
            ],
            max_tokens=2048,
            temperature=0.2,
        )
    except Exception as e:
        print(f"Error during guided batch generation: {e}")
        return []

    answer = response.choices[0].message.content.strip() if response.choices else None
    return _parse_batch_response(answer)


async def cold_llm_search(sentence, target_lang, glossary_hints: dict = None) -> dict | None:
    """
    Translate a sentence that has never been seen by the pipeline before.
    Glossary hints are injected into a system message for maximum authority.
    """
    glossary_block = _build_glossary_block(glossary_hints or {})
    system_content = f"You are a professional translator.{glossary_block}"

    prompt = f"""Translate the following sentence into {target_lang}.

    Rules:
    - Output ONLY the translated sentence, nothing else
    - No explanations, no notes, no alternatives
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
                {"role": "user",   "content": prompt},
            ],
            max_tokens=512,
            temperature=0.3
        )
    except Exception as e:
        print(f"Error during LLM generation: {e}")
        return None

    answer = response.choices[0].message.content.strip() if response.choices else None

    if not answer:
        return None

    return {
        "source": sentence,
        "translation": answer,
    }


async def cold_llm_batch(items: list[dict], target_lang: str) -> list[dict]:
    """Translate a batch of sentences without reference guidance."""
    if not items:
        return []

    # Aggregate all per-sentence glossary hints into a single set for the batch system message
    all_hints: dict = {}
    for item in items:
        all_hints.update(item.get("glossary_hints") or {})
    glossary_block = _build_glossary_block(all_hints)
    system_content = f"You are a professional translator.{glossary_block}"

    prompt = f"""Translate each sentence into {target_lang}.

    You MUST strictly obey all Mandatory Terminology in the system instructions — no exceptions.
    Return ONLY valid JSON, no extra text.

    JSON schema:
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
                {"role": "user",   "content": prompt},
            ],
            max_tokens=2048,
            temperature=0.2,
        )
    except Exception as e:
        print(f"Error during cold batch generation: {e}")
        return []

    answer = response.choices[0].message.content.strip() if response.choices else None
    return _parse_batch_response(answer)