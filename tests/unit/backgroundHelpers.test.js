import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mergeAnalysisConfigWithStoredApiKey, sanitizeAnalysisConfig, sanitizeLlmConfig } from '../../src/background/config.js';
import { isIgnorableRuntimeMessageError, sendRuntimeMessage } from '../../src/background/runtime-messaging.js';
import { normalizeInterruptedAnalysisStatus } from '../../src/background/status.js';

describe('background helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sanitizes analysis config and strips apiKey from the persisted snapshot', () => {
    const sanitized = sanitizeAnalysisConfig({
      provider: '  custom  ',
      apiUrl: '  https://example.com  ',
      apiKey: 'super-secret',
      modelName: '  model-x ',
      debugMode: true,
      maxTokens: '8192',
      linkCheckBatchSize: '12',
      promptMinimal: '  min ',
      promptComplete: '  complete ',
      promptSuggest: '  suggest '
    });

    expect(sanitized).toEqual({
      provider: 'custom',
      apiUrl: 'https://example.com',
      apiKey: '',
      modelName: 'model-x',
      debugMode: true,
      maxTokens: 8192,
      linkCheckBatchSize: 12,
      promptMinimal: 'min',
      promptComplete: 'complete',
      promptSuggest: 'suggest'
    });
  });

  it('uses safe defaults when analysis config contains invalid values', () => {
    expect(sanitizeLlmConfig({
      provider: 'not-a-provider',
      maxTokens: '-10',
      linkCheckBatchSize: '0'
    })).toEqual({
      provider: 'google',
      apiUrl: '',
      apiKey: '',
      modelName: '',
      debugMode: false,
      maxTokens: 32768,
      linkCheckBatchSize: 24,
      promptMinimal: '',
      promptComplete: '',
      promptSuggest: ''
    });
  });

  it('falls back to the default provider when provider input is empty', () => {
    expect(sanitizeLlmConfig({
      provider: '',
      apiUrl: 123,
      apiKey: null,
      modelName: undefined
    }, { defaultProvider: 'claude' })).toEqual({
      provider: 'claude',
      apiUrl: '',
      apiKey: '',
      modelName: '',
      debugMode: false,
      maxTokens: 32768,
      linkCheckBatchSize: 24,
      promptMinimal: '',
      promptComplete: '',
      promptSuggest: ''
    });
  });

  it('merges the stored apiKey without mutating the sanitized snapshot', () => {
    const merged = mergeAnalysisConfigWithStoredApiKey({ provider: 'openai', apiKey: 'from-ui' }, 'stored-key');
    expect(merged.apiKey).toBe('stored-key');
    expect(merged.provider).toBe('openai');
  });

  it('marks interrupted analyses as retryable and keeps existing logs intact', () => {
    const originalStatus = {
      state: 'analyzing',
      mode: 'complete',
      percentage: 42,
      logs: [{ text: 'Working...', type: 'info' }],
      actions: [{ id: 'act_1' }],
      explanation: 'pending',
      lastError: null,
      retryable: false,
      lastConfig: { provider: 'openai' },
      lastCheckDeadLinks: true
    };

    const { status, normalized } = normalizeInterruptedAnalysisStatus(
      originalStatus,
      'Analyse interrompue.',
      false
    );

    expect(normalized).toBe(true);
    expect(status.state).toBe('idle');
    expect(status.percentage).toBe(0);
    expect(status.actions).toEqual([]);
    expect(status.explanation).toBe('');
    expect(status.lastError).toBe('Analyse interrompue.');
    expect(status.retryable).toBe(true);
    expect(status.mode).toBe('complete');
    expect(status.lastConfig).toEqual({ provider: 'openai' });
    expect(status.lastCheckDeadLinks).toBe(true);
    expect(status.logs).toEqual([
      { text: 'Working...', type: 'info' },
      { text: 'Analyse interrompue.', type: 'warning' }
    ]);
    expect(originalStatus.state).toBe('analyzing');
  });

  it('does not normalize when an analysis controller is still active', () => {
    const status = { state: 'analyzing', logs: [] };
    const result = normalizeInterruptedAnalysisStatus(status, 'Analyse interrompue.', true);
    expect(result.normalized).toBe(false);
    expect(result.status).toBe(status);
  });

  it('treats ignorable runtime message failures as expected popup-closed cases', () => {
    expect(isIgnorableRuntimeMessageError(new Error('Could not establish connection. Receiving end does not exist.'))).toBe(true);
    expect(isIgnorableRuntimeMessageError('The message port closed before a response was received.')).toBe(true);
    expect(isIgnorableRuntimeMessageError(new Error('Random failure'))).toBe(false);
  });

  it('silently ignores expected runtime message failures and logs unexpected ones', async () => {
    chrome.runtime.sendMessage.mockRejectedValueOnce(new Error('Receiving end does not exist.'));
    await expect(sendRuntimeMessage({ action: 'progress_update' }, 'progress update')).resolves.toBe(false);
    expect(console.warn).not.toHaveBeenCalled();

    chrome.runtime.sendMessage.mockRejectedValueOnce(new Error('Unexpected runtime failure'));
    await expect(sendRuntimeMessage({ action: 'analysis_failed' }, 'analysis_failed notification')).resolves.toBe(false);
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it('treats missing runtime message details as unexpected errors', async () => {
    chrome.runtime.sendMessage.mockRejectedValueOnce('boom');
    await expect(sendRuntimeMessage({ action: 'analysis_failed' }, 'analysis_failed notification')).resolves.toBe(false);
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it('returns the original status when interruption normalization is not applicable', () => {
    const idleStatus = { state: 'idle', logs: null };
    const result = normalizeInterruptedAnalysisStatus(idleStatus, 'Analyse interrompue.', false);
    expect(result.normalized).toBe(false);
    expect(result.status).toBe(idleStatus);
  });

  it('normalizes interrupted analyses even when logs are missing or not an array', () => {
    const result = normalizeInterruptedAnalysisStatus(
      { state: 'analyzing', logs: null },
      'Analyse interrompue.',
      false
    );

    expect(result.normalized).toBe(true);
    expect(result.status.logs).toEqual([
      { text: 'Analyse interrompue.', type: 'warning' }
    ]);
  });

  it('treats a missing runtime error payload as unexpected', () => {
    expect(isIgnorableRuntimeMessageError(undefined)).toBe(false);
  });
});
