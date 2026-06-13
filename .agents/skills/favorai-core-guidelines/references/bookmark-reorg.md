# Bookmark Reorganization

## Input contract

The tree sent to the LLM contains bookmark IDs, titles, folder nodes, and URLs for semantic grouping.

## Output contract

- Return a JSON object with `reorganizedTree` and `explanation`.
- Existing bookmarks in the LLM output should contain only `id`.
- New folders must use IDs that start with `new_`.
- Preserve the original root structure.

## Reorganization rules

- Restore titles and URLs from local metadata after the model responds.
- Do not silently fall back to the root when a `new_` parent cannot be resolved.
- Keep complete-mode top-level folders under the bookmarks bar.
- Preserve original folder IDs only when intentionally reusing them as subfolders.

## Validation focus

- Detect malformed JSON early.
- Detect missing or duplicated IDs.
- Detect parent-child mismatches before apply.
- Compare the LLM response against the local bookmark tree before mutation.

## Apply and history

- Apply actions sequentially.
- Record failures instead of swallowing them.
- Preserve history so rollback remains possible after a successful mutation.
