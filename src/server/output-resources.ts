/**
 * Per-session debug resources (issues #218 / #571).
 *
 * Each debug session exposes its captured debuggee output as
 * debug://sessions/{id}/output — a verbatim console transcript (all categories
 * interleaved, in arrival order). Clients may subscribe to receive coalesced
 * resources/updated pings as output arrives; structured/cursor access is
 * available via the get_output tool. The pings themselves are coalesced and
 * fanned out by the core's NotificationHub (issue #1025, step 2); this module
 * holds the handlers and the per-facade subscription set.
 */
import { Server, ProtocolErrorCode } from '@modelcontextprotocol/server';
import type { IFileSystem } from '@debugmcp/shared';
import { WireMcpError } from '../errors/debug-errors.js';
import type { SessionManager } from '../session/session-manager.js';
import { proxyLogPathFor } from '../proxy/session-log-layout.js';
import { readProxyLogTail } from '../session/launch/proxy-failure-diagnostics.js';
import { outputOnNote } from './handlers/output-tools.js';
import { ownerKeyOf } from './owner-key.js';
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

/** Which output URIs one protocol facade subscribed to through resources/subscribe. */
export interface ResourceSubscriptions {
  subscribe(uri: string): void;
  unsubscribe(uri: string): void;
}

/**
 * The per-facade subscription set (issue #1025, step 2). A subscription
 * belongs to the connection that made it; the coalesced resources/updated
 * pings themselves come from the core's NotificationHub, which asks this set
 * whether the facade wants a given URI.
 */
export class FacadeSubscriptions implements ResourceSubscriptions {
  private readonly uris = new Set<string>();

  subscribe(uri: string): void {
    this.uris.add(uri);
  }

  unsubscribe(uri: string): void {
    this.uris.delete(uri);
  }

  has(uri: string): boolean {
    return this.uris.has(uri);
  }

  /** The resource is gone (its session was removed): drop the subscription. */
  forget(uri: string): void {
    this.uris.delete(uri);
  }
}

/**
 * Registers the MCP resource handlers. Only debuggee output is subscribable;
 * the bounded proxy-log tail is an on-demand diagnostic snapshot.
 */
export function registerResourceHandlers(
  server: Pick<Server, 'setRequestHandler'>,
  sessionManager: SessionManager,
  subscriptions: ResourceSubscriptions,
  fileSystem: Pick<IFileSystem, 'readTail'>
): void {
  server.setRequestHandler('resources/list', async (_request, callCtx) => {
    // The caller's scope (issue #1025, step 2); anonymous sees anonymous.
    const sessions = sessionManager.getSessionsVisibleTo(ownerKeyOf(callCtx));
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

  server.setRequestHandler('resources/read', async (request, callCtx) => {
    const uri = request.params.uri;
    const outputSessionId = parseOutputResourceUri(uri);
    const proxyLogSessionId = parseProxyLogResourceUri(uri);
    const sessionId = outputSessionId ?? proxyLogSessionId;
    // A session outside the caller's scope is an unknown resource (issue #1025, step 2).
    const session = sessionId && sessionManager.isSessionVisibleTo(sessionId, ownerKeyOf(callCtx))
      ? sessionManager.getSession(sessionId)
      : undefined;
    if (!session) {
      throw new WireMcpError(ProtocolErrorCode.InvalidParams, `Unknown resource: ${uri}`);
    }
    if (proxyLogSessionId) {
      if (!session.logDir) {
        throw new WireMcpError(ProtocolErrorCode.InvalidParams, `Unknown resource: ${uri}`);
      }
      const text = await readProxyLogTail(
        fileSystem,
        proxyLogPathFor(session.logDir, session.id)
      );
      return {
        contents: [{ uri, mimeType: 'text/plain', text: text ?? '' }]
      };
    }
    // A child whose adapter delivers the tree's output on the launch session
    // only (js-debug, issue #1082) reads as a pointer to that resource.
    const outputOn = sessionManager.outputOnFor(session.id);
    const ownOutput = session.outputBuffer?.renderText() ?? '';
    return {
      contents: [{
        uri,
        mimeType: 'text/plain',
        // Empty until the first launch creates the buffer
        text: outputOn
          ? `${outputOnNote(outputOn)}\nRead ${outputResourceUri(outputOn)} instead.\n${ownOutput}`
          : ownOutput
      }]
    };
  });

  server.setRequestHandler('resources/subscribe', async (request, callCtx) => {
    const uri = request.params.uri;
    const sessionId = parseOutputResourceUri(uri);
    if (!sessionId || !sessionManager.isSessionVisibleTo(sessionId, ownerKeyOf(callCtx))) {
      throw new WireMcpError(ProtocolErrorCode.InvalidParams, `Unknown resource: ${uri}`);
    }
    subscriptions.subscribe(uri);
    return {};
  });

  server.setRequestHandler('resources/unsubscribe', async (request) => {
    const uri = request.params.uri;
    subscriptions.unsubscribe(uri);
    return {};
  });
}
