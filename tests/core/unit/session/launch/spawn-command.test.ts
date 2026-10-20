/**
 * The dry run's answer: the adapter spawn command the launch would run,
 * computed in the parent process from the policy, the way the proxy worker
 * used to log it before it exited (issue #812). Pinned here because the string
 * is the one thing a dry run exists to report.
 */
import { describe, it, expect } from 'vitest';
import { MockAdapterPolicy, PythonAdapterPolicy, type AdapterPolicy } from '@debugmcp/shared';
import { describeSpawnCommand } from '../../../../../src/session/launch/spawn-command.js';

const base = {
  executablePath: '/usr/bin/python',
  adapterHost: '127.0.0.1',
  adapterPort: 5678,
  logDir: '/tmp/logs',
  scriptPath: '/work/app.py'
};

describe('describeSpawnCommand', () => {
  it('formats a spawn-mode answer as the command followed by its arguments', () => {
    const command = describeSpawnCommand(MockAdapterPolicy, {
      ...base,
      adapterCommand: { command: 'node', args: ['fake-adapter.js', '--port', '5678'] }
    });
    expect(command).toBe('node fake-adapter.js --port 5678');
  });

  it('formats a connect-mode answer as [connect] host:port', () => {
    const command = describeSpawnCommand(PythonAdapterPolicy, {
      ...base,
      launchConfig: { request: 'attach', connect: { host: '10.0.0.5', port: 5679 } } as never
    });
    expect(command).toBe('[connect] 10.0.0.5:5679');
  });

  it('names the policy when it cannot say what it would spawn', () => {
    // The mock policy answers nothing without an adapter command.
    expect(() => describeSpawnCommand(MockAdapterPolicy, base)).toThrow(
      /Cannot determine adapter command .*\(policy: mock\)/
    );
  });

  it('names a policy that has no spawn-config method at all', () => {
    const bare = { name: 'bare' } as unknown as AdapterPolicy;
    expect(() =>
      describeSpawnCommand(bare, { ...base, adapterCommand: { command: 'x', args: [] } })
    ).toThrow(/\(policy: bare\)/);
  });
});
