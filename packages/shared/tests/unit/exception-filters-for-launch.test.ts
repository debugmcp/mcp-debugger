/**
 * The launch-aware half of the breakOnExceptions → filter mapping (issue
 * #985 M1): a policy may read the transformed launch config before answering
 * which DAP filter ids a mode arms. debugpy's `uncaught` never fires on a
 * failing test — pytest catches it — so a pytest module launch arms
 * `userUnhandled` beside it under the `uncaught` default (measured in
 * docs/python/spike-notes-pytest.md). Every other launch keeps the table.
 */
import { describe, it, expect } from 'vitest';
import { resolveExceptionFilters, PythonAdapterPolicy, GoAdapterPolicy } from '../../src/index.js';

describe('resolveExceptionFilters with a launch config', () => {
  it("arms userUnhandled beside uncaught for a pytest module launch under the 'uncaught' default", () => {
    expect(resolveExceptionFilters(PythonAdapterPolicy, 'uncaught', { module: 'pytest' })).toEqual(['uncaught', 'userUnhandled']);
  });

  it('keeps the table for a program launch, another module, no config, and the other modes', () => {
    expect(resolveExceptionFilters(PythonAdapterPolicy, 'uncaught', { program: '/proj/app.py' })).toEqual(['uncaught']);
    expect(resolveExceptionFilters(PythonAdapterPolicy, 'uncaught', { module: 'flask' })).toEqual(['uncaught']);
    expect(resolveExceptionFilters(PythonAdapterPolicy, 'uncaught')).toEqual(['uncaught']);
    expect(resolveExceptionFilters(PythonAdapterPolicy, 'all', { module: 'pytest' })).toEqual(['raised', 'uncaught']);
    expect(resolveExceptionFilters(PythonAdapterPolicy, 'none', { module: 'pytest' })).toEqual([]);
  });

  it('is the plain table for a policy without the hook', () => {
    expect(resolveExceptionFilters(GoAdapterPolicy, 'uncaught', { module: 'pytest' })).toEqual(
      resolveExceptionFilters(GoAdapterPolicy, 'uncaught')
    );
  });

  it('exposes the hook on the Python policy only where it changes the answer', () => {
    expect(PythonAdapterPolicy.exceptionFiltersForLaunch?.('uncaught', { module: 'pytest' })).toEqual(['uncaught', 'userUnhandled']);
    expect(PythonAdapterPolicy.exceptionFiltersForLaunch?.('uncaught', { module: 'flask' })).toBeUndefined();
    expect(PythonAdapterPolicy.exceptionFiltersForLaunch?.('all', { module: 'pytest' })).toBeUndefined();
  });
});
