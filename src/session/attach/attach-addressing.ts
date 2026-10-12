/**
 * The attach-addressing contract (issue #903).
 *
 * `attach_to_process` takes `processId`, `port`, `host` and `adapterConfig`,
 * and which of those a language can act on is declared once, on its factory
 * metadata (`AdapterModes.attachBy`, with `attachHints` for the remedies).
 * This module turns a request plus that declaration into one verdict, taken
 * by the attach controller before any session state changes: a form the
 * language does not accept is refused by name, with the hint and the forms
 * it does take, and the session stays usable. Until now the top-level keys
 * went straight into the DAP attach arguments and each adapter's transform
 * dropped what it did not use, silently — the class behind issues #450,
 * #466, #871 and #895.
 *
 * The same pass records where the target lives (`AttachLocality`): a PID is
 * this host by construction, a port is local when its host is loopback, a
 * URI under `adapterConfig` is read for its hostname. `set_breakpoint` uses
 * that to decide whether the file on the mcp-debugger host is the debuggee's
 * own source (issue #899).
 */
import {
  isLoopbackHost,
  type AdapterModes,
  type AttachAddressing,
  type AttachLocality
} from '@debugmcp/shared';
import { ErrorMessages } from '../../utils/error-messages.js';

/** The addressing keys of an attach request, as the controller receives them. */
export interface AttachAddressingRequest {
  processId?: number | string;
  port?: number;
  host?: string;
  adapterConfig?: Record<string, unknown>;
}

export type AttachAddressingVerdict =
  /** `declared` is false when the factory declares no `attachBy` and the gate was skipped. */
  | { ok: true; locality: AttachLocality; declared: boolean }
  | { ok: false; error: string };

/** `adapterConfig` keys that carry a debugger URI (dart, js-debug). */
const URI_KEYS = ['vmServiceUri', 'websocketAddress'] as const;

/**
 * `adapterConfig` keys that name an attach target on their own (issue #905):
 * the URI keys and Dart's service-info file. Beside `processId` and `port`,
 * these are what make `create_debug_session` attach in the same call.
 */
export const ADAPTER_CONFIG_TARGET_KEYS = [...URI_KEYS, 'vmServiceInfoFile'] as const;

/** Whether a request names an attach target at all; `host` alone never does. */
export function namesAttachTarget(request: AttachAddressingRequest): boolean {
  return (
    given(request.processId) ||
    given(request.port) ||
    ADAPTER_CONFIG_TARGET_KEYS.some(key => given(request.adapterConfig?.[key]))
  );
}

function given(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}

function hostnameOf(uri: string): string | undefined {
  try {
    return new URL(uri).hostname;
  } catch {
    return undefined;
  }
}

/**
 * Where a request's target lives, independent of what the adapter accepts.
 * `processId` wins over `port` (a JavaScript PID attach also names the port
 * its inspector opens on, and that port is loopback by construction).
 */
export function attachLocalityOf(request: AttachAddressingRequest): AttachLocality {
  if (given(request.processId)) {
    return 'pid';
  }
  if (given(request.port)) {
    return isLoopbackHost(request.host ?? 'localhost') ? 'loopback' : 'remote';
  }
  for (const key of URI_KEYS) {
    const uri = request.adapterConfig?.[key];
    if (typeof uri === 'string' && uri !== '') {
      const hostname = hostnameOf(uri);
      if (hostname === undefined) {
        return 'unknown';
      }
      return isLoopbackHost(hostname) ? 'loopback' : 'remote';
    }
  }
  return 'unknown';
}

/**
 * Check a request against the language's declaration. With no `attachBy`
 * declared the verdict is `ok` with `declared: false`: the pre-contract
 * behaviour (the adapter's transform decides), which the controller logs.
 */
export function classifyAttachAddressing(
  language: string,
  request: AttachAddressingRequest,
  modes: AdapterModes | undefined
): AttachAddressingVerdict {
  const locality = attachLocalityOf(request);
  const accepted = modes?.attachBy;
  if (accepted === undefined) {
    return { ok: true, locality, declared: false };
  }
  const accepts = (form: AttachAddressing): boolean => accepted.includes(form);
  const hints = modes?.attachHints ?? {};

  if (given(request.processId) && !accepts('processId')) {
    return {
      ok: false,
      error: ErrorMessages.attachAddressingNotAccepted(language, 'processId', accepted, hints.processId)
    };
  }
  if (given(request.port) && !accepts('port')) {
    return {
      ok: false,
      error: ErrorMessages.attachAddressingNotAccepted(language, 'port', accepted, hints.port)
    };
  }
  // A PID names a process on this host, so a remote host beside it names a
  // machine no language can reach — whatever else the language accepts. A
  // loopback host beside it is harmless.
  if (given(request.processId) && given(request.host) && !isLoopbackHost(request.host)) {
    return {
      ok: false,
      error: ErrorMessages.attachProcessIdWithRemoteHost(language, String(request.host), accepts('port'))
    };
  }
  // On a language without a port form, a remote host alone names a machine
  // the attach cannot reach either.
  if (given(request.host) && !accepts('port') && !isLoopbackHost(request.host)) {
    return {
      ok: false,
      error: ErrorMessages.attachAddressingNotAccepted(language, 'host', accepted, hints.port)
    };
  }
  if (!given(request.processId) && !given(request.port) && !accepts('adapterConfig')) {
    return { ok: false, error: ErrorMessages.attachAddressingMissing(language, accepted) };
  }
  return { ok: true, locality, declared: true };
}
