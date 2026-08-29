/**
 * buildLogpointDowngradeLaunchWarning (issue #469): the deferred
 * set_breakpoint warning ("validated against the adapter's capabilities at
 * launch") must actually deliver its verdict on the start_debugging
 * response when the live adapter cannot do logpoints.
 */
import { describe, it, expect } from 'vitest';
import { buildLogpointDowngradeLaunchWarning } from '../../../../src/session/breakpoints/launch-warnings.js';
import type { ManagedSession } from '../../../../src/session/session-store.js';

type BuilderSession = {
  language: string;
  adapterCapabilities?: Record<string, unknown>;
  breakpoints: Map<string, { file: string; line: number; logMessage?: string }>;
};

function build(session: BuilderSession): string | undefined {
  // The builder is a free function over session state, so a bare literal
  // standing in for the three fields it reads keeps this a pure unit test.
  return buildLogpointDowngradeLaunchWarning(
    session as unknown as Pick<ManagedSession, 'breakpoints' | 'adapterCapabilities' | 'language'>
  );
}

const logpoint = { file: '/proj/examples/ruby/fizzbuzz.rb', line: 16, logMessage: 'value={value}' };

describe('buildLogpointDowngradeLaunchWarning', () => {
  it('warns when the live adapter does not advertise supportsLogPoints', () => {
    const warning = build({
      language: 'ruby',
      adapterCapabilities: { supportsFunctionBreakpoints: true },
      breakpoints: new Map([['a', logpoint]])
    });
    expect(warning).toMatch(/fizzbuzz\.rb:16/);
    expect(warning).toMatch(/downgraded to pausing breakpoint/);
    expect(warning).toMatch(/PAUSE/);
  });

  it('stays silent when the adapter advertises logpoint support', () => {
    expect(
      build({
        language: 'python',
        adapterCapabilities: { supportsLogPoints: true },
        breakpoints: new Map([['a', logpoint]])
      })
    ).toBeUndefined();
  });

  it('stays silent when no logpoints exist', () => {
    expect(
      build({
        language: 'ruby',
        adapterCapabilities: {},
        breakpoints: new Map([['a', { file: '/proj/x.rb', line: 3 }]])
      })
    ).toBeUndefined();
  });

  it('stays silent before capabilities are known', () => {
    expect(
      build({ language: 'ruby', breakpoints: new Map([['a', logpoint]]) })
    ).toBeUndefined();
  });

  it('names every downgraded logpoint', () => {
    const warning = build({
      language: 'ruby',
      adapterCapabilities: {},
      breakpoints: new Map([
        ['a', logpoint],
        ['b', { file: '/proj/lib/other.rb', line: 42, logMessage: 'hi' }]
      ])
    });
    expect(warning).toMatch(/fizzbuzz\.rb:16/);
    expect(warning).toMatch(/other\.rb:42/);
  });
});
