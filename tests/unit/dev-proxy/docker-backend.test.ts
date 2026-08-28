import { describe, expect, it } from 'vitest';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- plain-JS module without type declarations
import {
  DOCKER_OWNER_LABEL,
  addDockerOwnershipLabel,
  isDockerRunInvocation,
  removeOwnedDockerContainers,
} from '../../../tools/dev-proxy/docker-backend.mjs';

describe('dev-proxy Docker backend recognition', () => {
  it.each([
    [{ command: 'docker', args: ['run', '-i', 'image', 'stdio'] }],
    [{ command: 'docker.exe', args: ['run', 'image'] }],
    [{ command: 'C:\\Program Files\\Docker\\docker.exe', args: ['run', 'image'] }],
    [{ command: '/usr/local/bin/docker', args: ['run', 'image'] }],
  ])('recognizes docker run invocation %#', (invocation) => {
    expect(isDockerRunInvocation(invocation)).toBe(true);
  });

  it('rejects non-run Docker commands and unrelated executables', () => {
    expect(isDockerRunInvocation({ command: 'docker', args: ['compose', 'up'] })).toBe(false);
    expect(isDockerRunInvocation({ command: 'podman', args: ['run', 'image'] })).toBe(false);
  });

  it('injects an ownership label before existing run options without mutating input', () => {
    const invocation = { command: 'docker', args: ['run', '-i', '--rm', 'image', 'stdio'] };

    const result = addDockerOwnershipLabel(invocation, 'proxy-123');

    expect(result).toEqual({
      command: 'docker',
      args: [
        'run',
        '--label',
        `${DOCKER_OWNER_LABEL}=proxy-123`,
        '-i',
        '--rm',
        'image',
        'stdio',
      ],
    });
    expect(invocation.args).toEqual(['run', '-i', '--rm', 'image', 'stdio']);
  });

  it('passes non-Docker invocations through unchanged', () => {
    const invocation = { command: 'node', args: ['dist/index.js', 'stdio'] };
    expect(addDockerOwnershipLabel(invocation, 'proxy-123')).toBe(invocation);
  });
});

describe('dev-proxy Docker backend cleanup', () => {
  it('removes owned stdio containers by label without relying on a published port', () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    const execFile = ((command: string, args: string[]) => {
      calls.push({ command, args });
      if (args[0] === 'ps') return 'owned-a\r\nowned-b\r\n';
      return '';
    }) as never;

    const result = removeOwnedDockerContainers({
      dockerCommand: 'docker',
      ownerId: 'proxy-123',
      port: 3001,
      includeLegacyPort: false,
      execFile,
    });

    expect(result).toEqual({ ownedIds: ['owned-a', 'owned-b'], legacyIds: [] });
    expect(calls.map((call) => call.args)).toEqual([
      ['ps', '-aq', '--filter', `label=${DOCKER_OWNER_LABEL}=proxy-123`],
      ['rm', '-f', 'owned-a'],
      ['rm', '-f', 'owned-b'],
    ]);
  });

  it('also removes unlabeled published-port containers for network compatibility', () => {
    const removed: string[] = [];
    const execFile = ((_command: string, args: string[]) => {
      if (args[0] === 'ps' && args.includes('-aq')) return 'owned-a\n';
      if (args[0] === 'ps') return 'owned-a\nlegacy-b\n';
      if (args[0] === 'rm') removed.push(args[2]);
      return '';
    }) as never;

    const result = removeOwnedDockerContainers({
      dockerCommand: 'docker.exe',
      ownerId: 'proxy-123',
      port: 4555,
      includeLegacyPort: true,
      execFile,
    });

    expect(result).toEqual({ ownedIds: ['owned-a'], legacyIds: ['legacy-b'] });
    expect(removed).toEqual(['owned-a', 'legacy-b']);
  });
});
