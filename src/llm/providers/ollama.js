import { cleanAndParseJSON, fetchWithTimeout, formatErrorMessage, retryTransientRequest } from '../utils.js';

export async function queryOllama(url, model, prompt, systemPrompt, signal, debugMode, maxTokens = 131072) {
  const endpoint = `${url.replace(/\/$/, '')}/api/chat`;

  if (debugMode) {
    console.log('=== DEBUG: Ollama Request ===');
    console.log('Endpoint:', endpoint);
    console.log('Model:', model);
    console.log('System Prompt Length:', systemPrompt.length);
    console.log('User Prompt Length:', prompt.length);
    console.log('============================');
  }
  const response = await retryTransientRequest(async () => {
    const currentResponse = await fetchWithTimeout(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        stream: false,
        format: 'json',
        options: {
          temperature: 0.1,
          num_predict: maxTokens,
          num_ctx: 32768
        }
      }),
      signal
    });
    if (!currentResponse.ok) {
      const err = await currentResponse.text();
      const e = new Error(formatErrorMessage('Ollama', currentResponse.status, err));
      if (currentResponse.status === 429 || currentResponse.status === 503) e.isRateLimit = true;
      throw e;
    }
    return currentResponse;
  }, { signal });
  const data = await response.json();
  return cleanAndParseJSON(data.message.content);
}
