/**
 * DAP message constructors for responses the shim composes itself. `seq` is
 * left at 0: the client connection restamps it at write time.
 */
import type { DebugProtocol } from '@vscode/debugprotocol';

export function okResponse(request: DebugProtocol.Request, body?: unknown): DebugProtocol.Response {
  return { seq: 0, type: 'response', request_seq: request.seq, success: true, command: request.command, body };
}

export function errorResponse(request: DebugProtocol.Request, message: string): DebugProtocol.Response {
  return {
    seq: 0,
    type: 'response',
    request_seq: request.seq,
    success: false,
    command: request.command,
    message,
    body: { error: { id: 1, format: message, showUser: true } }
  };
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
