# Developer and AI Agent Guide

This guide details the architecture of FavorAI to help developers and other agentic coding systems understand and modify the extension safely.

## Key Design Principles

1. **Strict Separation of Concerns**:
   - `manifest.json`: Configuration and permissions.
   - `background.js`: Service Worker orchestrator (event routing).
   - `src/background/analysis.js`: Heavy computations for duplicates, dead links, and diff preparations.
   - `src/background/diff.js`: Logic to map trees, align IDs, and sanitize LLM output.
   - `src/background/apply.js`: Bookmark modification actions (creates, deletes, moves, renamos).
   - `src/background/history.js`: Storing session histories and performing rollback operations.
   - `src/llm/index.js`: LLM API routing and provider instantiation.

2. **XSS and Injection Security**:
   - Never inject user or AI text using `innerHTML`. Always use `textContent` or construct the DOM programmatically.
   - Restrict extension host permissions to required domains.
   - Avoid sending bookmark URLs to the AI. Only titles and structural layouts are transmitted.

3. **Service Worker Keep-Alive**:
   - Modern MV3 service workers can deactivate after 30 seconds of inactivity.
   - We use `chrome.alarms` paired with an alarm listener to fire background checks and keep the SW alive during lengthy analysis sessions.

## Adding a new LLM Provider

To add a new LLM provider:
1. Create a client wrapper inside `src/llm/providers/your_provider.js`.
2. Export a query function similar to `queryOpenAI`.
3. Import and route it inside `src/llm/index.js` in the `queryLLM` switch block.