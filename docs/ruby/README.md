# Ruby Debugging with mcp-debugger

mcp-debugger supports Ruby debugging through [`rdbg`](https://github.com/ruby/debug), the
CLI of Ruby's official `debug` gem, speaking the Debug Adapter Protocol over TCP.

```
MCP client ──> mcp-debugger ──> DAP proxy ──TCP/DAP──> rdbg ──> your Ruby program
```

Two modes are supported:

- **Launch** — mcp-debugger starts your script under `rdbg` and debugs it from the first line.
- **Attach** — your program is already running under `rdbg --open` (locally, in a container,
  or in a Kubernetes pod) and mcp-debugger connects to its DAP socket directly. No adapter
  process is spawned; the proxy connects straight to the listening debugger.

## Prerequisites

1. **Ruby 2.7+** (Ruby 3.1+ recommended — it bundles the `debug` gem)
2. **debug gem 1.7+** providing `rdbg`:
   ```bash
   gem install debug
   ```
3. Verify:
   ```bash
   ruby --version
   rdbg --version
   ```

mcp-debugger auto-detects `ruby` and `rdbg` from `PATH` plus common install locations
(RubyInstaller `C:\RubyXX-x64\bin` on Windows, Homebrew, system paths). Override with the
`RUBY_PATH` and `RDBG_PATH` environment variables when needed.

> **Windows note:** gem executables are `.bat` shims, which Node.js refuses to spawn
> directly. mcp-debugger automatically runs the sibling `rdbg` Ruby script via your Ruby
> interpreter instead — no configuration required for RubyInstaller layouts.

## Launch mode

```text
create_debug_session  { "language": "ruby", "name": "My Session" }
set_breakpoint        { "sessionId": "...", "file": "/abs/path/app.rb", "line": 15 }
start_debugging       { "sessionId": "...", "scriptPath": "/abs/path/app.rb" }
```

Under the hood mcp-debugger runs:

```bash
rdbg --open --host 127.0.0.1 --port <free-port> -c -- ruby /abs/path/app.rb
```

`rdbg` suspends the script at load and waits for the debugger to connect, so breakpoints
are configured before any code runs — even for scripts that finish in milliseconds. With
`stopOnEntry: false` (the default) the entry pause is released automatically and execution
runs to your first breakpoint; with `stopOnEntry: true` you get control at the first line.

Conditional breakpoints are supported:

```text
set_breakpoint { "sessionId": "...", "file": "/abs/path/app.rb", "line": 15, "condition": "i == 6" }
```

While paused, the usual inspection tools work: `get_stack_trace`, `get_scopes` (rdbg
reports a `Local variables` scope), `get_local_variables`, `evaluate_expression`
(evaluated in rdbg's `repl` context — expressions can read and modify program state),
`step_over` / `step_into` / `step_out`, and `continue_execution`.

### Bundler projects

Pass `useBundler` through the launch configuration to run the target via `bundle exec`:

```text
start_debugging {
  "sessionId": "...",
  "scriptPath": "/abs/path/bin/rspec",
  "adapterLaunchConfig": { "useBundler": true }
}
```

## Attach mode

Start your program with an rdbg DAP listener:

```bash
# Suspended at load, waiting for a debugger (good for debugging startup):
rdbg --open --host 127.0.0.1 --port 12345 app.rb

# Running immediately, debugger can attach at any time (good for services):
rdbg --open --host 127.0.0.1 --port 12345 --nonstop app.rb
```

Then attach:

```text
create_debug_session { "language": "ruby", "name": "Attach Session" }
attach_to_process    { "sessionId": "...", "host": "127.0.0.1", "port": 12345 }
```

Attach pauses the target (mcp-debugger issues an explicit pause if the program was
already running), so you can set breakpoints and inspect immediately. Detach with:

```text
detach_from_process { "sessionId": "...", "terminateProcess": false }
```

The target keeps running after detach, and `rdbg` keeps listening — you can re-attach
later. Pass `terminateProcess: true` to kill the target instead.

## Remote attach (containers and Kubernetes)

Because attach connects directly to rdbg's TCP socket, anything that forwards a TCP port
gives you remote debugging. A working demo lives in
[`examples/ruby/remote-attach/`](../../examples/ruby/remote-attach/).

> ⚠️ **Security:** the rdbg DAP socket is unauthenticated and allows arbitrary code
> execution in the target process. Never expose it on a public interface. Reach it only
> through localhost port mappings, `kubectl port-forward`, or an SSH tunnel
> (`ssh -L 12345:127.0.0.1:12345 user@host`).

### Docker

```bash
docker build -t ruby-remote-attach:demo examples/ruby/remote-attach
docker run --rm -d --name ruby-demo -p 12345:12345 ruby-remote-attach:demo
```

```text
create_debug_session { "language": "ruby" }
attach_to_process    { "sessionId": "...", "host": "127.0.0.1", "port": 12345 }
set_breakpoint       { "sessionId": "...", "file": "/app/app.rb", "line": 18 }
continue_execution   { "sessionId": "..." }
```

Use the **container's** source paths for breakpoints (`/app/app.rb`, as reported by
`get_stack_trace`) — the debugger resolves paths against its own filesystem. For attach
sessions mcp-debugger skips host-side file existence checks for exactly this reason.

### Kubernetes

The same flow works against a pod through `kubectl port-forward` (verified with a
[kind](https://kind.sigs.k8s.io/) cluster and the manifest in the demo directory):

```bash
docker build -t ruby-remote-attach:demo examples/ruby/remote-attach
kind create cluster --name ruby-debug-demo
kind load docker-image ruby-remote-attach:demo --name ruby-debug-demo
kubectl apply -f examples/ruby/remote-attach/pod.yaml
kubectl port-forward pod/ruby-remote-attach 12399:12345
```

```text
attach_to_process { "sessionId": "...", "host": "127.0.0.1", "port": 12399 }
```

Breakpoints, conditional breakpoints, locals, and expression evaluation all work against
the pod exactly as they do locally. For a pod on a real cluster, the only difference is
where `kubectl port-forward` points.

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| `rdbg not found` | `gem install debug`, or set `RDBG_PATH` to the rdbg executable |
| Connect timeout on launch | Ruby startup can take a few seconds; check the session log under the temp directory for the spawn command and rdbg's stderr |
| Connect refused on attach | Verify the target was started with `--open --host --port` and the port is reachable (`rdbg` prints `Debugger can attach via TCP/IP`) |
| Breakpoint not verified on attach | Use the path as the **debuggee** sees it (e.g. `/app/app.rb` in a container), not the host path |
| Locals empty | Make sure the session is paused (breakpoint hit or explicit pause); rdbg reports locals only while stopped |

## Additional resources

- [ruby/debug](https://github.com/ruby/debug) — the debug gem and rdbg CLI
- [Debug Adapter Protocol](https://microsoft.github.io/debug-adapter-protocol/)
- [Tool reference](../tool-reference.md) — full MCP tool documentation
