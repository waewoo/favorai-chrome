import { cleanAndParseJSON, fetchWithTimeout, formatErrorMessage, retryTransientRequest } from '../utils.js';

export async function queryGemini(url, key, model, prompt, systemPrompt, signal, debugMode, maxTokens = 131072) {
  const base = url.replace(/\/$/, '');
  const endpoint = `${base}/v1beta/models/${model}:generateContent?key=${key}`;

  if (debugMode) {
    console.log('=== DEBUG: Gemini Request ===');
    console.log('Endpoint:', `${base}/v1beta/models/${model}:generateContent?key=***`);
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
    if (!currentResponse.ok) {
      const err = await currentResponse.text();
      const e = new Error(formatErrorMessage('Gemini', currentResponse.status, err));
      if (currentResponse.status === 429 || currentResponse.status === 503) e.isRateLimit = true;
      throw e;
    }
    return currentResponse;
  }, { signal });
  const data = await response.json();
  const candidate = data.candidates?.[0];
  const finishReason = candidate?.finishReason;
  const isTokenLimit = finishReason === 'MAX_TOKENS' || finishReason === 'MAX_OUTPUT_TOKENS';

  if (debugMode) {
    console.log('=== DEBUG: Gemini Raw Response ===');
    console.log('Response object keys:', Object.keys(data));
    console.log('Candidates length:', data.candidates?.length);
    console.log('Finish reason:', finishReason);
    console.log('Finish message:', candidate?.finishMessage);
    console.log('Usage metadata:', data.usageMetadata);
    if (candidate) {
      console.log('Candidates[0] keys:', Object.keys(candidate));
      if (candidate.content) {
        console.log('Content keys:', Object.keys(candidate.content));
        console.log('Parts length:', candidate.content.parts?.length);
        if (candidate.content.parts?.[0]) {
          console.log('Parts[0] keys:', Object.keys(candidate.content.parts[0]));
          console.log('Text type:', typeof candidate.content.parts[0].text);
          if (typeof candidate.content.parts[0].text === 'string') {
            console.log('Text preview:', candidate.content.parts[0].text.substring(0, 300));
          }
        }
      }
    }
    console.log('==================================');
  }

  try {
    // Extract text from Gemini response structure
    const text = candidate?.content?.parts
      ?.map(part => part?.text)
      .filter(partText => typeof partText === 'string')
      .join('');
    if (!text || typeof text !== 'string') {
      throw new Error(`Missing or invalid text: ${typeof text}`);
    }
    return cleanAndParseJSON(text);
  } catch (e) {
    if (debugMode) {
      console.error('=== DEBUG: Gemini Parse Error ===');
      console.error('Error:', e.message);
      console.error('Full data:', data);
      console.error('==================================');
    }
    const error = new Error(isTokenLimit
      ? 'Gemini: La réponse a atteint la limite de tokens de sortie.'
      : `Gemini: ${e.message}`);
    if (isTokenLimit || e.isTokenLimit) error.isTokenLimit = true;
    throw error;
  }
}
