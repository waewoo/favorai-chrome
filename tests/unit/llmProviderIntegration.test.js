import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { queryLLM } from '../../src/llm/index.js';

describe('queryLLM and provider contract', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds the OpenAI request, parses the response, and validates the business contract', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              reorganizedTree: { id: '0', title: 'root', children: [] },
              explanation: 'Aucune modification nécessaire.'
            })
          }
        }]
      })
    });

    const result = await queryLLM(
      {
        provider: 'openai',
        apiUrl: 'https://api.openai.test/v1',
        apiKey: 'test-key',
        modelName: 'test-model',
        maxTokens: 512
      },
      { id: '0', title: 'root', children: [] },
      'minimal',
      null
    );

    expect(result).toEqual({
      reorganizedTree: { id: '0', title: 'root', children: [] },
      explanation: 'Aucune modification nécessaire.'
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const [endpoint, request] = global.fetch.mock.calls[0];
    const body = JSON.parse(request.body);
    expect(endpoint).toBe('https://api.openai.test/v1/chat/completions');
    expect(body).toMatchObject({
      model: 'test-model',
      max_tokens: 512,
      response_format: { type: 'json_object' }
    });
    expect(body.messages).toHaveLength(2);
  });
});
