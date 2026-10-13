import { describe, expect, it, vi } from 'vitest';
import {
  DOCKER_OWNER_LABEL,
  addDockerOwnershipLabel,
  isDockerRunInvocation,
  removeOwnedDockerContainers,
} from '../../../tools/dev-proxy/docker-backend.mjs';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

const output = (stdout = '') => ({ stdout, stderr: '' });
const cleanupOptions = {
  dockerCommand: 'docker', ownerId: 'proxy-123', port: 3001, includeLegacyPort: false,
};

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
  it('removes owned stdio containers by label without relying on a published port', async () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    const runFile = async (command: string, args: string[]) => {
      calls.push({ command, args });
      return output(args[0] === 'ps' ? 'owned-a\r\nowned-b\r\n' : '');
    };

    const result = await removeOwnedDockerContainers({ ...cleanupOptions, runFile });

    expect(result).toEqual({ ownedIds: ['owned-a', 'owned-b'], legacyIds: [] });
    expect(calls.map((call) => call.args)).toEqual([
      ['ps', '-aq', '--filter', `label=${DOCKER_OWNER_LABEL}=proxy-123`],
      ['rm', '-f', 'owned-a'],
      ['rm', '-f', 'owned-b'],
    ]);
  });

  it('also removes unlabeled published-port containers for network compatibility', async () => {
    const removed: string[] = [];
    const runFile = async (_command: string, args: string[]) => {
      if (args[0] === 'ps' && args.includes('-aq')) return output('owned-a\n');
      if (args[0] === 'ps') return output('owned-a\nlegacy-b\n');
      if (args[0] === 'rm') removed.push(args[2]);
      return output();
    };

    const result = await removeOwnedDockerContainers({
      ...cleanupOptions, dockerCommand: 'docker.exe', port: 4555, includeLegacyPort: true, runFile,
    });

    expect(result).toEqual({ ownedIds: ['owned-a'], legacyIds: ['legacy-b'] });
    expect(removed).toEqual(['owned-a', 'legacy-b']);
  });

  it('keeps the event loop responsive and waits for owned-container discovery', async () => {
    const discovery = deferred<ReturnType<typeof output>>();
    const runFile = vi.fn(async (_command: string, args: string[]) => (
      args[0] === 'ps' ? discovery.promise : output()
    ));
    let settled = false;
    const cleanup = removeOwnedDockerContainers({ ...cleanupOptions, runFile }).then(result => {
      settled = true;
      return result;
    });

    await new Promise<void>(resolve => setTimeout(resolve, 0));
    expect(settled).toBe(false);
    expect(runFile).toHaveBeenCalledTimes(1);
    discovery.resolve(output('owned-a\n'));
    await expect(cleanup).resolves.toEqual({ ownedIds: ['owned-a'], legacyIds: [] });
    expect(runFile).toHaveBeenLastCalledWith('docker', ['rm', '-f', 'owned-a']);
  });

  it('waits for legacy discovery before starting any removals', async () => {
    const discovery = deferred<ReturnType<typeof output>>();
    const runFile = vi.fn(async (_command: string, args: string[]) => {
      if (args[0] !== 'ps') return output();
      return args.includes('-aq') ? output('owned-a\n') : discovery.promise;
    });
    const cleanup = removeOwnedDockerContainers({ ...cleanupOptions, includeLegacyPort: true, runFile });

    await new Promise<void>(resolve => setTimeout(resolve, 0));
    expect(runFile).toHaveBeenCalledTimes(2);
    discovery.resolve(output('owned-a\nlegacy-b\n'));
    await expect(cleanup).resolves.toEqual({ ownedIds: ['owned-a'], legacyIds: ['legacy-b'] });
    expect(runFile.mock.calls.slice(2).map(([, args]) => args)).toEqual([
      ['rm', '-f', 'owned-a'], ['rm', '-f', 'legacy-b'],
    ]);
  });

  it('keeps the event loop responsive and waits for each removal before continuing', async () => {
    const removal = deferred<ReturnType<typeof output>>();
    const runFile = vi.fn(async (_command: string, args: string[]) => {
      if (args[0] === 'ps') return output('owned-a\nowned-b\n');
      return args[2] === 'owned-a' ? removal.promise : output();
    });
    let settled = false;
    const cleanup = removeOwnedDockerContainers({ ...cleanupOptions, runFile }).then(result => {
      settled = true;
      return result;
    });

    await new Promise<void>(resolve => setTimeout(resolve, 0));
    expect(settled).toBe(false);
    expect(runFile).toHaveBeenCalledTimes(2);
    expect(runFile).toHaveBeenLastCalledWith('docker', ['rm', '-f', 'owned-a']);
    removal.resolve(output());
    await expect(cleanup).resolves.toEqual({ ownedIds: ['owned-a', 'owned-b'], legacyIds: [] });
    expect(runFile).toHaveBeenLastCalledWith('docker', ['rm', '-f', 'owned-b']);
  });

  it('continues after individual owned and legacy removals fail', async () => {
    const runFile = vi.fn(async (_command: string, args: string[]) => {
      if (args[0] === 'ps') return output(args.includes('-aq') ? 'owned-a\nowned-b\n' : 'legacy-c\nlegacy-d\n');
      if (args[2] === 'owned-a' || args[2] === 'legacy-c') throw new Error('already removed');
      return output();
    });

    await expect(removeOwnedDockerContainers({ ...cleanupOptions, includeLegacyPort: true, runFile }))
      .resolves.toEqual({ ownedIds: ['owned-a', 'owned-b'], legacyIds: ['legacy-c', 'legacy-d'] });
    expect(runFile.mock.calls.slice(2).map(([, args]) => args[2])).toEqual([
      'owned-a', 'owned-b', 'legacy-c', 'legacy-d',
    ]);
  });

  it.each(['missing Docker', 'failed discovery'])('rejects %s for the lifecycle caller to handle', async scenario => {
    const failure = Object.assign(new Error(scenario), { code: scenario === 'missing Docker' ? 'ENOENT' : 1 });
    const runFile = vi.fn(async () => { throw failure; });

    await expect(removeOwnedDockerContainers({ ...cleanupOptions, runFile })).rejects.toBe(failure);
    expect(runFile).toHaveBeenCalledTimes(1);
  });

  it('rejects failed legacy discovery before removing any containers', async () => {
    const failure = new Error('legacy discovery failed');
    const runFile = vi.fn(async (_command: string, args: string[]) => {
      if (args.includes('-aq')) return output('owned-a\n');
      throw failure;
    });

    await expect(removeOwnedDockerContainers({ ...cleanupOptions, includeLegacyPort: true, runFile }))
      .rejects.toBe(failure);
    expect(runFile).toHaveBeenCalledTimes(2);
  });

  it('returns empty results without removal when no containers match', async () => {
    const runFile = vi.fn(async () => output('\r\n'));

    await expect(removeOwnedDockerContainers({ ...cleanupOptions, includeLegacyPort: true, runFile }))
      .resolves.toEqual({ ownedIds: [], legacyIds: [] });
    expect(runFile).toHaveBeenCalledTimes(2);
  });
});
