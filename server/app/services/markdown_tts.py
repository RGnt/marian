from __future__ import annotations

import re


_FENCED_CODE_BLOCK_RE = re.compile(r"```[\s\S]*?```", re.MULTILINE)
_INLINE_CODE_RE = re.compile(r"`([^`]+)`")
_MD_LINK_RE = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")
_MD_IMAGE_RE = re.compile(r"!\[([^\]]*)\]\(([^)]+)\)")
_HTML_TAG_RE = re.compile(r"<[^>]+>")


def markdown_to_tts_text(md: str) -> str:
    """
    Convert markdown into speech-friendly text.

    Requirements from your spec:
    - Remove markdown formatting for TTS only
    - For fenced code blocks: replace with 'Check the code below.'
    - Preserve normal text content
    """

    if not md:
        return ""

    text = md

    # Replace fenced code blocks entirely
    text = _FENCED_CODE_BLOCK_RE.sub("\nCheck the code below.\n", text)

    # Images -> alt text
    text = _MD_IMAGE_RE.sub(lambda m: m.group(1) or "image", text)

    # Links -> link text only
    text = _MD_LINK_RE.sub(lambda m: m.group(1), text)

    # Inline code -> keep content (spoken)
    text = _INLINE_CODE_RE.sub(lambda m: m.group(1), text)

    # Headings / blockquotes / list markers - keep content
    text = re.sub(r"^\s{0,3}#{1,6}\s+", "", text, flags=re.MULTILINE)  # headings
    text = re.sub(r"^\s{0,3}>\s?", "", text, flags=re.MULTILINE)  # blockquotes
    text = re.sub(r"^\s*[-*+]\s+", "", text, flags=re.MULTILINE)  # bullet lists
    text = re.sub(r"^\s*\d+\.\s+", "", text, flags=re.MULTILINE)  # numbered lists

    # Strip emphasis markers
    text = (
        text.replace("**", "")
        .replace("__", "")
        .replace("*", "")
        .replace("_", "")
        .replace("~~", "")
    )

    # Strip HTML tags if any
    text = _HTML_TAG_RE.sub("", text)

    # Collapse whitespace
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    text = re.sub(r"[ \t]{2,}", " ", text)

    return text
