import { cleanAndParseJSON, fetchWithTimeout } from '../utils.js';

export async function queryCustom(url, key, model, prompt, systemPrompt, signal, debugMode, maxTokens = 131072) {
  let endpoint = url.trim();
  if (endpoint.endsWith('/v1')) {
    endpoint = `${endpoint}/chat/completions`;
  } else if (!endpoint.includes('/chat/completions') && !endpoint.includes('/completions')) {
    endpoint = `${endpoint.replace(/\/$/, '')}/v1/chat/completions`;
  }

  if (debugMode) {
    console.log('=== DEBUG: Custom Provider Request ===');
    console.log('Endpoint:', endpoint);
    console.log('Model:', model);
    console.log('System Prompt Length:', systemPrompt.length);
    console.log('User Prompt Length:', prompt.length);
    console.log('=====================================');
  }

  const headers = { 'Content-Type': 'application/json' };
  if (key) headers['Authorization'] = `Bearer ${key}`;

  const response = await fetchWithTimeout(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: model || 'custom-model',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      max_tokens: maxTokens
    }),
    signal
  });
  if (!response.ok) {
    const err = await response.text();
    const e = new Error(`Erreur Endpoint Custom (${response.status}): ${err}`);
    if (response.status === 429) e.isRateLimit = true;
    throw e;
  }
  const data = await response.json();
  if (data.choices?.[0]?.message) return cleanAndParseJSON(data.choices[0].message.content);
  if (typeof data === 'string') return cleanAndParseJSON(data);
  return data;
}
