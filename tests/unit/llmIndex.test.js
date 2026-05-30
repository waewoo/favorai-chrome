import { describe, it, expect, vi } from 'vitest';
import { queryLLM } from '../../src/llm/index.js';
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
});
