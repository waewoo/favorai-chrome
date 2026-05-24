import { describe, it, expect } from 'vitest';
import { resolveParentId } from '../../src/background/apply.js';

describe('resolveParentId', () => {
  it('should return 1 as a fallback for falsy IDs', () => {
    expect(resolveParentId(null, {})).toBe('1');
    expect(resolveParentId(undefined, {})).toBe('1');
    expect(resolveParentId('', {})).toBe('1');
  });

  it('should resolve temporary IDs using the provided idMap', () => {
    const idMap = { 'new_123': '55' };
    expect(resolveParentId('new_123', idMap)).toBe('55');
  });

  it('should return the original ID if it does not start with the new folder prefix', () => {
    expect(resolveParentId('10', {})).toBe('10');
  });
});
