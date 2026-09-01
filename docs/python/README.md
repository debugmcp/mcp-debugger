# Python Debugging with Debug MCP Server

The Debug MCP Server provides support for Python debugging through the [debugpy](https://github.com/microsoft/debugpy) library. This document explains how to use the Python debugging capabilities.

Tool calls below are written the way the rest of these docs write them: the tool name followed by its JSON arguments — the shape your MCP client sends.

## Prerequisites

Before using the Python debugging features, ensure you have:

1. Python 3.7 or higher installed
2. The debugpy package installed:
   ```bash
   pip install debugpy
   ```
   Verify with `python -m debugpy --version`.

The interpreter is auto-detected from `PATH`. To pin a specific one, set the `PYTHON_PATH` environment variable (`PYTHON_EXECUTABLE` is checked as a fallback), or pass `executablePath` in `create_debug_session`.

**Use absolute paths.** In host mode relative `file`/`scriptPath` values are rejected; in container mode paths are resolved against the `/workspace/` mount.

## Debugging Workflow

### 1. Create a Debug Session

First, create a Python debug session:

```text
create_debug_session { "language": "python", "name": "My Python Debug Session" }
```

This returns a session ID that you'll use for all subsequent debugging commands.

### 2. Set Breakpoints

Set breakpoints in your code before starting execution:

```text
set_breakpoint { "sessionId": "your-session-id", "file": "/abs/path/script.py", "line": 10 }
```

`"verified": false` in the response is **normal** for Python — debugpy verifies breakpoints asynchronously once it loads the module. Set them anyway and start; they bind and hit. Do not retry-loop on the flag.

Three sturdier ways to address a breakpoint than a bare line number:

```text
# By content, like an Edit-tool match — survives file edits across restart_debugging
set_breakpoint { "sessionId": "...", "file": "/abs/path/script.py", "statement": "total = price * qty" }

# Line plus an assertion — if the text is not on that line the breakpoint is NOT set,
# and the error shows the line's actual content
set_breakpoint { "sessionId": "...", "file": "/abs/path/script.py", "line": 10,
                 "expectedContent": "total = price" }

# By symbol — no file and no line at all (function goes alone, optionally with condition)
set_breakpoint { "sessionId": "...", "function": "compute_total" }
```

Conditional breakpoints and logpoints:

```text
set_breakpoint { "sessionId": "...", "file": "/abs/path/script.py", "line": 15, "condition": "x > 5" }
set_breakpoint { "sessionId": "...", "file": "/abs/path/script.py", "line": 15, "logMessage": "x={x} y={y}" }
```

A logpoint never pauses: it interpolates the `{expressions}` and writes the line to `get_output` while the program runs at full speed.

### 3. Start Debugging

Start debugging your Python script:

```text
start_debugging { "sessionId": "your-session-id", "scriptPath": "/abs/path/script.py",
                  "args": ["--optional", "arguments"] }
```

Optional tuning:

- `dapLaunchArgs`: `{ "stopOnEntry": true }` pauses on the first line (the default is `false`); `{ "justMyCode": false }` steps into library code (the default is `true`).
- `breakOnExceptions`: launch sessions default to `"uncaught"`, so a crashing script pauses at the crash site with stack and locals intact instead of terminating the session. `"all"` also pauses on caught/raised exceptions; `"none"` opts out. Python edge case: debugpy treats `sys.exit(n)` with a **non-zero** code as an unhandled `SystemExit` and pauses there (`sys.exit(0)` runs to completion) — pass `"none"` if your script legitimately exits non-zero that way.
- `dryRunSpawn: true` validates the spawn configuration without actually starting a debug session.

### 4. Control Execution

When execution pauses at a breakpoint, you can:

#### Step Over (execute current line and pause at next line)
```text
step_over { "sessionId": "your-session-id" }
```

#### Step Into (go into functions called on current line)
```text
step_into { "sessionId": "your-session-id" }
```

#### Step Out (run until exiting current function)
```text
step_out { "sessionId": "your-session-id" }
```

#### Continue (run until next breakpoint)
```text
continue_execution { "sessionId": "your-session-id" }
```

#### Pause (pause a running program)
```text
pause_execution { "sessionId": "your-session-id" }
```

### 5. Examine Program State

When paused, you can examine the program's state using the `get_stack_trace` -> `get_scopes` -> `get_variables` sequence. Each step returns numeric handles that feed into the next:

#### Step 1: Get the Stack Trace
```text
get_stack_trace { "sessionId": "your-session-id" }
```
This returns stack frames, each with a numeric `id` (the frame ID). The top frame's `id` is not necessarily `0`.

#### Step 2: Get Scopes for a Frame
Use the `id` from the top stack frame:
```text
get_scopes { "sessionId": "your-session-id", "frameId": 3 }
```
This returns scopes (e.g., "Locals", "Globals"), each with a numeric `variablesReference`.

#### Step 3: Get Variables for a Scope
Use the `variablesReference` from a scope (not the frame ID):
```text
get_variables { "sessionId": "your-session-id", "scope": 5 }
```
The `scope` parameter is the numeric `variablesReference` from `get_scopes`. Frame IDs and variable references are different numbers — never swap them.

debugpy may return a `special variables` entry inside a Locals scope. That is a container, not a variable: call `get_variables` again with `scope` set to its `variablesReference` to expand it and reveal the real locals.

#### Shortcut: Get Local Variables
For convenience, `get_local_variables` performs the full stack->scopes->variables traversal in a single call and filters out debugpy's special/internal entries (pass `includeSpecial: true` to keep them):
```text
get_local_variables { "sessionId": "your-session-id" }
```

#### Evaluate Expressions
```text
evaluate_expression { "sessionId": "your-session-id", "expression": "x + y * 2" }
```

#### Get Source Context
```text
get_source_context { "sessionId": "your-session-id", "file": "/abs/path/script.py",
                     "line": 15, "linesContext": 5 }
```

### 6. Read Program Output

Python launches run with debugpy's `redirectOutput`, so `print()` and stderr are captured:

```text
get_output { "sessionId": "your-session-id" }
get_output { "sessionId": "your-session-id", "since": 42 }
```

Output is buffered per launch and readable while the program runs and after it exits, until the session closes. Pass `since` = the previous response's `nextSince` to fetch only new entries. The same transcript is also exposed as the MCP resource `debug://sessions/{sessionId}/output`, which supports `resources/subscribe`.

### 7. Close the Session

When finished debugging, close the session:

```text
close_debug_session { "sessionId": "your-session-id" }
```

## Managing Breakpoints

Breakpoints have a lifecycle beyond `set_breakpoint`. All three tools below take effect immediately while the program is running or paused, and also work before launch and after the program has exited:

```text
list_breakpoints   { "sessionId": "..." }                    # add "file" to scope to one file
remove_breakpoint  { "sessionId": "...", "breakpointId": "..." }
remove_breakpoint  { "sessionId": "...", "file": "/abs/path/script.py", "line": 15 }
remove_breakpoint  { "sessionId": "...", "function": "compute_total" }
clear_breakpoints  { "sessionId": "..." }                    # add "file" to scope to one file
```

`list_breakpoints` reports each breakpoint's verified state and adapter-assigned id; session-global function breakpoints appear separately as `functionBreakpoints`.

## The Edit-Rerun Loop

`restart_debugging` terminates the current program (if it is still running) and relaunches it with the same configuration as the last `start_debugging`, re-applying all current breakpoints:

```text
restart_debugging { "sessionId": "your-session-id" }
```

That turns "fix a line -> rerun -> land on the same breakpoints" into a single call. Two notes: the `get_output` buffer starts fresh (read from `since: 0` after a restart), and `restart_debugging` is rejected for attach sessions.

Statement-anchored breakpoints (see above) are what make this loop robust — they re-resolve against the edited file instead of drifting when your edit shifts line numbers.

## Attach Mode

Python attach is **port-only**: mcp-debugger connects directly to a listening debugpy endpoint. Attaching by `processId` is not supported and fails with a message pointing you at `--listen`.

Start the target yourself:

```bash
python -m debugpy --listen 127.0.0.1:5678 --wait-for-client script.py
```

`--wait-for-client` blocks the script until a debugger attaches — use it for anything short-lived. Then:

```text
create_debug_session { "language": "python" }
attach_to_process    { "sessionId": "...", "host": "127.0.0.1", "port": 5678 }
set_breakpoint       { "sessionId": "...", "file": "/abs/path/script.py", "line": 20 }
continue_execution   { "sessionId": "..." }
```

Shorthand: passing `host` and `port` to `create_debug_session` creates the session and attaches in one call.

After the handshake the attach is verified by polling for threads; raise `verifyTimeout` (default 20000 ms) for slow targets. `breakOnExceptions` applies **no** language default on attach — set it explicitly if you want it. `detach_from_process { "sessionId": "...", "terminateProcess": false }` leaves the target running.

### Remote targets and path mapping

Breakpoint paths are sent verbatim to the remote debugger and resolved against the **target's** filesystem. For a container or pod, use debuggee-side paths (`/app/app.py`, as reported by `get_stack_trace`), or a function breakpoint, which needs no paths at all.

To address breakpoints by local-checkout path instead, pass debugpy's native mapping shape through `adapterConfig` (issue #450):

```text
attach_to_process { "sessionId": "...", "host": "127.0.0.1", "port": 5678,
                    "adapterConfig": { "pathMappings": [
                      { "localRoot": "/abs/local/src", "remoteRoot": "/app" }] } }
```

Frames then report local paths too. Caveats:

- The ptvsd-era bare `localRoot`/`remoteRoot` keys are **not** forwarded — `pathMappings` is the one lever. The attach response's `warning` names any `adapterConfig` keys that were ignored.
- `host` and `port` must stay top-level; debugpy rejects a config carrying both `connect` and top-level host/port.

For the Kubernetes port-forward pattern and per-language presets, see the [Kubernetes debugging recipe](../kubernetes.md) and the [attach presets](../../examples/kubernetes/attach-presets.md).

## Secret Redaction

Variable values, captured output, and evaluate results are scanned for credentials before they reach the transcript: values with a recognizable secret shape, and variables whose *name* exactly matches a known sensitive name (`password`, `api_key`, ...), come back masked and flagged `redacted: true`. Only the display is masked — program state is untouched. Start the server with `DEBUG_MCP_NO_REDACT=1` to disable it (for example when debugging credential-handling code itself). Full rules and limitations: [Secret redaction](../tool-reference.md#secret-redaction).

## Debugging Tips

1. `"verified": false` at set time is expected — debugpy binds breakpoints when it loads the module, not when you set them
2. If the debugger doesn't stop at a breakpoint, ensure the file path is correct and absolute, and that the line is an executable statement (not a comment, a blank line, or a bare `def`/`class` line)
3. Use source context to see code around your current position
4. The stack trace shows the call hierarchy that led to the current position
5. Expressions are evaluated against the current paused debug context (current frame when available), with the evaluation context defaulting to `'variables'` — reads and arithmetic are reliable, but verify a mutation such as `x = 5` with a follow-up evaluate before relying on it
