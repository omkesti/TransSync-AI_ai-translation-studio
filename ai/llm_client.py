from groq import Groq
from dotenv import load_dotenv
import os
load_dotenv()

client = Groq(api_key=os.environ.get("GROK_API_KEY"))

def llm_guided_search(sentence, matched_source, matched_translation, target_lang) -> dict | None:
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

    Now translate this new sentence, using the reference for terminology 
    and style consistency but adapting it accurately:
    Sentence: "{sentence}"
    """

    try:
        response = client.generate(
            model="llama-3.3-70b-versatile",
            messages = [
                {
                    "role": "system",
                    "content": prompt
                }
            ]
        )
    except Exception as e:
        print(f"Error during LLM generation: {e}")
        return None
    
    # if response.generations and len(response.generations) > 0:
    
    #test
    return None
    
    