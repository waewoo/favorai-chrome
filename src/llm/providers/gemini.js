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

  if (debugMode) {
    console.log('=== DEBUG: Gemini Raw Response ===');
    console.log('Response object keys:', Object.keys(data));
    console.log('Candidates length:', data.candidates?.length);
    if (data.candidates?.[0]) {
      console.log('Candidates[0] keys:', Object.keys(data.candidates[0]));
      if (data.candidates[0].content) {
        console.log('Content keys:', Object.keys(data.candidates[0].content));
        console.log('Parts length:', data.candidates[0].content.parts?.length);
        if (data.candidates[0].content.parts?.[0]) {
          console.log('Parts[0] keys:', Object.keys(data.candidates[0].content.parts[0]));
          console.log('Text type:', typeof data.candidates[0].content.parts[0].text);
          if (typeof data.candidates[0].content.parts[0].text === 'string') {
            console.log('Text preview:', data.candidates[0].content.parts[0].text.substring(0, 300));
          }
        }
      }
    }
    console.log('==================================');
  }

  try {
    // Extract text from Gemini response structure
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
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
    throw new Error(`Gemini: ${e.message}`);
  }
}
