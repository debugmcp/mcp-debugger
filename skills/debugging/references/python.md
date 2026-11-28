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

Optional launch tuning via `dapLaunchArgs`: `{ "stopOnEntry": true }` to pause on the first line, `{ "justMyCode": false }` to step into library code. `dryRunSpawn: true` answers the adapter command the launch would run and leaves the session exactly as it was, a running program included; the same session then takes the real `start_debugging`.

Failing test, one call: `start_debugging { "sessionId": "<id>", "scriptPath": "/abs/tests/test_x.py", "testRunner": "pytest", "testTarget": "test_name" }` — no breakpoint needed. The answer is paused at the failing assert (or the raise site of an exception that escapes the test, with the helper frame first and the live test frame below it) with `snapshot.exception`, `frames` and `locals`; a passing test runs to completion (exit code 0). `testTarget` is `test_name`, `Class::test_name`, `test_name[param]` or a node id of that file; omit it for the whole file. The preset runs `python -m pytest <file>[::target] -x` from pytest's rootdir with xdist and cov turned off (`-p no:…`, or `-n0`/`--no-cov` when the project's `addopts` turns them on; your args asking for a plugin leave it alone) and arms `userUnhandled` beside `uncaught` (pytest catches failures, so plain `uncaught` never fires). Quirks: `pytest.skip()` pauses once (continue); an exception `pytest.raises` expects never pauses on Python 3.12+ but pauses once on ≤3.11 (continue); a `print` before the assert shows up in `get_output` only with pytest's report after the run (`args: ["-s"]` for live prints); your `args` are appended to pytest's.

Module launch: `dapLaunchArgs: { "module": "pytest" }` with `args: ["/abs/tests/test_x.py::test_name", "-x"]` runs `python -m pytest …` under the debugger instead of `scriptPath` (which still names the file the launch is about — the test file, or a package's `__main__.py`). debugpy takes one of `program`, `module`, `code`, so `program` is not sent; the answer's `warning` says so. `cwd` is what `python -m` puts on `sys.path`: it defaults to the directory above the top-most package containing `scriptPath`, and `dapLaunchArgs.cwd` sets it (the project root for a pytest run).

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

Shorthand: `create_debug_session { "language": "python", "host": "127.0.0.1", "port": 5678 }` creates the session and attaches in one call, with every attach argument `attach_to_process` takes. After the handshake the attach is verified by polling for threads; raise `verifyTimeout` (default ~20000 ms) for slow targets. Detach with `detach_from_process { "sessionId": "<id>", "terminateProcess": false }`.

**Ending an attach while the target is busy** (issue #1325): the `--listen` adapter belongs to the target, answers a `disconnect` only once the target's interpreter is free, and exits, closing the target's debug port for good, if its client leaves before that answer. `close_debug_session` and `detach_from_process` wait up to 10 s for it (`released: true` when it comes). A target busy for longer than that can lose its port; the answer's `warning` then says so. Never talk to the port with a client of your own that sends `disconnect` and closes without reading the answer.

**Remote targets (containers, pods)**: breakpoint paths resolve on the *target's* filesystem — use debuggee-side paths (`/app/app.py`, as shown by `get_stack_trace`) or a function breakpoint (`{"function": "tick"}`, no paths at all). To address breakpoints by local-checkout path instead, map it with debugpy's native shape: `adapterConfig: {"pathMappings": [{"localRoot": "<abs local dir>", "remoteRoot": "/app"}]}` — frames then report local paths too. The attach also sends debugpy `clientOS`, the operating system mcp-debugger runs on (`"WINDOWS"` / `"UNIX"`), so a Windows checkout's `C:\…` paths map onto a Linux target with the right separator; it is added only when you pass none of `clientOS`, `debugOptions` and `options`. Set `adapterConfig.clientOS` yourself when the paths you pass are in the other system's style (`C:\…` paths sent to the Docker image, say), and whenever you pass `debugOptions` or `options`, since no default is added then (from a Windows host to a Linux target, `{"options": "REDIRECT_OUTPUT=True", "pathMappings": [...]}` needs `"clientOS": "WINDOWS"`): debugpy accepts `"windows"`, `"unix"` and `"win"` in any case, an empty string leaves pydevd's current client-system setting unchanged (the target's own system unless an earlier attach to that process set another), and any other value fails the attach. The ptvsd-era bare `localRoot`/`remoteRoot` keys are not forwarded (the response `warning` names ignored keys), and `host`/`port` must stay top-level, never in `adapterConfig`. Kubernetes specifics (port-forward pattern, presets): [docs/kubernetes.md](https://github.com/debugmcp/mcp-debugger/blob/main/docs/kubernetes.md#breakpoints-and-paths-on-attach-read-this-once).

## Quirks

- **Exception-unwinding steps are lost on Python 3.12+.** With debugpy 1.8.22 on Python 3.12, 3.13 and 3.14, `step_over` or `step_out` where an exception leaves the function (at a `raise`, on a line that raises out of its function, or in a `finally` block during unwinding) never stops; the program runs on. `step_into` from the same place does stop. Since #1217 the step answer says the step was lost. Upstream: [debugpy #2100](https://github.com/microsoft/debugpy/issues/2100), reported 2026-11-26 (our issue #1194).
  Opt in per launch with `start_debugging { "sessionId": "<id>", "scriptPath": "/abs/path/app.py", "dapLaunchArgs": { "env": { "PYDEVD_USE_SYS_MONITORING": "0" } } }` to keep these steps. mcp-debugger does not set it by default: it costs 6 to 7 times on call-heavy code (10 million calls to a small function on Python 3.13: 2.26 s versus 0.38 s by default and 0.37 s without a debugger), and 1.6 to 1.8 times on a loop with no calls.
- **Breakpoints report `"verified": false` at set time.** debugpy verifies them asynchronously once it loads the module. Set them anyway, then `start_debugging` — they bind and hit. Do not retry-loop on the unverified flag.
- **"special variables" container.** `get_variables` on a Locals scope may return `{"name": "special variables", "variablesReference": N}`. That is a container, not a variable: call `get_variables` again with `scope: N` to expand it and reveal the real locals. Always check `variablesReference > 0` / `expandable: true` and expand recursively. `get_local_variables` avoids this dance.
- **frameId vs variablesReference.** `get_scopes` takes the frame `id` from `get_stack_trace`; `get_variables` takes the scope's `variablesReference`. They are different numbers — never swap them.
- **Set breakpoints on executable lines** (assignments, calls, returns). Comments, blank lines, and bare `def`/`class` lines misbehave.
- **evaluate_expression** runs in debugpy's `variables` (watch-style) context by default. Reads and arithmetic are reliable; whether mutations like `x = 5` take effect depends on debugpy — verify with a follow-up evaluate before relying on one. Collections are truncated at 300 items.
- **Output capture works for Python** (`redirectOutput`): `print()` and stderr land in `get_output` entries, readable during and after the run until the session closes.
- Logpoints work: `set_breakpoint` with `logMessage: "x={x}"` logs interpolated values to `get_output` without pausing. Each hit costs about 24.7 µs (2.5% of a core at 1,000 hits/s), and any logpoint in a function slows that whole function by 58× on Python 3.13 + debugpy (`sys.monitoring`) — keep logpoints off tight loops. When hits outrun debugpy's delivery rate (measured at 3,200–4,400 lines/s during a run, ~6,000 lines/s draining after), lines still queued at program exit are lost and the end answer does not say so (issue #1265). Full measurements: [docs/tool-reference.md#logpoints](https://github.com/debugmcp/mcp-debugger/blob/main/docs/tool-reference.md#logpoints).
- **Child processes are debug sessions by default.** debugpy's sub-process debugging is on: each Python child the program starts (`subprocess`, `multiprocessing`, pytest-xdist workers) becomes a child debug session — `list_debug_sessions` lists it with `parentSessionId`, it stops on this session's breakpoints, and `wait_for_stop` on this session reports the child's stop with `sessionId` naming the child (inspect and step with that id) and `children` listing the tree; a child can still be waited on by its own id. `dapLaunchArgs: { subProcess: false }` opts a launch out (the children run undebugged; the answer's warning says so); an attach target decides for itself (`python -m debugpy --listen … --configure-subProcess false`). `DEBUG_MCP_MAX_CHILD_SESSIONS=0` turns adoption off server-wide.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Session create/start fails, "Python not found" | Interpreter not on PATH | Set `PYTHON_PATH` (or `PYTHON_EXECUTABLE`), or pass `executablePath` in `create_debug_session` |
| Launch fails mentioning debugpy | debugpy not installed for that interpreter | `python -m pip install debugpy` using the same interpreter the session uses |
| `File not found` with a resolved path you didn't expect | Relative path resolved against the MCP client's cwd (or rejected in host mode) | Use absolute paths for `file` and `scriptPath` |
| Breakpoint never hits | Wrong file path, line not executed, or non-executable line | Verify absolute path matches the running file; move breakpoint to an executable statement on a reached code path |
| `evaluate_expression` -> "NameError: name ... is not defined" | Variable not assigned yet, or wrong frame | `get_stack_trace` to confirm location; step past the assignment; pass an explicit `frameId` |
| Attach fails when passing `processId` | Python attach is port-only | Restart target with `python -m debugpy --listen 127.0.0.1:<port>` and attach with `host`/`port` |
| On an attach, `verified: false` with "Breakpoint in file that does not exist." | debugpy looked for the path on the **target's** file system (a container, another machine) and found no file there | Attach with `adapterConfig.pathMappings` whose `localRoot` contains the file and whose `remoteRoot` is the same directory on the target, or set the breakpoint by the target's own path |
| "Session is not paused" errors | Inspection attempted while running | Wait for `paused` state (check `list_debug_sessions`), or `pause_execution` first |
