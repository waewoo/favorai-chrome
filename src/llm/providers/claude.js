import { cleanAndParseJSON, fetchWithTimeout, formatErrorMessage, retryTransientRequest } from '../utils.js';

export async function queryClaude(url, key, model, prompt, systemPrompt, signal, debugMode, maxTokens = 131072) {
  const endpoint = `${url.replace(/\/$/, '')}/v1/messages`;

  if (debugMode) {
    console.log('=== DEBUG: Claude (Anthropic) Request ===');
    console.log('Endpoint:', endpoint);
    console.log('Model:', model);
    console.log('System Prompt Length:', systemPrompt.length);
    console.log('User Prompt Length:', prompt.length);
    console.log('=========================================');
  }

  const response = await retryTransientRequest(async () => {
    const currentResponse = await fetchWithTimeout(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature: 0.1,
        system: systemPrompt,
        messages: [
          { role: 'user', content: prompt }
        ]
      }),
      signal
    });
    if (!currentResponse.ok) {
      const err = await currentResponse.text();
      const e = new Error(formatErrorMessage('Claude', currentResponse.status, err));
      if (currentResponse.status === 429 || currentResponse.status === 503) e.isRateLimit = true;
      throw e;
    }
    return currentResponse;
  }, { signal });
  const data = await response.json();
  try {
    return cleanAndParseJSON(data.content[0].text);
  } catch {
    throw new Error(`Claude: format de réponse invalide: ${JSON.stringify(data)}`);
  }
}
