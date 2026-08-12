---
status: resolved
---

# Debug: Gemini JSON parsing during bookmark reorganization

## Symptom

Gemini returns an error from `cleanAndParseJSON()` with `Unexpected non-whitespace character after JSON at position 10697`. The popup later reports application failure, but the console stack points to `queryGemini()` during analysis.

## Hypotheses

| # | Hypothesis | Confidence | Status | Evidence |
|---|---|---:|---|---|
| 1 | Gemini returned text containing a valid JSON value followed by extra non-whitespace content or another closing fragment. | 9/10 | Validated at parser boundary | The reported exception is specifically `Unexpected non-whitespace character after JSON`; the failing stack is `cleanAndParseJSON -> queryGemini`. |
| 2 | The response was truncated at the Gemini output-token limit. | 3/10 | Not supported yet | Truncation normally produces an incomplete JSON/end-of-input condition; the screenshot shows extra non-whitespace after a parsed JSON prefix. `queryGemini()` does not currently record `finishReason`. |
| 3 | Gemini returned several response parts and the provider only parsed the first part. | 4/10 | Not supported yet | `queryGemini()` reads only `parts[0].text`; the current log does not show the full `parts.length` or `finishReason` for this incident. |
| 4 | The local parser is the primary defect. | 2/10 | Mostly invalidated | A reproduction with JSON followed by prose, a literal `\\n`, or a second JSON object is recovered successfully by the current parser. The failure requires the actual raw response to identify a parser edge case. |

## Confirmed root cause

The analysis receives a Gemini candidate whose extracted text is not a single valid JSON value. This causes the failure before bookmark application. The exact upstream reason for the extra content (model formatting, truncation, or multiple parts) remains unconfirmed without the raw candidate metadata and response tail.

## Fix applied

`queryGemini()` now concatenates all text parts from the candidate and preserves a token-limit marker when Gemini reports `MAX_TOKENS` or `MAX_OUTPUT_TOKENS`. Debug mode also records the finish reason, finish message, usage metadata, and part count without exposing the API key.

Regression coverage now includes split response parts and token-limit handling.

## Next diagnostic step

If the issue recurs, enable debug mode for one reproduction and capture `finishReason`, `finishMessage`, `parts.length`, `usageMetadata`, and the last 500 characters of the candidate text. Do not capture or share the API key or full bookmark payload.
