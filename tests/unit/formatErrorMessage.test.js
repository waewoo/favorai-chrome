import { describe, it, expect } from 'vitest';
import { formatErrorMessage } from '../../src/llm/utils.js';

describe('formatErrorMessage', () => {
  it('should return formatted error with HTTP status description when payload is not JSON', () => {
    const result = formatErrorMessage('Gemini', 503, 'Service Unavailable');
    expect(result).toBe('Erreur Gemini (503: Service Unavailable)');
  });

  it('should extract error message from JSON error.message field', () => {
    const payload = JSON.stringify({ error: { message: 'API key invalid' } });
    const result = formatErrorMessage('OpenAI', 401, payload);
    expect(result).toBe('Erreur OpenAI (401: API key invalid)');
  });

  it('should extract error message from JSON message field', () => {
    const payload = JSON.stringify({ message: 'Rate limit exceeded' });
    const result = formatErrorMessage('Claude', 429, payload);
    expect(result).toBe('Erreur Claude (429: Rate limit exceeded)');
  });

  it('should extract error message from JSON error field (string)', () => {
    const payload = JSON.stringify({ error: 'Quota exceeded' });
    const result = formatErrorMessage('Mistral', 400, payload);
    expect(result).toBe('Erreur Mistral (400: Quota exceeded)');
  });

  it('should fall back to status description if extracted message is too long', () => {
    const longMessage = 'x'.repeat(300);
    const payload = JSON.stringify({ error: { message: longMessage } });
    const result = formatErrorMessage('DeepSeek', 500, payload);
    expect(result).toBe('Erreur DeepSeek (500: Server Error)');
  });

  it('should use plain text if it is short and contains no HTML, even if JSON parsing fails', () => {
    const result = formatErrorMessage('Ollama', 502, 'not valid json {');
    expect(result).toBe('Erreur Ollama (502: not valid json {)');
  });

  it('should use plain text response if it is short and does not contain HTML', () => {
    const result = formatErrorMessage('Custom', 500, 'Connection timeout');
    expect(result).toBe('Erreur Custom (500: Connection timeout)');
  });

  it('should fall back to status description for HTML error pages', () => {
    const htmlError = '<html><body>500 Internal Server Error</body></html>';
    const result = formatErrorMessage('Gemini', 500, htmlError);
    expect(result).toBe('Erreur Gemini (500: Server Error)');
  });

  it('should use default status for unknown HTTP codes', () => {
    const result = formatErrorMessage('Provider', 999, 'Unknown error');
    expect(result).toBe('Erreur Provider (999: Unknown error)');
  });

  it('should handle empty payload gracefully', () => {
    const result = formatErrorMessage('OpenAI', 400, '');
    expect(result).toBe('Erreur OpenAI (400: Bad Request)');
  });

  it('should handle null values in error object', () => {
    const payload = JSON.stringify({ error: { message: null } });
    const result = formatErrorMessage('Claude', 500, payload);
    expect(result).toBe('Erreur Claude (500: Server Error)');
  });

  it('should prioritize error.message over other fields', () => {
    const payload = JSON.stringify({
      error: { message: 'Specific error' },
      message: 'Generic error'
    });
    const result = formatErrorMessage('Mistral', 400, payload);
    expect(result).toBe('Erreur Mistral (400: Specific error)');
  });
});
