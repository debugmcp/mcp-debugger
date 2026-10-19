/**
 * Debuggee lifecycle tool handlers (start_debugging, restart_debugging),
 * driven directly against a ToolContext. The landing a launch that stopped
 * reports (issue #951) is hoisted and annotated the way the step tools,
 * wait_for_stop and pause_execution hoist theirs: `location`, `threadId` and
 * `note` beside `state`, the source line as `context`, and the stale-build
 * sentence (issues #938/#950) appended to the note.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DotnetAdapterPolicy, SessionLifecycleState } from '@debugmcp/shared';
import { startDebuggingTool, restartDebuggingTool } from '../../../../../src/server/handlers/debuggee-tools.js';
import { createMockToolContext } from '../server-test-helpers.js';

// DebugMcpServer builds its dependencies in the constructor; mock the container
// so createMockToolContext() never opens a real logger transport or session dir.
vi.mock('../../../../../src/container/dependencies.js');
vi.mock('../../../../../src/session/session-manager.js');

describe('debuggee lifecycle tool handlers', () => {
  let ctx: any;
  const location = { file: '/app/Program.cs', line: 8, column: 0 };
  /** What the adapter's transform handed the engine for the current launch (issue #950). */
  const launched = { program: '/app/bin/app.dll', launchConfig: { program: '/app/bin/app.dll' } };
  const evidence = {
    sourceFile: '/app/Program.cs',
    sourceMtimeMs: 20_000,
    generatedFile: '/app/bin/app.dll',
    generatedMtimeMs: 10_000,
    linkedBy: 'launch' as const
  };
  const context = {
    lineContent: '        int result = a + b;',
    surrounding: [{ line: 8, content: '        int result = a + b;' }]
  };

  type Answer = (data: Record<string, unknown>, state?: string) => Promise<{ content: Array<{ text: string }> }>;
  const answers: Array<[string, Answer]> = [
    ['start_debugging', (data, state = 'paused') => {
      ctx.sessionManager.startDebugging.mockResolvedValue({ success: true, state, data });
      return startDebuggingTool(ctx, { sessionId: 'test-session', scriptPath: '/app/Program.cs' }, 'start_debugging');
    }],
    ['restart_debugging', (data, state = 'paused') => {
      ctx.sessionManager.restartDebugging.mockResolvedValue({ success: true, state, data });
      return restartDebuggingTool(ctx, { sessionId: 'test-session' }, 'restart_debugging');
    }]
  ];

  beforeEach(() => {
    ctx = createMockToolContext();
    ctx.sessionManager.getSession.mockReturnValue({
      id: 'test-session',
      sessionLifecycle: SessionLifecycleState.ACTIVE,
      transformedLaunch: launched
    });
    ctx.sessionManager.getSessionPolicy.mockReturnValue(DotnetAdapterPolicy);
    ctx.fileChecker = { checkExists: vi.fn().mockResolvedValue({ exists: true, effectivePath: '/app/Program.cs' }) };
    ctx.lineReader = { getLineContext: vi.fn().mockResolvedValue(context) };
    ctx.buildStaleness = { check: vi.fn().mockResolvedValue(undefined) };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('where the launch stopped (issue #951)', () => {
    for (const [tool, answer] of answers) {
      it(`${tool} hoists location, threadId and note beside state and reads the line, as wait_for_stop does`, async () => {
        const data = {
          message: 'Debugging started for /app/Program.cs. Current state: paused',
          reason: 'breakpoint',
          location,
          threadId: 7,
          note: 'existing'
        };

        const payload = JSON.parse((await answer(data)).content[0].text);

        expect(payload).toMatchObject({ success: true, state: 'paused', location, threadId: 7, note: 'existing', context });
        expect(ctx.lineReader.getLineContext).toHaveBeenCalledWith('/app/Program.cs', 8, { contextLines: 2 });
        // The session layer's own copy stays beneath, as for pause_execution.
        expect(payload.data.location).toEqual(location);
        expect(payload.data.reason).toBe('breakpoint');
      });

      it(`${tool} appends the stale-build sentence to its note when the artefact the launch runs is older than the source`, async () => {
        ctx.buildStaleness = { check: vi.fn().mockResolvedValue(evidence) };

        const payload = JSON.parse((await answer({ message: 'Paused', reason: 'breakpoint', location, note: 'existing' })).content[0].text);

        expect(ctx.buildStaleness.check).toHaveBeenCalledWith('/app/Program.cs', DotnetAdapterPolicy, launched);
        expect(payload.note).toMatch(/^existing The compiled file .* may be stale/);
      });

      it(`${tool} says the sentence alone when the stop had nothing else to note`, async () => {
        ctx.buildStaleness = { check: vi.fn().mockResolvedValue(evidence) };

        const payload = JSON.parse((await answer({ message: 'Paused', reason: 'breakpoint', location })).content[0].text);

        expect(payload.note).toMatch(/^The compiled file .* may be stale/);
        expect(payload.note).toContain('/app/bin/app.dll');
      });

      it(`${tool} hoists nothing and reads nothing for an answer without a location`, async () => {
        const payload = JSON.parse((await answer({ message: 'still running', pending: true }, 'running')).content[0].text);

        expect(payload).toMatchObject({ success: true, state: 'running', pending: true });
        expect(payload).not.toHaveProperty('location');
        expect(payload).not.toHaveProperty('note');
        expect(payload).not.toHaveProperty('context');
        expect(ctx.lineReader.getLineContext).not.toHaveBeenCalled();
        expect(ctx.buildStaleness.check).not.toHaveBeenCalled();
      });
    }
  });
});
