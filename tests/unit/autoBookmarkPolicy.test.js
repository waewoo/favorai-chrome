import { describe, expect, it } from 'vitest';
import {
  AUTO_BOOKMARK_MODES,
  AUTO_BOOKMARK_POLICY_DEFAULTS,
  isBurstSizeUncertain,
  normalizeAutoBookmarkPolicy,
  shouldAutoMove
} from '../../src/background/auto-bookmark-policy.js';

describe('auto bookmark policy', () => {
  it('uses safe defaults and clamps invalid values', () => {
    expect(normalizeAutoBookmarkPolicy({
      autoBookmarkMode: 'unknown',
      autoBookmarkDailyLimit: -2,
      autoBookmarkBurstThreshold: 1,
      autoBookmarkDebounceMs: 999999,
      autoMoveConfidenceThreshold: 4
    })).toEqual({
      ...AUTO_BOOKMARK_POLICY_DEFAULTS,
      dailyLimit: 0,
      burstThreshold: 2,
      debounceMs: 60_000,
      confidenceThreshold: 1
    });
  });

  it('keeps legacy auto-move compatibility without enabling it by default', () => {
    expect(normalizeAutoBookmarkPolicy()).toEqual(AUTO_BOOKMARK_POLICY_DEFAULTS);
    expect(normalizeAutoBookmarkPolicy({ autoMoveNewBookmarks: true }).mode).toBe(AUTO_BOOKMARK_MODES.AUTO);
  });

  it('requires mode, confidence, origin certainty, and remaining budget', () => {
    const policy = { autoBookmarkMode: 'auto', autoBookmarkDailyLimit: 2, autoMoveConfidenceThreshold: 0.8 };
    expect(shouldAutoMove({ policy, confidence: 0.8, dailyCalls: 1, originCertain: true })).toBe(true);
    expect(shouldAutoMove({ policy, confidence: 0.9, dailyCalls: 2, originCertain: true })).toBe(false);
    expect(shouldAutoMove({ policy, confidence: 0.9, dailyCalls: 0, originCertain: false })).toBe(false);
    expect(shouldAutoMove({ policy: { ...policy, autoBookmarkMode: 'confirm' }, confidence: 1, dailyCalls: 0 })).toBe(false);
  });

  it('marks only configured-size bursts as uncertain', () => {
    expect(isBurstSizeUncertain(2)).toBe(false);
    expect(isBurstSizeUncertain(3)).toBe(true);
  });
});
