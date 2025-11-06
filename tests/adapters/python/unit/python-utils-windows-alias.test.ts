import { describe, it, expect, vi, afterEach } from 'vitest';
import { EventEmitter } from 'events';

describe('WhichCommandFinder (Windows alias handling)', () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('skips Windows Store aliases when a real python executable exists later in PATH', async () => {
    vi.resetModules();

    const spawnMock = vi.fn((cmd: string, args?: string[]) => {
      const proc = new EventEmitter() as any;
      proc.stdout = new EventEmitter();
      proc.stderr = new EventEmitter();

      // Simulate successful validation/debugpy checks for real Python path
      const exitCode = 0;
      process.nextTick(() => {
        if (args?.[0] === '-c' && args[1]?.includes('import debugpy')) {
          proc.stdout.emit('data', Buffer.from('1.8.0'));
        }
        proc.emit('exit', exitCode);
      });

      return proc;
    });

    const whichMock = vi.fn(async (command: string) => {
      switch (command) {
        case 'python':
        case 'python.exe':
          return [
            'C:\\Users\\runneradmin\\AppData\\Local\\Microsoft\\WindowsApps\\python.exe',
            'C:\\hostedtoolcache\\windows\\Python\\3.11.5\\x64\\python.exe',
          ];
        default:
          throw Object.assign(new Error(`Command not found: ${command}`), { code: 'ENOENT' });
      }
    });

    vi.doMock('child_process', async () => {
      const actual = await vi.importActual<typeof import('child_process')>('child_process');
      return {
        ...actual,
        spawn: spawnMock,
      };
    });

    vi.doMock('which', () => ({
      default: whichMock,
    }));

    const module = await import('@debugmcp/adapter-python');
    const { findPythonExecutable } = module;

    vi.stubGlobal('process', { ...process, platform: 'win32' });

    const resolved = await findPythonExecutable();
    expect(resolved).toBe('C:\\hostedtoolcache\\windows\\Python\\3.11.5\\x64\\python.exe');

    expect(whichMock).toHaveBeenCalledWith('python', expect.objectContaining({ all: true }));
    expect(whichMock).toHaveBeenCalledWith('python.exe', expect.objectContaining({ all: true }));
    expect(spawnMock).toHaveBeenCalled();
  });
});
