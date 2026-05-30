import { cleanAndParseJSON, fetchWithTimeout, formatErrorMessage } from '../utils.js';

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

  const response = await fetchWithTimeout(endpoint, {
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
  if (!response.ok) {
    const err = await response.text();
    const e = new Error(formatErrorMessage('Claude', response.status, err));
    if (response.status === 429) e.isRateLimit = true;
    throw e;
  }
  const data = await response.json();
  try {
    return cleanAndParseJSON(data.content[0].text);
  } catch {
    throw new Error(`Claude: format de réponse invalide: ${JSON.stringify(data)}`);
  }
}
