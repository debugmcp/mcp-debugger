/**
 * What the dry run reports as the launch's `script` (issue #985): the program
 * the engine runs when the launch has one, or the non-program target the
 * policy's launch-target keys name — `module: pytest`, `code: …` — instead of
 * the stand-in file a module launch only uses to say what it is about.
 */
import { describe, it, expect } from 'vitest';
import { DefaultAdapterPolicy, PythonAdapterPolicy, type AdapterPolicy } from '@debugmcp/shared';
import { describeLaunchTarget } from '../../../../../src/session/launch/spawn-command.js';

const base = {
  executablePath: 'python',
  adapterHost: '127.0.0.1',
  adapterPort: 5678,
  logDir: '/tmp/logs',
  scriptPath: '/proj/tests/test_a.py'
};

describe('describeLaunchTarget', () => {
  it('names the program when the launch config carries one', () => {
    expect(describeLaunchTarget(PythonAdapterPolicy, { ...base, launchConfig: { program: '/proj/app.py' } })).toBe('/proj/app.py');
  });

  it('names a module target as `module: <name>` when the policy declares the key', () => {
    expect(describeLaunchTarget(PythonAdapterPolicy, { ...base, launchConfig: { module: 'pytest', args: ['-x'] } })).toBe('module: pytest');
  });

  it('joins a code list and truncates a long code string', () => {
    expect(describeLaunchTarget(PythonAdapterPolicy, { ...base, launchConfig: { code: ['import x', 'x.run()'] } })).toBe('code: import x x.run()');
    const long = 'print(1); '.repeat(20).trim();
    const described = describeLaunchTarget(PythonAdapterPolicy, { ...base, launchConfig: { code: long } });
    expect(described.startsWith('code: print(1)')).toBe(true);
    expect(described.length).toBeLessThan(long.length);
    expect(described.endsWith('…')).toBe(true);
  });

  it('falls back to the payload scriptPath when nothing names a target', () => {
    expect(describeLaunchTarget(PythonAdapterPolicy, { ...base, launchConfig: { cwd: '/proj' } })).toBe(base.scriptPath);
    expect(describeLaunchTarget(PythonAdapterPolicy, { ...base, launchConfig: undefined })).toBe(base.scriptPath);
  });

  it('ignores a module key for a policy whose only target key is program', () => {
    expect(describeLaunchTarget(DefaultAdapterPolicy as AdapterPolicy, { ...base, launchConfig: { module: 'x' } })).toBe(base.scriptPath);
  });
});
