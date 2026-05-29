import language_tool_python

tool = language_tool_python.LanguageTool("en-US")

IGNORED_RULES = {
    "WHITESPACE_RULE",
    "COMMA_PARENTHESIS_WHITESPACE",
    "EN_QUOTES",
    "UPPERCASE_SENTENCE_START",
}

MAX_ERRORS_PER_SENTENCE = 4
MAX_BAD_SENTENCE_RATIO = 0.35
MAX_ERROR_SAMPLES = 20

def run_quality_checks(text: str) -> list[str]:
    """Returns list of error messages for a single sentence."""
    matches = tool.check(text)
    return [
        f"~offset {m.offset_in_context}: {m.message}"
        for m in matches
        if m.rule_id not in IGNORED_RULES
    ]


def evaluate_sentences(sentences: list[str]) -> dict:
    """Evaluates sentence quality and returns status + sampled errors."""
    if not sentences:
        return {"status": "error", "errors": ["No sentences to validate."]}

    bad_sentences = 0
    errors: list[str] = []

    for idx, sentence in enumerate(sentences, start=1):
        issues = run_quality_checks(sentence)
        if len(issues) > MAX_ERRORS_PER_SENTENCE:
            bad_sentences += 1
            if len(errors) < MAX_ERROR_SAMPLES:
                errors.append(f"Sentence {idx}: {issues[0]}")

    ratio = bad_sentences / max(1, len(sentences))
    if ratio > MAX_BAD_SENTENCE_RATIO:
        return {"status": "error", "errors": errors or ["Too many invalid sentences."]}

    return {"status": "ok", "errors": []}