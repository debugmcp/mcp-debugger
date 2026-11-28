/**
 * releaseAttachedTarget (issue #1325): the one release detach_from_process and
 * close_debug_session send, read back from the worker's report of it or, with
 * no report, from the request's own outcome.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  releaseAttachedTarget,
  noAnswerWithin,
  DETACH_ACKNOWLEDGEMENT_TIMEOUT_MS
} from '../../../../src/session/attach/target-release.js';
import type { IProxyManager } from '../../../../src/proxy/proxy-manager.js';

type Report = ReturnType<IProxyManager['getDetachResult']>;

/** A proxy whose disconnect answers or fails as told, and whose worker reports as told. */
function proxyThat(outcome: { fails?: string; report?: Report }) {
  const sendDapRequest = vi.fn(async () => {
    if (outcome.fails !== undefined) {
      throw new Error(outcome.fails);
    }
    return { success: true };
  });
  return {
    proxy: { sendDapRequest, getDetachResult: () => outcome.report } as unknown as IProxyManager,
    sendDapRequest
  };
}

const logger = { warn: vi.fn() };

describe('releaseAttachedTarget (issue #1325)', () => {
  it('sends a detaching disconnect under the 10 s bound', async () => {
    const { proxy, sendDapRequest } = proxyThat({});

    await releaseAttachedTarget(proxy, logger);

    expect(sendDapRequest).toHaveBeenCalledWith('disconnect', { terminateDebuggee: false }, { timeoutMs: DETACH_ACKNOWLEDGEMENT_TIMEOUT_MS });
    expect(DETACH_ACKNOWLEDGEMENT_TIMEOUT_MS).toBe(10_000);
  });

  it('reads an answered request with no report of it as released', async () => {
    // A worker that answered the request but sent no detach_result (an
    // older worker, or one whose status was lost): the answer is the proof.
    const { proxy } = proxyThat({ report: undefined });

    expect(await releaseAttachedTarget(proxy, logger)).toEqual({ fate: 'released' });
  });

  it("prefers the worker's report of the request to the request's own failure", async () => {
    // The report says why the adapter did not acknowledge it; the request's
    // failure is how the parent heard of it, and says less.
    const { proxy } = proxyThat({
      fails: 'Proxy exited',
      report: { trigger: 'detach', acknowledged: false, error: 'the adapter refused the detach' }
    });

    expect(await releaseAttachedTarget(proxy, logger)).toEqual({ fate: 'unconfirmed', reason: 'the adapter refused the detach' });
  });

  it("falls back to the request's failure when the report has no reason", async () => {
    const { proxy } = proxyThat({ fails: 'Proxy exited', report: { trigger: 'detach', acknowledged: false } });

    expect(await releaseAttachedTarget(proxy, logger)).toEqual({ fate: 'unconfirmed', reason: 'Proxy exited' });
  });

  it('states a timeout as the bound that expired', async () => {
    const { proxy } = proxyThat({ fails: "Request 'disconnect' timed out after 10s" });

    expect(await releaseAttachedTarget(proxy, logger)).toEqual({ fate: 'unconfirmed', reason: noAnswerWithin(10_000) });
  });

  it('ignores a report that is not about a detach', async () => {
    // A worker shutting down by itself reports its own disconnect.
    const { proxy } = proxyThat({ fails: 'DAP client disconnected', report: { trigger: 'shutdown', acknowledged: true, by: 'response' } });

    expect(await releaseAttachedTarget(proxy, logger)).toEqual({ fate: 'unconfirmed', reason: 'DAP client disconnected' });
  });
});
