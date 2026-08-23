/**
 * Unit tests for the doctor command's host-platform checks (issue #423).
 * All filesystem and environment access goes through injected fakes.
 */
import { describe, it, expect, vi } from 'vitest';
import type { IEnvironment, IFileSystem } from '@debugmcp/shared';
import {
  checkYamaPtraceScope,
  checkContainerWorkspace
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
