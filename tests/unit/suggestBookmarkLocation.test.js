import { describe, it, expect, vi, beforeEach } from 'vitest';
import { suggestBookmarkLocation } from '../../src/llm/index.js';
import { queryOpenAI } from '../../src/llm/providers/openai.js';
import { queryGemini } from '../../src/llm/providers/gemini.js';
import { queryClaude } from '../../src/llm/providers/claude.js';
import { queryMistral } from '../../src/llm/providers/mistral.js';
import { queryDeepSeek } from '../../src/llm/providers/deepseek.js';
import { queryOllama } from '../../src/llm/providers/ollama.js';
import { queryCustom } from '../../src/llm/providers/custom.js';

vi.mock('../../src/llm/providers/openai.js');
vi.mock('../../src/llm/providers/gemini.js');
vi.mock('../../src/llm/providers/claude.js');
vi.mock('../../src/llm/providers/mistral.js');
vi.mock('../../src/llm/providers/deepseek.js');
vi.mock('../../src/llm/providers/ollama.js');
vi.mock('../../src/llm/providers/custom.js');

function getPromptFromProviderCall(mockedProvider) {
  const [, , , prompt] = mockedProvider.mock.calls.at(-1);
  return prompt;
}

describe('suggestBookmarkLocation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should query the correct provider (OpenAI) with custom prompt', async () => {
    vi.mocked(queryOpenAI).mockResolvedValue({
      action: 'use_existing',
      targetFolderId: '2',
      explanation: 'Fits perfectly under Design resources'
    });

    const config = {
      provider: 'openai',
      apiUrl: 'https://api.openai.com/v1',
      apiKey: 'test-key',
      modelName: 'gpt-5.5'
    };

    const bookmark = { title: 'Dribbble portfolio', url: 'https://dribbble.com' };
    const folders = [
      { id: '1', path: 'Barre de favoris' },
      { id: '2', path: 'Barre de favoris > Design resources' }
    ];

    const result = await suggestBookmarkLocation(config, bookmark, folders, null);

    expect(queryOpenAI).toHaveBeenCalled();
    expect(result.action).toBe('use_existing');
    expect(result.targetFolderId).toBe('2');
  });

  it('should fallback and query other providers like Gemini', async () => {
    vi.mocked(queryGemini).mockResolvedValue({
      action: 'create_new',
      newFolderTitle: 'Cooking',
      newFolderParentId: '1',
      explanation: 'No cooking folders exist yet.'
    });

    const config = {
      provider: 'google',
      apiKey: 'gemini-key',
      modelName: 'gemini-3.5-flash'
    };

    const bookmark = { title: 'Pasta Recipe', url: 'https://recipes.com/pasta' };
    const folders = [{ id: '1', path: 'Barre de favoris' }];

    const result = await suggestBookmarkLocation(config, bookmark, folders, null);

    expect(queryGemini).toHaveBeenCalled();
    expect(result.action).toBe('create_new');
    expect(result.newFolderTitle).toBe('Cooking');
  });
  it('should reject malformed suggestion responses before the popup receives them', async () => {
    vi.mocked(queryOpenAI).mockResolvedValue({ explanation: 'Missing action' });
    const config = { provider: 'openai', apiKey: 'test-key' };
    const malformedBookmark = { title: 'New Bookmark', url: 'https://example.com' };
    const malformedFolders = [
      { id: '1', path: 'Barre de favoris' },
      { id: '2', path: 'Barre de favoris > Tech' }
    ];

    await expect(suggestBookmarkLocation(config, malformedBookmark, malformedFolders, null))
      .rejects.toThrow(/action/i);
  });
});

describe('suggestBookmarkLocation - all providers', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  const bookmark = { title: 'New Bookmark', url: 'https://example.com' };
  const folders = [
    { id: '1', path: 'Barre de favoris' },
    { id: '2', path: 'Barre de favoris > Tech' }
  ];

  it('should route to Claude provider', async () => {
    vi.mocked(queryClaude).mockResolvedValue({
      action: 'use_existing',
      targetFolderId: '2',
      explanation: 'Claude recommendation'
    });

    const config = {
      provider: 'claude',
      apiKey: 'test-key',
      modelName: 'claude-opus-4-7'
    };

    const result = await suggestBookmarkLocation(config, bookmark, folders, null);

    expect(queryClaude).toHaveBeenCalled();
    expect(result.explanation).toBe('Claude recommendation');
  });

  it('should route to Mistral provider', async () => {
    vi.mocked(queryMistral).mockResolvedValue({
      action: 'use_existing',
      targetFolderId: '2',
      explanation: 'Mistral recommendation'
    });

    const config = {
      provider: 'mistral',
      apiKey: 'test-key',
      modelName: 'mistral-medium-latest'
    };

    const result = await suggestBookmarkLocation(config, bookmark, folders, null);

    expect(queryMistral).toHaveBeenCalled();
    expect(result.explanation).toBe('Mistral recommendation');
  });

  it('should route to DeepSeek provider', async () => {
    vi.mocked(queryDeepSeek).mockResolvedValue({
      action: 'use_existing',
      targetFolderId: '2',
      explanation: 'DeepSeek recommendation'
    });

    const config = {
      provider: 'deepseek',
      apiKey: 'test-key',
      modelName: 'deepseek-reasoner'
    };

    const result = await suggestBookmarkLocation(config, bookmark, folders, null);

    expect(queryDeepSeek).toHaveBeenCalled();
    expect(result.explanation).toBe('DeepSeek recommendation');
  });

  it('should route to Ollama provider', async () => {
    vi.mocked(queryOllama).mockResolvedValue({
      action: 'use_existing',
      targetFolderId: '2',
      explanation: 'Ollama recommendation'
    });

    const config = {
      provider: 'ollama',
      modelName: 'llama-4-scout'
    };

    const result = await suggestBookmarkLocation(config, bookmark, folders, null);

    expect(queryOllama).toHaveBeenCalled();
    expect(result.explanation).toBe('Ollama recommendation');
  });

  it('should route to Custom provider', async () => {
    vi.mocked(queryCustom).mockResolvedValue({
      action: 'use_existing',
      targetFolderId: '2',
      explanation: 'Custom provider recommendation'
    });

    const config = {
      provider: 'custom',
      apiUrl: 'https://custom.api',
      apiKey: 'test-key',
      modelName: 'custom-model'
    };

    const result = await suggestBookmarkLocation(config, bookmark, folders, null);

    expect(queryCustom).toHaveBeenCalled();
    expect(result.explanation).toBe('Custom provider recommendation');
  });

  it('should handle ignored folder IDs', async () => {
    vi.mocked(queryOpenAI).mockResolvedValue({
      action: 'use_existing',
      targetFolderId: '3',
      explanation: 'Avoiding ignored folders'
    });

    const config = {
      provider: 'openai',
      apiKey: 'test-key',
      modelName: 'gpt-5.5'
    };

    const foldersWithIgnored = [
      { id: '1', path: 'Barre de favoris' },
      { id: '2', path: 'Barre de favoris > Ignored' },
      { id: '3', path: 'Barre de favoris > Recommended' }
    ];

    await suggestBookmarkLocation(config, bookmark, foldersWithIgnored, ['2']);

    expect(queryOpenAI).toHaveBeenCalled();
    // Check that avoidInstruction was built
    // queryOpenAI signature: (url, key, model, prompt, systemPrompt, signal, debugMode, maxTokens)
    const finalPrompt = getPromptFromProviderCall(vi.mocked(queryOpenAI));
    expect(finalPrompt).toContain('CRITICAL CONSTRAINT');
    expect(finalPrompt).toContain('avoid');
  });

  it('should NOT append avoidInstruction when ignoredFolderIds have no match in folders list', async () => {
    vi.mocked(queryOpenAI).mockResolvedValue({
      action: 'use_existing',
      targetFolderId: '1',
      explanation: 'No ignored folders matched'
    });

    const config = {
      provider: 'openai',
      apiKey: 'test-key',
      modelName: 'gpt-5.5'
    };

    const foldersWithIgnored = [
      { id: '1', path: 'Barre de favoris' },
      { id: '2', path: 'Barre de favoris > Tech' }
    ];

    // ignoredFolderIds contains IDs not present in foldersWithIgnored → ignoredPaths.length === 0
    await suggestBookmarkLocation(config, bookmark, foldersWithIgnored, ['999']);

    const finalPrompt = getPromptFromProviderCall(vi.mocked(queryOpenAI));
    // avoidInstruction should NOT be appended
    expect(finalPrompt).not.toContain('CRITICAL CONSTRAINT');
  });

  it('should handle null ignoredFolderIds without avoidInstruction', async () => {
    vi.mocked(queryOpenAI).mockResolvedValue({ action: 'use_existing', targetFolderId: '1', explanation: 'ok' });
    const config = { provider: 'openai', apiKey: 'test-key' };
    const foldersWithIgnored = [{ id: '1', path: 'Barre de favoris' }];

    await suggestBookmarkLocation(config, bookmark, foldersWithIgnored, null);

    const finalPrompt = getPromptFromProviderCall(vi.mocked(queryOpenAI));
    expect(finalPrompt).not.toContain('CRITICAL CONSTRAINT');
  });
});
