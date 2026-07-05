import { describe, it, expect, vi, beforeEach } from 'vitest';
import { queryLLM, suggestBookmarkLocation } from '../../src/llm/index.js';
import { queryOpenAI } from '../../src/llm/providers/openai.js';
import { queryGemini } from '../../src/llm/providers/gemini.js';
import { queryMistral } from '../../src/llm/providers/mistral.js';
import { queryClaude } from '../../src/llm/providers/claude.js';
import { queryDeepSeek } from '../../src/llm/providers/deepseek.js';
import { queryOllama } from '../../src/llm/providers/ollama.js';
import { queryCustom } from '../../src/llm/providers/custom.js';

vi.mock('../../src/llm/providers/openai.js');
vi.mock('../../src/llm/providers/gemini.js');
vi.mock('../../src/llm/providers/mistral.js');
vi.mock('../../src/llm/providers/claude.js');
vi.mock('../../src/llm/providers/deepseek.js');
vi.mock('../../src/llm/providers/ollama.js');
vi.mock('../../src/llm/providers/custom.js');

describe('llm/index.js', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  const techTree = {
    id: '0',
    title: 'root',
    children: [
      {
        id: '1',
        title: 'Barre de favoris',
        children: [
          { id: '10', title: 'Python Coding tutorial', url: 'https://python.org' },
          { id: '20', title: 'Homelab docker setup', url: 'https://docker.com' }
        ]
      }
    ]
  };

  const personalTree = {
    id: '0',
    title: 'root',
    children: [
      {
        id: '1',
        title: 'Barre de favoris',
        children: [
          { id: '10', title: 'My Cooking recipes and delicious food', url: 'https://recipe.org' },
          { id: '20', title: 'Summer travel trip vacation vlog', url: 'https://travel.org' }
        ]
      }
    ]
  };

  const emptyTree = {
    id: '0',
    title: 'root',
    children: []
  };

  it('should detect tech user profile based on bookmark titles and call the requested provider', async () => {
    vi.mocked(queryOpenAI).mockResolvedValue({ reorganizedTree: {}, explanation: 'OpenAI OK' });

    const config = {
      provider: 'openai',
      apiUrl: 'https://api.openai.com/v1',
      apiKey: 'test-key',
      modelName: 'gpt-5.5',
      maxTokens: 8192
    };

    const result = await queryLLM(config, techTree, 'complete', null);
    
    expect(queryOpenAI).toHaveBeenCalled();
    expect(result.explanation).toBe('OpenAI OK');
  });

  it('should detect personal user profile based on bookmark titles', async () => {
    vi.mocked(queryOpenAI).mockResolvedValue({ reorganizedTree: {}, explanation: 'OpenAI Personal OK' });

    const config = {
      provider: 'openai',
      apiKey: 'test-key',
      debugMode: true // also tests debugMode logging paths (lines 245-257)
    };

    const result = await queryLLM(config, personalTree, 'complete', null);
    expect(queryOpenAI).toHaveBeenCalled();
    expect(result.explanation).toBe('OpenAI Personal OK');
  });

  it('should handle empty tree profile detection as MIXED', async () => {
    vi.mocked(queryOpenAI).mockResolvedValue({ reorganizedTree: {}, explanation: 'OpenAI Mixed OK' });

    const config = {
      provider: 'openai',
      apiKey: 'test-key'
    };

    const result = await queryLLM(config, emptyTree, 'complete', null);
    expect(queryOpenAI).toHaveBeenCalled();
    expect(result.explanation).toBe('OpenAI Mixed OK');
  });

  it('should detect mixed user profile as MIXED when tech and personal bookmarks are balanced', async () => {
    vi.mocked(queryOpenAI).mockResolvedValue({ reorganizedTree: {}, explanation: 'OpenAI Mixed OK' });

    const mixedTree = {
      id: '0',
      title: 'root',
      children: [
        {
          id: '1',
          title: 'Barre de favoris',
          children: [
            { id: '10', title: 'Python Coding tutorial', url: 'https://python.org' },
            { id: '20', title: 'My Cooking recipes and delicious food', url: 'https://recipe.org' }
          ]
        }
      ]
    };

    const config = {
      provider: 'openai',
      apiKey: 'test-key'
    };

    const result = await queryLLM(config, mixedTree, 'complete', null);
    expect(queryOpenAI).toHaveBeenCalled();
    expect(result.explanation).toBe('OpenAI Mixed OK');
  });


  it('should route requests to all supported providers', async () => {
    vi.mocked(queryGemini).mockResolvedValue({ reorganizedTree: {}, explanation: 'Gemini OK' });
    vi.mocked(queryMistral).mockResolvedValue({ reorganizedTree: {}, explanation: 'Mistral OK' });
    vi.mocked(queryClaude).mockResolvedValue({ reorganizedTree: {}, explanation: 'Claude OK' });
    vi.mocked(queryDeepSeek).mockResolvedValue({ reorganizedTree: {}, explanation: 'DeepSeek OK' });
    vi.mocked(queryOllama).mockResolvedValue({ reorganizedTree: {}, explanation: 'Ollama OK' });
    vi.mocked(queryCustom).mockResolvedValue({ reorganizedTree: {}, explanation: 'Custom OK' });

    // Gemini
    const resGemini = await queryLLM({ provider: 'google', apiKey: 'k' }, techTree, 'minimal', null);
    expect(queryGemini).toHaveBeenCalled();
    expect(resGemini.explanation).toBe('Gemini OK');

    // Mistral
    const resMistral = await queryLLM({ provider: 'mistral', apiKey: 'k' }, techTree, 'minimal', null);
    expect(queryMistral).toHaveBeenCalled();
    expect(resMistral.explanation).toBe('Mistral OK');

    // Grok (uses queryOpenAI mock)
    vi.mocked(queryOpenAI).mockResolvedValue({ reorganizedTree: {}, explanation: 'Grok OK' });
    const resGrok = await queryLLM({ provider: 'grok', apiKey: 'k' }, techTree, 'minimal', null);
    expect(queryOpenAI).toHaveBeenCalled();
    expect(resGrok.explanation).toBe('Grok OK');

    // Claude
    const resClaude = await queryLLM({ provider: 'claude', apiKey: 'k' }, techTree, 'minimal', null);
    expect(queryClaude).toHaveBeenCalled();
    expect(resClaude.explanation).toBe('Claude OK');

    // DeepSeek
    const resDeepSeek = await queryLLM({ provider: 'deepseek', apiKey: 'k' }, techTree, 'minimal', null);
    expect(queryDeepSeek).toHaveBeenCalled();
    expect(resDeepSeek.explanation).toBe('DeepSeek OK');

    // Ollama
    const resOllama = await queryLLM({ provider: 'ollama' }, techTree, 'minimal', null);
    expect(queryOllama).toHaveBeenCalled();
    expect(resOllama.explanation).toBe('Ollama OK');

    // Custom
    const resCustom = await queryLLM({ provider: 'custom', apiUrl: 'http://custom' }, techTree, 'minimal', null);
    expect(queryCustom).toHaveBeenCalled();
    expect(resCustom.explanation).toBe('Custom OK');
  });

  it('should throw an error for unknown provider', async () => {
    const config = { provider: 'unknown-provider' };
    await expect(queryLLM(config, techTree, 'minimal', null)).rejects.toThrow(/Unknown LLM provider/);
  });

  it('should use custom prompts when provided in config', async () => {
    vi.mocked(queryOpenAI).mockResolvedValue({ reorganizedTree: {}, explanation: 'OK' });

    const config = {
      provider: 'openai',
      apiKey: 'test-key',
      promptComplete: 'Custom complete prompt',
      promptMinimal: 'Custom minimal prompt'
    };

    await queryLLM(config, techTree, 'complete', null);

    const callArgs = vi.mocked(queryOpenAI).mock.calls[0];
    // callArgs[3] is the prompt (userPrompt parameter)
    expect(callArgs[3]).toContain('Custom complete prompt');
  });

  it('should use default prompts when custom ones are not provided', async () => {
    vi.mocked(queryOpenAI).mockResolvedValue({ reorganizedTree: {}, explanation: 'OK' });

    const config = {
      provider: 'openai',
      apiKey: 'test-key'
    };

    await queryLLM(config, techTree, 'minimal', null);

    const callArgs = vi.mocked(queryOpenAI).mock.calls[0];
    // Should contain default prompt content
    expect(callArgs[3]).toBeDefined();
  });

  it('should apply maxTokens config correctly', async () => {
    vi.mocked(queryOpenAI).mockResolvedValue({ reorganizedTree: {}, explanation: 'OK' });

    const config = {
      provider: 'openai',
      apiKey: 'test-key',
      maxTokens: 5000
    };

    await queryLLM(config, techTree, 'complete', null);

    const callArgs = vi.mocked(queryOpenAI).mock.calls[0];
    // callArgs[7] is maxTokens parameter
    expect(callArgs[7]).toBe(5000);
  });

  it('should use default maxTokens when not provided or invalid', async () => {
    vi.mocked(queryOpenAI).mockResolvedValue({ reorganizedTree: {}, explanation: 'OK' });

    const config = {
      provider: 'openai',
      apiKey: 'test-key',
      maxTokens: 'invalid'
    };

    await queryLLM(config, techTree, 'complete', null);

    const callArgs = vi.mocked(queryOpenAI).mock.calls[0];
    // callArgs[7] is maxTokens, should default to 131072 when invalid
    expect(callArgs[7]).toBe(131072);
  });

  it('should fall back to English for unknown UI languages, and support language code splitting', async () => {
    vi.mocked(queryOpenAI).mockResolvedValue({ reorganizedTree: {}, explanation: 'OK' });

    // Test unknown UI language
    chrome.i18n.getUILanguage.mockReturnValueOnce('xyz');
    await queryLLM({ provider: 'openai', apiKey: 'test-key' }, techTree, 'complete', null);
    let callArgs = vi.mocked(queryOpenAI).mock.calls[vi.mocked(queryOpenAI).mock.calls.length - 1];
    expect(callArgs[4]).toContain('Respond in English');

    // Test language code splitting (e.g., 'de-DE')
    chrome.i18n.getUILanguage.mockReturnValueOnce('de-DE');
    await queryLLM({ provider: 'openai', apiKey: 'test-key' }, techTree, 'complete', null);
    callArgs = vi.mocked(queryOpenAI).mock.calls[vi.mocked(queryOpenAI).mock.calls.length - 1];
    expect(callArgs[4]).toContain('Respond in German');
  });

  it('should handle tree without children in getTopLevelFolders during context building', async () => {
    vi.mocked(queryOpenAI).mockResolvedValue({ reorganizedTree: {}, explanation: 'OK' });

    const noChildrenTree = { id: '0', title: 'root' }; // no children key
    await queryLLM({ provider: 'openai', apiKey: 'test-key' }, noChildrenTree, 'complete', null);

    const callArgs = vi.mocked(queryOpenAI).mock.calls[vi.mocked(queryOpenAI).mock.calls.length - 1];
    expect(callArgs[3]).toContain('Current top-level folders: (none)');
  });

  it('should handle template placeholders not in substitutions during suggestBookmarkLocation', async () => {
    vi.mocked(queryOpenAI).mockResolvedValue({
      action: 'use_existing',
      targetFolderId: '1',
      explanation: 'OK'
    });

    const config = {
      provider: 'openai',
      apiKey: 'test-key',
      promptSuggest: 'Recommend for {title} and {url} and {non_existent}'
    };
    const bookmark = { title: 'My Bookmark' }; // url is undefined
    const folders = [{ id: '1', path: 'Root' }];

    await suggestBookmarkLocation(config, bookmark, folders, [], null);

    const callArgs = vi.mocked(queryOpenAI).mock.calls[vi.mocked(queryOpenAI).mock.calls.length - 1];
    // The placeholder {non_existent} is ignored by regex; {url} falls back to {url} via nullish coalescing
    expect(callArgs[3]).toContain('Recommend for My Bookmark and {url} and {non_existent}');
  });

  it('should log useful debug information when debugMode is enabled', async () => {
    vi.mocked(queryOpenAI).mockResolvedValue({ reorganizedTree: {}, explanation: 'OK' });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const bigTree = {
      id: '0',
      title: 'root',
      children: [
        {
          id: '1',
          title: 'Barre de favoris',
          children: Array.from({ length: 20 }, (_, index) => ({
            id: String(index + 10),
            title: `Very long bookmark title ${index} with repeated context to trigger preview truncation`,
            url: `https://example.com/${index}`
          }))
        }
      ]
    };

    await queryLLM({ provider: 'openai', apiKey: 'test-key', debugMode: true }, bigTree, 'complete', null);

    expect(logSpy).toHaveBeenCalledWith('=== DEBUG: LLM Query ===');
    expect(logSpy).toHaveBeenCalledWith('Provider:', 'openai');
    expect(logSpy).toHaveBeenCalledWith('Context Length:', expect.any(Number));
    expect(logSpy).toHaveBeenCalledWith('System Prompt Length:', expect.any(Number));
    expect(logSpy).toHaveBeenCalledWith('Mode Instruction Length:', expect.any(Number));
    expect(logSpy).toHaveBeenCalledWith('User Prompt Length:', expect.any(Number));

    logSpy.mockRestore();
  });

  it('should reject malformed reorganized tree responses before diff processing', async () => {
    vi.mocked(queryOpenAI).mockResolvedValue({
      reorganizedTree: {
        id: '0',
        title: 'root',
        children: { invalid: true }
      },
      explanation: 'Broken structure'
    });

    await expect(queryLLM({ provider: 'openai', apiKey: 'test-key' }, techTree, 'complete', null))
      .rejects.toThrow(/children doit être un tableau/i);
  });

  // ─── Context block content assertions ───────────────────────────────────────

  it('should embed TECH profile, bookmark count and folder names in userPrompt', async () => {
    vi.mocked(queryOpenAI).mockResolvedValue({ reorganizedTree: {}, explanation: 'OK' });

    const tree = {
      id: '0', title: 'root',
      children: [
        {
          id: '1', title: 'Dev',
          children: [
            { id: '10', title: 'Python coding tutorial', url: 'https://python.org' },
            { id: '20', title: 'Docker homelab setup', url: 'https://docker.com' },
          ]
        },
        { id: '2', title: 'Archives', children: [] }
      ]
    };

    await queryLLM({ provider: 'openai', apiKey: 'k' }, tree, 'complete', null);
    const calls = vi.mocked(queryOpenAI).mock.calls;
    const userPrompt = calls[calls.length - 1][3];

    expect(userPrompt).toContain('User profile: TECH');
    expect(userPrompt).toContain('Total bookmarks: 2');
    expect(userPrompt).toContain('Current top-level folders: Dev, Archives');
  });

  it('should embed PERSONAL profile in userPrompt', async () => {
    vi.mocked(queryOpenAI).mockResolvedValue({ reorganizedTree: {}, explanation: 'OK' });

    const tree = {
      id: '0', title: 'root',
      children: [{
        id: '1', title: 'Lifestyle',
        children: [
          { id: '10', title: 'My cooking recipes', url: 'https://recipes.com' },
          { id: '20', title: 'Summer travel trip', url: 'https://travel.com' },
          { id: '30', title: 'Fitness gym workout', url: 'https://gym.com' },
        ]
      }]
    };

    await queryLLM({ provider: 'openai', apiKey: 'k' }, tree, 'minimal', null);
    const calls = vi.mocked(queryOpenAI).mock.calls;
    const userPrompt = calls[calls.length - 1][3];

    expect(userPrompt).toContain('User profile: PERSONAL');
    expect(userPrompt).toContain('Total bookmarks: 3');
  });

  it('should embed MIXED profile when tech and personal are exactly balanced', async () => {
    vi.mocked(queryOpenAI).mockResolvedValue({ reorganizedTree: {}, explanation: 'OK' });

    // 1 tech, 1 personal → ratio 0.5 ≤ 0.65 → MIXED
    const tree = {
      id: '0', title: 'root',
      children: [{
        id: '1', title: 'Mix',
        children: [
          { id: '10', title: 'Python', url: 'https://p.com' },
          { id: '20', title: 'Cooking', url: 'https://c.com' },
        ]
      }]
    };

    await queryLLM({ provider: 'openai', apiKey: 'k' }, tree, 'complete', null);
    const calls = vi.mocked(queryOpenAI).mock.calls;
    expect(calls[calls.length - 1][3]).toContain('User profile: MIXED');
  });

  it('should embed MIXED when ratio is below threshold: 3 tech out of 5 (0.6 ≤ 0.65)', async () => {
    vi.mocked(queryOpenAI).mockResolvedValue({ reorganizedTree: {}, explanation: 'OK' });

    // 3 tech, 2 personal → total = 5, tech/total = 0.6 → NOT > 0.65 → MIXED
    // also kills the tech-personal arithmetic mutant: total = 3-2 = 1, tech/total = 3 → TECH (wrong)
    const tree = {
      id: '0', title: 'root',
      children: [{
        id: '1', title: 'Mix',
        children: [
          { id: '10', title: 'Python dev', url: 'https://p.com' },
          { id: '11', title: 'Docker dev', url: 'https://d.com' },
          { id: '12', title: 'Linux server', url: 'https://l.com' },
          { id: '20', title: 'Cooking food', url: 'https://c.com' },
          { id: '21', title: 'Travel trip', url: 'https://t.com' },
        ]
      }]
    };

    await queryLLM({ provider: 'openai', apiKey: 'k' }, tree, 'complete', null);
    const calls = vi.mocked(queryOpenAI).mock.calls;
    expect(calls[calls.length - 1][3]).toContain('User profile: MIXED');
  });

  it('should include (none) when top-level nodes are all bookmarks (no children)', async () => {
    vi.mocked(queryOpenAI).mockResolvedValue({ reorganizedTree: {}, explanation: 'OK' });

    const tree = {
      id: '0', title: 'root',
      children: [
        { id: '10', title: 'A bookmark', url: 'https://a.com' }
      ]
    };

    await queryLLM({ provider: 'openai', apiKey: 'k' }, tree, 'complete', null);
    const calls = vi.mocked(queryOpenAI).mock.calls;
    const userPrompt = calls[calls.length - 1][3];
    expect(userPrompt).toContain('Current top-level folders: (none)');
    expect(userPrompt).toContain('Total bookmarks: 1');
  });

  it('should filter out top-level folders with empty or null titles (filter Boolean)', async () => {
    vi.mocked(queryOpenAI).mockResolvedValue({ reorganizedTree: {}, explanation: 'OK' });

    const tree = {
      id: '0', title: 'root',
      children: [
        { id: '1', title: 'ValidFolder', children: [] },
        { id: '2', title: '', children: [] },
        { id: '3', title: null, children: [] },
      ]
    };

    await queryLLM({ provider: 'openai', apiKey: 'k' }, tree, 'complete', null);
    const calls = vi.mocked(queryOpenAI).mock.calls;
    const userPrompt = calls[calls.length - 1][3];
    expect(userPrompt).toContain('Current top-level folders: ValidFolder');
    expect(userPrompt).not.toMatch(/Current top-level folders: ValidFolder,\s*,/);
  });

  // ─── Language map coverage ───────────────────────────────────────────────────

  it.each([
    ['en', 'English'],
    ['fr', 'French'],
    ['de', 'German'],
    ['es', 'Spanish'],
    ['it', 'Italian'],
    ['pt', 'Portuguese'],
    ['ja', 'Japanese'],
    ['zh', 'Chinese'],
    ['ru', 'Russian'],
    ['ko', 'Korean'],
  ])('should map language code %s to %s in the system prompt', async (code, label) => {
    vi.mocked(queryOpenAI).mockResolvedValue({ reorganizedTree: {}, explanation: 'OK' });
    chrome.i18n.getUILanguage.mockReturnValueOnce(code);
    await queryLLM({ provider: 'openai', apiKey: 'k' }, emptyTree, 'minimal', null);
    const calls = vi.mocked(queryOpenAI).mock.calls;
    const systemPrompt = calls[calls.length - 1][4];
    expect(systemPrompt).toContain(`Respond in ${label}`);
  });

  // ─── Default apiUrl/modelName fallbacks per provider ───────────────────────

  it('should use default OpenAI apiUrl and modelName when not specified', async () => {
    vi.mocked(queryOpenAI).mockResolvedValue({ explanation: 'OK' });
    await queryLLM({ provider: 'openai', apiKey: 'k' }, emptyTree, 'minimal', null);
    expect(queryOpenAI).toHaveBeenLastCalledWith(
      'https://api.openai.com/v1', 'k', 'gpt-5.5',
      expect.any(String), expect.any(String), null, undefined, 131072
    );
  });

  it('should use default Gemini apiUrl and modelName when not specified', async () => {
    vi.mocked(queryGemini).mockResolvedValue({ explanation: 'OK' });
    await queryLLM({ provider: 'google', apiKey: 'k' }, emptyTree, 'minimal', null);
    expect(queryGemini).toHaveBeenLastCalledWith(
      'https://generativelanguage.googleapis.com', 'k', 'gemini-3.5-flash',
      expect.any(String), expect.any(String), null, undefined, 131072
    );
  });

  it('should use default Mistral apiUrl and modelName when not specified', async () => {
    vi.mocked(queryMistral).mockResolvedValue({ explanation: 'OK' });
    await queryLLM({ provider: 'mistral', apiKey: 'k' }, emptyTree, 'minimal', null);
    expect(queryMistral).toHaveBeenLastCalledWith(
      'https://api.mistral.ai/v1', 'k', 'mistral-medium-latest',
      expect.any(String), expect.any(String), null, undefined, 131072
    );
  });

  it('should use default Grok apiUrl and modelName when not specified', async () => {
    vi.mocked(queryOpenAI).mockResolvedValue({ explanation: 'OK' });
    await queryLLM({ provider: 'grok', apiKey: 'k' }, emptyTree, 'minimal', null);
    expect(queryOpenAI).toHaveBeenLastCalledWith(
      'https://api.x.ai/v1', 'k', 'grok-4-3',
      expect.any(String), expect.any(String), null, undefined, 131072
    );
  });

  it('should use default Claude apiUrl and modelName when not specified', async () => {
    vi.mocked(queryClaude).mockResolvedValue({ explanation: 'OK' });
    await queryLLM({ provider: 'claude', apiKey: 'k' }, emptyTree, 'minimal', null);
    expect(queryClaude).toHaveBeenLastCalledWith(
      'https://api.anthropic.com', 'k', 'claude-opus-4-7',
      expect.any(String), expect.any(String), null, undefined, 131072
    );
  });

  it('should use default DeepSeek apiUrl and modelName when not specified', async () => {
    vi.mocked(queryDeepSeek).mockResolvedValue({ explanation: 'OK' });
    await queryLLM({ provider: 'deepseek', apiKey: 'k' }, emptyTree, 'minimal', null);
    expect(queryDeepSeek).toHaveBeenLastCalledWith(
      'https://api.deepseek.com/v1', 'k', 'deepseek-reasoner',
      expect.any(String), expect.any(String), null, undefined, 131072
    );
  });

  it('should use default Ollama apiUrl and modelName when not specified', async () => {
    vi.mocked(queryOllama).mockResolvedValue({ explanation: 'OK' });
    await queryLLM({ provider: 'ollama' }, emptyTree, 'minimal', null);
    expect(queryOllama).toHaveBeenLastCalledWith(
      'http://localhost:11434', 'llama-4-scout',
      expect.any(String), expect.any(String), null, undefined, 131072
    );
  });

  // ─── Mode condition and promptMinimal ──────────────────────────────────────

  it('should use custom promptMinimal when mode is minimal', async () => {
    vi.mocked(queryOpenAI).mockResolvedValue({ explanation: 'OK' });
    const config = { provider: 'openai', apiKey: 'k', promptMinimal: 'MY_MINIMAL_INSTRUCTION' };
    await queryLLM(config, emptyTree, 'minimal', null);
    const calls = vi.mocked(queryOpenAI).mock.calls;
    expect(calls[calls.length - 1][3]).toContain('MY_MINIMAL_INSTRUCTION');
  });

  it('should use default PROMPT_MINIMAL when mode is minimal and no custom prompt', async () => {
    vi.mocked(queryOpenAI).mockResolvedValue({ explanation: 'OK' });
    const config = { provider: 'openai', apiKey: 'k' }; // no promptMinimal
    await queryLLM(config, emptyTree, 'minimal', null);
    const calls = vi.mocked(queryOpenAI).mock.calls;
    const userPrompt = calls[calls.length - 1][3];
    // Default prompt must produce a non-empty prompt
    expect(userPrompt.length).toBeGreaterThan(50);
    // Complete prompt must differ from minimal prompt
    await queryLLM({ ...config, promptComplete: 'COMPLETE_MARKER' }, emptyTree, 'complete', null);
    const completePrompt = vi.mocked(queryOpenAI).mock.calls.at(-1)[3];
    expect(completePrompt).toContain('COMPLETE_MARKER');
    expect(completePrompt).not.toContain('MY_MINIMAL_INSTRUCTION');
  });

  // ─── suggestBookmarkLocation foldersList format ─────────────────────────────

  it('should format foldersList as "id: path" joined with newlines in prompt', async () => {
    vi.mocked(queryOpenAI).mockResolvedValue({ action: 'use_existing', targetFolderId: '1' });
    const config = { provider: 'openai', apiKey: 'k' };
    const bookmark = { title: 'Test', url: 'https://test.com' };
    const folders = [
      { id: '1', path: 'Root' },
      { id: '2', path: 'Root > Sub' },
    ];

    await suggestBookmarkLocation(config, bookmark, folders, [], null);

    const userPrompt = vi.mocked(queryOpenAI).mock.calls.at(-1)[3];
    expect(userPrompt).toContain('1: "Root"');
    expect(userPrompt).toContain('2: "Root > Sub"');
    expect(userPrompt).toContain('1: "Root"\n2: "Root > Sub"');
  });

  it('should join multiple ignoredPaths with newlines in avoidInstruction', async () => {
    vi.mocked(queryOpenAI).mockResolvedValue({ action: 'use_existing', targetFolderId: '3' });
    const config = { provider: 'openai', apiKey: 'k' };
    const bookmark = { title: 'Test', url: 'https://test.com' };
    const folders = [
      { id: '1', path: 'Root' },
      { id: '2', path: 'Root > Ignored A' },
      { id: '3', path: 'Root > Recommended' },
      { id: '4', path: 'Root > Ignored B' },
    ];

    await suggestBookmarkLocation(config, bookmark, folders, ['2', '4'], null);

    const userPrompt = vi.mocked(queryOpenAI).mock.calls.at(-1)[3];
    expect(userPrompt).toContain('CRITICAL CONSTRAINT');
    // The two ignored entries must be separated by newline, not concatenated
    expect(userPrompt).toContain('2: "Root > Ignored A"\n4: "Root > Ignored B"');
  });

  it('should use JSON classifier system prompt in suggestBookmarkLocation', async () => {
    vi.mocked(queryOpenAI).mockResolvedValue({ action: 'use_existing', targetFolderId: '1' });
    const config = { provider: 'openai', apiKey: 'k' };
    await suggestBookmarkLocation(config, { title: 'T', url: 'https://t.com' }, [{ id: '1', path: 'Root' }], [], null);
    const systemPrompt = vi.mocked(queryOpenAI).mock.calls.at(-1)[4];
    expect(systemPrompt).toContain('strict JSON classifier');
  });

  // ─── Profile threshold boundary: exactly 0.65 must be MIXED (not TECH/PERSONAL) ─

  it('should classify as MIXED when tech/total equals exactly 0.65 (> not >=)', async () => {
    vi.mocked(queryOpenAI).mockResolvedValue({ explanation: 'OK' });

    // 13 tech, 7 personal → total=20, tech/total = 0.65 (exactly)
    // With > 0.65: false → MIXED  |  With >= 0.65: true → TECH (wrong)
    const tree = {
      id: '0', title: 'root',
      children: [{
        id: '1', title: 'Mix',
        children: [
          { id: '1', title: 'Python dev', url: 'https://a.com' },
          { id: '2', title: 'Docker dev', url: 'https://b.com' },
          { id: '3', title: 'Linux server', url: 'https://c.com' },
          { id: '4', title: 'React frontend', url: 'https://d.com' },
          { id: '5', title: 'Node api', url: 'https://e.com' },
          { id: '6', title: 'Git github', url: 'https://f.com' },
          { id: '7', title: 'AWS cloud', url: 'https://g.com' },
          { id: '8', title: 'SQL database', url: 'https://h.com' },
          { id: '9', title: 'Kubernetes devops', url: 'https://i.com' },
          { id: '10', title: 'Vim vscode', url: 'https://j.com' },
          { id: '11', title: 'Rust golang', url: 'https://k.com' },
          { id: '12', title: 'ML tensorflow', url: 'https://l.com' },
          { id: '13', title: 'Data analytics', url: 'https://m.com' },
          { id: '14', title: 'Cooking food', url: 'https://n.com' },
          { id: '15', title: 'Travel trip', url: 'https://o.com' },
          { id: '16', title: 'Fitness gym', url: 'https://p.com' },
          { id: '17', title: 'Music movie', url: 'https://q.com' },
          { id: '18', title: 'Pet cat', url: 'https://r.com' },
          { id: '19', title: 'Recipe cooking', url: 'https://s.com' },
          { id: '20', title: 'Gaming game', url: 'https://t.com' },
        ]
      }]
    };

    await queryLLM({ provider: 'openai', apiKey: 'k' }, tree, 'complete', null);
    const userPrompt = vi.mocked(queryOpenAI).mock.calls.at(-1)[3];
    expect(userPrompt).toContain('User profile: MIXED');
  });

  it('should NOT include Stryker garbage in prompt when ignoredFolderIds is empty (avoidInstruction default)', async () => {
    vi.mocked(queryOpenAI).mockResolvedValue({ action: 'use_existing', targetFolderId: '1' });
    const config = { provider: 'openai', apiKey: 'k' };

    await suggestBookmarkLocation(config, { title: 'T', url: 'https://t.com' }, [{ id: '1', path: 'Root' }], [], null);

    const userPrompt = vi.mocked(queryOpenAI).mock.calls.at(-1)[3];
    expect(userPrompt).not.toContain('Stryker');
    // The prompt should not have any trailing garbage after the template substitutions
    expect(userPrompt.endsWith('\n')).toBe(false);
  });
});
