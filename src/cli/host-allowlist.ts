/**
 * Host header allowlist for the Streamable HTTP transport (issue #667).
 *
 * The server binds every interface, so the Host header check is what keeps a
 * browser on the operator's machine from reaching it through DNS rebinding.
 * The default accepts only loopback names; an operator who has another access
 * control in front of the server (private network, mTLS, an authenticating
 * proxy) extends it explicitly with `--allowed-host` or
 * `MCP_HTTP_ALLOWED_HOSTS`. There is deliberately no wildcard.
 *
 * The comparison mirrors the MCP SDK's `hostHeaderValidation`: the hostname
 * is parsed with the URL API (so it is port-agnostic, case-folded, and keeps
 * IPv6 brackets). The middleware is ours rather than the SDK's because the
 * 403 body must name the remedy — the SDK's fixed `Invalid Host: <name>`
 * reads like a malformed request — and because it must run before the JSON
 * body parser.
 */
import type { RequestHandler } from 'express';

/** The names a loopback client can present; always accepted. */
export const LOOPBACK_HOSTS: readonly string[] = Object.freeze(['localhost', '127.0.0.1', '[::1]']);

export const ALLOWED_HOSTS_ENV_KEY = 'MCP_HTTP_ALLOWED_HOSTS';
export const ALLOWED_HOST_FLAG = '--allowed-host';

export type AllowedHostSource = typeof ALLOWED_HOST_FLAG | typeof ALLOWED_HOSTS_ENV_KEY;

/** A configured allowlist entry that cannot be honored. Fail fast: a silently dropped entry reproduces the very discoverability problem the flag exists to fix. */
export class AllowedHostError extends Error {
  constructor(
    public readonly entry: string,
    public readonly source: AllowedHostSource,
    reason: string
  ) {
    super(`Invalid ${source} value "${entry}": ${reason}`);
    this.name = 'AllowedHostError';
  }
}

export interface AllowedHostsResult {
  /** The effective allowlist: the loopback trio first, then the configured extras in order. */
  hosts: string[];
  /** Entries that were accepted after normalization the operator should know about. */
  warnings: string[];
}

/** Rejected hostnames are logged once each; a scanner must not turn that into unbounded growth. */
const MAX_WARNED_HOSTNAMES = 50;

function normalizeEntry(entry: string, source: AllowedHostSource): { hostname: string; warning?: string } {
  if (entry === '*') {
    throw new AllowedHostError(entry, source, 'wildcards are not supported; list each host explicitly');
  }
  if (entry.includes('/')) {
    throw new AllowedHostError(entry, source, 'a Host value is a bare hostname or IP (optionally :port), not a URL or path');
  }
  if (!entry.startsWith('[') && entry.split(':').length > 2) {
    throw new AllowedHostError(entry, source, `an IPv6 literal must be bracketed, e.g. [${entry}]`);
  }
  let hostname: string;
  try {
    hostname = new URL(`http://${entry}`).hostname;
  } catch {
    throw new AllowedHostError(entry, source, 'not a valid hostname');
  }
  if (!hostname) {
    throw new AllowedHostError(entry, source, 'not a valid hostname');
  }
  const lowered = entry.toLowerCase();
  if (hostname === lowered) {
    return { hostname };
  }
  if (lowered.startsWith(`${hostname}:`)) {
    return {
      hostname,
      warning: `${source} value "${entry}": the port is ignored (Host validation is port-agnostic); accepting "${hostname}"`,
    };
  }
  return { hostname, warning: `${source} value "${entry}" was normalized to "${hostname}"` };
}

/**
 * Build the effective Host allowlist from the repeatable `--allowed-host`
 * values and the comma-separated `MCP_HTTP_ALLOWED_HOSTS` value. The loopback
 * trio is always present. Throws `AllowedHostError` for an entry that cannot
 * be a Host value.
 */
export function parseAllowedHosts(
  cliValues: readonly string[] | undefined,
  envValue: string | undefined
): AllowedHostsResult {
  const hosts = [...LOOPBACK_HOSTS];
  const warnings: string[] = [];
  const entries: Array<[string, AllowedHostSource]> = [
    ...(cliValues ?? []).map((value): [string, AllowedHostSource] => [value.trim(), ALLOWED_HOST_FLAG]),
    ...(envValue ?? '').split(',').map((value): [string, AllowedHostSource] => [value.trim(), ALLOWED_HOSTS_ENV_KEY]),
  ];
  for (const [entry, source] of entries) {
    if (!entry) {
      continue;
    }
    const { hostname, warning } = normalizeEntry(entry, source);
    if (warning) {
      warnings.push(warning);
    }
    if (!hosts.includes(hostname)) {
      hosts.push(hostname);
    }
  }
  return { hosts, warnings };
}

/** The 403 body for a rejected Host: names the cause and both remedies (issue #667). */
export function hostRejectionMessage(hostname: string, allowed: readonly string[]): string {
  return (
    `Invalid Host: ${hostname} — this server accepts only these Host header values: ${allowed.join(', ')} ` +
    `(DNS-rebinding protection; the port is ignored). Reach it through a port-forward or SSH tunnel, or, ` +
    `if another access control fronts it, start it with ${ALLOWED_HOST_FLAG} ${hostname} or ${ALLOWED_HOSTS_ENV_KEY}=${hostname}.`
  );
}

function jsonRpcError(message: string): { jsonrpc: '2.0'; error: { code: number; message: string }; id: null } {
  return { jsonrpc: '2.0', error: { code: -32000, message }, id: null };
}

/**
 * Express middleware that answers 403 unless the request's Host hostname is
 * in `allowed`. Register it before any body parser so a rejected request is
 * never read. Each distinct rejected hostname is logged once.
 */
export function hostAllowlistMiddleware(
  allowed: readonly string[],
  logger: { warn: (message: string) => unknown }
): RequestHandler {
  const warned = new Set<string>();
  return (req, res, next) => {
    const hostHeader = req.headers.host;
    if (!hostHeader) {
      res.status(403).json(jsonRpcError('Missing Host header'));
      return;
    }
    let hostname: string;
    try {
      hostname = new URL(`http://${hostHeader}`).hostname;
    } catch {
      res.status(403).json(jsonRpcError(`Invalid Host header: ${hostHeader}`));
      return;
    }
    if (!allowed.includes(hostname)) {
      if (!warned.has(hostname) && warned.size < MAX_WARNED_HOSTNAMES) {
        warned.add(hostname);
        logger.warn(
          `Rejected a request whose Host is "${hostname}" (403): not in the allowlist [${allowed.join(', ')}]. ` +
            `Clients on other machines should use a port-forward or SSH tunnel; add ${ALLOWED_HOST_FLAG} ${hostname} ` +
            `or ${ALLOWED_HOSTS_ENV_KEY}=${hostname} only if another access control fronts this server.`
        );
      }
      res.status(403).json(jsonRpcError(hostRejectionMessage(hostname, allowed)));
      return;
    }
    next();
  };
}
