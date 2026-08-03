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
  MockAdapterPolicy
} from '../../src/index.js';

interface PolicyExpectation {
  name: string;
  policy: AdapterPolicy;
  uncaught: string[];
  all: string[];
}

const EXPECTATIONS: PolicyExpectation[] = [
  { name: 'python', policy: PythonAdapterPolicy, uncaught: ['uncaught'], all: ['raised', 'uncaught'] },
  { name: 'js-debug', policy: JsDebugAdapterPolicy, uncaught: ['uncaught'], all: ['all'] },
  { name: 'go', policy: GoAdapterPolicy, uncaught: ['fatal', 'panic'], all: ['fatal', 'panic'] },
  { name: 'java', policy: JavaAdapterPolicy, uncaught: ['uncaught'], all: ['caught', 'uncaught'] },
  { name: 'dotnet', policy: DotnetAdapterPolicy, uncaught: ['user-unhandled'], all: ['all'] },
  { name: 'ruby', policy: RubyAdapterPolicy, uncaught: [], all: ['any'] },
  { name: 'rust', policy: RustAdapterPolicy, uncaught: ['rust_panic'], all: ['rust_panic', 'cpp_throw'] },
  { name: 'mock', policy: MockAdapterPolicy, uncaught: ['uncaught'], all: ['all'] }
];

describe('resolveExceptionFilters', () => {
  describe.each(EXPECTATIONS)('$name policy', ({ policy, uncaught, all }) => {
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
});
