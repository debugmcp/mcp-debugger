/**
 * The protocol facade (issue #1025, step 2): one SDK `Server` per connection
 * or per request over the one shared DebugMcpServer core.
 *
 * The 2026-07-28 serving entries build a Server per HTTP request
 * (`createMcpHandler`) or per stdio connection plus a discarded probe instance
 * (`serveStdio`), so a facade has to be cheap: the nine MCP handlers closing
 * over the core, the error and initialized hooks, and one notification sink
 * that lives exactly as long as the facade does. No dependency container, no
 * SessionManager, no logger of its own.
 */
import { CLIENT_INFO_META_KEY, PROTOCOL_VERSION_META_KEY, Server } from '@modelcontextprotocol/server';
import type { DebugMcpServer } from '../server.js';
import { facadeSink } from './notification-hub.js';
import { FacadeSubscriptions, registerResourceHandlers } from './output-resources.js';
import { registerPromptHandlers } from './prompts.js';
import { registerToolHandlers } from './tool-dispatch.js';

/** The wire era a facade serves: the 2025 handshake family, or 2026-07-28. */
export type ProtocolEra = 'legacy' | 'modern';

export interface ProtocolFacadeOptions {
  era: ProtocolEra;
  /**
   * How this facade's Server delivers notifications. `instance`: the Server
   * itself is long-lived (a stdio pin, a legacy HTTP session) and sends them,
   * so the facade attaches a sink to the core's hub. `external`: the Server
   * serves one HTTP request and cannot send anything afterwards; the HTTP
   * layer's handler notifier is the sink instead, so the facade attaches none.
   */
  deliver: 'instance' | 'external';
}

type Registrar = Pick<Server, 'setRequestHandler'>;
type AnyHandler = (request: unknown, callCtx: unknown) => unknown;

/** What a 2026-07-28 request says about its sender: the envelope the SDK lifts out of `_meta`. */
function modernClientOf(server: Server, callCtx: unknown): { protocolVersion?: string; client?: string } {
  // The SDK types the envelope as `{}`; the keys are its own exported constants.
  const envelope = (callCtx as { mcpReq?: { envelope?: Record<string, unknown> } } | undefined)?.mcpReq?.envelope;
  const revision = envelope?.[PROTOCOL_VERSION_META_KEY];
  const info = envelope?.[CLIENT_INFO_META_KEY] as { name?: unknown; version?: unknown } | undefined;
  // Client info is optional and self-reported: a label for the log, bounded, never a key for behaviour.
  const client = typeof info?.name === 'string'
    ? `${info.name}${typeof info.version === 'string' ? ` ${info.version}` : ''}`.slice(0, 200)
    : undefined;
  return {
    protocolVersion: typeof revision === 'string' ? revision : server.getNegotiatedProtocolVersion(),
    client
  };
}

/**
 * A registrar for a modern-era facade: every handler registered through it
 * first tells the core who is calling. The 2026-07-28 era has no handshake to
 * log a client from (`oninitialized` never fires), so the first request that
 * reaches a handler is where a client becomes known; the core logs each
 * distinct client once per process.
 */
function identifyingClients(server: Server, core: DebugMcpServer): Registrar {
  const register = server.setRequestHandler.bind(server) as unknown as (method: string, handler: AnyHandler) => void;
  const setRequestHandler = (method: string, handler: AnyHandler): void =>
    register(method, (request, callCtx) => {
      core.noteModernClient(modernClientOf(server, callCtx));
      return handler(request, callCtx);
    });
  return { setRequestHandler: setRequestHandler as unknown as Server['setRequestHandler'] };
}

export function createProtocolServer(core: DebugMcpServer, options: ProtocolFacadeOptions): Server {
  // Everything the Server advertises is read off the core, computed once per
  // process: a facade is built per connection or per request.
  const server = new Server(
    { name: 'debug-mcp-server', version: core.version },
    {
      capabilities: { tools: {}, resources: { subscribe: true, listChanged: true }, prompts: {} },
      instructions: core.instructions
    }
  );

  // resources/subscribe bookkeeping is per facade: a subscription belongs to
  // the connection that made it.
  const subscriptions = new FacadeSubscriptions();
  const registrar: Registrar = options.era === 'modern' ? identifyingClients(server, core) : server;
  registerToolHandlers(registrar, core);
  registerResourceHandlers(registrar, core.sessionManager, subscriptions, core.fileSystem);
  registerPromptHandlers(registrar, core.environment);

  // The protocol version each legacy client negotiates (issue #1025). The
  // modern era has no initialize; its clients are named on their first
  // handled request, through the registrar above.
  server.oninitialized = () => {
    const client = server.getClientVersion();
    core.logger.info('[MCP Server] Client initialized', {
      protocolVersion: server.getNegotiatedProtocolVersion(),
      client: client ? `${client.name} ${client.version}` : undefined
    });
  };
  server.onerror = (error) => {
    core.logger.error('Server error', { error });
  };

  if (options.deliver === 'instance') {
    // A legacy facade pings what it subscribed to; a modern pin pings every
    // URI and the SDK's listen router filters. Either way the sink leaves
    // with the facade: the serving entries chain onclose rather than
    // replacing it, so this hook survives them.
    const detach = core.notifications.addSink(
      facadeSink(server, options.era === 'legacy' ? subscriptions : undefined)
    );
    const previous = server.onclose;
    server.onclose = () => {
      detach();
      previous?.();
    };
  }

  return server;
}
