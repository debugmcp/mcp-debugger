import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { EventEmitter } from 'events';
import { runVersionProbe } from '../../src/utils/version-probe.js';

const spawnMock: Mock = vi.fn();

vi.mock('child_process', async () => {
  const actual = await vi.importActual<typeof import('child_process')>('child_process');
  return {
    ...actual,
    spawn: (...args: Parameters<typeof actual.spawn>) => spawnMock(...args)
  };
});

type FakeChild = EventEmitter & { stdout: EventEmitter; stderr: EventEmitter; kill: Mock };

function fakeChild(): FakeChild {
  const child = new EventEmitter() as FakeChild;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = vi.fn();
  return child;
}

beforeEach(() => {
  spawnMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

// Issue #969: one shared probe instead of five private copies, each reading
// output on its own terms.
describe('runVersionProbe', () => {
  it('spawns the command directly (no shell, hidden window) and reads output that arrives after exit', async () => {
    const child = fakeChild();
    spawnMock.mockReturnValue(child);

    const probe = runVersionProbe('java', ['-version']);
    child.emit('exit', 0, null);
    child.stdout.emit('data', Buffer.from('out '));
    child.stderr.emit('data', Buffer.from('openjdk version "21.0.10"'));
    child.emit('close', 0, null);

    await expect(probe).resolves.toEqual({
      code: 0,
      stdout: 'out ',
      stderr: 'openjdk version "21.0.10"',
      timedOut: false
    });
    const [command, args, options] = spawnMock.mock.calls[0];
    expect([command, args]).toEqual(['java', ['-version']]);
    expect(options).toMatchObject({ windowsHide: true });
    expect(options.shell).toBeUndefined();
  });

  it('passes env and cwd through', async () => {
    const child = fakeChild();
    spawnMock.mockReturnValue(child);

    const probe = runVersionProbe('go', ['version'], { env: { GOFLAGS: '' }, cwd: '/work' });
    child.emit('close', 0, null);
    await probe;

    expect(spawnMock.mock.calls[0][2]).toMatchObject({ env: { GOFLAGS: '' }, cwd: '/work' });
  });

  it('resolves null when the command cannot be spawned', async () => {
    const child = fakeChild();
    spawnMock.mockReturnValue(child);

    const probe = runVersionProbe('dlv', ['version']);
    child.emit('error', Object.assign(new Error('spawn dlv ENOENT'), { code: 'ENOENT' }));
    child.emit('close', -2, null);

    await expect(probe).resolves.toBeNull();
  });

  it('resolves null when spawn itself throws', async () => {
    spawnMock.mockImplementation(() => {
      throw new Error('EINVAL');
    });

    await expect(runVersionProbe('bad', [])).resolves.toBeNull();
  });

  it('kills a probe that outlives its timeout and reports it timed out', async () => {
    vi.useFakeTimers();
    const child = fakeChild();
    spawnMock.mockReturnValue(child);
    child.kill.mockImplementation(() => child.emit('close', null, 'SIGKILL'));

    const probe = runVersionProbe('java', ['-version'], { timeoutMs: 1000 });
    await vi.advanceTimersByTimeAsync(1000);

    await expect(probe).resolves.toMatchObject({ code: null, timedOut: true });
    expect(child.kill).toHaveBeenCalled();
  });
});
