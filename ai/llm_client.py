from groq import Groq
from dotenv import load_dotenv
import os
load_dotenv()

client = Groq(api_key=os.environ.get("GROK_API_KEY"))

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
            model="llama-3.3-70b-versatile",
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
            model="llama-3.3-70b-versatile",
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
        
    