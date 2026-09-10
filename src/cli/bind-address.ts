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
 * bound through a DNS lookup whose answer the operator cannot see. An empty
 * value is refused too, unlike an empty `MCP_HTTP_ALLOWED_HOSTS`: a silent
 * loopback fallback inside the image would leave the published port
 * unreachable with nothing saying why.
 */
import { isIP } from 'node:net';
import { Option } from 'commander';
import { ALLOWED_HOST_FLAG, LOOPBACK_HOSTS } from './host-allowlist.js';

export const BIND_ENV_KEY = 'MCP_HTTP_BIND';
export const BIND_FLAG = '--bind';
export const DEFAULT_BIND_ADDRESS = '127.0.0.1';

/** Which knob supplied a bind value. */
export type BindOrigin = typeof BIND_FLAG | typeof BIND_ENV_KEY;

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
  /** The knob that supplied the value; absent for the built-in default. */
  origin?: BindOrigin;
  /** Set when the value was rewritten (`localhost` → 127.0.0.1); worth a log line. */
  note?: string;
}

/** What /health reports under `listening`; the handler updates it from `server.address()` once bound. */
export interface ListeningEndpoint {
  address: string;
  port: number;
}

/** A startup line about the bind, at the level it deserves. */
export interface BindNotice {
  level: 'info' | 'warn';
  message: string;
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
      '0.0.0.0 listens on every interface and is reachable from other machines — pair it with ' +
      `${ALLOWED_HOST_FLAG} <name> for the name clients dial, and front it with another access control. ` +
      'localhost means 127.0.0.1; IPv6 literals may be bracketed; hostnames and an empty value are refused.'
  );
}

/**
 * Precedence: flag, then env, then loopback. Blank values, hostnames other
 * than `localhost`, and IPv6 zone ids throw {@link BindAddressError} naming
 * the source.
 */
export function resolveBindAddress(flag: string | undefined, env: NodeJS.ProcessEnv): ResolvedBindAddress {
  const chosen =
    flag !== undefined
      ? { raw: flag, source: 'flag' as const, origin: BIND_FLAG as BindOrigin }
      : env[BIND_ENV_KEY] !== undefined
        ? { raw: env[BIND_ENV_KEY] as string, source: 'env' as const, origin: BIND_ENV_KEY as BindOrigin }
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
      origin: chosen.origin,
      note:
        `${chosen.origin} localhost binds ${DEFAULT_BIND_ADDRESS}: Node would bind only the first resolved ` +
        'address family (::1 on some systems) and refuse 127.0.0.1 clients'
    };
  }
  if (unbracketed.includes('%')) {
    // net.isIP accepts fe80::1%eth0, but neither a Host header nor the
    // endpoint URL can carry a zone id, so the allowlist could never match it.
    throw new BindAddressError(
      `${chosen.origin} value '${trimmed}' carries a zone id (%...), which a Host header and a URL cannot express; ` +
        'give the address without it, or :: for every interface'
    );
  }
  if (isIP(unbracketed) === 0) {
    throw new BindAddressError(
      `${chosen.origin} value '${trimmed}' is not an IP address; give one such as 127.0.0.1, 0.0.0.0 or :: ` +
        '(a hostname would bind whichever address it resolves to first)'
    );
  }
  return { address: unbracketed, source: chosen.source, origin: chosen.origin };
}

/** 127.0.0.0/8, ::1, and the IPv4-mapped form of either (dotted or hex). */
export function isLoopbackAddress(address: string): boolean {
  const bare = stripBrackets(address.trim()).toLowerCase();
  if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(bare)) {
    return true;
  }
  if (bare === '::1') {
    return true;
  }
  const mapped = ipv4MappedTail(bare);
  return mapped !== undefined && isLoopbackAddress(mapped);
}

/** 0.0.0.0 or :: — every interface (`::` is dual-stack unless ipv6Only). */
export function isUnspecifiedAddress(address: string): boolean {
  const bare = stripBrackets(address.trim());
  return bare === '0.0.0.0' || bare === '::';
}

/**
 * The startup line a bind deserves, shared by both transports so they cannot
 * drift: nothing for a loopback address the allowlist already accepts; an
 * info line naming the `--allowed-host` entry for any other loopback address
 * (still unreachable from other machines, but clients dialing it send it as
 * Host); a warning for anything reachable from other machines, naming the
 * knob that set it and the allowlist entry those clients will need. The one
 * softening: the image's own `MCP_HTTP_BIND=0.0.0.0` under `MCP_CONTAINER=true`
 * is reported at info level, because there the published port or
 * port-forward is the access control — an explicit flag, a specific address
 * or a near-miss `MCP_CONTAINER` value still warn.
 */
export function bindNotice(bind: ResolvedBindAddress, env: NodeJS.ProcessEnv): BindNotice | undefined {
  const hostForm = allowlistFormOf(bind.address);
  const from = bind.origin ?? 'the default';
  if (isLoopbackAddress(bind.address)) {
    if (LOOPBACK_HOSTS.includes(hostForm)) {
      return undefined;
    }
    return {
      level: 'info',
      message:
        `Bound to ${bind.address} (from ${from}): loopback only, but a client dialing it sends Host: ${hostForm}, ` +
        `which the allowlist rejects until ${ALLOWED_HOST_FLAG} ${hostForm} is added.`
    };
  }
  const allowlistHint = isUnspecifiedAddress(bind.address)
    ? `Clients on other machines send the name or address they dial as Host; add ${ALLOWED_HOST_FLAG} <name> for each.`
    : `A client dialing ${bind.address} sends Host: ${hostForm}, which the allowlist rejects until ${ALLOWED_HOST_FLAG} ${hostForm} is added.`;
  const imageDefault = bind.source === 'env' && isUnspecifiedAddress(bind.address) && env.MCP_CONTAINER === 'true';
  if (imageDefault) {
    return {
      level: 'info',
      message:
        `Bound to ${bind.address} (${BIND_ENV_KEY}, the image default): the published port or port-forward is the ` +
        `access control. ${allowlistHint}`
    };
  }
  return {
    level: 'warn',
    message:
      `Bound to ${bind.address} (from ${from}): reachable from other machines. The Host/Origin allowlist stops ` +
      `browsers, not direct clients — front this server with another access control. ${allowlistHint}`
  };
}

/**
 * The line for a failed `listen()`, naming the address, the port and — when
 * the address came from a knob — that knob, with a remedy per errno.
 */
export function describeListenError(err: NodeJS.ErrnoException, port: number, bind: ResolvedBindAddress): string {
  const from = bind.origin ? ` (from ${bind.origin})` : '';
  switch (err.code) {
    case 'EADDRINUSE':
      return `Port ${port} is already in use on ${bind.address}. Another instance may be running.`;
    case 'EADDRNOTAVAIL':
      return (
        `Cannot listen on ${bind.address}:${port}${from}: no interface on this machine has that address. ` +
        'Give one it has, 0.0.0.0 for every interface, or 127.0.0.1.'
      );
    case 'EACCES':
      return (
        `Cannot listen on ${bind.address}:${port}: permission denied. Ports below 1024 need elevated privileges ` +
        '(and Windows reserves some ranges); choose another port with -p.'
      );
    default:
      return `Server error: ${err.message}`;
  }
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

/** The Host value a client dialing this address sends, as the allowlist stores it (IPv6 bracketed, lower-case). */
function allowlistFormOf(address: string): string {
  const bare = stripBrackets(address.trim());
  return isIP(bare) === 6 ? `[${bare.toLowerCase()}]` : bare;
}

/** The IPv4 inside an IPv4-mapped literal — `::ffff:127.0.0.1` or its hex spelling `::ffff:7f00:1` — dotted. */
function ipv4MappedTail(bare: string): string | undefined {
  if (!bare.startsWith('::ffff:')) {
    return undefined;
  }
  const tail = bare.slice('::ffff:'.length);
  if (tail.includes('.')) {
    return tail;
  }
  const groups = tail.split(':');
  if (groups.length !== 2 || !groups.every((group) => /^[0-9a-f]{1,4}$/.test(group))) {
    return undefined;
  }
  const [hi, lo] = groups.map((group) => parseInt(group, 16));
  return `${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`;
}

function stripBrackets(value: string): string {
  return value.startsWith('[') && value.endsWith(']') ? value.slice(1, -1) : value;
}
