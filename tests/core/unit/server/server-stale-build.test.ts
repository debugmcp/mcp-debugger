/**
 * set_breakpoint's stale-build warning (issue #938), through the full server
 * over a mocked container: a TypeScript breakpoint whose compiled file (found
 * through the tsconfig's outDir and proved by its map) is older than the
 * source gets a hedged warning naming both files; a current build, a
 * non-TypeScript file, or a session whose adapter does not bind through a
 * map gets none. The warning rides beside the loud-snapping one, after it.
 * The compiled languages' cases (issue #950) and the two carriers #951 added
 * (the launch answer, get_stack_trace) are at the end.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';
import type { Stats } from 'fs';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { DotnetAdapterPolicy, JsDebugAdapterPolicy } from '@debugmcp/shared';
import { DebugMcpServer } from '../../../../src/server.js';
import { SessionManager } from '../../../../src/session/session-manager.js';
import { createProductionDependencies, type Dependencies } from '../../../../src/container/dependencies.js';
import {
  createMockDependencies,
  createMockServer,
  createMockSessionManager,
  createMockStdioTransport,
  getToolHandlers,
  type CallToolHandler,
  type MockServer,
  type MockSessionManager
} from './server-test-helpers.js';

vi.mock('@modelcontextprotocol/sdk/server/index.js');
vi.mock('@modelcontextprotocol/sdk/server/stdio.js');
vi.mock('../../../../src/session/session-manager.js');
vi.mock('../../../../src/container/dependencies.js');

// An absolute project root on either platform (C:\proj or /proj).
const P = path.resolve(path.sep, 'proj');
const at = (...parts: string[]) => path.join(P, ...parts);
const SRC = at('src', 'a.ts');
const DIST = at('dist', 'a.js');
const DIST_MAP = at('dist', 'a.js.map');
const PY = at('src', 'a.py');

const TS_FILE = [
  'export function total(prices: number[]): number {', // 1
  '  let sum = 0;',                                     // 2
  '',                                                   // 3 (requested)
  '  for (const p of prices) sum += p;'                 // 4 (adapter binds here)
].join('\n');

interface FakeFile { content: string; mtimeMs: number }

describe('set_breakpoint stale-build warning (#938)', () => {
  let mockServer: MockServer;
  let mockSessionManager: MockSessionManager;
  let mockDependencies: Dependencies;
  let callToolHandler: CallToolHandler;
  let files: Record<string, FakeFile>;

  beforeEach(() => {
    files = {
      [at('tsconfig.json')]: { content: '{ "compilerOptions": { "outDir": "dist", "rootDir": "src" } }', mtimeMs: 1 },
      [SRC]: { content: TS_FILE, mtimeMs: 20_000 },
      [PY]: { content: TS_FILE, mtimeMs: 20_000 },
      [DIST]: { content: 'compiled', mtimeMs: 10_000 },
      [DIST_MAP]: { content: JSON.stringify({ version: 3, sources: ['../src/a.ts'], mappings: '' }), mtimeMs: 10_000 }
    };
    mockDependencies = createMockDependencies();
    const fs = mockDependencies.fileSystem;
    vi.mocked(fs.pathExists).mockImplementation(async (file: string) => file in files);
    vi.mocked(fs.existsSync).mockImplementation((file: string) => file in files);
    vi.mocked(fs.readFile).mockImplementation(async (file: string) => files[file]?.content ?? '{}');
    vi.mocked(fs.stat).mockImplementation(async (file: string) => {
      const entry = files[file];
      if (!entry) {
        throw Object.assign(new Error(`ENOENT: ${file}`), { code: 'ENOENT' });
      }
      return { isFile: () => true, isDirectory: () => false, size: entry.content.length, mtimeMs: entry.mtimeMs } as Stats;
    });
    vi.mocked(createProductionDependencies).mockReturnValue(mockDependencies);

    mockServer = createMockServer();
    vi.mocked(Server).mockImplementation(function() { return mockServer as any; });
    const mockStdioTransport = createMockStdioTransport();
    vi.mocked(StdioServerTransport).mockImplementation(function() { return mockStdioTransport as any; });

    mockSessionManager = createMockSessionManager(mockDependencies.adapterRegistry);
    vi.mocked(SessionManager).mockImplementation(function() { return mockSessionManager as any; });

    new DebugMcpServer();
    callToolHandler = getToolHandlers(mockServer).callToolHandler;

    // A pre-launch session: no lastLaunch, so nothing says the program runs from .ts.
    mockSessionManager.getSession.mockReturnValue({ id: 'test-session', sessionLifecycle: 'active' });
    mockSessionManager.getSessionPolicy.mockReturnValue(JsDebugAdapterPolicy);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  async function setBreakpoint(file: string, record: Record<string, unknown>) {
    mockSessionManager.setBreakpoint.mockResolvedValue({
      breakpoint: { id: 'bp-1', file, line: 3, requestedLine: 3, verified: false, ...record }
    });
    const result = await callToolHandler({
      method: 'tools/call',
      params: { name: 'set_breakpoint', arguments: { sessionId: 'test-session', file, line: 3 } }
    });
    return JSON.parse(result.content[0].text);
  }

  it('warns, naming both files and their mtimes, when the compiled file its map names is older than the source', async () => {
    const content = await setBreakpoint(SRC, {});

    expect(content.success).toBe(true);
    expect(content.warning).toMatch(/may be stale/);
    expect(content.warning).toContain(DIST);
    expect(content.warning).toContain(SRC);
    expect(content.warning).toContain(new Date(10_000).toISOString());
    expect(content.warning).toContain(new Date(20_000).toISOString());
    // The echo still comes from the source, and the message is the plain one.
    expect(content.content).toBe('');
    expect(content.message).not.toMatch(/may be stale/);
  });

  it('follows the loud-snapping warning with the staleness, its likely cause, and leaves the message to the snap', async () => {
    const content = await setBreakpoint(SRC, { line: 4, requestedLine: 3 });

    const snapAt = content.warning.indexOf('requested line 3, bound to line 4');
    const staleAt = content.warning.indexOf('may be stale');
    expect(snapAt).toBeGreaterThanOrEqual(0);
    expect(staleAt).toBeGreaterThan(snapAt);
    expect(content.warning.slice(snapAt, staleAt)).toContain('; ');
    expect(content.message).toContain('requested line 3, bound to line 4');
    expect(content.message).not.toMatch(/may be stale/);
  });

  it('says nothing about a current build', async () => {
    files[DIST].mtimeMs = 30_000;
    files[DIST_MAP].mtimeMs = 30_000;

    const content = await setBreakpoint(SRC, {});

    expect(content.success).toBe(true);
    expect(content.warning ?? '').not.toMatch(/may be stale/);
  });

  it('does not look for a build for a file the adapter does not compile', async () => {
    const content = await setBreakpoint(PY, {});

    expect(content.success).toBe(true);
    expect(content.warning ?? '').not.toMatch(/may be stale/);
    const probed = vi.mocked(mockDependencies.fileSystem.pathExists).mock.calls.map(([file]) => String(file));
    expect(probed.some(file => file.endsWith('tsconfig.json'))).toBe(false);
  });

  it('does not look for a build under an adapter whose policy declares no generated files', async () => {
    mockSessionManager.getSessionPolicy.mockReturnValue({});

    const content = await setBreakpoint(SRC, {});

    expect(content.warning ?? '').not.toMatch(/may be stale/);
    const probed = vi.mocked(mockDependencies.fileSystem.pathExists).mock.calls.map(([file]) => String(file));
    expect(probed.some(file => file.endsWith('tsconfig.json'))).toBe(false);
  });

  describe('a compiled language binds through the artefact the launch runs (issue #950)', () => {
    const CS = at('Program.cs');
    const DLL = at('bin', 'Debug', 'net8.0', 'app.dll');
    const launched = { program: DLL, launchConfig: { program: DLL } };

    beforeEach(() => {
      files[CS] = { content: TS_FILE, mtimeMs: 20_000 };
      files[DLL] = { content: 'MZ', mtimeMs: 10_000 };
      mockSessionManager.getSessionPolicy.mockReturnValue(DotnetAdapterPolicy);
    });

    it('warns on a .NET source newer than the launched DLL, naming both', async () => {
      mockSessionManager.getSession.mockReturnValue({ id: 'test-session', sessionLifecycle: 'active', transformedLaunch: launched });

      const content = await setBreakpoint(CS, {});

      expect(content.success).toBe(true);
      expect(content.warning).toMatch(/may be stale/);
      expect(content.warning).toContain(DLL);
      expect(content.warning).toContain(CS);
    });

    it('says nothing before a launch: the artefact is unknown until the transform names it', async () => {
      const content = await setBreakpoint(CS, {});

      expect(content.warning ?? '').not.toMatch(/may be stale/);
      const stats = vi.mocked(mockDependencies.fileSystem.stat).mock.calls.map(([file]) => String(file));
      expect(stats).not.toContain(DLL);
    });

    it('says nothing about a DLL as new as the source, nor on an attach session', async () => {
      files[DLL].mtimeMs = 20_000;
      mockSessionManager.getSession.mockReturnValue({ id: 'test-session', sessionLifecycle: 'active', transformedLaunch: launched });
      expect((await setBreakpoint(CS, {})).warning ?? '').not.toMatch(/may be stale/);

      files[DLL].mtimeMs = 10_000;
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session', sessionLifecycle: 'active', attachMode: true, attachLocality: 'pid', transformedLaunch: launched
      });
      expect((await setBreakpoint(CS, {})).warning ?? '').not.toMatch(/may be stale/);
    });

    // The two carriers #951 added, through the full server and the real
    // checker: the launch answer, when the program is paused in the source
    // as the launch answers, and the stack, when its top frame is there.
    it('start_debugging carries the sentence as note when the launch answers paused in the source (issue #951)', async () => {
      mockSessionManager.getSession.mockReturnValue({ id: 'test-session', sessionLifecycle: 'active', transformedLaunch: launched });
      mockSessionManager.startDebugging.mockResolvedValue({
        success: true,
        state: 'paused',
        data: { message: 'Debugging started', reason: 'breakpoint', location: { file: CS, line: 4, column: 1 } }
      });

      const result = await callToolHandler({
        method: 'tools/call',
        params: { name: 'start_debugging', arguments: { sessionId: 'test-session', scriptPath: DLL } }
      });
      const content = JSON.parse(result.content[0].text);

      expect(content.success, JSON.stringify(content)).toBe(true);
      expect(content.state).toBe('paused');
      expect(content.location).toEqual({ file: CS, line: 4, column: 1 });
      expect(content.context?.lineContent).toBe('  for (const p of prices) sum += p;');
      expect(content.note).toMatch(/may be stale/);
      expect(content.note).toContain(DLL);
      expect(content.note).toContain(CS);
    });

    it('get_stack_trace carries the sentence as note when its top frame is in the source (issue #951)', async () => {
      // Paused with a current thread: the server reads the stack through the
      // session layer's detailed read, which the mock answers below.
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: 'active',
        state: 'paused',
        proxyManager: { getCurrentThreadId: () => 1, setCurrentThreadId: vi.fn() },
        transformedLaunch: launched
      });
      mockSessionManager.getStackTraceDetailed.mockResolvedValue({
        frames: [{ id: 1, name: 'HelloWorld.Add', file: CS, line: 4, column: 1 }],
        threadId: 1,
        totalFrameCount: 1,
        hiddenFrameCount: 0,
        allFramesInternal: false
      });

      const result = await callToolHandler({
        method: 'tools/call',
        params: { name: 'get_stack_trace', arguments: { sessionId: 'test-session' } }
      });
      const content = JSON.parse(result.content[0].text);

      expect(content.success, JSON.stringify(content)).toBe(true);
      expect(content.stackFrames[0].file).toBe(CS);
      expect(content.note).toMatch(/may be stale/);
      expect(content.note).toContain(DLL);
    });
  });
});
