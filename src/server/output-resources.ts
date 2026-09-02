/**
 * Per-session debug resources (issues #218 / #571).
 *
 * Each debug session exposes its captured debuggee output as
 * debug://sessions/{id}/output — a verbatim console transcript (all categories
 * interleaved, in arrival order). Clients may subscribe to receive coalesced
 * resources/updated pings as output arrives; structured/cursor access is
 * available via the get_output tool.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  SubscribeRequestSchema,
  UnsubscribeRequestSchema,
  ErrorCode as McpErrorCode
} from '@modelcontextprotocol/sdk/types.js';
import { ILogger, type IFileSystem } from '@debugmcp/shared';
import { WireMcpError } from '../errors/debug-errors.js';
import type { SessionManager } from '../session/session-manager.js';
import { proxyLogPathFor } from '../proxy/session-log-layout.js';
import { readProxyLogTail } from '../session/launch/proxy-failure-diagnostics.js';
import {
  outputResourceUri,
  parseOutputResourceUri,
  parseProxyLogResourceUri,
  proxyLogResourceUri
} from '../session/session-resource-uris.js';

export {
  outputResourceUri,
  parseOutputResourceUri,
  parseProxyLogResourceUri,
  proxyLogResourceUri
} from '../session/session-resource-uris.js';

/** Debounce window for resources/updated pings. */
export const OUTPUT_UPDATE_DEBOUNCE_MS = 150;

/**
 * Subscription bookkeeping and debounced resources/updated pings for the
 * output resources. URIs subscribed via resources/subscribe; updated-pings are
 * debounced so notification volume is independent of debuggee output volume.
 */
export class OutputResourceNotifier {
  private readonly subscribedUris = new Set<string>();
  private readonly outputUpdateTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly server: Server,
    private readonly logger: ILogger
  ) {}

  /**
   * Stable listener for SessionManager's 'output-captured' event: the owner
   * registers this exact reference with on() and removes it with
   * removeListener() on stop().
   */
  readonly handleOutputCaptured = (sessionId: string): void => {
    this.scheduleUpdated(sessionId);
  };

  subscribe(uri: string): void {
    this.subscribedUris.add(uri);
  }

  unsubscribe(uri: string): void {
    this.subscribedUris.delete(uri);
    this.clearTimer(uri);
  }

  /** The session's output resource is gone: drop its subscription and timer. */
  forgetSession(sessionId: string): void {
    this.unsubscribe(outputResourceUri(sessionId));
  }

  /**
   * Throttled resources/updated ping for a session's output resource: the
   * first captured event after a quiet period arms a timer; everything that
   * arrives inside the window rides the same ping.
   */
  scheduleUpdated(sessionId: string): void {
    const uri = outputResourceUri(sessionId);
    if (!this.subscribedUris.has(uri) || this.outputUpdateTimers.has(uri)) {
      return;
    }
    const timer = setTimeout(() => {
      this.outputUpdateTimers.delete(uri);
      this.server.sendResourceUpdated({ uri }).catch((error: unknown) => {
        // Not connected yet / transport gone — nothing to notify, not an error.
        this.logger.debug(`[Server] Failed to send resources/updated for ${uri}`, { error });
      });
    }, OUTPUT_UPDATE_DEBOUNCE_MS);
    timer.unref?.();
    this.outputUpdateTimers.set(uri, timer);
  }

  /** Fire-and-forget resources/list_changed (sessions appeared/disappeared). */
  notifyListChanged(): void {
    this.server.sendResourceListChanged().catch((error: unknown) => {
      this.logger.debug('[Server] Failed to send resources/list_changed', { error });
    });
  }

  /**
   * Tear down output-resource bookkeeping: pending debounce timers must not
   * outlive the server (the test suite runs with a strict leak guard).
   */
  dispose(): void {
    for (const uri of this.outputUpdateTimers.keys()) {
      this.clearTimer(uri);
    }
    this.subscribedUris.clear();
  }

  private clearTimer(uri: string): void {
    const timer = this.outputUpdateTimers.get(uri);
    if (timer) {
      clearTimeout(timer);
      this.outputUpdateTimers.delete(uri);
    }
  }
}

/**
 * Registers the MCP resource handlers. Only debuggee output is subscribable;
 * the bounded proxy-log tail is an on-demand diagnostic snapshot.
 */
export function registerResourceHandlers(
  server: Server,
  sessionManager: SessionManager,
  notifier: OutputResourceNotifier,
  fileSystem: Pick<IFileSystem, 'readTail'>
): void {
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const sessions = sessionManager.getAllSessions();
    return {
      resources: sessions.flatMap(session => {
        const resources = [{
          uri: outputResourceUri(session.id),
          name: `Debuggee output — ${session.name}`,
          description: `stdout/stderr/console output captured for ${session.language} debug session '${session.name}'`,
          mimeType: 'text/plain'
        }];
        if (sessionManager.getSession(session.id)?.logDir) {
          resources.push({
            uri: proxyLogResourceUri(session.id),
            name: `Debug proxy log — ${session.name}`,
            description: `Sanitized tail of the debug proxy log for ${session.language} debug session '${session.name}'`,
            mimeType: 'text/plain'
          });
        }
        return resources;
      })
    };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;
    const outputSessionId = parseOutputResourceUri(uri);
    const proxyLogSessionId = parseProxyLogResourceUri(uri);
    const sessionId = outputSessionId ?? proxyLogSessionId;
    const session = sessionId ? sessionManager.getSession(sessionId) : undefined;
    if (!session) {
      throw new WireMcpError(McpErrorCode.InvalidParams, `Unknown resource: ${uri}`);
    }
    if (proxyLogSessionId) {
      if (!session.logDir) {
        throw new WireMcpError(McpErrorCode.InvalidParams, `Unknown resource: ${uri}`);
      }
      const text = await readProxyLogTail(
        fileSystem,
        proxyLogPathFor(session.logDir, session.id)
      );
      return {
        contents: [{ uri, mimeType: 'text/plain', text: text ?? '' }]
      };
    }
    return {
      contents: [{
        uri,
        mimeType: 'text/plain',
        // Empty until the first launch creates the buffer
        text: session.outputBuffer?.renderText() ?? ''
      }]
    };
  });

  server.setRequestHandler(SubscribeRequestSchema, async (request) => {
    const uri = request.params.uri;
    const sessionId = parseOutputResourceUri(uri);
    if (!sessionId || !sessionManager.getSession(sessionId)) {
      throw new WireMcpError(McpErrorCode.InvalidParams, `Unknown resource: ${uri}`);
    }
    notifier.subscribe(uri);
    return {};
  });

  server.setRequestHandler(UnsubscribeRequestSchema, async (request) => {
    const uri = request.params.uri;
    notifier.unsubscribe(uri);
    return {};
  });
}
