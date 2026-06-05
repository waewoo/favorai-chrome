import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/popup/actions.js', () => ({
  applyActionFilter: vi.fn()
}));

import { scheduleActionFilter } from '../../src/popup/progress.js';
import { applyActionFilter } from '../../src/popup/actions.js';

describe('scheduleActionFilter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('should debounce to the latest filter value', () => {
    scheduleActionFilter('clean');
    scheduleActionFilter('structure');
    scheduleActionFilter('move');

    expect(applyActionFilter).not.toHaveBeenCalled();

    vi.advanceTimersByTime(49);
    expect(applyActionFilter).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(applyActionFilter).toHaveBeenCalledTimes(1);
    expect(applyActionFilter).toHaveBeenCalledWith('move');
  });
});
