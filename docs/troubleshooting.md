# Troubleshooting Guide

This guide provides solutions for common issues you might encounter when setting up and using the Debug MCP Server.

> **Start with `mcp-debugger doctor`** — it checks every adapter's runtime and debug backend in one pass and prints fix hints. See the [Diagnostics guide](./diagnostics.md) for the command, per-language prerequisites, and failure signatures.

## Connection Issues

### MCP Server Shows as Disconnected

**Problem**: Your MCP client (Claude Code, Claude Desktop, the Codex CLI, desktop or IDE clients, or
any other MCP host) lists mcp-debugger as failed or disconnected.

**Solutions**:

1. Verify the command path in your MCP settings:
   ```json
   "command": "node",
   "args": ["C:\\path\\to\\mcp-debugger\\dist\\index.js", "stdio"]
   ```
   Ensure the path points to the correct location of the built server. The entry point is `dist/index.js` when building from source. (The NPX package `@debugmcp/mcp-debugger` exposes `dist/cli` as the executable shim, which loads `dist/cli.mjs`.)

2. Keep the `stdio` argument. It is the default subcommand (`.command('stdio', { isDefault:
   true })`), so it can be omitted — the [README](../README.md)'s MCP settings and Codex
   samples pass it explicitly, while the `docker run` sample leaves it to the image's own
   default (`CMD ["stdio"]`). Passing it explicitly documents the transport.

3. Check for spaces in file paths:
   - Windows paths with spaces require proper quoting

4. Run the server manually to see errors:
   - Open a terminal
   - Navigate to the project directory
   - Run: `node dist/index.js stdio`
   - Check for any error messages

5. Ask the client for its own view of the server:
   - Claude Code: `claude mcp list`, then `/mcp` inside a session
   - Codex: `codex mcp list`, then `/mcp` inside a session

6. Restart the client. Most MCP hosts launch their servers at startup, so a configuration
   change needs a restart (or the client’s reconnect command) to take effect.

7. Running the Docker image? Pass `-i`. Without it the container’s stdin is closed before
   any client speaks, the server deliberately stays alive, and `--rm` never fires — see
   [Known Issues](./KNOWN_ISSUES.md).

### ENOENT Error When Starting Server

**Problem**: You see an error like: `spawn node c:/path/to/debug-mcp-server/dist/index.js ENOENT`

**Solutions**:

1. Check if the path exists:
   - Verify that the `dist` directory and `index.js` entry point exist
   - Run `pnpm install && pnpm build` if the dist folder is missing (this repo is
     pnpm-only — the `workspace:*` dependencies require it)

2. Fix path formatting:
   - Windows paths might need backslashes instead of forward slashes
   - Ensure your MCP settings point to `dist/index.js` (monorepo root) or use the NPX command `npx @debugmcp/mcp-debugger stdio`

3. Use quotes for paths with spaces:
   - If your path contains spaces, ensure it's properly quoted in the command

## Python Issues

### Python Not Found

**Problem**: The server can't find a Python installation.

**Solutions**:

1. Check if Python is installed and in PATH:
   ```
   python --version
   ```

2. Set the PYTHON_PATH or PYTHON_EXECUTABLE environment variable:
   - Windows: `set PYTHON_PATH=C:\path\to\python.exe`
   - Unix: `export PYTHON_PATH=/path/to/python`
   - Alternative: `PYTHON_EXECUTABLE` is also checked as a fallback if `PYTHON_PATH` is not set

3. Specify Python path directly in the debug session:
   - When creating a debug session through Claude, specify the executablePath

### debugpy Not Found or Installation Fails

**Problem**: The server can't find debugpy or fails to install it.

**Solutions**:

1. Install debugpy manually:
   ```
   pip install debugpy
   ```

2. Check pip installation:
   ```
   pip --version
   ```

3. Try installing with Python module syntax:
   ```
   python -m pip install debugpy
   ```

4. Check for permissions issues:
   - On Unix systems, you might need sudo
   - On Windows, try running as Administrator

## Path Resolution

### Understanding How Paths Are Resolved

**The rule: pass absolute paths in host mode.** There is no working-directory resolution to
reason about, because there is no resolution at all — `resolvePathForRuntime` returns a host
path unchanged, and `SimpleFileChecker` then rejects anything that is not absolute
(`src/utils/simple-file-checker.ts:49`). A bare `test.py` does not resolve against your
project, your client's working directory, or anything else; it fails.

That was a deliberate choice. Node's `fs` would happily resolve a relative path against
`process.cwd()`, which passes the existence check and then fails deep inside the debug
adapter with a far worse error — so the check rejects early instead.

**Container mode is the opposite**, and is the only mode that accepts a relative path: every
path is re-rooted under `MCP_WORKSPACE_ROOT`, so both `test.py` and `/test.py` become
`/workspace/test.py`. Nothing is rejected for being absolute.

This means the client you use does not change the rule — it only changes how visible the
mistake is. A relative path fails the same way under Claude Code, Claude Desktop, the Codex
app, or any other host.

**Best Practices**:

1. **Use Absolute Paths**: in host mode this is required, not a style preference:
   ```json
   {
     "file": "C:/Users/user/projects/myapp/test.py",
     "line": 10
   }
   ```

2. **Check Error Messages**: a missing file names both the path you passed and the path
   the server actually looked at:
   ```
   Script file not found: 'test.py'
   Looked for: 'test.py'
   Error: Path must be absolute. Received: "test.py"
   ```
   In container mode the message also carries a hint naming the workspace mount point to
   check your `-v` mapping against.

3. **Container Mode**: When running in Docker, paths are prefixed with the workspace root:
   - The `MCP_WORKSPACE_ROOT` environment variable must be set in container mode (there is no code default; the Docker image may set it, e.g., to `/workspace`)
   - Host: `test.py` → Container: `/workspace/test.py`
   - The debugger handles this translation automatically

4. **Host Mode**: Relative paths are rejected by `SimpleFileChecker` for file-based operations (e.g., `set_breakpoint`, `start_debugging`) -- always use absolute paths when running outside Docker

## Debugging Session Issues

### Breakpoints Not Hit

**Problem**: Debugging starts, but breakpoints are never hit.

**Solutions**:

1. Verify breakpoint is set in the correct file:
   - Use absolute paths when setting breakpoints
   - Check file paths in Claude's responses

2. Check breakpoint verification:
   - Claude should report if a breakpoint was "verified"
   - Unverified breakpoints won't work

3. Make sure script execution reaches the breakpoint:
   - Set breakpoints in code paths that are definitely executed
   - Add a breakpoint at the script entry point to confirm debugging works

### Session Creation Fails

**Problem**: Unable to create a debug session.

**Solutions**:

1. Check server logs for errors:
   - Logs should show why session creation failed

2. Verify Python detection is working:
   - Server logs will show if Python was detected
   - Make sure Python is in PATH or specified via PYTHON_PATH

3. Ensure debugpy communication works:
   - Session ports are dynamically allocated by the OS (port 0 is requested, so each session gets a unique port); port 5679 is only used by Docker test fixtures and is not the default session port
   - Check server logs if a session fails to start — the assigned port will be logged

### "Debug proxy initialization did not complete within 30s"

The message's second sentence tells you which stage stalled — it is derived from live progress facts, not a guess:

- **"…failed to start or is not properly configured"** — nothing ever spawned or connected: verify the language's toolchain (`mcp-debugger doctor`).
- **"…spawned (PID N) but the DAP connection was never established"** — the adapter process is up but its port never accepted: check for port conflicts or loopback firewalling.
- **"…the \"X\" request never received a response … an adapter-side protocol stall, not a missing install"** — the adapter connected and then went quiet mid-handshake. Retrying usually succeeds; if it recurs, capture a `DAP_TRACE=1` trace of the failing launch. The failed `start_debugging` result's `data` carries the same facts structurally (`initProgress`, `proxyLogPath`).

For a worked example of diagnosing this class of failure (an rdbg launch that emitted the `initialized` event but never the `initialize` response), see the [rdbg initialize-response stall case study](./case-studies/rdbg-initialize-response-stall.md).

### `get_output` Returns Nothing

**Problem**: The program is clearly printing, but `get_output` comes back with an empty
`entries` array.

**Solutions**:

1. Check *which* launch you are reading. The buffer is per launch: `restart_debugging`
   starts a fresh one and returns `outputReset: true`, so a stale cursor from before the
   restart matches nothing. Read from `since: 0` after a restart.

2. Check your cursor. Pass `since: nextSince` from the previous response, not a guess.
   `limit` defaults to 100 and is capped at 1000; `hasMore: true` means keep paging.

3. Check `dropped`. The buffer keeps the last 1000 entries per launch and evicts the
   oldest beyond that; `dropped` counts what was evicted. A chatty program can push its
   early output out before you read it — poll during the run instead of only at the end.
   Individual entries longer than 8192 characters come back with `truncated: true`.

4. Look for buffering in the debuggee. A program whose stdout is a pipe typically
   block-buffers, so nothing appears until it exits or flushes. Ruby launches get a
   `$stdout.sync = true` prelude injected for exactly this reason; other languages may
   need an explicit flush or an unbuffered-output flag.

5. Attach sessions may have no output route at all. Ruby attach connects straight to the
   `rdbg` socket, so `get_output` captures nothing — the program's stdio stays wherever it
   was started. See [Known Issues](./KNOWN_ISSUES.md).

6. A session that was created but never launched has no buffer yet and returns an empty
   page rather than an error. `get_output` deliberately keeps working after the program
   exits, right up until `close_debug_session`.

### `restart_debugging` Is Refused

**Problem**: `restart_debugging` returns `success: false`.

The message names the reason, and each one is by design:

- *"Cannot restart an attach session…"* — there is no launch configuration to replay.
  Detach and attach again instead.
- *"Nothing to restart: this session has not been launched…"* — `start_debugging` has not
  run, or only a dry run (`dryRunSpawn: true`) was performed.
- *"A restart is already in progress for this session."* — a second restart arrived while
  the first was still replaying.
- *"Session is still initializing…"* — wait for the in-flight start to finish.

On success it replays the last launch and re-applies every breakpoint, reporting
`breakpointsReapplied`. Two warnings are worth reading rather than skipping:

- Breakpoints addressed by `statement` anchors are re-resolved against the file on disk.
  Anchors that no longer match keep their previous line and say so; anchors that matched
  several lines re-anchor to the nearest and list candidates under
  `anchorResolution.moved`. If your file changed shape, confirm the breakpoints landed
  where you meant.
- `outputReset: true` means the `get_output` cursor must go back to `since: 0`.

### `pause_execution` Returns `pending: true`

**Problem**: `pause_execution` succeeds but the session is not paused yet.

This is a success, not a failure. The pause request was delivered but no `stopped` event
arrived inside the grace window — usually because the program is blocked in native code or
a syscall and cannot reach a safe stop point yet. The session flips to `paused` once the
stop lands.

**What to do**: poll `list_debug_sessions` (or call `get_stack_trace`) until the state is
`paused`, then inspect as usual. If it never pauses, the target is genuinely wedged
somewhere the debugger cannot interrupt — for compiled languages, consider a breakpoint on
a line the program will reach instead.

## Reading the Logs for a Failed Session

Every launch attempt gets its own directory. The base is the system temp folder by
default, or a `sessions/` directory beside your `--log-file` when you set one:

```text
<tmpdir>/debug-mcp-server/sessions/<sessionId>/run-<startedAt>/
  proxy-<sessionId>.log          # proxy + DAP routing decisions
  <sessionId>.log                # the language adapter's own log
  dap-trace-<sessionId>.ndjson   # only with DAP_TRACE=1
```

Some debug engines drop their own logs into that same run directory.

The proxy log follows the server's `--log-level` / `DEBUG_MCP_LOG_LEVEL`, so raise it to
`debug` before reproducing. The server logs the resolved base directory at startup
(`Session logs will be stored in: …`).

You rarely need to hunt for those paths by hand:

- **A failed `start_debugging` or `attach_to_process`** returns structured `data` carrying
  `proxyLogPath` (the server-host path), `proxyLogResource` (the MCP resource URI), and
  `initProgress` when the failure was an initialization stall.
- **`list_debug_sessions`** includes the same record as `diagnostics` on any session in the
  `error` state. It is retained for proxy initialization failures and for proxy/adapter
  deaths after initialization, and is cleared when a new launch or attach begins.
- **`debug://sessions/{id}/proxy-log`** reads a sanitized tail of that log (bounded to
  80 lines / 64 KiB) through MCP itself — the way to see it when the server is remote or in
  a container. Unlike `debug://sessions/{id}/output`, it is a point-in-time snapshot and
  cannot be subscribed to.

Set `DAP_TRACE=1` to capture every DAP frame to the `dap-trace-<sessionId>.ndjson` file
above when you need the wire protocol rather than the summary.


## Communication Issues

### The Agent Can't Drive a Debugging Session

**Problem**: The server connects, but tool calls against a session do not behave as expected.

**Solutions**:

1. Restart the conversation:
   - Sometimes a fresh conversation helps

2. Verify the tool surface reached the client:
   - The server advertises 28 tools; your client should list all of them (`/mcp` in
     Claude Code or Codex)
   - Call `list_supported_languages` first — it needs no session and proves the round trip

3. Try a simple command first:
   - Start with listing debug sessions
   - Then create a debug session
   - Gradually build up to more complex operations

If you encounter an issue not covered in this guide, check:

1. The server log: `--log-file <path>` if you set one, otherwise
   `<os.tmpdir()>/debug-mcp-server/debug-mcp-server-<pid>.log`
   (`/app/logs/debug-mcp-server.log` in the container image)
2. The per-session proxy log — see
   [Reading the Logs for a Failed Session](#reading-the-logs-for-a-failed-session) above
3. Your MCP client's own report for the server (`claude mcp list`, `codex mcp list`)
4. The failing tool result itself: errors carry structured `data` alongside the message

[Known Issues](./KNOWN_ISSUES.md) lists the current caveats that are working as designed —
check there before filing a bug.
