import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { EventEmitter } from 'events';
import { runVersionProbe, VERSION_PROBE_KILL_GRACE_MS } from '../../src/utils/version-probe.js';

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
    expect(options).toMatchObject({ windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
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

  it('reports why when the command cannot be run', async () => {
    const child = fakeChild();
    spawnMock.mockReturnValue(child);

    const probe = runVersionProbe('dlv', ['version']);
    child.emit('error', Object.assign(new Error('spawn dlv ENOENT'), { code: 'ENOENT' }));
    child.emit('close', -2, null);

    await expect(probe).resolves.toEqual({
      code: null,
      stdout: '',
      stderr: '',
      timedOut: false,
      error: 'spawn dlv ENOENT'
    });
  });

  it('reports why when spawn itself throws', async () => {
    spawnMock.mockImplementation(() => {
      throw new Error('EINVAL');
    });

    await expect(runVersionProbe('bad', [])).resolves.toMatchObject({ code: null, error: 'EINVAL' });
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

  it('settles a timed-out probe even when a descendant keeps the pipe open and close never comes', async () => {
    vi.useFakeTimers();
    const child = fakeChild();
    spawnMock.mockReturnValue(child);
    // The kill reaches only the direct child; whatever else holds stdout keeps it open.
    child.kill.mockImplementation(() => true);

    const probe = runVersionProbe('wrapper', ['--version'], { timeoutMs: 1000 });
    child.stdout.emit('data', Buffer.from('partial'));
    let settled = false;
    void probe.then(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(1000);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(VERSION_PROBE_KILL_GRACE_MS);

    await expect(probe).resolves.toEqual({ code: null, stdout: 'partial', stderr: '', timedOut: true });
  });
});
