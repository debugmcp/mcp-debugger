# Quickstart: mcp-debugger

The shortest path from nothing to a paused Python program. For the narrated version of the same
path, see [Getting Started](./getting-started.md).

## Prerequisites

- **Node.js 22+** for the server
- **Python 3.7+** with `debugpy` for this walkthrough: `python -m pip install debugpy`
- An **MCP client**: Claude Desktop, the Claude Code CLI, or the Codex CLI

## Installation

Pick one.

```bash
# npx — nothing to install
npx @debugmcp/mcp-debugger --help

# npm, installed globally
npm install -g @debugmcp/mcp-debugger

# Docker. -i is required: without it the container never sees a client,
# never exits, and --rm never fires.
docker run -i --rm -v $(pwd):/workspace debugmcp/mcp-debugger:latest

# From source. This is a pnpm workspace — not npm install.
git clone https://github.com/debugmcp/mcp-debugger.git
cd mcp-debugger
pnpm install
pnpm run build
```

## Verify

```bash
npx @debugmcp/mcp-debugger doctor          # every adapter's runtime + debug backend, with fix hints
npx @debugmcp/mcp-debugger doctor python   # same report, exit code gated on python
```

Run this before anything else — it separates a broken toolchain from a broken server. `--json`
emits a machine-readable report; `--timeout <ms>` caps each probe (default 10000).

## Register with a client

Claude Desktop, or any client with a JSON config:

```json
{
  "mcpServers": {
    "mcp-debugger": {
      "command": "npx",
      "args": ["@debugmcp/mcp-debugger", "stdio"]
    }
  }
}
```

For a source build, use `"command": "node"` with
`"args": ["/absolute/path/to/mcp-debugger/dist/index.js", "stdio"]`.

Claude Code CLI:

```bash
claude mcp add-json mcp-debugger '{"type":"stdio","command":"npx","args":["@debugmcp/mcp-debugger","stdio"]}'
claude mcp list
```

Codex CLI:

```bash
codex mcp add mcp-debugger -- npx -y @debugmcp/mcp-debugger stdio
```

Restart the client after changing its configuration.

## Transports

```bash
mcp-debugger stdio                  # default subcommand; for clients that spawn the server
mcp-debugger http -p 3001           # Streamable HTTP, recommended for remote; endpoint /mcp
mcp-debugger sse -p 3001            # DEPRECATED — use http
```

Console output is silenced in every mode, so add `--log-level debug --log-file ./logs/debug.log`
when you need to see anything. To point a client at an HTTP server:

```bash
claude mcp add-json mcp-debugger '{"type":"http","url":"http://127.0.0.1:3001/mcp"}'
```

## Worked example: find a bug in a Python script

Save this as `buggy_math.py` and note its **absolute** path — host mode rejects a relative
`file` or `scriptPath`. The calls below use `/tmp/buggy_math.py`; on Windows use something
like `C:\work\buggy_math.py`.

```python
def calculate_average(numbers):
    total = 0
    for num in numbers:
        total += num
    # Bug: this adds 1 to the average
    average = total / len(numbers) + 1
    return average

numbers = [10, 20, 30, 40, 50]
result = calculate_average(numbers)
print(f"Average: {result}")
```

It prints `Average: 31.0`. The right answer is 30.0.

**1. Create a session.**

```
create_debug_session {"language": "python", "name": "Debug Math Bug"}
```

```json
{
  "success": true,
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Created python debug session: Debug Math Bug"
}
```

That `sessionId` goes into every call below.

**2. Set a breakpoint** on line 6, the buggy assignment.

```
set_breakpoint {"sessionId": "550e8400-...", "file": "/tmp/buggy_math.py", "line": 6}
```

The response echoes `breakpointId`, the resolved `file` and `line`, `verified`, and the `content`
of the line it landed on. If the debugger bound the breakpoint somewhere else, that arrives as a
`warning`.

**3. Start the program.** Breakpoints set before launch are queued and applied automatically.

```
start_debugging {"sessionId": "550e8400-...", "scriptPath": "/tmp/buggy_math.py"}
```

The response's `state` becomes `"paused"` once the breakpoint is hit.

**4. Inspect.** The fast route is the current frame's locals:

```
get_local_variables {"sessionId": "550e8400-..."}
```

At line 6, `numbers` is `[10, 20, 30, 40, 50]` and `total` is `150`. There is no `average` yet —
the line has not executed.

The long form, when you need a specific frame or scope: `get_stack_trace` returns `stackFrames`
(each with an `id`), `get_scopes` turns a frame id into scopes carrying a `variablesReference`,
and `get_variables` reads that reference. Take every id from the responses; never hardcode one.

```
get_stack_trace {"sessionId": "550e8400-..."}
get_scopes {"sessionId": "550e8400-...", "frameId": <id from stackFrames[0]>}
get_variables {"sessionId": "550e8400-...", "scope": <variablesReference from that scope>}
```

**5. Confirm the bug** without editing the file:

```
evaluate_expression {"sessionId": "550e8400-...", "expression": "total / len(numbers)"}
```

30.0 — so the `+ 1` on line 6 is the bug.

**6. Step, run to the end, read what it printed.**

```
step_over {"sessionId": "550e8400-..."}
continue_execution {"sessionId": "550e8400-..."}
get_output {"sessionId": "550e8400-..."}
```

`get_output` returns the debuggee's captured stdout/stderr plus a `nextSince` cursor; pass it
back as `since` to read only what is new.

**7. Clean up.**

```
close_debug_session {"sessionId": "550e8400-..."}
```

## Key Points to Remember

1. **Session ids are UUIDs** — save the `sessionId` from `create_debug_session`.
2. **`get_variables` takes a `variablesReference`, not a frame id** — get one from `get_scopes`,
   or skip both with `get_local_variables`.
3. **Breakpoints need executable lines** — not comments, blank lines, or bare declarations.
4. **`continue_execution` does not wait for the next stop** — check `list_debug_sessions`, or
   `get_stack_trace`, whose `stopReason` says why the program stopped.
5. **Host mode requires absolute paths** — a relative `file` or `scriptPath` fails with
   `Path must be absolute. Received: "..."`. Container mode is the exception: paths are resolved
   against the `/workspace` mount, so pass paths relative to the directory you mounted.

## Troubleshooting Quick Tips

1. **Run `mcp-debugger doctor` first.** It names the broken toolchain and prints the fix.
2. **Server not found or won't connect**: use an absolute path, confirm a source build produced
   `dist/index.js` (`pnpm run build`), and keep `stdio` in the args.
3. **Python debugging not working**: `python -m pip install debugpy` for the *same* interpreter
   the session uses, or pin it with `PYTHON_PATH` or `executablePath` on `create_debug_session`.
4. **Session terminated unexpectedly**: rerun with `--log-level debug --log-file`, then read
   `proxy-<sessionId>.log` under
   `<system temp dir>/debug-mcp-server/sessions/<sessionId>/run-<timestamp>/`.

More: [Troubleshooting](./troubleshooting.md) · [Diagnostics](./diagnostics.md)

## What's Next?

- Read the [Tool Reference](./tool-reference.md) for every tool's parameters and response shape
- See the [Usage Guide](./usage.md) for more involved debugging scenarios
- Read [Getting Started](./getting-started.md) for the narrated walkthrough

---

*For more detailed information, see the full [documentation](./README.md).*
