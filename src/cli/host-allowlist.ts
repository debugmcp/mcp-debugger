/**
 * Host and Origin allowlist for the Streamable HTTP transport (issues #667, #677).
 *
 * The server binds loopback by default (`--bind` / `MCP_HTTP_BIND` widen it,
 * issue #680), and the Host header check is what keeps a
 * browser on the operator's machine from reaching it through DNS rebinding,
 * and the Origin check is what keeps an ordinary cross-site page from driving
 * it at all. Both consult one list: the loopback names by default, extended
 * explicitly by an operator who has another access control in front of the
 * server (`--allowed-host` / `MCP_HTTP_ALLOWED_HOSTS`). There is no wildcard.
 *
 * The comparison mirrors the MCP SDK's `hostHeaderValidation`: the hostname
 * is parsed with the URL API (port-agnostic, case-folded, IPv6 brackets
 * kept). The middleware is ours rather than the SDK's because the 403 body
 * must name the remedy, Origin must be checked too, and both must run before
 * the JSON body parser.
 */
import type { RequestHandler } from 'express';
import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { jsonRpcErrorBody } from './json-rpc-error.js';
import { StartupRefusalError } from './startup-refusal.js';

/** The names a loopback client can present; always accepted. */
export const LOOPBACK_HOSTS: readonly string[] = Object.freeze(['localhost', '127.0.0.1', '[::1]']);

export const ALLOWED_HOSTS_ENV_KEY = 'MCP_HTTP_ALLOWED_HOSTS';
export const ALLOWED_HOST_FLAG = '--allowed-host';

/** The code the SDK's own hostHeaderValidation answers a refused Host with; kept for parity. */
export const HOST_REJECTED_CODE: number = ErrorCode.ConnectionClosed;

export type AllowedHostSource = typeof ALLOWED_HOST_FLAG | typeof ALLOWED_HOSTS_ENV_KEY;

/**
 * A configured allowlist entry that cannot be honored. Fail fast: a silently
 * dropped or rewritten entry reproduces the very discoverability problem the
 * flag exists to fix.
 */
export class AllowedHostError extends StartupRefusalError {
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
  /** Entries accepted after a normalization the operator should know about (a stripped port). */
  warnings: string[];
}

/** Rejected values are logged once each; a scanner must not turn that into unbounded growth. */
const MAX_WARNED_VALUES = 50;
/** What a DNS name or IPv4 address looks like once the URL parser has canonicalized it. */
const HOSTNAME_SHAPE = /^[a-z0-9.-]+$/;
/** A bracketed IPv6 literal (the URL parser has already validated the inside). */
const IPV6_LITERAL_SHAPE = /^\[[0-9a-f:.]+\]$/;

/** The hostname the URL parser derives from a Host-shaped value, or undefined when it is not one. */
function canonicalHostname(value: string): string | undefined {
  try {
    return new URL(`http://${value}`).hostname || undefined;
  } catch {
    return undefined;
  }
}

function normalizeEntry(entry: string, source: AllowedHostSource): { hostname: string; warning?: string } {
  if (entry === '*') {
    throw new AllowedHostError(entry, source, 'wildcards are not supported; list each host explicitly');
  }
  if (entry.includes('/')) {
    throw new AllowedHostError(entry, source, 'a Host value is a bare hostname or IP (optionally :port), not a URL or path');
  }
  const hostname = canonicalHostname(entry);
  if (hostname === undefined) {
    if (!entry.startsWith('[') && entry.split(':').length > 2) {
      throw new AllowedHostError(entry, source, `an IPv6 literal must be bracketed, e.g. [${entry}]`);
    }
    if (entry.includes('%')) {
      throw new AllowedHostError(entry, source, 'not a valid hostname (a zone id such as %eth0 cannot appear in a Host header)');
    }
    throw new AllowedHostError(entry, source, 'not a valid hostname');
  }
  if (!HOSTNAME_SHAPE.test(hostname) && !IPV6_LITERAL_SHAPE.test(hostname)) {
    throw new AllowedHostError(
      entry,
      source,
      `"${hostname}" contains characters that cannot appear in a Host header (a pattern is not a hostname; list each host explicitly)`
    );
  }
  const lowered = entry.toLowerCase();
  if (hostname === lowered) {
    return { hostname };
  }
  const portSuffix = lowered.startsWith(`${hostname}:`) ? lowered.slice(hostname.length + 1) : undefined;
  if (portSuffix !== undefined && /^\d+$/.test(portSuffix)) {
    return {
      hostname,
      warning: `${source} value "${entry}": the port is ignored (Host validation is port-agnostic); accepting "${hostname}"`,
    };
  }
  // Anything else the parser rewrites ("3001" → an IPv4 address, "user@host" → host,
  // an IDN → punycode) is not what the operator typed; make them say the canonical form.
  throw new AllowedHostError(
    entry,
    source,
    `it would be accepted as "${hostname}", which is not what was written; use "${hostname}" explicitly if that is what you mean`
  );
}

/**
 * Build the effective allowlist from the repeatable `--allowed-host` values
 * and the comma-separated `MCP_HTTP_ALLOWED_HOSTS` value (commas split flag
 * values too). The loopback trio is always present. Throws `AllowedHostError`
 * for an entry that cannot be a Host value or would be silently rewritten.
 */
export function parseAllowedHosts(
  cliValues: readonly string[] | undefined,
  envValue: string | undefined
): AllowedHostsResult {
  const hosts = [...LOOPBACK_HOSTS];
  const warnings: string[] = [];
  const entries: Array<[string, AllowedHostSource]> = [
    ...(cliValues ?? []).flatMap((value) =>
      value.split(',').map((piece): [string, AllowedHostSource] => [piece.trim(), ALLOWED_HOST_FLAG])
    ),
    ...(envValue ?? '').split(',').map((piece): [string, AllowedHostSource] => [piece.trim(), ALLOWED_HOSTS_ENV_KEY]),
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

/** The 403 body for a browser request from an origin outside the allowlist (issue #677). */
export function originRejectionMessage(origin: string, originHost: string | undefined, allowed: readonly string[]): string {
  const remedyHost = originHost ?? '<host>';
  return (
    `Invalid Origin: ${origin} — browser requests are accepted only when the Origin's host is one of: ${allowed.join(', ')} ` +
    `(cross-site request protection). If that page should control this debugger, start the server with ` +
    `${ALLOWED_HOST_FLAG} ${remedyHost} or ${ALLOWED_HOSTS_ENV_KEY}=${remedyHost}.`
  );
}

/** The hostname of a full Origin value ("https://a.example:8443" → "a.example"), or undefined for "null" and junk. */
function originHostname(origin: string): string | undefined {
  try {
    return new URL(origin).hostname || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Express middleware that answers 403 unless the request's Host hostname —
 * and, for browser requests, its Origin's hostname — is in `allowed`.
 * Register it before any body parser so a rejected request is never read.
 * Each distinct rejected value is logged once, with the same text the client
 * receives, up to a cap that is itself announced.
 */
export function hostAllowlistMiddleware(
  allowed: readonly string[],
  logger: { warn: (message: string) => unknown }
): RequestHandler {
  const warned = new Set<string>();
  let capAnnounced = false;
  const warnOnce = (key: string, message: string): void => {
    if (warned.has(key)) {
      return;
    }
    if (warned.size >= MAX_WARNED_VALUES) {
      if (!capAnnounced) {
        capAnnounced = true;
        logger.warn(
          `Rejected-request logging cap reached (${MAX_WARNED_VALUES} distinct values); no further rejected hostnames will be logged for this process.`
        );
      }
      return;
    }
    warned.add(key);
    logger.warn(`Rejected a request (403): ${message}`);
  };

  return (req, res, next) => {
    const hostHeader = req.headers.host;
    if (!hostHeader) {
      res.status(403).json(jsonRpcErrorBody(HOST_REJECTED_CODE, 'Missing Host header'));
      return;
    }
    const hostname = canonicalHostname(hostHeader);
    if (hostname === undefined) {
      res.status(403).json(jsonRpcErrorBody(HOST_REJECTED_CODE, `Invalid Host header: ${hostHeader}`));
      return;
    }
    if (!allowed.includes(hostname)) {
      const message = hostRejectionMessage(hostname, allowed);
      warnOnce(`host:${hostname}`, message);
      res.status(403).json(jsonRpcErrorBody(HOST_REJECTED_CODE, message));
      return;
    }
    const origin = req.headers.origin;
    if (origin !== undefined) {
      const originHost = originHostname(origin);
      if (originHost === undefined || !allowed.includes(originHost)) {
        const message = originRejectionMessage(origin, originHost, allowed);
        warnOnce(`origin:${originHost ?? origin}`, message);
        res.status(403).json(jsonRpcErrorBody(HOST_REJECTED_CODE, message));
        return;
      }
    }
    next();
  };
}
