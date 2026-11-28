// A file whose own afterAll makes a state transition the table does not list,
// after its last test, and swallows the shadow's throw. Its test passes; the
// harness's afterAll drain must fail the file anyway.
import { afterAll, it } from 'vitest';
import { SessionState } from '@debugmcp/shared';
import { StateShadow } from '../../../src/session/machine/shadow.js';

it('passes', () => undefined);

afterAll(() => {
  const shadow = new StateShadow({ logger: () => undefined });
  const session = { id: 'fixture-after-all', state: SessionState.RUNNING };
  try {
    shadow.check(session, SessionState.STOPPED, SessionState.RUNNING, { site: 'handleContinued', event: 'continued' });
  } catch {
    // swallowed
  }
});
