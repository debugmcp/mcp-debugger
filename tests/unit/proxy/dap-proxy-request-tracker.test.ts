/**
 * Unit tests for RequestTracker
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { RequestTracker, CallbackRequestTracker } from '../../../src/proxy/dap-proxy-request-tracker.js';

describe('RequestTracker', () => {
  let tracker: RequestTracker;

  beforeEach(() => {
    vi.useFakeTimers();
    tracker = new RequestTracker(1000); // 1 second timeout for tests
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('track', () => {
    it('should track a new request', () => {
      tracker.track('req-1', 'continue');

      expect(tracker.isPending('req-1')).toBe(true);
      expect(tracker.getPendingCount()).toBe(1);
    });

    it('should replace existing request with same ID', () => {
      tracker.track('req-1', 'continue');
      const count1 = tracker.getPendingCount();
      
      tracker.track('req-1', 'evaluate'); // Same ID, different command
      const count2 = tracker.getPendingCount();

      expect(count1).toBe(1);
      expect(count2).toBe(1); // Still only one request
      expect(tracker.isPending('req-1')).toBe(true);
    });

    it('should track multiple requests', () => {
      tracker.track('req-1', 'continue');
      tracker.track('req-2', 'evaluate');
      tracker.track('req-3', 'setBreakpoints');

      expect(tracker.getPendingCount()).toBe(3);
      expect(tracker.isPending('req-1')).toBe(true);
      expect(tracker.isPending('req-2')).toBe(true);
      expect(tracker.isPending('req-3')).toBe(true);
    });

    it('should use custom timeout when provided', () => {
      tracker.track('req-1', 'continue', 5000); // 5 second timeout

      const pending = tracker.getPending();
      const request = pending.get('req-1');
      expect(request).toBeDefined();
      expect(request!.requestId).toBe('req-1');
      expect(request!.command).toBe('continue');
    });

    it('should automatically remove request after timeout', () => {
      tracker.track('req-1', 'continue', 1000);

      expect(tracker.isPending('req-1')).toBe(true);

      // Advance time past timeout
      vi.advanceTimersByTime(1001);

      expect(tracker.isPending('req-1')).toBe(false);
    });
  });

  describe('complete', () => {
    it('should remove completed request', () => {
      tracker.track('req-1', 'continue');
      expect(tracker.isPending('req-1')).toBe(true);

      tracker.complete('req-1');
      expect(tracker.isPending('req-1')).toBe(false);
      expect(tracker.getPendingCount()).toBe(0);
    });

    it('should clear timeout when completing request', () => {
      tracker.track('req-1', 'continue', 1000);
      tracker.complete('req-1');

      // Advance time past what would have been timeout
      vi.advanceTimersByTime(2000);

      // Request should still be gone (not re-added by timeout)
      expect(tracker.isPending('req-1')).toBe(false);
    });

    it('should handle completing non-existent request', () => {
      expect(() => tracker.complete('non-existent')).not.toThrow();
    });
  });

  describe('clear', () => {
    it('should remove all pending requests', () => {
      tracker.track('req-1', 'continue');
      tracker.track('req-2', 'evaluate');
      tracker.track('req-3', 'setBreakpoints');

      expect(tracker.getPendingCount()).toBe(3);

      tracker.clear();

      expect(tracker.getPendingCount()).toBe(0);
      expect(tracker.isPending('req-1')).toBe(false);
      expect(tracker.isPending('req-2')).toBe(false);
      expect(tracker.isPending('req-3')).toBe(false);
    });

    it('should clear all timeouts', () => {
      tracker.track('req-1', 'continue', 1000);
      tracker.track('req-2', 'evaluate', 1000);
      
      tracker.clear();

      // Advance time past timeout
      vi.advanceTimersByTime(2000);

      // No requests should be present
      expect(tracker.getPendingCount()).toBe(0);
    });
  });

  describe('getPending', () => {
    it('should return copy of pending requests', () => {
      tracker.track('req-1', 'continue');
      tracker.track('req-2', 'evaluate');

      const pending = tracker.getPending();
      expect(pending.size).toBe(2);
      expect(pending.get('req-1')?.command).toBe('continue');
      expect(pending.get('req-2')?.command).toBe('evaluate');

      // Modifying the returned map should not affect the tracker
      pending.clear();
      expect(tracker.getPendingCount()).toBe(2);
    });
  });

  describe('getElapsedTime', () => {
    it('should return elapsed time for pending request', () => {
      const startTime = Date.now();
      vi.setSystemTime(startTime);

      tracker.track('req-1', 'continue');

      // Advance time by 500ms
      vi.setSystemTime(startTime + 500);

      const elapsed = tracker.getElapsedTime('req-1');
      expect(elapsed).toBe(500);
    });

    it('should return null for non-existent request', () => {
      const elapsed = tracker.getElapsedTime('non-existent');
      expect(elapsed).toBeNull();
    });
  });
});

describe('CallbackRequestTracker', () => {
  let tracker: CallbackRequestTracker;
  let timeoutCallback: Mock;

  beforeEach(() => {
    vi.useFakeTimers();
    timeoutCallback = vi.fn();
    tracker = new CallbackRequestTracker(timeoutCallback, 1000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should call timeout callback when request times out', () => {
    tracker.track('req-1', 'continue', 1000);

    expect(timeoutCallback).not.toHaveBeenCalled();

    // Advance time past timeout
    vi.advanceTimersByTime(1001);

    expect(timeoutCallback).toHaveBeenCalledWith('req-1', 'continue');
    expect(timeoutCallback).toHaveBeenCalledTimes(1);
    expect(tracker.isPending('req-1')).toBe(false);
  });

  it('should not call timeout callback if request is completed', () => {
    tracker.track('req-1', 'continue', 1000);
    tracker.complete('req-1');

    // Advance time past timeout
    vi.advanceTimersByTime(2000);

    expect(timeoutCallback).not.toHaveBeenCalled();
  });

  it('should handle multiple timeouts', () => {
    tracker.track('req-1', 'continue', 500);
    tracker.track('req-2', 'evaluate', 1000);
    tracker.track('req-3', 'setBreakpoints', 1500);

    // Advance to trigger first timeout
    vi.advanceTimersByTime(501);
    expect(timeoutCallback).toHaveBeenCalledWith('req-1', 'continue');
    expect(timeoutCallback).toHaveBeenCalledTimes(1);

    // Advance to trigger second timeout
    vi.advanceTimersByTime(500);
    expect(timeoutCallback).toHaveBeenCalledWith('req-2', 'evaluate');
    expect(timeoutCallback).toHaveBeenCalledTimes(2);

    // Complete third request before timeout
    tracker.complete('req-3');

    // Advance past third timeout
    vi.advanceTimersByTime(1000);
    expect(timeoutCallback).toHaveBeenCalledTimes(2); // Still only 2
  });
});
