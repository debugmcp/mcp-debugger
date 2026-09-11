/**
 * The `--port` option for the network transports (issue #689).
 *
 * `http` and the deprecated `sse` used to take `-p, --port <number>` with no
 * parser and hand `parseInt(options.port, 10)` straight to `listen()`: `-p abc`
 * failed with Node's own `options.port should be >= 0 and < 65536. Received
 * type number (NaN)` (naming an internal, not the flag, and not the value
 * typed), `-p 3001x` silently bound 3001 because parseInt stops at the first
 * non-digit, and `-p 0` logged `listening on 127.0.0.1:0` while the OS-assigned
 * port was visible only in /health. The value is now resolved here, the way
 * `--bind` is in bind-address.ts: only an unsigned integer in 0-65535 is
 * accepted, anything else is refused by name before a server is built.
 */
import { Option } from 'commander';
import { StartupRefusalError } from './startup-refusal.js';

export const PORT_FLAG = '--port';
/** A string, like every commander default: the app factories resolve it. */
export const DEFAULT_PORT = '3001';
export const MAX_PORT = 65535;

/** An unusable `--port` value; the server must not start. */
export class PortError extends StartupRefusalError {
  constructor(message: string) {
    super(message);
    this.name = 'PortError';
  }
}

/**
 * The `--port` option, built once for both network transports so the flag and
 * its help text cannot drift apart. The default stays the string '3001':
 * commander never runs a parser over a default value, and resolution happens
 * in `resolvePort`.
 */
export function portOption(): Option {
  return new Option(
    `-p, ${PORT_FLAG} <number>`,
    `Port to listen on, 0-${MAX_PORT} (0 lets the OS choose; the startup line and /health report the port ` +
      'actually bound)'
  ).default(DEFAULT_PORT);
}

/**
 * The port to hand to `listen()`. Only an unsigned decimal integer in
 * 0-65535 is accepted — no sign, no decimal point, no whitespace, no trailing
 * characters — so a typo fails loudly instead of binding a different port.
 * Throws {@link PortError} naming the flag, the value as typed and which of
 * the two rules it broke. The message carries no trailing period: the
 * handlers append ". The server was not started." to it.
 */
export function resolvePort(raw: string): number {
  const remedy = `give an integer 0-${MAX_PORT} (0 lets the OS choose)`;
  if (!/^\d+$/.test(raw)) {
    throw new PortError(`${PORT_FLAG} value '${raw}' is not a port number; ${remedy}`);
  }
  const port = Number(raw);
  if (port > MAX_PORT) {
    throw new PortError(`${PORT_FLAG} value '${raw}' is above ${MAX_PORT}; ${remedy}`);
  }
  return port;
}
