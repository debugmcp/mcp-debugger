# Ruby debugging (mcp-debugger)

## Prerequisites

- Ruby 2.7+ (3.1+ recommended — it bundles the `debug` gem). Need `debug` gem 1.7+ providing `rdbg`: `gem install debug`. Verify with `ruby --version` and `rdbg --version`.
- Auto-detects `ruby`/`rdbg` from PATH and common install locations (RubyInstaller `C:\RubyXX-x64\bin`, Homebrew, system paths). Override with `RUBY_PATH` / `RDBG_PATH` env vars.
- Windows: gem executables are `.bat` shims that Node cannot spawn directly — mcp-debugger automatically runs the sibling `rdbg` Ruby script via your Ruby interpreter. No configuration needed.
- Use absolute file paths.

## Launch quickstart

```text
create_debug_session { "language": "ruby", "name": "rb-bug-hunt" }
  -> returns sessionId

set_breakpoint  { "sessionId": "<id>", "file": "/abs/path/app.rb", "line": 15 }
start_debugging { "sessionId": "<id>", "scriptPath": "/abs/path/app.rb" }
  -> rdbg suspends the script at load, breakpoints are configured before any code runs,
     then execution auto-continues to your breakpoint (stopOnEntry defaults to false)

get_stack_trace { "sessionId": "<id>" }
get_scopes      { "sessionId": "<id>", "frameId": <top frame id> }   # rdbg reports "Local variables"
get_local_variables { "sessionId": "<id>" }
evaluate_expression { "sessionId": "<id>", "expression": "items.size" }
step_over       { "sessionId": "<id>" }
continue_execution { "sessionId": "<id>" }
close_debug_session { "sessionId": "<id>" }
```

Conditional breakpoints work: `set_breakpoint { ..., "condition": "i == 6" }`.

**Bundler projects (Rails, RSpec):** run the target via `bundle exec` by passing `useBundler` in the adapter launch config:

```text
start_debugging {
  "sessionId": "<id>",
  "scriptPath": "/abs/path/bin/rspec",
  "adapterLaunchConfig": { "useBundler": true }
}
```

## Attach / remote

Start the target with an rdbg DAP listener:

```bash
rdbg --open --host 127.0.0.1 --port 12345 app.rb            # suspended at load (debug startup)
rdbg --open --host 127.0.0.1 --port 12345 --nonstop app.rb  # runs immediately (services)
```

```text
create_debug_session { "language": "ruby", "name": "attach" }
attach_to_process    { "sessionId": "<id>", "host": "127.0.0.1", "port": 12345 }
  -> attach pauses the target (an explicit pause is issued if it was running),
     so you can set breakpoints and inspect immediately
set_breakpoint       { "sessionId": "<id>", "file": "/app/app.rb", "line": 18 }
continue_execution   { "sessionId": "<id>" }
detach_from_process  { "sessionId": "<id>", "terminateProcess": false }   # target keeps running; re-attach later
```

No adapter process is spawned for attach — the proxy connects straight to rdbg's TCP socket, so anything that forwards TCP gives remote debugging. Kubernetes pattern:

```bash
kubectl port-forward pod/my-pod 12399:12345
# then: attach_to_process { "sessionId": "<id>", "host": "127.0.0.1", "port": 12399 }
```

For containers/pods, use the **debuggee's** filesystem paths in `set_breakpoint` (e.g. `/app/app.rb`, as reported by `get_stack_trace`) — host-side file existence checks are skipped for attach sessions. Security: the rdbg socket is unauthenticated and allows arbitrary code execution; reach it only via localhost port mappings, `kubectl port-forward`, or an SSH tunnel — never a public interface.

## Quirks

- **Launch always stops at load.** rdbg suspends the script before the first line so breakpoints bind even for scripts that finish in milliseconds. With `stopOnEntry: false` (default) that entry pause is released automatically; with `dapLaunchArgs: { "stopOnEntry": true }` you get control at the first line.
- **Debuggee output is captured in launch mode.** rdbg hands the debuggee the adapter process's stdio; the proxy forwards it as `get_output` entries (categories `stdout`/`stderr`, rdbg's own `DEBUGGER:` banners excluded). **Attach mode captures nothing** — the target's stdio stays wherever the process was started; inspect state via `evaluate_expression` / `get_local_variables` there instead.
- **evaluate_expression runs in rdbg's `repl` context** — expressions can read *and modify* program state (`x = 5` works). Useful for testing fixes live.
- **Scope name is `Local variables`** (not "Locals"); `get_local_variables` handles this for you. Locals are only reported while stopped.
- **Windows `.bat` shim bypass is automatic** — if spawn fails anyway, set `RDBG_PATH` to the rdbg script inside your Ruby installation's `bin` directory.
- **Ruby startup can take a few seconds** on launch; don't declare a timeout after one slow start.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `rdbg not found` | debug gem missing or not on PATH | `gem install debug`, or set `RDBG_PATH` (and `RUBY_PATH` if ruby itself isn't found) |
| Connect timeout on launch | Slow Ruby startup, or spawn failed | Retry; check the session log in the temp directory for the spawn command and rdbg's stderr |
| Connect refused on attach | Target not listening | Start it with `rdbg --open --host <h> --port <p>`; rdbg prints `Debugger can attach via TCP/IP` when ready; verify port-forwarding |
| Breakpoint not verified on attach | Host path used for a remote/container target | Use the path as the debuggee sees it (e.g. `/app/app.rb` from `get_stack_trace`) |
| Locals empty | Session not paused | Hit a breakpoint or `pause_execution` first — rdbg reports locals only while stopped |
| `get_output` returns no entries on attach | Attached target's stdio stays on its own terminal/pod | Read the target's own logs, or inspect via `evaluate_expression` at a breakpoint |
