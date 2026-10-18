/**
 * Helpers shared by more than one tool handler.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JsDebugAdapterPolicy, Variable } from '@debugmcp/shared';
import {
  appendNote,
  attachRequestFromArgs,
  describeStaleBuild,
  readLineContext,
  redactionSummary,
  variablePayloadExtras,
  successWarning
} from '../../../../../src/server/handlers/shared.js';
import type { ToolArguments } from '../../../../../src/server/tool-arguments.js';
import { createMockToolContext } from '../server-test-helpers.js';

// DebugMcpServer builds its dependencies in the constructor; mock the container
// so createMockToolContext() never opens a real logger transport or session dir.
vi.mock('../../../../../src/container/dependencies.js');
vi.mock('../../../../../src/session/session-manager.js');

function variable(name: string, overrides: Partial<Variable> = {}): Variable {
  return { name, value: '1', type: 'int', expandable: false, ...overrides };
}

describe('variablePayloadExtras', () => {
  it('returns nothing when there is no filter, no redaction and no truncation', () => {
    expect(variablePayloadExtras([variable('x')], undefined, undefined)).toEqual({});
  });

  it('emits notFound: [] for a filter that matched everything', () => {
    const extras = variablePayloadExtras([variable('x')], ['x'], undefined);

    expect(extras.notFound).toEqual([]);
    expect('notFound' in extras).toBe(true);
  });

  it('emits notFound: [] for an EMPTY filter — [] is truthy, so the key must still appear', () => {
    const extras = variablePayloadExtras([variable('x')], [], undefined);

    expect('notFound' in extras).toBe(true);
    expect(extras.notFound).toEqual([]);
  });
  it('lists only the names that were not returned', () => {
    const extras = variablePayloadExtras([variable('x')], ['x', 'missing'], undefined);
    expect(extras.notFound).toEqual(['missing']);
  });

  it('keys notFound, redaction and truncation in that order', () => {
    const extras = variablePayloadExtras(
      [variable('secret', { redacted: true })],
      ['secret', 'gone'],
      { omittedCount: 2, valueTruncatedCount: 1 }
    );

    expect(Object.keys(extras)).toEqual(['notFound', 'redaction', 'truncation']);
    expect(extras.redaction?.masked).toBe(1);
    expect(extras.truncation?.omittedCount).toBe(2);
    expect(typeof extras.truncation?.notice).toBe('string');
    expect(extras.truncation?.notice.length).toBeGreaterThan(0);
  });
});

describe('redactionSummary', () => {
  it('is absent when nothing was masked', () => {
    expect(redactionSummary([{ redacted: false }, {}])).toBeUndefined();
  });

  it('counts the masked entries', () => {
    expect(redactionSummary([{ redacted: true }, {}, { redacted: true }])?.masked).toBe(2);
  });
});

describe('successWarning', () => {
  it('reports the data warning of a successful attach', () => {
    expect(successWarning({ success: true, data: { warning: 'dropped foo' } })).toBe('dropped foo');
  });

  it('stays silent on failure, and when there is no data or no warning', () => {
    expect(successWarning({ success: false, data: { warning: 'dropped foo' } })).toBeUndefined();
    expect(successWarning({ success: true })).toBeUndefined();
    expect(successWarning({ success: true, data: {} })).toBeUndefined();
  });
});

describe('describeStaleBuild (issue #938)', () => {
  let ctx: any;
  const evidence = {
    sourceFile: '/app/src/a.ts',
    sourceMtimeMs: Date.UTC(2026, 9, 16, 23, 9, 0),
    generatedFile: '/app/dist/a.js',
    generatedMtimeMs: Date.UTC(2026, 9, 16, 23, 4, 0),
    mapFile: '/app/dist/a.js.map'
  };

  beforeEach(() => {
    ctx = createMockToolContext();
    ctx.buildStaleness = { check: vi.fn().mockResolvedValue(evidence) };
    ctx.sessionManager.getSession.mockReturnValue({ id: 's1', lastLaunch: { scriptPath: '/app/dist/main.js' } });
    ctx.sessionManager.getSessionPolicy.mockReturnValue(JsDebugAdapterPolicy);
  });

  it('names both files and their mtimes in a hedged sentence when the build is older than the source', async () => {
    const sentence = await describeStaleBuild(ctx, 's1', '/app/src/a.ts', 'breakpoint');

    expect(ctx.buildStaleness.check).toHaveBeenCalledWith('/app/src/a.ts', JsDebugAdapterPolicy);
    expect(sentence).toMatch(/may be stale/);
    expect(sentence).toContain('/app/dist/a.js');
    expect(sentence).toContain('/app/src/a.ts');
    expect(sentence).toContain('2026-10-16T23:04');
    expect(sentence).toContain('2026-10-16T23:09');
  });

  it('says nothing when the checker finds nothing', async () => {
    ctx.buildStaleness.check.mockResolvedValue(undefined);

    expect(await describeStaleBuild(ctx, 's1', '/app/src/a.ts', 'breakpoint')).toBeUndefined();
  });

  it('asks nothing for a policy without the hook', async () => {
    ctx.sessionManager.getSessionPolicy.mockReturnValue({});

    expect(await describeStaleBuild(ctx, 's1', '/app/src/a.ts', 'breakpoint')).toBeUndefined();
    expect(ctx.buildStaleness.check).not.toHaveBeenCalled();
  });

  it('asks nothing for an attach whose target is not on this host: the host file is not the debuggee\'s source', async () => {
    ctx.sessionManager.getSession.mockReturnValue({ id: 's1', attachMode: true, attachLocality: 'remote' });

    expect(await describeStaleBuild(ctx, 's1', '/app/src/a.ts', 'breakpoint')).toBeUndefined();
    expect(ctx.buildStaleness.check).not.toHaveBeenCalled();
  });

  it('asks nothing when the program itself is a TypeScript source (tsx, ts-node, type stripping: no build to be stale)', async () => {
    ctx.sessionManager.getSession.mockReturnValue({ id: 's1', lastLaunch: { scriptPath: '/app/src/main.ts' } });

    expect(await describeStaleBuild(ctx, 's1', '/app/src/a.ts', 'breakpoint')).toBeUndefined();
    expect(ctx.buildStaleness.check).not.toHaveBeenCalled();
  });

  it('asks nothing when the launched program is a runner under node_modules (vitest, jest, mocha: the sources run in memory)', async () => {
    ctx.sessionManager.getSession.mockReturnValue({ id: 's1', lastLaunch: { scriptPath: '/app/node_modules/vitest/vitest.mjs' } });

    expect(await describeStaleBuild(ctx, 's1', '/app/src/a.ts', 'breakpoint')).toBeUndefined();
    expect(ctx.buildStaleness.check).not.toHaveBeenCalled();
  });

  it('ignores a stale lastLaunch on an attach session: the attached process is not the launched one', async () => {
    ctx.sessionManager.getSession.mockReturnValue({
      id: 's1', attachMode: true, attachLocality: 'pid', lastLaunch: { scriptPath: '/app/src/main.ts' }
    });

    expect(await describeStaleBuild(ctx, 's1', '/app/src/a.ts', 'breakpoint')).toMatch(/may be stale/);
    expect(ctx.buildStaleness.check).toHaveBeenCalledWith('/app/src/a.ts', JsDebugAdapterPolicy);
  });

  it('asks nothing for an unknown session', async () => {
    ctx.sessionManager.getSession.mockReturnValue(undefined);

    expect(await describeStaleBuild(ctx, 'nope', '/app/src/a.ts', 'breakpoint')).toBeUndefined();
    expect(ctx.buildStaleness.check).not.toHaveBeenCalled();
  });

  it('swallows a checker failure and logs it under the caller label', async () => {
    ctx.buildStaleness.check.mockRejectedValue(new Error('disk on fire'));

    expect(await describeStaleBuild(ctx, 's1', '/app/src/a.ts', 'step result')).toBeUndefined();
    expect(ctx.logger.debug).toHaveBeenCalledWith(
      'Could not check build staleness for step result',
      expect.objectContaining({ file: '/app/src/a.ts' })
    );
  });

  it('swallows a policy lookup failure', async () => {
    ctx.sessionManager.getSessionPolicy.mockImplementation(() => { throw new Error('no such session'); });

    expect(await describeStaleBuild(ctx, 's1', '/app/src/a.ts', 'breakpoint')).toBeUndefined();
  });
});

describe('appendNote', () => {
  it('space-joins onto an existing note, sets an absent one, and leaves the response alone for nothing', () => {
    const withNote: Record<string, unknown> = { note: 'existing' };
    appendNote(withNote, 'more');
    expect(withNote.note).toBe('existing more');

    const without: Record<string, unknown> = {};
    appendNote(without, 'first');
    expect(without.note).toBe('first');

    const untouched: Record<string, unknown> = { note: 'existing' };
    appendNote(untouched, undefined);
    expect(untouched).toEqual({ note: 'existing' });
    const empty: Record<string, unknown> = {};
    appendNote(empty, undefined);
    expect('note' in empty).toBe(false);
  });
});

describe('readLineContext', () => {
  let ctx: any;

  beforeEach(() => {
    ctx = createMockToolContext();
  });

  it('returns the line content and its surroundings', async () => {
    const getLineContext = vi.fn().mockResolvedValue({
      lineContent: 'x = 1',
      surrounding: [{ line: 1, content: 'x = 1' }],
      extraFieldTheHandlerIgnores: true
    });
    ctx.lineReader = { getLineContext };

    const context = await readLineContext(ctx, '/app/main.py', 1, 'breakpoint');

    expect(getLineContext).toHaveBeenCalledWith('/app/main.py', 1, { contextLines: 2 });
    expect(context).toEqual({ lineContent: 'x = 1', surrounding: [{ line: 1, content: 'x = 1' }] });
  });

  it('reports no context when the reader returns nothing', async () => {
    ctx.lineReader = { getLineContext: vi.fn().mockResolvedValue(null) };

    expect(await readLineContext(ctx, '/app/main.py', 1, 'breakpoint')).toBeUndefined();
    expect(ctx.logger.debug).not.toHaveBeenCalled();
  });

  it('swallows a reader failure and logs it under the caller label', async () => {
    const failure = new Error('unreadable');
    ctx.lineReader = { getLineContext: vi.fn().mockRejectedValue(failure) };

    expect(await readLineContext(ctx, '/app/main.py', 7, 'step result')).toBeUndefined();
    expect(ctx.logger.debug).toHaveBeenCalledWith(
      'Could not get line context for step result',
      { file: '/app/main.py', line: 7, error: failure }
    );
  });
});

describe('attachRequestFromArgs (issue #905)', () => {
  it('spells every AttachRequest key, forwarded as given, with breakOnExceptions validated', () => {
    const args: ToolArguments = {
      port: 5009, host: '10.0.0.5', processId: 4242, timeout: 7000, verifyTimeout: 12000,
      sourcePaths: ['/src'], stopOnEntry: false, justMyCode: false, breakOnExceptions: 'uncaught',
      adapterConfig: { pathMappings: [] }
    };

    expect(attachRequestFromArgs(args)).toEqual({ ...args });
  });

  it('defaults nothing: an absent host or timeout stays absent for the adapter to decide', () => {
    const request = attachRequestFromArgs({ port: 5009 });

    expect(Object.keys(request).sort()).toEqual([
      'adapterConfig', 'breakOnExceptions', 'host', 'justMyCode', 'port', 'processId',
      'sourcePaths', 'stopOnEntry', 'timeout', 'verifyTimeout'
    ]);
    expect(request.host).toBeUndefined();
    expect(request.timeout).toBeUndefined();
    expect(request.breakOnExceptions).toBeUndefined();
  });

  it('refuses an invalid breakOnExceptions', () => {
    expect(() => attachRequestFromArgs({ port: 5009, breakOnExceptions: 'sometimes' })).toThrow(/breakOnExceptions/);
  });
});
