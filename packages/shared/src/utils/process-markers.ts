/**
 * Argv marker constants shared between the processes that tag child argv at
 * spawn time (the server's proxy launcher, adapter packages) and the startup
 * reapers that later recognize those tags in system-wide process scans
 * (issues #343, #431).
 *
 * Marker constraints, imposed by the scan/matcher machinery:
 * - Tokens must be whitespace-free: the win32 scan splits a process's
 *   CommandLine on whitespace, so a marker containing a space would fragment
 *   and never match.
 * - Identity markers are matched with `String.includes` against every token
 *   (paths may fragment), so they must be substrings that cannot appear in
 *   unrelated cmdlines by accident.
 * - No token may be or contain `--help`: vsDebugServer.cjs prints usage and
 *   exits when `--help` appears anywhere in its argv.
 */

/** Substring of the proxy worker's script-path argv token used as its identity marker. */
export const PROXY_BOOTSTRAP_MARKER = 'proxy-bootstrap';

/**
 * Substring of the js-debug DAP server's script-path argv token used as its
 * identity marker (issue #431). On its own this also matches VS Code's own
 * js-debug instances — matchers must additionally require the owner-pid
 * marker below, which only our spawns carry.
 */
export const JS_DEBUG_ADAPTER_MARKER = 'vsDebugServer';

/** Records the PID of the mcp-debugger server that owned the session. */
export const OWNER_PID_ARG_PREFIX = '--mcp-owner-pid=';
export const SESSION_ID_ARG_PREFIX = '--mcp-session-id=';
