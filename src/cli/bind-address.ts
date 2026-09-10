/**
 * Bind address for the network transports (issue #680).
 *
 * `http` and the deprecated `sse` used to call `app.listen(port)`, which binds
 * every interface: the Host/Origin allowlist stops browsers (DNS rebinding,
 * cross-site pages), not a LAN client that sends `Host: localhost` itself. The
 * server now binds loopback unless told otherwise — `--bind <address>` first,
 * then `MCP_HTTP_BIND`, then 127.0.0.1 — and the Docker image sets
 * `MCP_HTTP_BIND=0.0.0.0` so a published port keeps working; the `-p
 * 127.0.0.1:` publish stays the loopback control there.
 *
 * Only IP literals are accepted (bracketed IPv6 allowed), plus `localhost`,
 * which is normalized to 127.0.0.1: `listen(port, 'localhost')` would bind
 * only the first resolved address family — `::1` on Windows — and refuse
 * 127.0.0.1 clients. Any other hostname is refused with a remedy rather than
 * bound through a DNS lookup whose answer the operator cannot see.
 */
import { isIP } from 'node:net';
import { Option } from 'commander';

export const BIND_ENV_KEY = 'MCP_HTTP_BIND';
export const BIND_FLAG = '--bind';
export const DEFAULT_BIND_ADDRESS = '127.0.0.1';

/** An unusable `--bind` / `MCP_HTTP_BIND` value; the server must not start. */
export class BindAddressError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BindAddressError';
  }
}

export interface ResolvedBindAddress {
  /** The address to hand to `listen()`. */
  address: string;
  source: 'flag' | 'env' | 'default';
  /** Set when the value was rewritten (`localhost` → 127.0.0.1); worth a log line. */
  note?: string;
}

/**
 * The `--bind` option, built once for both network transports so the flag and
 * its help text cannot drift apart. It carries no commander default on
 * purpose: a default value would always populate `options.bind`, and the
 * environment variable could never win — resolution happens in
 * `resolveBindAddress`. The default is spelled out in the description instead
 * (commander renders nothing for a description-only default).
 */
export function bindOption(): Option {
  return new Option(
    `${BIND_FLAG} <address>`,
    `IP address to listen on (default 127.0.0.1, loopback only; or ${BIND_ENV_KEY}). ` +
      '0.0.0.0 listens on every interface and is reachable from other machines — front it with ' +
      'another access control. localhost means 127.0.0.1; IPv6 literals may be bracketed.'
  );
}

/**
 * Precedence: flag, then env, then loopback. Blank values and hostnames other
 * than `localhost` throw {@link BindAddressError} naming the source.
 */
export function resolveBindAddress(flag: string | undefined, env: NodeJS.ProcessEnv): ResolvedBindAddress {
  const chosen =
    flag !== undefined
      ? { raw: flag, source: 'flag' as const, origin: BIND_FLAG }
      : env[BIND_ENV_KEY] !== undefined
        ? { raw: env[BIND_ENV_KEY] as string, source: 'env' as const, origin: BIND_ENV_KEY }
        : undefined;
  if (!chosen) {
    return { address: DEFAULT_BIND_ADDRESS, source: 'default' };
  }
  const trimmed = chosen.raw.trim();
  if (trimmed === '') {
    throw new BindAddressError(`${chosen.origin} is empty; give an IP address such as 127.0.0.1 or 0.0.0.0`);
  }
  const unbracketed = stripBrackets(trimmed);
  if (unbracketed.toLowerCase() === 'localhost') {
    return {
      address: DEFAULT_BIND_ADDRESS,
      source: chosen.source,
      note:
        `${chosen.origin} localhost binds ${DEFAULT_BIND_ADDRESS}: Node would bind only the first resolved ` +
        'address family (::1 on some systems) and refuse 127.0.0.1 clients'
    };
  }
  if (isIP(unbracketed) === 0) {
    throw new BindAddressError(
      `${chosen.origin} value '${trimmed}' is not an IP address; give one such as 127.0.0.1, 0.0.0.0 or :: ` +
        '(a hostname would bind whichever address it resolves to first)'
    );
  }
  return { address: unbracketed, source: chosen.source };
}

/** 127.0.0.0/8, ::1, and the IPv4-mapped form of either. */
export function isLoopbackAddress(address: string): boolean {
  const bare = stripBrackets(address.trim()).toLowerCase();
  if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(bare)) {
    return true;
  }
  if (bare === '::1') {
    return true;
  }
  if (bare.startsWith('::ffff:')) {
    return isLoopbackAddress(bare.slice('::ffff:'.length));
  }
  return false;
}

/** 0.0.0.0 or :: — every interface (`::` is dual-stack unless ipv6Only). */
export function isUnspecifiedAddress(address: string): boolean {
  const bare = stripBrackets(address.trim());
  return bare === '0.0.0.0' || bare === '::';
}

/**
 * A URL a client on this machine can actually open, for the startup log: an
 * unspecified bind is reported as loopback plus the fact that every interface
 * is bound; an IPv6 literal is bracketed.
 */
export function describeEndpoint(address: string, port: number, path: string): string {
  if (isUnspecifiedAddress(address)) {
    return `http://${DEFAULT_BIND_ADDRESS}:${port}${path} (bound to all interfaces: ${stripBrackets(address)})`;
  }
  const bare = stripBrackets(address);
  const host = isIP(bare) === 6 ? `[${bare}]` : bare;
  return `http://${host}:${port}${path}`;
}

function stripBrackets(value: string): string {
  return value.startsWith('[') && value.endsWith(']') ? value.slice(1, -1) : value;
}
