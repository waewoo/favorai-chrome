import { queryOpenAI }   from './providers/openai.js';
import { queryGemini }   from './providers/gemini.js';
import { queryMistral }  from './providers/mistral.js';
import { queryOllama }   from './providers/ollama.js';
import { queryCustom }   from './providers/custom.js';
import { queryClaude }   from './providers/claude.js';
import { queryDeepSeek } from './providers/deepseek.js';

const SYSTEM_PROMPT_COMMON = `You are an expert information architect and UX specialist in browser bookmark organization.
You analyze content semantically and design intuitive, easy-to-navigate folder hierarchies.
Your task is to reorganize browser bookmarks for maximum usability and logical coherence.

BOOKMARKS BAR CONTEXT — CRITICAL:
You are organizing a Chrome/Chromium BOOKMARKS BAR. Top-level folders appear as clickable buttons on the browser toolbar.
- HARD LIMIT: MAXIMUM 8 top-level folders. Never exceed 8. Count them before returning.
- TARGET: exactly 6 to 8 top-level folders — not fewer, not more
- NEVER create a single catch-all top-level folder like "Bookmarks", "All Bookmarks", "Links", or "Favorites"
- NEVER put all content under just 1-3 top-level folders — this defeats the purpose of the bar
- If you have more than 8 candidate categories, MERGE the smallest/most related ones into broader themes until you reach ≤ 8
- Use sub-folders (2nd and 3rd level) to organize content within each top-level folder

CRITICAL RULES FOR OUTPUT:
1. RETURN FORMAT — You MUST return ONLY a valid JSON object with exactly TWO keys:
   - "reorganizedTree": the complete reorganized structure
   - "explanation": structured explanation of ALL changes (in the user's language)

2. JSON STRUCTURE — Use this exact format:
   - Bookmark: { "id": "string", "title": "string" }
   - Folder:   { "id": "string", "title": "string", "children": [...] }
   - NEVER include "url", "date", or any other field

3. DATA INTEGRITY — CRITICAL:
   - Do NOT lose ANY bookmark — ALL input IDs must appear in output
   - Keep "id" values UNCHANGED so changes can be tracked
   - Preserve exact bookmark titles

4. FOLDER CREATION & DELETION — TOP-LEVEL REBUILD:
   - TOP-LEVEL FOLDERS (direct children of the root) MUST ALL use new_ IDs in COMPLETE mode
     → Original folder IDs may ONLY appear as sub-folders (depth ≥ 2) inside a new_ top-level folder
     → An original folder appearing at top level in reorganizedTree = KEPT at top level (NOT deleted!)
     → To DELETE an old top-level folder: OMIT it entirely from reorganizedTree
     → To REORGANIZE it: place it inside a new_ top-level folder as a sub-folder
   - New folders use IDs starting with "new_" (e.g., "new_folder_devops", "new_folder_ai")
   - NEVER include empty folders in reorganizedTree — every folder must contain at least one child
   - NEVER keep fully-replaced or emptied original folders in the reorganizedTree
   - Direct bookmarks placed directly on the bookmarks bar (not inside any folder) must be grouped into "★ Quick Access"

5. DUPLICATE BOOKMARKS:
   - If two bookmarks have identical or near-identical titles suggesting the same resource, keep only the one in the most semantically appropriate folder
   - Report removed duplicates in the explanation

SEMANTIC ANALYSIS:
6. For EVERY bookmark, determine its primary category:
   - Technical: Programming, DevOps, Cloud, AI, Security, Hardware, Software
   - Professional: Work, Finance, HR, Management, Career, Business
   - Personal/Hobbies: Pets, Sports, Gaming, Cooking, Travel, Fitness, Family
   - Entertainment: Movies, Music, TV, Streaming, Podcasts
   - Reference/Learning: Documentation, Tutorials, News, Education

7. DETECT MISMATCHES:
   - "Best cat breeds" in "Homelab" → MISMATCH → move to Personal/Pets
   - "Docker cheatsheet" in "Misc" → MISMATCH → move to Development/DevOps
   - "Hiking trails France" in "Work" → MISMATCH → move to Personal/Travel
   - Each folder's title must accurately describe ALL of its content

8. MERGE & CONSOLIDATE:
   - Combine redundant folders: "JS" + "JavaScript" → "JavaScript"
   - Merge thin folders (< 3 bookmarks) into a broader parent if appropriate
   - Example: "Fonts" + "Icons" + "Colors" → "Design Resources"
   - Remove empty folders after merging

EXPLANATION FORMAT:
9. Structure your "explanation" value as follows (plain text, user's language):

**STRUCTURE OVERVIEW**
List new top-level folders with one-line purpose.

**SEMANTIC MISMATCHES FIXED**
"Moved '[title]' from '[OldFolder]' to '[NewFolder]' because [reason]."

**MERGES PERFORMED**
"Merged '[A]' and '[B]' into '[C]' because [reason]."

**NEW FOLDERS CREATED**
"Created '[Folder]' under '[Parent]' to group [description]."

**DUPLICATES REMOVED**
"Removed duplicate '[title]' — kept in '[Folder]'."

FINAL VALIDATION — verify before returning:
✅ Top-level folder count is between 6 and 8 (HARD MAXIMUM: 8) — count them explicitly
✅ If count > 8: STOP, merge the least populated top-level folders until count ≤ 8
✅ No single folder contains more than ~40% of all bookmarks
   EXCEPTION: If collection is 70%+ technical, one top-level tech category may hold up to 60% provided it has at least 4 rich sub-folders
✅ No technical bookmarks in personal/hobby folders
✅ No personal bookmarks in technical folders
✅ All folder names accurately describe their content
✅ No orphaned or misplaced bookmarks
✅ No duplicate URLs in multiple folders
✅ No empty folders remain — every folder in reorganizedTree has at least one child
✅ Original folders absent from reorganizedTree will be deleted by the system — verify all original folder IDs are either present (with content) or omitted (to be deleted)`;

const PROMPT_MINIMAL = `MODE: Minimal Reorganization — fix only clear semantic misplacements. Preserve everything else.
RULE #1: When in doubt → do nothing. Prefer false negatives over false positives.

FOR EACH BOOKMARK, follow these 3 steps:

Step 1 — TOPIC EXTRACTION
Infer the bookmark's main topic from its title. Assign 1–3 semantic tags (e.g. "DevOps", "AI", "Finance", "Cooking").

Step 2 — FOLDER THEME
Infer the semantic theme of its current folder from the folder name and its siblings.

Step 3 — COHERENCE SCORE
  2 = Strong match (same domain)        → KEEP
  1 = Weak match (related domain)       → KEEP
  0 = Clear mismatch (different domain) → consider MOVE

MOVE LOGIC (only when score = 0):
  1. Find the existing folder with the highest semantic match (score ≥ 2 required as destination)
  2. If found → move there
  3. If not found → create a new folder ONLY if the topic is unambiguous
  4. If still uncertain → DO NOT MOVE

ABSOLUTE CONSTRAINTS:
- NEVER rename, delete, or move any folder
- NEVER restructure the hierarchy
- NEVER mass-move or "optimize" the structure
- NEVER act on ambiguous or unclear titles
- Only bookmarks with score = 0 AND a clear score-2 destination may be moved
- QUICK ACCESS: any bookmark placed directly on the bookmarks bar (not inside any folder) must be moved into a "★ Quick Access" folder — create it if it doesn't exist

EXPLANATION FORMAT (put in the "explanation" field):
Structure your explanation as follows:

**MOVED BOOKMARKS**
For each move: "Moved '[title]' from '[source]' to '[target]' — [semantic mismatch reason]."

**NEW FOLDERS CREATED** (if any)
"Created '[name]' because [justification]."

**BORDERLINE CASES** (optional but valuable)
"Kept '[title]' in '[folder]' despite [ambiguity] — [why it was not moved]."`;

const PROMPT_COMPLETE = `MODE: Complete reorganization.
Specific rules:
- Redesign the entire bookmark structure for maximum semantic clarity and usability.
- Analyze EVERY folder's title against its contents: are items thematically aligned?
- CORRECT ALL MISPLACED ITEMS: move bookmarks/folders to semantically matching categories.
- You may create new folders, rename existing ones, merge folders, or move entire folders.
- DETECT & REMOVE DUPLICATES: if two bookmarks point to the same resource, keep only the best-placed one.
COMPLETE MODE — MANDATORY WORKFLOW:

Step 1 — PLAN your 6 to 8 new top-level categories (all with new_ IDs):
  Example: new_dev, new_devops, new_ai, new_finance, new_personal, new_reference, new_quickaccess
  → Write these down mentally before generating the JSON

Step 2 — ASSIGN every bookmark to one of these new_ categories (or a sub-folder within)

Step 3 — MAP old folders: for each original folder, decide:
  - Is it useful as a sub-folder inside one of my new_ top-level folders? → include it with its original ID under the correct new_ parent
  - Is it redundant/replaced by a new_ structure? → OMIT it entirely (system will delete it)
  - CRITICAL: do NOT keep old folders at the top level — they will block deletion

Step 4 — GENERATE the JSON with:
  - ALL top-level folders using new_ IDs (no exceptions)
  - Original folder IDs appearing ONLY at depth ≥ 2 (inside new_ top-level folders) or ABSENT
  - Every bookmark ID from the input appearing exactly once in the output
  - 6–8 top-level folders max (count before returning)

- BOOKMARKS BAR USAGE: exactly 6–8 top-level folders with new_ IDs — HARD MAXIMUM 8
- MERGE thin folders (< 3 bookmarks) into broader categories where appropriate.
- NO ORPHAN FOLDERS: any original folder not included in reorganizedTree is automatically deleted.
- QUICK ACCESS: bookmarks placed directly on the bar (not in a folder) → "★ Quick Access" (new_ ID).
- Follow the structured explanation format defined in the system prompt.`;

// ─── Context helpers ───────────────────────────────────────────────────────

function countBookmarks(node) {
  if (!node.children) return 1;
  return node.children.reduce((sum, child) => sum + countBookmarks(child), 0);
}

function getTopLevelFolders(tree) {
  if (!tree.children) return [];
  return tree.children.filter(n => n.children).map(n => n.title).filter(Boolean);
}

function detectUserProfile(tree) {
  const techRe = /\b(code|dev|docker|kubernetes|k8s|linux|python|javascript|typescript|react|vue|angular|node|api|git|github|aws|azure|gcp|cloud|server|database|sql|mongodb|redis|nginx|programming|software|engineering|cyber|security|hacking|homelab|sysadmin|bash|shell|vim|vscode|npm|pip|rust|golang|java|php|ruby|swift|flutter|devops|terraform|ansible|prometheus|grafana|ml|ai|llm|gpt|deeplearning|pytorch|tensorflow|data|analytics|kafka|frontend|backend|fullstack)\b/i;
  const personalRe = /\b(food|recipe|cooking|travel|trip|vacation|sport|fitness|gym|yoga|music|movie|film|serie|netflix|youtube|gaming|game|pet|cat|dog|family|kids|baby|health|medical|diet|book|novel|manga|anime|fashion|art|photo|diy|craft|garden|home|house|car|bike)\b/i;

  let tech = 0, personal = 0;
  function scan(node) {
    if (node.title) {
      if (techRe.test(node.title)) tech++;
      if (personalRe.test(node.title)) personal++;
    }
    if (node.children) node.children.forEach(scan);
  }
  scan(tree);

  const total = tech + personal;
  if (total === 0) return 'MIXED';
  if (tech / total > 0.65) return 'TECH';
  if (personal / total > 0.65) return 'PERSONAL';
  return 'MIXED';
}

function buildContextBlock(tree) {
  const total = countBookmarks(tree);
  const topFolders = getTopLevelFolders(tree);
  const profile = detectUserProfile(tree);
  return [
    `USER CONTEXT (auto-detected):`,
    `- User profile: ${profile}`,
    `- Total bookmarks: ${total}`,
    `- Current top-level folders: ${topFolders.length > 0 ? topFolders.join(', ') : '(none)'}`,
  ].join('\n');
}

// ───────────────────────────────────────────────────────────────────────────

/**
 * Route la requête vers le bon provider LLM.
 * @param {object} config  - { provider, apiUrl, apiKey, modelName, promptMinimal, promptComplete }
 * @param {object} bookmarksTree - Arborescence nettoyée (sans URLs)
 * @param {string} mode    - 'minimal' | 'complete'
 * @param {AbortSignal} signal
 */
export async function queryLLM(config, bookmarksTree, mode, signal) {
  const { provider, apiUrl, apiKey, modelName, promptMinimal, promptComplete, debugMode, maxTokens } = config;
  const resolvedMaxTokens = parseInt(maxTokens, 10) || 131072;

  const systemPrompt = SYSTEM_PROMPT_COMMON;

  const modeInstruction = mode === 'complete'
    ? (promptComplete || PROMPT_COMPLETE)
    : (promptMinimal || PROMPT_MINIMAL);

  const contextBlock = buildContextBlock(bookmarksTree);
  const userPrompt = `${modeInstruction}\n\n${contextBlock}\n\nHere is the JSON of my current bookmarks to reorganize:\n\n${JSON.stringify(bookmarksTree)}`;

  if (debugMode) {
    console.log('=== DEBUG: LLM Query ===');
    console.log('Provider:', provider);
    console.log('Model:', modelName);
    console.log('Mode:', mode);
    console.log('Context:', contextBlock);
    console.log('--- System Prompt ---');
    console.log(systemPrompt);
    console.log('--- Mode Instruction ---');
    console.log(modeInstruction);
    console.log('--- User Prompt (Preview) ---');
    console.log(userPrompt.substring(0, 500) + '...');
    console.log('========================');
  }

  switch (provider) {
    case 'openai':
      return queryOpenAI(apiUrl || 'https://api.openai.com/v1', apiKey, modelName || 'gpt-5.5', userPrompt, systemPrompt, signal, debugMode, resolvedMaxTokens);
    case 'google':
      return queryGemini(apiUrl || 'https://generativelanguage.googleapis.com', apiKey, modelName || 'gemini-3.5-flash', userPrompt, systemPrompt, signal, debugMode, resolvedMaxTokens);
    case 'mistral':
      return queryMistral(apiUrl || 'https://api.mistral.ai/v1', apiKey, modelName || 'mistral-large-3', userPrompt, systemPrompt, signal, debugMode, resolvedMaxTokens);
    case 'grok':
      return queryOpenAI(apiUrl || 'https://api.x.ai/v1', apiKey, modelName || 'grok-4-3', userPrompt, systemPrompt, signal, debugMode, resolvedMaxTokens);
    case 'claude':
      return queryClaude(apiUrl || 'https://api.anthropic.com', apiKey, modelName || 'claude-opus-4-7', userPrompt, systemPrompt, signal, debugMode, resolvedMaxTokens);
    case 'deepseek':
      return queryDeepSeek(apiUrl || 'https://api.deepseek.com/v1', apiKey, modelName || 'deepseek-reasoner', userPrompt, systemPrompt, signal, debugMode, resolvedMaxTokens);
    case 'ollama':
      return queryOllama(apiUrl || 'http://localhost:11434', modelName || 'llama-4-scout', userPrompt, systemPrompt, signal, debugMode, resolvedMaxTokens);
    case 'custom':
      return queryCustom(apiUrl, apiKey, modelName, userPrompt, systemPrompt, signal, debugMode, resolvedMaxTokens);
    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}
