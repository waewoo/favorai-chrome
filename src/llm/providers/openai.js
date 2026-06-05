import { cleanAndParseJSON, fetchWithTimeout, formatErrorMessage, retryTransientRequest } from '../utils.js';

export async function queryOpenAI(url, key, model, prompt, systemPrompt, signal, debugMode, maxTokens = 131072) {
  const endpoint = `${url.replace(/\/$/, '')}/chat/completions`;

  if (debugMode) {
    console.log('=== DEBUG: OpenAI Request ===');
    console.log('Endpoint:', endpoint);
    console.log('Model:', model);
    console.log('System Prompt Length:', systemPrompt.length);
    console.log('User Prompt Length:', prompt.length);
    console.log('===========================');
  }

  const response = await retryTransientRequest(async () => {
    const currentResponse = await fetchWithTimeout(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: maxTokens
      }),
      signal
    });
    if (!currentResponse.ok) {
      const err = await currentResponse.text();
      const e = new Error(formatErrorMessage('OpenAI', currentResponse.status, err));
      if (currentResponse.status === 429 || currentResponse.status === 503) e.isRateLimit = true;
      throw e;
    }
    return currentResponse;
  }, { signal });
  const data = await response.json();
  return cleanAndParseJSON(data.choices[0].message.content);
}
