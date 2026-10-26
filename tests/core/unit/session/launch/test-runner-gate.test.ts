/**
 * The test-runner preset gate (issue #985): `start_debugging { testRunner }`
 * names a preset the language's factory metadata (`AdapterModes.testRunners`)
 * must declare. Like the attach-addressing contract (#903), the verdict is
 * taken before any session state changes, so an unknown runner is refused by
 * name — with the runners the language does take — and the session stays
 * usable.
 */
import { describe, it, expect } from 'vitest';
import type { AdapterModes } from '@debugmcp/shared';
import { classifyTestRunner } from '../../../../../src/session/launch/test-runner-gate.js';

const python: AdapterModes = { launch: true, attach: 'direct-connect', attachBy: ['port'], testRunners: ['pytest'] };
const go: AdapterModes = { launch: true, attach: 'none' };

describe('classifyTestRunner', () => {
  it('passes a launch that names no runner, whatever the language declares', () => {
    expect(classifyTestRunner('python', undefined, python)).toEqual({ ok: true, runner: undefined });
    expect(classifyTestRunner('go', { cwd: '/proj' }, go)).toEqual({ ok: true, runner: undefined });
    expect(classifyTestRunner('go', {}, undefined)).toEqual({ ok: true, runner: undefined });
  });

  it('passes a declared runner and names it', () => {
    expect(classifyTestRunner('python', { testRunner: 'pytest' }, python)).toEqual({ ok: true, runner: 'pytest' });
  });

  it('refuses an undeclared runner by name, listing the ones the language takes', () => {
    const verdict = classifyTestRunner('python', { testRunner: 'jest' }, python);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.error).toContain("'jest'");
      expect(verdict.error).toContain('python');
      expect(verdict.error).toContain('pytest');
    }
  });

  it('refuses every runner for a language that declares none, saying so', () => {
    const verdict = classifyTestRunner('go', { testRunner: 'go-test' }, go);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.error).toContain("'go-test'");
      expect(verdict.error).toMatch(/no test-runner preset/i);
    }
    expect(classifyTestRunner('go', { testRunner: 'go-test' }, undefined).ok).toBe(false);
  });

  it('refuses a runner that is not a non-empty string, null included, and a testTarget without a runner', () => {
    expect(classifyTestRunner('python', { testRunner: '' }, python).ok).toBe(false);
    expect(classifyTestRunner('python', { testRunner: 7 }, python).ok).toBe(false);
    expect(classifyTestRunner('python', { testRunner: null }, python).ok).toBe(false);
    const orphan = classifyTestRunner('python', { testTarget: 'test_x' }, python);
    expect(orphan.ok).toBe(false);
    if (!orphan.ok) {
      expect(orphan.error).toContain('testTarget');
      expect(orphan.error).toContain('testRunner');
    }
  });

  it('refuses a testTarget that is not a string, which the transform would otherwise drop and run the whole file', () => {
    for (const target of [42, ['test_x'], { name: 'test_x' }]) {
      const verdict = classifyTestRunner('python', { testRunner: 'pytest', testTarget: target }, python);
      expect(verdict.ok, JSON.stringify(target)).toBe(false);
      if (!verdict.ok) {
        expect(verdict.error).toContain('testTarget');
        expect(verdict.error).toMatch(/string/);
      }
    }
    expect(classifyTestRunner('python', { testRunner: 'pytest', testTarget: 'test_x' }, python).ok).toBe(true);
  });
});
