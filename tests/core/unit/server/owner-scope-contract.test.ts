/**
 * The isolation seam's contract (issue #1025, step 2): for a caller, a debug
 * session outside its scope does not exist. Not "is refused" — does not exist:
 * every tool that takes a `sessionId` must answer a foreign session exactly as
 * it answers an id nobody holds, with well-formed and with malformed
 * arguments, or the difference tells the caller the session is there. And a
 * tool that takes no `sessionId` must not be steered by a stray one.
 *
 * This runs the real dispatch over the real SessionManager and SessionStore
 * (mock proxy), never a fake context: a fake that lacks a method makes a
 * handler fail the same way for both ids and proves nothing. Each tool is
 * called twice by the same caller with the same arguments — once naming a
 * session another principal owns, once naming an id that was never minted —
 * and the two answers must be equal once the id itself is masked. The caller
 * is a different principal, and separately an anonymous one: the anonymous
 * scope is the one every unauthenticated request is in.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { DebugLanguage, SessionState } from '@debugmcp/shared';
import { DebugMcpServer } from '../../../../src/server.js';
import { registerToolHandlers } from '../../../../src/server/tool-dispatch.js';
import { FacadeSubscriptions, registerResourceHandlers, outputResourceUri } from '../../../../src/server/output-resources.js';
import { buildToolDefinitions, TOOL_ALIASES, type ToolDefinition } from '../../../../src/server/tool-schemas.js';
import { createProductionDependencies, type Dependencies } from '../../../../src/container/dependencies.js';
import { createMockDependencies } from '../session/session-manager-test-utils.js';

vi.mock('../../../../src/container/dependencies.js');

const NOBODY = '00000000-0000-4000-8000-000000000000';
const OWNER = 'agent-b';

type Handler = (request: unknown, callCtx?: unknown) => Promise<unknown>;

const callCtxFor = (clientId?: string) => ({
  mcpReq: { signal: new AbortController().signal },
  ...(clientId !== undefined ? { http: { authInfo: { clientId, token: 't', scopes: [] } } } : {})
});

function handlersOf(register: (recorder: never) => void): Map<string, Handler> {
  const handlers = new Map<string, Handler>();
  register({ setRequestHandler: (method: string, handler: Handler) => handlers.set(method, handler) } as never);
  return handlers;
}

/** What a call did, as the caller sees it: a result or a protocol error, with the id masked. */
async function outcome(handler: Handler, request: unknown, clientId: string | undefined, id: string): Promise<string> {
  let seen: unknown;
  try {
    seen = { result: await handler(request, callCtxFor(clientId)) };
  } catch (error) {
    const thrown = error as { constructor: { name: string }; code?: unknown; message?: unknown; data?: unknown };
    seen = { thrown: { type: thrown.constructor.name, code: thrown.code, message: thrown.message, data: thrown.data } };
  }
  return JSON.stringify(seen).split(id).join('<id>');
}

type Schema = { type?: string; enum?: unknown[] };

/** A plausible value for a schema property. */
function plausible(schema: Schema): unknown {
  if (schema.enum?.length) return schema.enum[0];
  switch (schema.type) {
    case 'number':
    case 'integer':
      return 1;
    case 'boolean':
      return true;
    case 'object':
      return {};
    case 'array':
      return [];
    default:
      return 'x';
  }
}

/** A value of the wrong type for a schema property, to walk the argument checks. */
function wrong(schema: Schema): unknown {
  return schema.type === 'string' || schema.type === undefined ? { not: 'a string' } : 'not-the-right-type';
}

const SHAPES = ['the id alone', 'required arguments filled', 'every argument filled', 'every argument of the wrong type'] as const;

function argumentsFor(definition: ToolDefinition, shape: (typeof SHAPES)[number], sessionId: string): Record<string, unknown> {
  const properties = (definition.inputSchema.properties ?? {}) as Record<string, Schema>;
  const required = new Set((definition.inputSchema.required ?? []) as string[]);
  const args: Record<string, unknown> = {};
  for (const [name, schema] of Object.entries(properties)) {
    if (name === 'sessionId') continue;
    if (shape === 'the id alone') continue;
    if (shape === 'required arguments filled' && !required.has(name)) continue;
    args[name] = shape === 'every argument of the wrong type' ? wrong(schema) : plausible(schema);
  }
  return { ...args, sessionId };
}

const environment = { get: () => undefined, getAll: () => ({}), getCurrentWorkingDirectory: () => '/' };
const takesSessionId = (definition: ToolDefinition): boolean =>
  Object.prototype.hasOwnProperty.call(definition.inputSchema.properties ?? {}, 'sessionId');
const ALL_TOOLS = buildToolDefinitions({ supportedLanguages: ['mock'], environment });
const BY_NAME = new Map(ALL_TOOLS.map((definition) => [definition.name as string, definition]));
/** Every name a caller can use for a tool that takes a `sessionId`: the listed tools and the unlisted aliases. */
const SESSION_TOOLS: Array<readonly [string, ToolDefinition]> = [
  ...ALL_TOOLS.filter(takesSessionId).map((definition) => [definition.name as string, definition] as const),
  ...Object.entries(TOOL_ALIASES)
    .map(([alias, target]) => [alias, BY_NAME.get(target)] as const)
    .filter((entry): entry is readonly [string, ToolDefinition] => entry[1] !== undefined && takesSessionId(entry[1]))
];
const STRANGERS = [['another principal', 'agent-a'], ['an anonymous caller', undefined]] as const;

describe.each(['created', 'paused at a breakpoint'] as const)(
  'a session outside the caller scope does not exist for the caller (foreign session %s)',
  (foreignState) => {
    let core: DebugMcpServer;
    let dependencies: ReturnType<typeof createMockDependencies>;
    let callTool: Handler;
    let resources: Map<string, Handler>;
    let foreign: string;

    // One foreign session for the whole matrix: no case may change it, and every case checks that.
    beforeAll(async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      vi.setSystemTime(1_000_000);
      dependencies = createMockDependencies();
      vi.mocked(createProductionDependencies).mockReturnValue(dependencies as unknown as Dependencies);
      core = new DebugMcpServer();
      callTool = handlersOf((recorder) => registerToolHandlers(recorder, core)).get('tools/call')!;
      resources = handlersOf((recorder) => registerResourceHandlers(recorder, core.sessionManager, new FacadeSubscriptions(), core.fileSystem));

      const session = await core.sessionManager.createSession({ language: DebugLanguage.MOCK, ownerKey: OWNER });
      foreign = session.id;
      if (foreignState === 'paused at a breakpoint') {
        await core.sessionManager.setBreakpoint(foreign, { file: '/w/app.py', line: 7 });
        await core.sessionManager.startDebugging(foreign, 'test.py');
        await vi.runAllTimersAsync();
        dependencies.mockProxyManager.simulateStopped(1, 'breakpoint');
        await vi.runAllTimersAsync();
        expect(core.sessionManager.getSession(foreign)?.state).toBe(SessionState.PAUSED);
      }
      // The stranger arrives ten seconds after the owner's last call.
      vi.setSystemTime(Date.now() + 10_000);
    });

    afterAll(async () => {
      await core.sessionManager.closeAllSessions().catch(() => undefined);
      dependencies.mockProxyManager.reset();
      vi.useRealTimers();
      vi.clearAllMocks();
    });

    /** When the foreign session's idle clock was last refreshed, whatever the clock reads now. */
    const lastActivity = (): number => {
      const at = Date.now();
      return at - core.sessionManager.idleMsOf(foreign, at)!;
    };

    describe.each(STRANGERS)('asked by %s', (_who, stranger) => {
      describe.each(SESSION_TOOLS)('%s', (name, definition) => {
        it.each(SHAPES)('answers a foreign session as it answers an id nobody holds: %s', async (shape) => {
          const stateBefore = core.sessionManager.getSession(foreign)?.state;
          const activityBefore = lastActivity();
          const request = (sessionId: string) =>
            ({ method: 'tools/call', params: { name, arguments: argumentsFor(definition, shape, sessionId) } });

          const forForeign = await outcome(callTool, request(foreign), stranger, foreign);
          const forNobody = await outcome(callTool, request(NOBODY), stranger, NOBODY);

          expect(forForeign).toBe(forNobody);
          // And the call changed nothing: the session is still there, in the
          // state its owner left it, and its idle clock was not refreshed.
          expect(core.sessionManager.getSession(foreign)?.state).toBe(stateBefore);
          expect(lastActivity()).toBe(activityBefore);
        });
      });

      // A tool that takes no sessionId ignores one: a stray id — the one an
      // agent carries along from an earlier call — must not change what the
      // tool answers, and above all must not make it name the foreign session.
      it('list_debug_sessions does not list the foreign session, with or without its id as a stray argument', async () => {
        const list = (args: Record<string, unknown>, id: string) =>
          outcome(callTool, { method: 'tools/call', params: { name: 'list_debug_sessions', arguments: args } }, stranger, id);

        const plain = await list({}, foreign);
        const withForeign = await list({ sessionId: foreign }, foreign);
        const withNobody = await list({ sessionId: NOBODY }, NOBODY);

        expect(plain).not.toContain('<id>');
        expect(withForeign).not.toContain('<id>');
        expect(withForeign).toBe(withNobody);
        expect(withForeign).toBe(plain);
      });

      it('list_supported_languages answers the same with a stray foreign id as with an unknown one', async () => {
        const languages = (id: string) =>
          outcome(callTool, { method: 'tools/call', params: { name: 'list_supported_languages', arguments: { sessionId: id } } }, stranger, id);

        expect(await languages(foreign)).toBe(await languages(NOBODY));
      });

      it('the operator log names a foreign session as it names an unknown one', async () => {
        const logged = (id: string) =>
          vi.mocked(dependencies.mockLogger.info).mock.calls
            .filter(([message, meta]) => message === 'tool:call' && (meta as { sessionId?: string }).sessionId === id)
            .map(([, meta]) => (meta as { sessionName?: string }).sessionName);
        vi.mocked(dependencies.mockLogger.info).mockClear();

        for (const tool of ['get_output', 'list_debug_sessions']) {
          await outcome(callTool, { method: 'tools/call', params: { name: tool, arguments: { sessionId: foreign } } }, stranger, foreign);
          await outcome(callTool, { method: 'tools/call', params: { name: tool, arguments: { sessionId: NOBODY } } }, stranger, NOBODY);
        }

        expect(logged(foreign)).toHaveLength(2);
        expect(logged(foreign)).toEqual(logged(NOBODY));
      });

      it.each(['resources/read', 'resources/subscribe'])('%s answers a foreign output resource as an unknown one', async (method) => {
        const request = (sessionId: string) => ({ method, params: { uri: outputResourceUri(sessionId) } });

        const forForeign = await outcome(resources.get(method)!, request(foreign), stranger, foreign);
        const forNobody = await outcome(resources.get(method)!, request(NOBODY), stranger, NOBODY);

        expect(forForeign).toBe(forNobody);
        // The handler's own refusal, not a harness accident that fails both alike.
        expect(forNobody).toContain('Unknown resource');
      });

      it('resources/list does not list the foreign session', async () => {
        expect(await outcome(resources.get('resources/list')!, { method: 'resources/list', params: {} }, stranger, foreign)).not.toContain('<id>');
      });
    });

    it('the owner still reaches its session, its resources and its row', async () => {
      const call = (name: string, args: Record<string, unknown>) =>
        outcome(callTool, { method: 'tools/call', params: { name, arguments: args } }, OWNER, foreign);

      expect(JSON.parse(await call('list_breakpoints', { sessionId: foreign })).result.content[0].text).toContain('"success":true');
      expect(await call('list_debug_sessions', {})).toContain('<id>');
      for (const method of ['resources/read', 'resources/subscribe']) {
        expect(await outcome(resources.get(method)!, { method, params: { uri: outputResourceUri(foreign) } }, OWNER, foreign)).toContain('"result"');
      }
    });
  }
);
