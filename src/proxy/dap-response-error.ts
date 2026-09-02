/**
 * The human-readable reason a DAP response failed (issue #663).
 *
 * DAP's ErrorResponse carries two texts: `message`, "the raw error in short
 * form", and `body.error`, a structured Message whose `format` (with `{name}`
 * placeholders filled from `variables`) is what the user is meant to see.
 * Adapters are free to set either. js-debug sends a ProtocolError with only
 * `body.error` — `{success:false, body:{error:{id, format:"Uncaught
 * ReferenceError: x is not defined"}}}` — so reading `message` alone turned
 * every one of its user-facing evaluate/variables/frame errors into a bare
 * "Request failed".
 */
import type { DebugProtocol } from '@vscode/debugprotocol';

export const DEFAULT_DAP_FAILURE_MESSAGE = 'Request failed';

/** Fill `{name}` placeholders in a DAP Message format from its variables. */
export function formatDapMessage(message: DebugProtocol.Message): string {
  const variables = message.variables ?? {};
  return message.format.replace(/\{([^{}]+)\}/g, (placeholder, name: string) =>
    Object.prototype.hasOwnProperty.call(variables, name) ? variables[name] : placeholder
  );
}

/**
 * `message` when the adapter set it, else the formatted `body.error`, else
 * undefined. Callers add their own fallback.
 */
export function dapResponseErrorText(response: DebugProtocol.Response): string | undefined {
  if (response.message) {
    return response.message;
  }
  const error = (response.body as DebugProtocol.ErrorResponse['body'] | undefined)?.error;
  if (error && typeof error.format === 'string' && error.format !== '') {
    return formatDapMessage(error);
  }
  return undefined;
}

/** The reason a failed response gives, or the generic fallback. */
export function dapResponseErrorMessage(response: DebugProtocol.Response): string {
  return dapResponseErrorText(response) ?? DEFAULT_DAP_FAILURE_MESSAGE;
}
