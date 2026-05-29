import json
import os

from groq import Groq
from dotenv import load_dotenv
load_dotenv()

client = Groq(api_key=os.environ.get("GROK_API_KEY"))

MODEL_NAME = "llama-3.1-8b-instant"


def _parse_batch_response(answer: str) -> list[dict]:
    """Parse structured JSON response from the LLM batch prompt."""
    if not answer:
        return []

    try:
        payload = json.loads(answer)
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

async def llm_guided_search(sentence, matched_source, matched_translation, target_lang) -> dict | None:
    """
    This function uses ollama model to 
    translate the sentence which is mid-high similarity (0.8 - 0.95).
    This prompt is included with the reference sentence which is 
    already well translated to maintain consistency accross the translations.
    """

    prompt = f"""
    Act as a professional translator. 
    Translate the following sentence to {target_lang}.

    A similar sentence was previously translated as reference:
    Source: "{matched_source}"
    Translation: "{matched_translation}"

    Rules:
    - Output ONLY the translated sentence, nothing else
    - No explanations, no notes, no alternatives
    - Preserve the original tone, formality, and meaning exactly
    - If the sentence contains technical or legal terminology, translate it accurately

    Now translate this new sentence, using the reference for terminology 
    and style consistency but adapting it accurately:
    Sentence: "{sentence}"
    """

    try:
        response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[{
                "role": "user", 
                "content": prompt
            }],
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

    prompt = f"""
    Act as a professional translator.
    Translate each item to {target_lang}.

    Each item includes a reference translation to enforce terminology consistency.
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
            messages=[{
                "role": "user",
                "content": prompt,
            }],
            max_tokens=2048,
            temperature=0.2,
        )
    except Exception as e:
        print(f"Error during guided batch generation: {e}")
        return []

    answer = response.choices[0].message.content.strip() if response.choices else None
    return _parse_batch_response(answer)
    
async def cold_llm_search(sentence, target_lang) -> dict | None:
    """
    This function uses ollama model to 
    translate the sentence which has never seen by the pipeline before.
    """

    prompt = f"""You are a professional translator. Translate the following sentence into {target_lang}.

    Rules:
    - Output ONLY the translated sentence, nothing else
    - No explanations, no notes, no alternatives
    - Preserve the original tone, formality, and meaning exactly
    - If the sentence contains technical or legal terminology, translate it accurately

    Sentence: {sentence}

    Translation:"""

    try:
        response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[{
                "role": "user", 
                "content": prompt
            }],
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

    prompt = f"""
    You are a professional translator. Translate each sentence into {target_lang}.

    Rules:
    - Output ONLY valid JSON
    - Preserve tone and meaning exactly

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
            messages=[{
                "role": "user",
                "content": prompt,
            }],
            max_tokens=2048,
            temperature=0.2,
        )
    except Exception as e:
        print(f"Error during cold batch generation: {e}")
        return []

    answer = response.choices[0].message.content.strip() if response.choices else None
    return _parse_batch_response(answer)
        
    