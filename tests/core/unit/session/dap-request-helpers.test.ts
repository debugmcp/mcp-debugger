/**
 * Which failed DAP requests are timeouts (isDapRequestTimeout), and which get
 * the 'timeout' argument's hint (withTimeoutHint): the worker's and the
 * parent's wordings, and a request a Deadline ended, classified by its class.
 *
 * A Deadline reaches a caller of sendDapRequest in four ways: refused or cut
 * off at its nominal end (`budget`), abandoned unanswered at its backstop
 * (`backstop`, which ProxyManager words as the adapter not responding and
 * carries as the error's cause), or given up from outside or by its owner
 * (`cancelled`, `disposed`). The first two are timeouts; the last two are
 * not: the caller gave the request up, the adapter was not left unanswering.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { deadline, DeadlineExpired, PARENT_GRACE_MS } from '@debugmcp/shared';
import { isDapRequestTimeout, withTimeoutHint } from '../../../../src/session/dap-request-helpers.js';
import { ErrorMessages } from '../../../../src/utils/error-messages.js';

afterEach(() => {
  vi.useRealTimers();
});

/** A real request through a real Deadline, left unanswered, ended the way `end` says. */
async function endedRequest(end: 'budget' | 'backstop' | 'cancelled' | 'disposed'): Promise<unknown> {
  vi.useFakeTimers();
  const outside = new AbortController();
  const d = deadline(100, { parent: outside.signal, label: 'a request' });
  let failure: unknown;
  const settle = (error: unknown): void => { failure = error; };
  if (end === 'budget') {
    // Refused at once: the deadline has passed before anything is sent.
    await vi.advanceTimersByTimeAsync(100);
    d.request(async () => 'never sent').catch(settle);
  } else {
    d.request(() => new Promise(() => {})).catch(settle);
    if (end === 'backstop') await vi.advanceTimersByTimeAsync(100 + PARENT_GRACE_MS);
    if (end === 'cancelled') outside.abort();
    if (end === 'disposed') d.dispose();
  }
  await vi.advanceTimersByTimeAsync(0);
  expect(failure).toBeInstanceOf(DeadlineExpired);
  expect((failure as DeadlineExpired).why).toBe(end);
  return failure;
}

describe('isDapRequestTimeout', () => {
  it.each(['budget', 'backstop'] as const)('a request a Deadline ended at its %s is a timeout, whatever its wording', async (end) => {
    const failure = await endedRequest(end);
    expect((failure as Error).message).not.toMatch(/timed out|did not respond/i);
    expect(isDapRequestTimeout(failure)).toBe(true);
  });

  it.each(['cancelled', 'disposed'] as const)('a request whose Deadline was %s is not a timeout', async (end) => {
    expect(isDapRequestTimeout(await endedRequest(end))).toBe(false);
  });

  it('a failure that carries a Deadline\'s end as its cause is classified by it', () => {
    const backstop = new DeadlineExpired('backstop', 1000);
    expect(isDapRequestTimeout(new Error(ErrorMessages.dapRequestNoAnswerWithin('stackTrace', 1000, PARENT_GRACE_MS), { cause: backstop })))
      .toBe(true);
    // The class decides even when the wording would say otherwise.
    expect(isDapRequestTimeout(new Error('the request timed out', { cause: new DeadlineExpired('cancelled', 1000) }))).toBe(false);
    expect(isDapRequestTimeout(new Error('wrapped', { cause: new Error('wrapped again', { cause: new DeadlineExpired('budget', 5) }) })))
      .toBe(true);
  });

  it('any other failure is classified by its wording, as before', () => {
    expect(isDapRequestTimeout("Request 'evaluate' timed out after 500ms")).toBe(true);
    expect(isDapRequestTimeout(new Error(ErrorMessages.dapRequestTimeout('evaluate', 35)))).toBe(true);
    expect(isDapRequestTimeout(new Error('Unable to evaluate: name is not defined'))).toBe(false);
    expect(isDapRequestTimeout('pause refused')).toBe(false);
  });
});

describe('withTimeoutHint', () => {
  const hint = ErrorMessages.dapRequestTimeoutHint();

  it('hints at the timeout argument for a Deadline\'s budget or backstop, given the failure', async () => {
    for (const end of ['budget', 'backstop'] as const) {
      const failure = await endedRequest(end);
      expect(withTimeoutHint('Evaluation failed', failure)).toBe(`Evaluation failed. ${hint}`);
    }
  });

  it('gives no hint for a Deadline that was cancelled or disposed', async () => {
    for (const end of ['cancelled', 'disposed'] as const) {
      expect(withTimeoutHint('Evaluation failed', await endedRequest(end))).toBe('Evaluation failed');
    }
  });

  it('classifies any other failure by the message shown, as before', () => {
    expect(withTimeoutHint("Request 'evaluate' timed out after 500ms")).toBe(`Request 'evaluate' timed out after 500ms. ${hint}`);
    expect(withTimeoutHint("Request 'evaluate' timed out after 500ms", new Error('anything'))).toBe(
      `Request 'evaluate' timed out after 500ms. ${hint}`
    );
    expect(withTimeoutHint('Syntax error in expression: x', new Error('Syntax error'))).toBe('Syntax error in expression: x');
  });
});
