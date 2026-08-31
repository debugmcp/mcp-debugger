import { describe, expectTypeOf, it } from 'vitest';
import type { DebugResultData } from '../../../../src/session/session-manager-core.js';

describe('DebugResultData type contract (issue #590)', () => {
  it('stays closed over the result keys written by the session layer', () => {
    expectTypeOf<keyof DebugResultData>().toEqualTypeOf<
      | 'initProgress'
      | 'proxyLogPath'
      | 'proxyLogResource'
      | 'message'
      | 'warning'
      | 'pending'
      | 'dryRun'
      | 'command'
      | 'script'
      | 'reason'
      | 'stopOnEntrySuccessful'
      | 'toolchainValidation'
      | 'breakpointsReapplied'
      | 'outputReset'
      | 'anchorResolution'
    >();
  });
});
