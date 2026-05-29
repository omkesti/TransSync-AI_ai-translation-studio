import language_tool_python

tool = language_tool_python.LanguageTool("en-US")

IGNORED_RULES = {
    "WHITESPACE_RULE",
    "COMMA_PARENTHESIS_WHITESPACE",
    "EN_QUOTES",
    "UPPERCASE_SENTENCE_START",
}

ERROR_THRESHOLD = 10

def run_quality_checks(raw_text: str) -> list[str]:
    """Returns list of error messages. Empty list = pass."""
    matches = tool.check(raw_text)
    return [
        f"~offset {m.offset_in_context}: {m.message}"
        for m in matches
        if m.rule_id not in IGNORED_RULES
    ]