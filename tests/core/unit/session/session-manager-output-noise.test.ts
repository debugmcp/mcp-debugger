/**
 * Policy-driven adapter-noise suppression in output capture (issue #361):
 * the session manager consults the language policy's
 * shouldSuppressOutputEvent hook after the telemetry drop, so LLDB's DWARF
 * spew never reaches the rust/cpp output buffer while normal stderr does.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager, SessionManagerConfig } from '../../../../src/session/session-manager.js';
import { DebugLanguage } from '@debugmcp/shared';
import { createMockDependencies } from './session-manager-test-utils.js';

const DWARF_NOISE =
  "error: hello_world.exe 0x00002b54: DW_TAG_member '_M_local_buf' refers to type 0x0000000000010ac0 which extends beyond the bounds of 0x00002b4b\n";

describe('SessionManager - adapter-noise output suppression (issue #361)', () => {
  let sessionManager: SessionManager;
  let dependencies: ReturnType<typeof createMockDependencies>;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    dependencies = createMockDependencies();
    const config: SessionManagerConfig = {
      logDirBase: '/tmp/test-sessions',
      defaultDapLaunchArgs: { stopOnEntry: true, justMyCode: true }
    };
    sessionManager = new SessionManager(config, dependencies);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    dependencies.mockProxyManager.reset();
  });

  async function launch(language: DebugLanguage) {
    const session = await sessionManager.createSession({ language, executablePath: 'x' });
    await sessionManager.startDebugging(session.id, 'main');
    await vi.runAllTimersAsync();
    return session;
  }

  it('drops LLDB DWARF-parser stderr noise for rust sessions', async () => {
    const session = await launch(DebugLanguage.RUST);

    dependencies.mockProxyManager.emit('output', { category: 'stderr', output: DWARF_NOISE });
    dependencies.mockProxyManager.emit('output', { category: 'stderr', output: 'real stderr line\n' });
    dependencies.mockProxyManager.emit('output', { category: 'stdout', output: 'Hello, world!\n' });

    const outputs = sessionManager.getSession(session.id)!.outputBuffer!.read(0, 100).entries.map(e => e.output);
    expect(outputs).toEqual(['real stderr line\n', 'Hello, world!\n']);
  });

  it('keeps identical text for languages whose policy declares no suppression', async () => {
    const session = await launch(DebugLanguage.MOCK);

    dependencies.mockProxyManager.emit('output', { category: 'stderr', output: DWARF_NOISE });

    const outputs = sessionManager.getSession(session.id)!.outputBuffer!.read(0, 100).entries.map(e => e.output);
    expect(outputs).toEqual([DWARF_NOISE]);
  });
});
