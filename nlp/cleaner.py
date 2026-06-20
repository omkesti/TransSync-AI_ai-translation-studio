import re

# Conservative cleanup to remove common PDF artifacts while preserving content.

def clean_raw_text(raw_text: str) -> str:
    if not raw_text:
        return ""

    text = raw_text.replace("\r\n", "\n").replace("\r", "\n")
    # Join hyphenated line breaks: "con-\ntext" -> "context".
    text = re.sub(r"-\s*\n\s*", "", text)
    # Join wrapped lines inside a paragraph: "...word\nword..." -> "...word word...".
    text = re.sub(r"(?<=\w)\n(?=\w)", " ", text)

    # Split on HARD paragraph breaks (blank line / 2+ newlines). These are the
    # separators the parsers insert between DOCX paragraphs and table cells, and
    # between PDF pages. Preserving them prevents headings and table cells with
    # no terminal punctuation from being merged into the following paragraph
    # during sentence segmentation (which would make them un-reconstructable).
    blocks = re.split(r"\n{2,}", text)

    cleaned_blocks = []
    for block in blocks:
        kept = []
        for line in block.split("\n"):
            stripped = line.strip()
            if not stripped:
                continue
            if _looks_like_page_number(stripped):
                continue
            if _looks_like_caption(stripped):
                continue
            if _is_mostly_noise(stripped):
                continue
            kept.append(stripped)
        if not kept:
            continue
        # Collapse the surviving lines of this block into a single paragraph.
        paragraph = re.sub(r"\s+", " ", " ".join(kept)).strip()
        if paragraph:
            cleaned_blocks.append(paragraph)

    # One paragraph per line. The sentencizer treats each line as a hard
    # boundary so sentences never span paragraph/cell boundaries.
    return "\n".join(cleaned_blocks)


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

    # Count letters in a SCRIPT-AGNOSTIC way. str.isalpha() is Unicode-aware and
    # returns True for Devanagari, CJK, Arabic, Cyrillic, etc. — using a Latin-only
    # [A-Za-z] regex here would treat every non-Latin character as a "symbol" and
    # wrongly discard whole paragraphs of Hindi/Japanese/etc. as noise.
    alpha = sum(1 for c in non_space if c.isalpha())
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
