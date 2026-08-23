/**
 * Policy-driven adapter-noise suppression in output capture (issue #361):
 * the session manager consults the language policy's
 * shouldSuppressOutputEvent hook after the telemetry drop, so LLDB's DWARF
 * spew never reaches the rust/cpp output buffer while normal stderr does.
 * Also covers the observe-and-record sibling annotateOutputEvent (issue #441).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager, SessionManagerConfig } from '../../../../src/session/session-manager.js';
import { DebugLanguage, RustAdapterPolicy } from '@debugmcp/shared';
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

  describe('adapter degradation annotation (issue #441)', () => {
    const LANG_SUPPORT_FAILURE =
      "Failed to initialize language support for rust [Errno 2] No such file or directory: 'rustc'\n";

    it('keeps the raw line, appends one attributed warning entry, and records the notice', async () => {
      const session = await launch(DebugLanguage.RUST);

      dependencies.mockProxyManager.emit('output', { category: 'console', output: LANG_SUPPORT_FAILURE });

      const managed = sessionManager.getSession(session.id)!;
      const outputs = managed.outputBuffer!.read(0, 100).entries.map(e => e.output);
      expect(outputs[0]).toBe(LANG_SUPPORT_FAILURE);
      expect(outputs[1]).toMatch(/^\[mcp-debugger\] Warning: Rust type summaries are unavailable/);
      expect(outputs).toHaveLength(2);
      expect(managed.adapterNotices).toHaveLength(1);
      expect(managed.adapterNotices![0]).toContain('CODELLDB_RUST_SYSROOT');
    });

    it('dedupes a repeated failure line — one notice, one warning entry', async () => {
      const session = await launch(DebugLanguage.RUST);

      dependencies.mockProxyManager.emit('output', { category: 'console', output: LANG_SUPPORT_FAILURE });
      dependencies.mockProxyManager.emit('output', { category: 'console', output: LANG_SUPPORT_FAILURE });

      const managed = sessionManager.getSession(session.id)!;
      const warnings = managed.outputBuffer!.read(0, 100).entries
        .filter(e => e.output.startsWith('[mcp-debugger] Warning:'));
      expect(warnings).toHaveLength(1);
      expect(managed.adapterNotices).toHaveLength(1);
    });

    it('leaves languages without the hook untouched', async () => {
      const session = await launch(DebugLanguage.MOCK);

      dependencies.mockProxyManager.emit('output', { category: 'console', output: LANG_SUPPORT_FAILURE });

      const managed = sessionManager.getSession(session.id)!;
      const outputs = managed.outputBuffer!.read(0, 100).entries.map(e => e.output);
      expect(outputs).toEqual([LANG_SUPPORT_FAILURE]);
      expect(managed.adapterNotices ?? []).toHaveLength(0);
    });

    it('joins a pre-resolution notice into the start_debugging warning', async () => {
      const session = await sessionManager.createSession({
        language: DebugLanguage.RUST,
        executablePath: 'x'
      });
      // The output handler attaches before proxy start, so a line emitted at
      // 'initialized' (fired during start) always precedes launch resolution.
      dependencies.mockProxyManager.once('initialized', () => {
        dependencies.mockProxyManager.emit('output', { category: 'console', output: LANG_SUPPORT_FAILURE });
      });

      const result = await sessionManager.startDebugging(session.id, 'main');
      await vi.runAllTimersAsync();

      expect(result.success).toBe(true);
      expect((result.data as { warning?: string }).warning).toContain('Rust type summaries are unavailable');
    });

    it('still captures output when the annotation hook throws', async () => {
      const spy = vi.spyOn(RustAdapterPolicy, 'annotateOutputEvent').mockImplementation(() => {
        throw new Error('hook exploded');
      });
      try {
        const session = await launch(DebugLanguage.RUST);

        dependencies.mockProxyManager.emit('output', { category: 'console', output: LANG_SUPPORT_FAILURE });

        const managed = sessionManager.getSession(session.id)!;
        const outputs = managed.outputBuffer!.read(0, 100).entries.map(e => e.output);
        expect(outputs).toEqual([LANG_SUPPORT_FAILURE]);
        expect(managed.adapterNotices ?? []).toHaveLength(0);
      } finally {
        spy.mockRestore();
      }
    });
  });
});
