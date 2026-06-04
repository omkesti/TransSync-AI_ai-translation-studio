# Export Reconstruction Fix

## Problem
Some sentences in the reconstructed DOCX were left in the original language instead of being translated. This happened when the source sentence in `raw_text` differed slightly from the sentence in the translation list due to whitespace or line-break variations. The previous implementation also only replaced the first occurrence of a sentence, which could leave later occurrences untranslated.

## Root Cause
- Exact substring matching (`source in paragraph`) failed when the same text contained extra spaces or line breaks.
- Replacement was limited to the first occurrence of each sentence.

## Fix Applied
- Added a fuzzy regex matcher that tolerates whitespace variations by converting whitespace in the source sentence to `\s+`.
- Replaced all occurrences of a source sentence in a paragraph (not just the first).

## Files Changed
- backend/routes/export.py

## Key Change
- New helper `_build_fuzzy_pattern()` builds a whitespace-tolerant regex.
- `_reconstruct_paragraphs()` now uses `re.sub()` to replace all matches with the translation.

## Verification Steps
1. Run the upload → validate → translate → review → export flow.
2. Compare the exported DOCX to the original document and verify every translated sentence appears in the right paragraph.
3. Test a document with repeated sentences and extra line breaks to confirm all instances are translated.
