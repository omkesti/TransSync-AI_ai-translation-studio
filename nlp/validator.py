import language_tool_python

# ── Language-aware grammar checking ───────────────────────────────────────────
# LanguageTool only ships rule sets for some languages. We map our canonical
# source-language codes to LanguageTool locales for the ones it supports, and
# for everything else (hi, ja, mar, …) we SKIP the grammar gate entirely rather
# than checking foreign text against the wrong language's rules (which floods
# false positives and would wrongly reject the document).
LOCALE_BY_LANG = {
    "en": "en-US",
    "fr": "fr",
    "de": "de-DE",
    "es": "es",
}

# Lazily constructed LanguageTool instances, cached per locale (each one is
# expensive to build and may download a rule set on first use).
_TOOLS: dict[str, "language_tool_python.LanguageTool"] = {}

IGNORED_RULES = {
    "WHITESPACE_RULE",
    "COMMA_PARENTHESIS_WHITESPACE",
    "EN_QUOTES",
    "UPPERCASE_SENTENCE_START",
}

MAX_ERRORS_PER_SENTENCE = 4
MAX_BAD_SENTENCE_RATIO = 0.35
MAX_ERROR_SAMPLES = 20


def _get_tool(source_lang: str):
    """Return a cached LanguageTool for ``source_lang``, or None if unsupported."""
    locale = LOCALE_BY_LANG.get((source_lang or "en").lower())
    if locale is None:
        return None
    tool = _TOOLS.get(locale)
    if tool is None:
        tool = language_tool_python.LanguageTool(locale)
        _TOOLS[locale] = tool
    return tool


def run_quality_checks(text: str, tool) -> list[str]:
    """Returns list of error messages for a single sentence."""
    matches = tool.check(text)
    return [
        f"~offset {m.offset_in_context}: {m.message}"
        for m in matches
        if m.rule_id not in IGNORED_RULES
    ]


def evaluate_sentences(sentences: list[str], source_lang: str = "en") -> dict:
    """Evaluates sentence quality and returns status + sampled errors.

    Grammar checking runs only when LanguageTool supports ``source_lang``;
    for unsupported languages it is skipped gracefully (status "ok") so a
    perfectly good non-English document is never rejected.
    """
    if not sentences:
        return {"status": "error", "errors": ["No sentences to validate."]}

    tool = _get_tool(source_lang)
    if tool is None:
        # No grammar rules for this language — accept the sentences as-is.
        return {"status": "ok", "errors": []}

    bad_sentences = 0
    errors: list[str] = []

    for idx, sentence in enumerate(sentences, start=1):
        issues = run_quality_checks(sentence, tool)
        if len(issues) > MAX_ERRORS_PER_SENTENCE:
            bad_sentences += 1
            if len(errors) < MAX_ERROR_SAMPLES:
                errors.append(f"Sentence {idx}: {issues[0]}")

    ratio = bad_sentences / max(1, len(sentences))
    if ratio > MAX_BAD_SENTENCE_RATIO:
        return {"status": "error", "errors": errors or ["Too many invalid sentences."]}

    return {"status": "ok", "errors": []}
