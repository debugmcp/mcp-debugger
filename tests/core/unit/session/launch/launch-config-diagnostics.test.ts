/**
 * collectLaunchConfigNotices turns the adapter's per-key diagnostics into the
 * start_debugging warning by matching them against the caller's launch keys.
 * A scope: 'launch' diagnostic is about the launch as a whole (issue #796) and
 * must reach the warning with no caller key to match.
 */
import { describe, it, expect } from 'vitest';
import type { IDebugAdapter, LanguageSpecificLaunchConfig } from '@debugmcp/shared';
import { collectLaunchConfigNotices } from '../../../../../src/session/launch/launch-config-diagnostics.js';

describe('collectLaunchConfigNotices — launch-scoped diagnostics (issue #796)', () => {
  it('renders a scope: launch diagnostic as-is even though no caller key matches it', () => {
    const adapter = {
      supportedLaunchKeys: ['program'],
      consumeLaunchConfigDiagnostics: () => [
        { key: 'exitcode-shim.cjs', scope: 'launch' as const, message: 'exit codes will not be captured: exitcode-shim.cjs not found (looked in /a, /b)' }
      ]
    } as unknown as IDebugAdapter;

    const notices = collectLaunchConfigNotices(adapter, {}, { program: '/app.js' } as LanguageSpecificLaunchConfig);

    expect(notices).toEqual(['exit codes will not be captured: exitcode-shim.cjs not found (looked in /a, /b)']);
  });

  it('still matches ordinary diagnostics on the caller key only', () => {
    const adapter = {
      supportedLaunchKeys: ['program'],
      consumeLaunchConfigDiagnostics: () => [{ key: 'runtimeArgs', message: 'expected an array of strings' }]
    } as unknown as IDebugAdapter;

    expect(collectLaunchConfigNotices(adapter, {}, { program: '/app.js' } as LanguageSpecificLaunchConfig)).toEqual([]);
  });
});
