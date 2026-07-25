import {
  AUTO_BOOKMARK_BURST_THRESHOLD_DEFAULT,
  AUTO_BOOKMARK_DAILY_LIMIT_DEFAULT,
  AUTO_BOOKMARK_DEBOUNCE_MS_DEFAULT,
  AUTO_BOOKMARK_RETENTION_MS_DEFAULT,
  AUTO_MOVE_CONFIDENCE_THRESHOLD_DEFAULT
} from '../utils/constants.js';

export const AUTO_BOOKMARK_MODES = Object.freeze({
  CONFIRM: 'confirm',
  AUTO: 'auto'
});

export const AUTO_BOOKMARK_POLICY_DEFAULTS = Object.freeze({
  mode: AUTO_BOOKMARK_MODES.CONFIRM,
  dailyLimit: AUTO_BOOKMARK_DAILY_LIMIT_DEFAULT,
  debounceMs: AUTO_BOOKMARK_DEBOUNCE_MS_DEFAULT,
  burstThreshold: AUTO_BOOKMARK_BURST_THRESHOLD_DEFAULT,
  retentionMs: AUTO_BOOKMARK_RETENTION_MS_DEFAULT,
  confidenceThreshold: AUTO_MOVE_CONFIDENCE_THRESHOLD_DEFAULT
});

function boundedInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeMode(value, legacyAutoMove = false) {
  if (value === AUTO_BOOKMARK_MODES.AUTO || value === AUTO_BOOKMARK_MODES.CONFIRM) return value;
  return legacyAutoMove ? AUTO_BOOKMARK_MODES.AUTO : AUTO_BOOKMARK_MODES.CONFIRM;
}

export function normalizeAutoBookmarkPolicy(values = {}) {
  const policy = {
    mode: normalizeMode(values.autoBookmarkMode, values.autoMoveNewBookmarks === true),
    dailyLimit: boundedInteger(values.autoBookmarkDailyLimit, AUTO_BOOKMARK_POLICY_DEFAULTS.dailyLimit, 0, 1000),
    debounceMs: boundedInteger(values.autoBookmarkDebounceMs, AUTO_BOOKMARK_POLICY_DEFAULTS.debounceMs, 0, 60_000),
    burstThreshold: boundedInteger(values.autoBookmarkBurstThreshold, AUTO_BOOKMARK_POLICY_DEFAULTS.burstThreshold, 2, 100),
    retentionMs: boundedInteger(values.autoBookmarkRetentionMs, AUTO_BOOKMARK_POLICY_DEFAULTS.retentionMs, 60_000, 30 * 24 * 60 * 60 * 1000),
    confidenceThreshold: normalizeConfidence(values.autoMoveConfidenceThreshold)
  };

  return Object.freeze(policy);
}

function normalizeConfidence(value) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return AUTO_BOOKMARK_POLICY_DEFAULTS.confidenceThreshold;
  return Math.min(1, Math.max(0, parsed));
}

export function shouldAutoMove({ policy, confidence, originCertain = true, dailyCalls = 0 }) {
  const normalized = normalizeAutoBookmarkPolicy(policy);
  const normalizedConfidence = normalizeConfidence(confidence);
  return normalized.mode === AUTO_BOOKMARK_MODES.AUTO &&
    originCertain &&
    normalized.dailyLimit > dailyCalls &&
    normalizedConfidence >= normalized.confidenceThreshold;
}

export function isBurstSizeUncertain(size, policy = {}) {
  const normalized = normalizeAutoBookmarkPolicy(policy);
  return Number.isFinite(size) && size >= normalized.burstThreshold;
}
