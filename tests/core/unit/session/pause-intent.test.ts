import { describe, expect, it, vi } from 'vitest';
import {
  armPauseIntent,
  beginProxyGeneration,
  clearPauseIntent,
  hasCurrentPauseIntent
} from '../../../../src/session/execution/pause-intent.js';

describe('generation-scoped pause intent', () => {
  it('invalidates a pending pause when a new proxy generation begins', () => {
    const session: {
      proxyGeneration?: number;
      pauseIntent?: ReturnType<typeof armPauseIntent>;
    } = {};
    beginProxyGeneration(session);
    const first = armPauseIntent(session, 'user');
    expect(hasCurrentPauseIntent(session)).toBe(true);

    beginProxyGeneration(session);

    expect(session.proxyGeneration).toBe(first.generation + 1);
    expect(session.pauseIntent).toBeUndefined();
    expect(hasCurrentPauseIntent({
      proxyGeneration: session.proxyGeneration,
      pauseIntent: first
    })).toBe(false);
  });

  it('does not clear a newer intent while an older request settles', () => {
    vi.spyOn(Date, 'now').mockReturnValueOnce(1).mockReturnValueOnce(2);
    const session: {
      proxyGeneration?: number;
      pauseIntent?: ReturnType<typeof armPauseIntent>;
    } = { proxyGeneration: 4 };
    const older = armPauseIntent(session, 'user');
    const newer = armPauseIntent(session, 'attach');

    clearPauseIntent(session, older);
    expect(session.pauseIntent).toBe(newer);
    clearPauseIntent(session, newer);
    expect(session.pauseIntent).toBeUndefined();
  });
});
