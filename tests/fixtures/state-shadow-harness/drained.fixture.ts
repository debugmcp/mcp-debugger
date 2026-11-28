// The control: a test that provokes the same failure on purpose and claims it
// from the queue. The harness must let it pass.
import { expect, it } from 'vitest';
import { SessionState } from '@debugmcp/shared';
import { StateShadow, takeStrictFailures } from '../../../src/session/machine/shadow.js';

it('claims the failure it provoked', () => {
  const shadow = new StateShadow({ logger: () => undefined });
  const session = { id: 'fixture-drained', state: SessionState.RUNNING };
  try {
    shadow.check(session, SessionState.STOPPED, SessionState.RUNNING, { site: 'handleContinued', event: 'continued' });
  } catch {
    // swallowed
  }
  expect(takeStrictFailures().map((record) => record.outcome)).toEqual(['no-row']);
});
