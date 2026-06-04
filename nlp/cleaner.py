import re

# Conservative cleanup to remove common PDF artifacts while preserving content.

def clean_raw_text(raw_text: str) -> str:
    if not raw_text:
        return ""

    text = raw_text.replace("\r\n", "\n").replace("\r", "\n")
    # Join hyphenated line breaks: "con-\ntext" -> "context".
    text = re.sub(r"-\s*\n\s*", "", text)
    # Join wrapped lines inside paragraphs.
    text = re.sub(r"(?<=\w)\n(?=\w)", " ", text)
    # Collapse multiple newlines.
    text = re.sub(r"\n{2,}", "\n", text)

    lines = []
    for line in text.split("\n"):
        stripped = line.strip()
        if not stripped:
            continue
        if _looks_like_page_number(stripped):
            continue
        if _looks_like_caption(stripped):
            continue
        if _is_mostly_noise(stripped):
            continue
        lines.append(stripped)

    cleaned = "\n".join(lines)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def filter_sentences(sentences: list[str]) -> list[str]:
    filtered = []
    for sentence in sentences:
        s = sentence.strip()
        if len(s) < 2:
            continue
        if _is_mostly_noise(s):
            continue
        filtered.append(s)
    return filtered


def _looks_like_page_number(line: str) -> bool:
    return bool(re.fullmatch(r"\d{1,4}", line))


def _looks_like_caption(line: str) -> bool:
    return bool(re.match(r"^(fig\.|figure|table|eq\.)\b", line.lower()))


def _is_mostly_noise(text: str) -> bool:
    non_space = re.sub(r"\s+", "", text)
    if not non_space:
        return True

    alpha = len(re.findall(r"[A-Za-z]", non_space))
    digits = len(re.findall(r"\d", non_space))
    symbols = len(non_space) - alpha - digits

    alpha_ratio = alpha / len(non_space)
    symbol_ratio = symbols / len(non_space)

    if alpha_ratio < 0.25 and symbol_ratio > 0.4:
        return True

    # Drop lines dominated by digits/symbols with very few letters.
    if alpha_ratio < 0.2 and len(non_space) > 12:
        return True

    return False
