/**
 * Base class for a startup knob refused by name (issues #667, #680, #689):
 * `--allowed-host` / MCP_HTTP_ALLOWED_HOSTS, `--bind` / MCP_HTTP_BIND and
 * `--port`. The network transports catch this one class, log the message,
 * write it to stderr past the silenced console and exit 1 — so a new
 * validated flag only has to extend it, and cannot land in the generic
 * "Failed to start" arm on one transport but not the other.
 */
export class StartupRefusalError extends Error {}
