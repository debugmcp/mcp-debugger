# Attach presets — Kubernetes targets

Copy-paste `attach_to_process` configurations for every attach-capable language,
so you (or your agent) don't have to derive them each time. Each preset assumes
the matching Deployment from this directory (`kubectl apply -f <lang>-app.yaml`),
but the *Target requirement* line tells you what any real workload needs.

Ground rules that apply to **every** attach session (all verified):

- **Breakpoint paths are sent verbatim to the remote debugger** and resolved
  against the **target's** filesystem. Use debuggee-side paths (`/app/app.py`),
  never local ones. `get_stack_trace` shows you the paths the target uses.
- **`breakOnExceptions` has no default on attach** — set it explicitly.
- `detach_from_process {terminateProcess: false}` leaves the target running.
- `restart_debugging` is rejected for attach sessions (detach and re-attach).
- Debug listeners (debugpy, rdbg, the V8 inspector, JDWP) are **unauthenticated
  remote-code-execution ports**. Reach them via `kubectl port-forward` only —
  never a Service, Ingress, or LoadBalancer.

Two ways to reach a debug port (see [docs/kubernetes.md](../../docs/kubernetes.md)):

- **Pattern A** — `kubectl port-forward` the debug port to your workstation and
  attach with a locally running mcp-debugger.
- **Pattern B** — inject mcp-debugger as an ephemeral container
  ([`debug-sidecar.sh`](debug-sidecar.sh)); it shares the pod's network
  namespace, so it attaches to `127.0.0.1:<port>` in-pod and only the MCP HTTP
  port is ever forwarded. Required for C/C++ (attach is by PID); optional for
  the network-attach languages.

---

## python

**Target requirement**: run under debugpy — `python -m debugpy --listen 0.0.0.0:5678 /app/app.py`
**Port-forward**: `kubectl port-forward deploy/python-demo 5678:5678`

```json
attach_to_process {"sessionId": "...", "host": "127.0.0.1", "port": 5678,
                   "breakOnExceptions": "uncaught"}
```

**Breakpoints & paths**: container-side paths only — `{"file": "/app/app.py", "line": 6}`.
The python adapter has **no path-mapping lever**: `localRoot`/`remoteRoot`/
`pathMappings` are silently dropped, and a breakpoint at a local path reports
`verified: false` ("file does not exist" from the target's point of view).
Function breakpoints (`{"function": "tick"}`) work and need no paths at all.
**Caveats**: do not put `host`/`port` inside `adapterConfig` (debugpy rejects
the conflicting `connect.*` combination). Attaching pauses the target; use
`continue_execution` to let it run with breakpoints armed.

## ruby

**Target requirement**: run under rdbg — `rdbg --open --host 0.0.0.0 --port 12345 --nonstop /app/app.rb`
(the `debug` gem is bundled with Ruby ≥ 3.1; stock `ruby:3.3-slim` has it)
**Port-forward**: `kubectl port-forward deploy/ruby-demo 12345:12345`

```json
attach_to_process {"sessionId": "...", "host": "127.0.0.1", "port": 12345,
                   "breakOnExceptions": "all"}
```

**Breakpoints & paths**: set at `/app/app.rb` — binds fine. Note that stack
frames report the ConfigMap volume's *resolved* symlink path
(`/app/..<timestamp>/app.rb`); that is the same file. To map paths to a local
checkout instead, pass `"localfsMap": "/app:<abs local dir>"` (top-level or in
`adapterConfig`).
**Caveats**: rdbg has no uncaught-only exception filter — use `"all"` or
`"none"`. Ruby attach captures no stdout (`get_output` stays empty); read the
pod logs instead. The containerized mcp-debugger attaches to rdbg with **no
Ruby runtime needed** (direct socket connection — ruby is attach-only in the
Docker image).

## javascript

**Target requirement**: `node --preserve-symlinks-main --inspect=0.0.0.0:9229 /app/app.js`
**Port-forward**: `kubectl port-forward deploy/javascript-demo 9229:9229`

```json
attach_to_process {"sessionId": "...", "host": "127.0.0.1", "port": 9229,
                   "breakOnExceptions": "uncaught"}
```

**Breakpoints & paths**: `{"file": "/app/app.js", "line": 3}` binds **only if**
the script's runtime path is `/app/app.js` — that is what
`--preserve-symlinks-main` is for: ConfigMap volumes are symlink trees, and
without the flag node resolves the main module to `/app/..<timestamp>/app.js`
and breakpoints at `/app/app.js` stay "Unbound". If you can't add the flag,
read the real path from `get_stack_trace` (pause first) and use that, or use a
function breakpoint (`{"function": "tick"}`) — those bind by symbol at the next
pause and need no path.
**Caveats**: `adapterConfig` is ignored by the js adapter (js-debug builds its
own attach request) — there is no path-mapping lever. Breakpoints may report
`verified: false` ("Unbound") until the script is seen; they still hit.

## java

**Target requirement**: JVM started with a JDWP agent —
`java -agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:5005 -cp /shared App`
(compile with `javac -g` or variables won't be inspectable)
**Port-forward**: `kubectl port-forward deploy/java-demo 5005:5005`

```json
attach_to_process {"sessionId": "...", "host": "127.0.0.1", "port": 5005,
                   "verifyTimeout": 60000, "breakOnExceptions": "uncaught"}
```

**Breakpoints & paths**: prefer the **fully-qualified class name** instead of a
file path — `{"file": "App", "line": 4}` (or `"com.example.MyClass"`). This
binds immediately, works with every classloader, and needs no source files
anywhere. Pass `sourcePaths` only if you want source-file addressing against a
local checkout.
**Caveats**: `verifyTimeout` is in **milliseconds** — raise it (e.g. `60000`)
for a still-warming JVM. A `suspend=y` target waits for the debugger and needs
an explicit `continue_execution` after attach. Deferred breakpoints on
not-yet-loaded classes bind natively via `ClassPrepareRequest`.

## cpp (and C)

**Target requirement**: none — no agent, no debug port, no flags. Compile with
debug info and don't strip (`g++ -g -O0 -gdwarf-4`, as `cpp-app.yaml` does).
**Sidecar** (attach is by PID, so the debugger must share the PID namespace):

```bash
./debug-sidecar.sh app=cpp-demo        # kubectl debug --target=app --profile=general + port-forward 3001
```

```json
attach_to_process {"sessionId": "...", "processId": 1, "stopOnEntry": true,
                   "adapterConfig": {"program": "/proc/1/root/shared/app"}}
```

**Breakpoints & paths**: function breakpoints need nothing —
`{"function": "tick"}` → "Resolved locations: 1". Line breakpoints work against
the **compile-time path recorded in the DWARF** (`{"file": "/app/app.cpp", "line": 8}`
for this manifest), even with zero source files in the sidecar.
**Caveats**: `adapterConfig.program` points CodeLLDB at the target's binary
through `/proc/<pid>/root/` — required because mount namespaces are not shared
and `/proc/1/maps` paths aren't openable from the sidecar. The target is
**PID 1** of the shared namespace when injected with `--target=app`.
`--profile=general` is what injects `SYS_PTRACE` (nodes run
`kernel.yama.ptrace_scope=1`). `stopOnEntry` defaults to `true` for C/C++
attach. Expect `<optimized out>` locals on `-O2` builds and symbol-only
breakpoints on stripped binaries.

## dotnet — no Kubernetes recipe today

.NET attach is **PID-only** (no host/port attach exists in netcoredbg), which
would require the sidecar pattern — but the published Docker image ships
without netcoredbg (`DEBUG_MCP_DISABLE_LANGUAGES=go,dotnet`), so the sidecar
cannot debug .NET. Debug .NET on a host where netcoredbg is installed
(`docs/dotnet/README.md`), or launch the workload locally.

## go / rust — attach not implemented

`attach_to_process` fails fast with "Attach mode is not implemented" for these
languages. Rust *launch* debugging works in the container (vendored CodeLLDB);
Go is disabled in the image entirely.
