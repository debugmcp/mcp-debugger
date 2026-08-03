# Python debugging (mcp-debugger)

## Prerequisites

- Python 3.7+ with debugpy installed: `pip install debugpy` (verify with `python -m debugpy --version`).
- The server auto-detects the Python interpreter from PATH. To pin one, set the `PYTHON_PATH` env var (`PYTHON_EXECUTABLE` is checked as a fallback), or pass `executablePath` in `create_debug_session`.
- Always use absolute file paths. In host mode relative paths are rejected; in container mode paths get a `/workspace/` prefix.

## Launch quickstart

```text
create_debug_session { "language": "python", "name": "py-bug-hunt" }
  -> returns sessionId

set_breakpoint  { "sessionId": "<id>", "file": "/abs/path/app.py", "line": 14 }
  -> "verified": false is NORMAL here (see Quirks); response echoes surrounding source

start_debugging { "sessionId": "<id>", "scriptPath": "/abs/path/app.py", "args": ["--flag"] }
  -> state "paused", reason "breakpoint"

get_stack_trace { "sessionId": "<id>" }          # top frame's "id" is the frameId — NOT necessarily 0
get_scopes      { "sessionId": "<id>", "frameId": <top frame id> }
get_variables   { "sessionId": "<id>", "scope": <variablesReference from a scope> }
evaluate_expression { "sessionId": "<id>", "expression": "a + b" }
step_over       { "sessionId": "<id>" }
continue_execution { "sessionId": "<id>" }
get_output      { "sessionId": "<id>" }           # captured stdout/stderr; pass since=nextSince to poll
close_debug_session { "sessionId": "<id>" }
```

Shortcut: `get_local_variables { "sessionId": "<id>" }` does stack -> scopes -> variables in one call and filters out `__builtins__` and special variables (pass `includeSpecial: true` to see them).

Optional launch tuning via `dapLaunchArgs`: `{ "stopOnEntry": true }` to pause on the first line, `{ "justMyCode": false }` to step into library code. `dryRunSpawn: true` tests the spawn without debugging.

## Attach / remote

Python attaches only to a listening debugpy endpoint — attaching by `processId` is not supported. Start the target yourself:

```bash
python -m debugpy --listen 127.0.0.1:5678 --wait-for-client script.py
```

(`--wait-for-client` blocks the script until you attach — use it for anything short-lived.) Then:

```text
create_debug_session { "language": "python" }
attach_to_process    { "sessionId": "<id>", "host": "127.0.0.1", "port": 5678 }
set_breakpoint       { "sessionId": "<id>", "file": "/abs/path/script.py", "line": 20 }
continue_execution   { "sessionId": "<id>" }
```

Shorthand: `create_debug_session { "language": "python", "host": "127.0.0.1", "port": 5678 }` creates the session and attaches in one call. After the handshake the attach is verified by polling for threads; raise `verifyTimeout` (default ~5000 ms) for slow targets. Detach with `detach_from_process { "sessionId": "<id>", "terminateProcess": false }`.

## Quirks

- **Breakpoints report `"verified": false` at set time.** debugpy verifies them asynchronously once it loads the module. Set them anyway, then `start_debugging` — they bind and hit. Do not retry-loop on the unverified flag.
- **"special variables" container.** `get_variables` on a Locals scope may return `{"name": "special variables", "variablesReference": N}`. That is a container, not a variable: call `get_variables` again with `scope: N` to expand it and reveal the real locals. Always check `variablesReference > 0` / `expandable: true` and expand recursively. `get_local_variables` avoids this dance.
- **frameId vs variablesReference.** `get_scopes` takes the frame `id` from `get_stack_trace`; `get_variables` takes the scope's `variablesReference`. They are different numbers — never swap them.
- **Set breakpoints on executable lines** (assignments, calls, returns). Comments, blank lines, and bare `def`/`class` lines misbehave.
- **evaluate_expression** runs in debugpy's `variables` (watch-style) context by default. Reads and arithmetic are reliable; whether mutations like `x = 5` take effect depends on debugpy — verify with a follow-up evaluate before relying on one. Collections are truncated at 300 items.
- **Output capture works for Python** (`redirectOutput`): `print()` and stderr land in `get_output` entries, readable during and after the run until the session closes.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Session create/start fails, "Python not found" | Interpreter not on PATH | Set `PYTHON_PATH` (or `PYTHON_EXECUTABLE`), or pass `executablePath` in `create_debug_session` |
| Launch fails mentioning debugpy | debugpy not installed for that interpreter | `python -m pip install debugpy` using the same interpreter the session uses |
| `File not found` with a resolved path you didn't expect | Relative path resolved against the MCP client's cwd (or rejected in host mode) | Use absolute paths for `file` and `scriptPath` |
| Breakpoint never hits | Wrong file path, line not executed, or non-executable line | Verify absolute path matches the running file; move breakpoint to an executable statement on a reached code path |
| `evaluate_expression` -> "NameError: name ... is not defined" | Variable not assigned yet, or wrong frame | `get_stack_trace` to confirm location; step past the assignment; pass an explicit `frameId` |
| Attach fails when passing `processId` | Python attach is port-only | Restart target with `python -m debugpy --listen 127.0.0.1:<port>` and attach with `host`/`port` |
| "Session is not paused" errors | Inspection attempted while running | Wait for `paused` state (check `list_debug_sessions`), or `pause_execution` first |
