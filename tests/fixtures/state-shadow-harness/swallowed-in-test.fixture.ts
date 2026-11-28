// A test whose code makes a state transition the table does not list and
// swallows the shadow's throw. The harness must fail the test anyway.
import { it } from 'vitest';
import { SessionState } from '@debugmcp/shared';
import { StateShadow } from '../../../src/session/machine/shadow.js';

it('swallows an unlisted transition', () => {
  const shadow = new StateShadow({ logger: () => undefined });
  const session = { id: 'fixture-in-test', state: SessionState.RUNNING };
  try {
    shadow.check(session, SessionState.STOPPED, SessionState.RUNNING, { site: 'handleContinued', event: 'continued' });
  } catch {
    // swallowed, as a catch in the code under test would
  }
});
