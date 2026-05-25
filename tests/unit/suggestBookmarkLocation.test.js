import { describe, it, expect, vi, beforeEach } from 'vitest';
import { suggestBookmarkLocation } from '../../src/llm/index.js';
import { queryOpenAI } from '../../src/llm/providers/openai.js';
import { queryGemini } from '../../src/llm/providers/gemini.js';

vi.mock('../../src/llm/providers/openai.js');
vi.mock('../../src/llm/providers/gemini.js');

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
});
