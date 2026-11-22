/**
 * What the child-safe derivative changes, pinned (issue #1211). The session
 * layer reads one thing through a session's own connection: the DAP client
 * behaviour (`SessionManagerCore.clientBehaviorOf`). Everything else it reads
 * from the language's policy, which is only right while the derivative leaves
 * everything else alone. A new override here fails this test and points at
 * that seam.
 */
import { describe, it, expect } from 'vitest';
import { JsDebugAdapterPolicy, PythonAdapterPolicy, type AdapterPolicy } from '@debugmcp/shared';
import { createChildSafePolicy } from '../../../src/proxy/child-safe-policy.js';

describe('createChildSafePolicy', () => {
  it('is the policy itself for an adapter that adopts nothing in-session (debugpy)', () => {
    expect(createChildSafePolicy(PythonAdapterPolicy)).toBe(PythonAdapterPolicy);
  });

  it('changes only in-session adoption and the DAP client behaviour of a js-debug connection', () => {
    const derived = createChildSafePolicy(JsDebugAdapterPolicy) as unknown as Record<string, unknown>;
    const base = JsDebugAdapterPolicy as unknown as Record<string, unknown>;
    const changed = Object.keys({ ...base, ...derived }).filter((key) => !Object.is(derived[key], base[key])).sort();
    expect(changed).toEqual(['childSessionStrategy', 'getDapClientBehavior', 'supportsReverseStartDebugging']);
  });

  it('turns off, on such a connection, exactly the behaviour that exists for the in-session target', () => {
    const base = JsDebugAdapterPolicy.getDapClientBehavior();
    const derived = (createChildSafePolicy(JsDebugAdapterPolicy) as AdapterPolicy).getDapClientBehavior();
    expect(base.mirrorBreakpointsToChild).toBe(true);
    expect(derived.mirrorBreakpointsToChild).toBe(false);
    expect(derived.pauseAfterChildAttach).toBe(false);
    expect(derived.stackTraceRequiresChild).toBe(false);
    expect([...(derived.childRoutedCommands ?? [])]).toEqual([]);
    expect([...(derived.childRequiredCommands ?? [])]).toEqual([]);
    // Members that hold a value, not a function or a set built per call.
    const plain = (value: unknown): boolean => value === undefined || ['boolean', 'number', 'string'].includes(typeof value);
    const b = base as Record<string, unknown>;
    const d = derived as Record<string, unknown>;
    const changed = Object.keys({ ...b, ...d }).filter((key) => plain(b[key]) && plain(d[key]) && !Object.is(d[key], b[key])).sort();
    expect(changed).toEqual(['mirrorBreakpointsToChild', 'pauseAfterChildAttach', 'stackTraceRequiresChild']);
  });
});
