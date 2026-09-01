/**
 * Unit tests for the doctor command's host-platform checks (issue #423).
 * All filesystem and environment access goes through injected fakes.
 */
import { describe, it, expect, vi } from 'vitest';
import type { IEnvironment, IFileSystem, IProcessManager } from '@debugmcp/shared';
import {
  checkYamaPtraceScope,
  checkContainerWorkspace,
  checkStaleContainers
} from '../../../../src/cli/commands/doctor/platform-checks.js';

const makeFileSystem = (overrides: Partial<IFileSystem> = {}): IFileSystem =>
  ({
    readFile: vi.fn().mockRejectedValue(new Error('ENOENT')),
    stat: vi.fn().mockRejectedValue(new Error('ENOENT')),
    readdir: vi.fn().mockRejectedValue(new Error('ENOENT')),
    ...overrides
  }) as unknown as IFileSystem;

const makeEnvironment = (env: Record<string, string | undefined>): IEnvironment => ({
  get: (key: string) => env[key],
  getAll: () => env,
  getCurrentWorkingDirectory: () => process.cwd()
});

describe('checkYamaPtraceScope', () => {
  it('is skipped on non-linux platforms without touching the filesystem', async () => {
    const fileSystem = makeFileSystem();

    const result = await checkYamaPtraceScope(fileSystem, 'win32');

    expect(result.id).toBe('yama-ptrace-scope');
    expect(result.status).toBe('skipped');
    expect(fileSystem.readFile).not.toHaveBeenCalled();
  });

  it.each([
    [0, 'ok'],
    [1, 'warn'],
    [2, 'warn'],
    [3, 'broken']
  ] as const)('maps ptrace_scope=%i to %s on linux', async (value, status) => {
    const fileSystem = makeFileSystem({
      readFile: vi.fn().mockResolvedValue(`${value}\n`)
    });

    const result = await checkYamaPtraceScope(fileSystem, 'linux');

    expect(result.status).toBe(status);
    expect(result.detail).toContain(`ptrace_scope=${value}`);
  });

  it('offers a sysctl fix hint for restrictive scopes', async () => {
    const fileSystem = makeFileSystem({ readFile: vi.fn().mockResolvedValue('1') });

    const result = await checkYamaPtraceScope(fileSystem, 'linux');

    expect(result.fixHint).toContain('kernel.yama.ptrace_scope');
  });

  it('is skipped when the Yama sysctl file is unreadable (Yama absent)', async () => {
    const fileSystem = makeFileSystem();

    const result = await checkYamaPtraceScope(fileSystem, 'linux');

    expect(result.status).toBe('skipped');
  });
});

describe('checkContainerWorkspace', () => {
  it('reports host mode and skips the mount check outside a container', async () => {
    const environment = makeEnvironment({});
    const fileSystem = makeFileSystem();

    const [containerMode, mount] = await checkContainerWorkspace(environment, fileSystem);

    expect(containerMode.id).toBe('container-mode');
    expect(containerMode.status).toBe('ok');
    expect(mount.id).toBe('workspace-mount');
    expect(mount.status).toBe('skipped');
  });

  it('warns when MCP_CONTAINER is set to a truthy-looking but unrecognized value', async () => {
    const environment = makeEnvironment({ MCP_CONTAINER: '1' });
    const fileSystem = makeFileSystem();

    const [containerMode, mount] = await checkContainerWorkspace(environment, fileSystem);

    expect(containerMode.status).toBe('warn');
    expect(containerMode.detail).toContain("'1'");
    expect(containerMode.fixHint).toContain('true');
    expect(mount.status).toBe('skipped');
  });

  it('echoes the recognized MCP_CONTAINER value in the detail', async () => {
    const environment = makeEnvironment({ MCP_CONTAINER: 'true', MCP_WORKSPACE_ROOT: '/workspace' });
    const fileSystem = makeFileSystem({
      stat: vi.fn().mockResolvedValue({ isDirectory: () => true }),
      readdir: vi.fn().mockResolvedValue(['src'])
    });

    const [containerMode] = await checkContainerWorkspace(environment, fileSystem);

    expect(containerMode.status).toBe('ok');
    expect(containerMode.detail).toContain('MCP_CONTAINER=true');
  });

  it('reports broken when MCP_WORKSPACE_ROOT is unset in container mode', async () => {
    const environment = makeEnvironment({ MCP_CONTAINER: 'true' });
    const fileSystem = makeFileSystem();

    const [, mount] = await checkContainerWorkspace(environment, fileSystem);

    expect(mount.status).toBe('broken');
    expect(mount.fixHint).toContain('MCP_WORKSPACE_ROOT');
  });

  it('reports broken when the workspace root does not exist', async () => {
    const environment = makeEnvironment({ MCP_CONTAINER: 'true', MCP_WORKSPACE_ROOT: '/workspace' });
    const fileSystem = makeFileSystem();

    const [, mount] = await checkContainerWorkspace(environment, fileSystem);

    expect(mount.status).toBe('broken');
    expect(mount.detail).toContain('/workspace');
  });

  it('warns when the workspace root is an empty directory', async () => {
    const environment = makeEnvironment({ MCP_CONTAINER: 'true', MCP_WORKSPACE_ROOT: '/workspace' });
    const fileSystem = makeFileSystem({
      stat: vi.fn().mockResolvedValue({ isDirectory: () => true }),
      readdir: vi.fn().mockResolvedValue([])
    });

    const [, mount] = await checkContainerWorkspace(environment, fileSystem);

    expect(mount.status).toBe('warn');
    expect(mount.detail).toContain('empty');
  });

  it('reports ok for a populated workspace mount', async () => {
    const environment = makeEnvironment({ MCP_CONTAINER: 'true', MCP_WORKSPACE_ROOT: '/workspace' });
    const fileSystem = makeFileSystem({
      stat: vi.fn().mockResolvedValue({ isDirectory: () => true }),
      readdir: vi.fn().mockResolvedValue(['src', 'package.json'])
    });

    const [, mount] = await checkContainerWorkspace(environment, fileSystem);

    expect(mount.status).toBe('ok');
  });
});

describe('checkStaleContainers (issue #633)', () => {
  const NOW = Date.parse('2026-08-31T20:00:00Z');
  const at = (iso: string) => `${iso} +0000 UTC`;

  const makeProcessManager = (stdout: string): IProcessManager =>
    ({ exec: vi.fn().mockResolvedValue({ stdout, stderr: '' }) }) as unknown as IProcessManager;

  it('is skipped when no process manager is available', async () => {
    const result = await checkStaleContainers(undefined, NOW);

    expect(result.id).toBe('stale-containers');
    expect(result.status).toBe('skipped');
  });

  it('is skipped when docker is absent or the daemon is unreachable', async () => {
    const processManager = ({
      exec: vi.fn().mockRejectedValue(new Error('docker: command not found'))
    }) as unknown as IProcessManager;

    const result = await checkStaleContainers(processManager, NOW);

    expect(result.status).toBe('skipped');
    expect(result.detail).toContain('docker not available');
  });

  it('is ok when nothing is running', async () => {
    const result = await checkStaleContainers(makeProcessManager(''), NOW);

    expect(result.status).toBe('ok');
    expect(result.detail).toContain('no mcp-debugger containers');
  });

  it('is ok when containers exist but all are younger than 24h', async () => {
    const stdout = [
      `keen_cori\t${at('2026-08-31 19:00:00')}`,
      `bold_hopper\t${at('2026-08-31 04:00:00')}`
    ].join('\n');

    const result = await checkStaleContainers(makeProcessManager(stdout), NOW);

    expect(result.status).toBe('ok');
    expect(result.fixHint).toBeUndefined();
  });

  it('warns with the removal hint once a container has run over 24h', async () => {
    const stdout = [
      `keen_cori\t${at('2026-08-31 19:00:00')}`,
      `stale_one\t${at('2026-08-25 12:00:00')}`
    ].join('\n');

    const result = await checkStaleContainers(makeProcessManager(stdout), NOW);

    expect(result.status).toBe('warn');
    expect(result.detail).toContain('1 of 2');
    expect(result.detail).toContain('6d');
    expect(result.fixHint).toContain('docker rm -f');
  });

  // Doctor cannot prove a long-lived container is orphaned; an active session
  // looks identical. The wording must not claim more than that.
  it('hedges rather than asserting the container is definitely orphaned', async () => {
    const stdout = `stale_one\t${at('2026-08-25 12:00:00')}`;

    const result = await checkStaleContainers(makeProcessManager(stdout), NOW);

    expect(result.detail).toMatch(/likely|though an active session/);
  });

  it('ignores a container whose timestamp cannot be parsed rather than guessing its age', async () => {
    const stdout = 'weird_one\tnot-a-timestamp';

    const result = await checkStaleContainers(makeProcessManager(stdout), NOW);

    expect(result.status).toBe('ok');
  });
});
