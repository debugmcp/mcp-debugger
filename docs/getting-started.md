# Getting Started with mcp-debugger

mcp-debugger is an MCP server that hands an AI agent a real step-through debugger: sessions,
breakpoints, stepping, stack traces, and variable inspection, all exposed as MCP tools. This
guide walks a first run end to end — install, verify, register with a client, then debug a
script that has a real bug in it.

Python is used throughout because it needs the least setup. The server also debugs Ruby,
JavaScript/TypeScript, Rust, Go, Java, .NET/C#, and C/C++ — the per-language guides are linked
at the end.

## Prerequisites

1. **Node.js 22+** for the server itself.

2. **A toolchain for the language you want to debug.** For this walkthrough that is
   **Python 3.7+** with `debugpy` installed for the *same* interpreter the session will use:
   ```bash
   python --version
   python -m pip install debugpy
   ```

3. **An MCP client** — Claude Desktop, the Claude Code CLI, or the Codex CLI.

You do not have to clone this repository. The walkthrough uses `examples/python/fibonacci.py`
from the repo, but any Python file works just as well.

## Step 1: Install

Pick whichever fits how you plan to use it.

**npx — nothing to install:**
```bash
npx @debugmcp/mcp-debugger --help
```

**npm, installed globally:**
```bash
npm install -g @debugmcp/mcp-debugger
mcp-debugger --help
```

**Docker:**
```bash
docker run -i --rm -v $(pwd):/workspace debugmcp/mcp-debugger:latest
```
The `-i` is not optional — it keeps stdin attached so the container can see its MCP client.
Without it the container has no client to serve and never exits, so `--rm` never fires. In
container mode, paths are resolved against the `/workspace` mount, so paths relative to the
directory you mounted work there; outside a container every path must be absolute. See
[Docker support](./docker-support.md) for which languages the image debugs natively.

**From source, for working on mcp-debugger itself:**
```bash
git clone https://github.com/debugmcp/mcp-debugger.git
cd mcp-debugger
pnpm install
pnpm run build
node dist/index.js --help
```
This repo is a pnpm workspace. Use `pnpm install`, not `npm install`.

## Step 2: Verify your toolchains with `doctor`

Before wiring anything into a client, ask the server what it can actually debug on this machine:

```bash
npx @debugmcp/mcp-debugger doctor          # or: node dist/index.js doctor (source checkout)
```

`doctor` probes every adapter's language runtime and debug backend in one pass and prints a row
per language with a verdict — `ok`, `warn`, `missing`, `broken`, or `disabled` — followed by fix
hints for anything that needs attention.

Name the languages you actually care about and the exit code follows them, which makes `doctor`
usable as a CI gate:

```bash
mcp-debugger doctor python
```

With no language arguments the run is informational and always exits 0. `--json` emits a
machine-readable report; `--timeout <ms>` caps each probe (default 10000).

If `doctor` reports python as `missing` or `broken`, fix that before going further. Most
first-run failures are an absent `debugpy` or the wrong interpreter, not the server. Every
prerequisite and failure signature is collected in the [Diagnostics guide](./diagnostics.md).

## Step 3: Register the server with your MCP client

The server speaks three transports. You only need one.

| Transport | Command | Use it for |
|---|---|---|
| stdio | `mcp-debugger stdio` (the default subcommand) | Local clients that spawn the server themselves |
| Streamable HTTP | `mcp-debugger http -p 3001` | **Recommended** for anything not spawned locally — remote or shared servers |
| SSE | `mcp-debugger sse -p 3001` | **Deprecated** — use `http` instead |

Because `stdio` is the default subcommand, bare `mcp-debugger` starts in stdio mode. Passing it
explicitly in a config file is still worth doing: it documents the intent. Console output is
silenced in every mode so nothing can corrupt the JSON-RPC stream.

### Claude Desktop, or any client with a JSON config

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

### Claude Code CLI

```bash
claude mcp add-json mcp-debugger '{"type":"stdio","command":"npx","args":["@debugmcp/mcp-debugger","stdio"]}'
claude mcp list
```

From a source checkout, `./scripts/install-claude-mcp.sh` builds the project and registers
`dist/index.js` for you.

### Codex CLI

```bash
codex mcp add mcp-debugger -- npx -y @debugmcp/mcp-debugger stdio
codex mcp list
```

### Over Streamable HTTP

Start the server yourself, then point the client at its endpoint:

```bash
mcp-debugger http -p 3001
claude mcp add-json mcp-debugger '{"type":"http","url":"http://127.0.0.1:3001/mcp"}'
```

Restart the client after changing its configuration, then confirm the connection — `/mcp` inside
Claude Code, or `claude mcp list` from a shell.

## Step 4: Debug the example script

The repository ships a Fibonacci calculator at `examples/python/fibonacci.py` with a deliberate
bug on line 46:

```python
buggy_value = fibonacci_iterative(n - 1) + 1  # Bug: should be fibonacci_iterative(n)
```

Run it plainly and it tells you something is wrong without telling you what:

```text
Calculating the 10th Fibonacci number:
Iterative result: 55
Recursive result: 55
Buggy value: 35
Debug me: The buggy value doesn't match the expected result!
```

Now find it with the debugger. Ask your agent in plain language; the tool it calls for each step
is named in parentheses.

**Paths must be absolute.** In host mode `set_breakpoint` and `start_debugging` reject a relative
`file`/`scriptPath` with `Path must be absolute. Received: "..."`. The steps below write it as
`/absolute/path/to/mcp-debugger/examples/python/fibonacci.py`; substitute your own checkout.
(Container mode is the exception — the `/workspace` mount makes a workspace-relative path absolute
before it is checked.)

1. **Create a session** (`create_debug_session`)
   ```
   Create a Python debug session named "Fibonacci"
   ```
   The response carries a `sessionId`. Every later call needs it.

2. **Set a breakpoint** (`set_breakpoint`)
   ```
   Set a breakpoint in /absolute/path/to/mcp-debugger/examples/python/fibonacci.py at line 46
   ```
   Breakpoints can be set before the program starts — they are queued and applied at launch. The
   response reports `verified`, and says so loudly if the debugger bound the breakpoint to a
   different line than you asked for.

3. **Start the program** (`start_debugging`)
   ```
   Start debugging /absolute/path/to/mcp-debugger/examples/python/fibonacci.py
   ```
   When the breakpoint is hit, the response's `state` is `"paused"`.

4. **Look around** (`get_stack_trace`, `get_local_variables`)
   ```
   Show me the stack trace and the local variables
   ```
   Line 46 has not executed yet, so the locals are `n = 10`, `result_iterative = 55`, and
   `result_recursive = 55` — there is no `buggy_value` yet. `get_local_variables` is the
   shortcut; the long form is `get_scopes` for a frame, then `get_variables` with that scope's
   `variablesReference`.

5. **Test the hypothesis** (`evaluate_expression`)
   ```
   Evaluate fibonacci_iterative(n - 1) + 1, then evaluate fibonacci_iterative(n)
   ```
   35 against 55: both halves of the bug isolated, with no edit to the file. Expressions run in
   the live process and can modify program state as well as read it.

6. **Step and confirm** (`step_over`, `get_local_variables`)
   ```
   Step over the current line, then show me buggy_value
   ```
   After the step, `buggy_value` exists and is 35 — the wrong answer, caught in the act.

7. **Let it finish and read what it printed** (`continue_execution`, `get_output`)
   ```
   Continue execution, then show me the program's output
   ```
   `continue_execution` returns as soon as the adapter acknowledges it; it does not wait for the
   next stop. `get_output` returns the debuggee's captured stdout/stderr along with a `nextSince`
   cursor you can pass back to read only what is new.

8. **Clean up** (`close_debug_session`)
   ```
   Close the debug session
   ```

That is the whole loop. Everything else — conditional breakpoints, logpoints, function
breakpoints, attaching to a process that is already running, restarting with breakpoints intact
— builds on these same tools.

## Where the logs are

Console output is silenced in every transport mode so it can never corrupt the JSON-RPC stream.
There are two places to look instead.

**Per-session logs** are written under
`<system temp dir>/debug-mcp-server/sessions/<sessionId>/run-<timestamp>/`, one directory per
launch attempt. It holds `proxy-<sessionId>.log`, which carries the DAP routing decisions, and
the debug adapter's own log.

**The server log** goes wherever `--log-file` points, at the level `--log-level` sets (`error`,
`warn`, `info`, `debug`; default `info`):

```bash
mcp-debugger stdio --log-level debug --log-file ./logs/debug.log
```

A session's captured output is also readable without touching the filesystem: the `get_output`
tool, or the MCP resource `debug://sessions/<sessionId>/output`, which supports
`resources/subscribe`. `debug://sessions/<sessionId>/proxy-log` returns a bounded tail of the
proxy log for quick triage.

## When something goes wrong

1. **Run `mcp-debugger doctor` first.** It is the fastest way to tell an environment problem
   apart from a server problem, and it prints the fix for most of what it finds.
2. **Check that the client actually connected** — `claude mcp list`, or `/mcp` inside Claude
   Code. A server that fails to start usually has a wrong path or a missing `stdio` argument.
3. **Check the breakpoint landed on an executable line.** Comments, blank lines, and bare
   declarations are not reliable stopping points; the `set_breakpoint` response tells you whether
   it was verified and whether it moved.
4. **Turn up the logs** with `--log-level debug --log-file`, then read the per-session
   `proxy-<sessionId>.log` for the DAP conversation.

The [Troubleshooting guide](./troubleshooting.md) covers symptom-by-symptom fixes, and the
[Diagnostics guide](./diagnostics.md) has per-language failure signatures.

## Next steps

- [Quickstart](./quickstart.md) — this same path, condensed to copy-paste commands
- [Tool reference](./tool-reference.md) — every tool, its parameters, and its response shape
- [Usage guide](./usage.md) — longer debugging scenarios
- Per-language guides: [python](./python/README.md) · [javascript](./javascript/README.md) ·
  [ruby](./ruby/README.md) · [go](./go/README.md) · [java](./java/README.md) ·
  [dotnet](./dotnet/README.md) · [rust](./rust-debugging.md) · [cpp](./cpp/README.md)
