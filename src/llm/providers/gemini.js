import { cleanAndParseJSON, fetchWithTimeout } from '../utils.js';

export async function queryGemini(url, key, model, prompt, systemPrompt, signal, debugMode, maxTokens = 131072) {
  const base = url.replace(/\/$/, '');
  const endpoint = `${base}/v1beta/models/${model}:generateContent?key=${key}`;

  if (debugMode) {
    console.log('=== DEBUG: Gemini Request ===');
    console.log('Endpoint:', endpoint);
    console.log('Model:', model);
    console.log('System Prompt Length:', systemPrompt.length);
    console.log('User Prompt Length:', prompt.length);
    console.log('============================');
  }
  const response = await fetchWithTimeout(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
        maxOutputTokens: maxTokens
      }
    }),
    signal
  });
  if (!response.ok) {
    const err = await response.text();
    const e = new Error(`Erreur Gemini (${response.status}): ${err}`);
    if (response.status === 429) e.isRateLimit = true;
    throw e;
  }
  const data = await response.json();
  try {
    return cleanAndParseJSON(data.candidates[0].content.parts[0].text);
  } catch {
    throw new Error(`Gemini: format de réponse invalide: ${JSON.stringify(data)}`);
  }
}
