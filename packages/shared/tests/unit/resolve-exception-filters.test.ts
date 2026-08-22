/**
 * Guardrail for the per-language breakOnExceptions → DAP filter mapping
 * (issue #220). Each policy's exceptionFilters table is asserted exactly:
 * a change here must be a deliberate decision, not a side effect.
 */
import { describe, it, expect } from 'vitest';
import type { AdapterPolicy, ExceptionBreakMode } from '../../src/index.js';
import {
  resolveExceptionFilters,
  DefaultAdapterPolicy,
  PythonAdapterPolicy,
  JsDebugAdapterPolicy,
  GoAdapterPolicy,
  JavaAdapterPolicy,
  DotnetAdapterPolicy,
  RubyAdapterPolicy,
  RustAdapterPolicy,
  CppAdapterPolicy,
  MockAdapterPolicy
} from '../../src/index.js';

interface PolicyExpectation {
  name: string;
  policy: AdapterPolicy;
  uncaught: string[];
  all: string[];
  /** Launch-session default applied when the user didn't pass breakOnExceptions (issue #244) */
  defaultMode: ExceptionBreakMode | undefined;
}

const EXPECTATIONS: PolicyExpectation[] = [
  { name: 'python', policy: PythonAdapterPolicy, uncaught: ['uncaught'], all: ['raised', 'uncaught'], defaultMode: 'uncaught' },
  { name: 'js-debug', policy: JsDebugAdapterPolicy, uncaught: ['uncaught'], all: ['all'], defaultMode: 'uncaught' },
  // Delve's real filter IDs (dlv 1.26); shorthand 'panic'/'fatal' was silently ignored by Delve
  { name: 'go', policy: GoAdapterPolicy, uncaught: ['unrecovered-panic', 'runtime-fatal-throw'], all: ['unrecovered-panic', 'runtime-fatal-throw'], defaultMode: 'uncaught' },
  { name: 'java', policy: JavaAdapterPolicy, uncaught: ['uncaught'], all: ['caught', 'uncaught'], defaultMode: 'uncaught' },
  { name: 'dotnet', policy: DotnetAdapterPolicy, uncaught: ['user-unhandled'], all: ['all'], defaultMode: 'uncaught' },
  // Ruby: no uncaught-only filter in rdbg → no launch default; crashes run to termination
  { name: 'ruby', policy: RubyAdapterPolicy, uncaught: [], all: ['any'], defaultMode: undefined },
  { name: 'rust', policy: RustAdapterPolicy, uncaught: ['rust_panic'], all: ['rust_panic', 'cpp_throw'], defaultMode: 'uncaught' },
  // Cpp: LLDB has no uncaught-only C++ filter — cpp_throw fires on every throw,
  // and uncaught exceptions reach std::terminate -> SIGABRT, which LLDB stops
  // on natively. So 'uncaught' maps to NO filters (issue #244 default).
  { name: 'cpp', policy: CppAdapterPolicy, uncaught: [], all: ['cpp_throw'], defaultMode: 'uncaught' },
  { name: 'mock', policy: MockAdapterPolicy, uncaught: ['uncaught'], all: ['all'], defaultMode: 'uncaught' }
];

describe('resolveExceptionFilters', () => {
  describe.each(EXPECTATIONS)('$name policy', ({ policy, uncaught, all, defaultMode }) => {
    it(`declares defaultExceptionBreakMode ${JSON.stringify(defaultMode)} (issue #244)`, () => {
      expect(policy.getInitializationBehavior().defaultExceptionBreakMode).toEqual(defaultMode);
    });

    it(`resolves 'uncaught' to ${JSON.stringify(uncaught)}`, () => {
      expect(resolveExceptionFilters(policy, 'uncaught')).toEqual(uncaught);
    });

    it(`resolves 'all' to ${JSON.stringify(all)}`, () => {
      expect(resolveExceptionFilters(policy, 'all')).toEqual(all);
    });

    it("resolves 'none' to []", () => {
      expect(resolveExceptionFilters(policy, 'none')).toEqual([]);
    });

    it('resolves undefined to []', () => {
      expect(resolveExceptionFilters(policy, undefined)).toEqual([]);
    });
  });

  it('returns [] for every mode on a policy without a filter table (DefaultAdapterPolicy)', () => {
    const modes: Array<ExceptionBreakMode | undefined> = ['uncaught', 'all', 'none', undefined];
    for (const mode of modes) {
      expect(resolveExceptionFilters(DefaultAdapterPolicy, mode)).toEqual([]);
    }
  });

  it('DefaultAdapterPolicy declares no defaultExceptionBreakMode (issue #244)', () => {
    expect(DefaultAdapterPolicy.getInitializationBehavior().defaultExceptionBreakMode).toBeUndefined();
  });
});
