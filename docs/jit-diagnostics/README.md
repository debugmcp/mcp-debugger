# Just-in-time diagnostics: debugging a sick pod without redeploying it

The prevailing observability model is *log everything in advance and pay to store it, in case you need it later*. This tutorial demonstrates the inverse: **interrogate the live process only when something is wrong** — an agent attaches a real debugger to a misbehaving Kubernetes pod, inspects actual runtime state, names the bug, and detaches. Nothing pre-instrumented, nothing stored, no redeploy, and the pod keeps serving.

The bug in this tutorial is chosen to be **invisible to logs**: it's state-dependent (only manifests after a particular traffic pattern) and the corrupted value lives in an in-memory cache no log line ever prints. A debugger finds it in minutes.

The tutorial has two parts: **Part 1** debugs an interpreted service by connecting to an in-process debug agent over the network; **Part 2** debugs a **compiled** service — where no in-process agent exists — by sending the debugger to the pod as a Kubernetes ephemeral debug container and attaching by PID.

## Prerequisites

- Docker, [kind](https://kind.sigs.k8s.io/) (or any cluster you can `kubectl port-forward` into), `kubectl`
- An AI agent connected to mcp-debugger (e.g. Claude Code with `npx @debugmcp/mcp-debugger stdio` registered), running on your workstation
- This repo checked out (the agent needs local source for path mapping)

## 1. Deploy the sick service

```bash
cd examples/sick-pod
kind create cluster --name jit-demo
docker build -t sick-pod-checkout:tutorial .
kind load docker-image sick-pod-checkout:tutorial --name jit-demo
kubectl apply -f k8s.yaml
kubectl wait --for=condition=available deployment/checkout
kubectl port-forward svc/checkout 8080:8080 &
```

## 2. Reproduce the symptom

```bash
# A cherry cart costs 300 cents. Correct.
curl -s localhost:8080/checkout -d '{"items":["cherry"]}'
# -> {"items": ["cherry"], "total_cents": 300}

# Someone checks out the same cart WITH a bulk discount...
curl -s localhost:8080/checkout -d '{"items":["cherry"], "bulk": true}'
# -> {"items": ["cherry"], "total_cents": 270}   (10% off — fine)

# ...and now every regular customer gets the wrong price, forever:
curl -s localhost:8080/checkout -d '{"items":["cherry"]}'
# -> {"items": ["cherry"], "total_cents": 270}   # WRONG. Should be 300.
```

The service logs nothing useful (check: `kubectl logs deploy/checkout`). Restarting the pod "fixes" it — until the traffic pattern recurs. This is exactly the class of bug that gets labeled *unreproducible* and closed.

## 3. Attach the agent's debugger to the live pod

The tutorial image runs the app under `debugpy --listen 0.0.0.0:5678` (see the security notes for how to do this on demand instead). Forward the debug port:

```bash
kubectl port-forward deploy/checkout 5678:5678 &
```

Now ask your agent to diagnose it. The tool sequence it should follow:

```text
create_debug_session  {language: "python", name: "sick-pod"}
attach_to_process     {sessionId, host: "127.0.0.1", port: 5678,
                       localRoot: "<abs path>/examples/sick-pod",
                       remoteRoot: "/app"}
set_breakpoint        {sessionId, file: "<abs path>/examples/sick-pod/app.py", line: 51}
                      # line 51 = "total = sum(prices)" in the non-bulk path
```

Trigger one request while the breakpoint is armed:

```bash
curl -s localhost:8080/checkout -d '{"items":["cherry"]}'
```

The session pauses inside the live pod. The agent inspects:

```text
get_stack_trace       {sessionId}
get_local_variables   {sessionId}          # prices = [270]  <- corrupted!
evaluate_expression   {sessionId, expression: "_cart_cache"}
                      # {('cherry',): [270]}  <- the cached template was mutated
evaluate_expression   {sessionId, expression: "PRICES['cherry']"}   # 300 — source of truth is fine
continue_execution    {sessionId}
close_debug_session   {sessionId}          # pod keeps serving throughout
```

Diagnosis: `build_cart` returns the **cached list object itself**, and `apply_bulk_discount` mutates it in place — one bulk request corrupts the cache for every later request with the same cart shape. Fix: return a copy (`list(_cart_cache[key])`) or make the discount non-mutating.

Total pause time: a few hundred milliseconds around one request. No redeploy, no new log lines, no observability bill.

## Part 2: Native code — bring the debugger to the pod

Part 1 worked because debugpy runs **inside** the sick process: the debug engine ships with the debuggee, and only a wire protocol crosses the network. Compiled services (C, C++, Rust, Go) have no in-process agent to connect to — a native debugger's power comes from the kernel (`ptrace`), and ptrace never crosses the network or a PID-namespace boundary. So instead of connecting to the pod, you **send the debugger to the pod**: a Kubernetes *ephemeral debug container* running the mcp-debugger image, sharing the target container's PID namespace, attaching to the compiled process **by PID**. (Everything below was verified end-to-end on kind with containerd.)

The demo service is [`examples/sick-pod-cpp`](../../examples/sick-pod-cpp/) — the same cache-mutation bug as Part 1's checkout service, now in a compiled C++ "pricer" (a reference into a cached `std::vector` is mutated in place by the bulk-discount path). Same class of bug, same invisibility to logs; only the attach mechanism differs.

### 2.1 Deploy and reproduce

```bash
cd examples/sick-pod-cpp
docker build -t sick-pod-pricer:tutorial .
kind load docker-image sick-pod-pricer:tutorial --name jit-demo
kubectl apply -f k8s.yaml
kubectl wait --for=condition=available deployment/pricer
kubectl port-forward svc/pricer 18080:8080 &

printf 'TOTAL cherry\n' | nc localhost 18080   # -> 300  correct
printf 'BULK cherry\n'  | nc localhost 18080   # -> 270  (10% off — fine)
printf 'TOTAL cherry\n' | nc localhost 18080   # -> 270  WRONG. Should be 300.
```

### 2.2 Send the debugger to the pod

The mcp-debugger image must be reachable by the cluster (`kind load docker-image mcp-debugger:local --name jit-demo`, or `debugmcp/mcp-debugger:latest` from the registry). Start an ephemeral debug container that shares the app container's PID namespace and runs the MCP server over Streamable HTTP:

```bash
POD=$(kubectl get pods -l app=pricer -o jsonpath='{.items[0].metadata.name}')
kubectl debug "$POD" --image=debugmcp/mcp-debugger:latest \
  --target=app --profile=general --container=debugger \
  -- /app/entry.sh http -p 3001
kubectl port-forward "pod/$POD" 3001:3001 &
```

Register the endpoint with your agent (e.g. `claude mcp add-json sick-pod '{"type":"http","url":"http://127.0.0.1:3001/mcp"}'`).

The HTTP server reaps MCP sessions abandoned by a crashed client (idle, with no open SSE stream) after 30 minutes, closing their debug sessions and releasing any ptrace claim on the target. For a short-lived diagnostic sidecar a tighter window is safer — add `--env=MCP_HTTP_STALE_SESSION_MS=300000` (5 minutes; `0` disables) to the `kubectl debug` command.

Facts that will save you an afternoon (all observed, not assumed):

- **`--profile=general` is what makes attach possible.** It injects `SYS_PTRACE` into the ephemeral container's securityContext (`kubectl get pod -o jsonpath='{.spec.ephemeralContainers[*].securityContext}'` shows `{"capabilities":{"add":["SYS_PTRACE"]}}`). Kubernetes nodes commonly run `kernel.yama.ptrace_scope=1` (the kind node does), which blocks ptrace of non-descendant processes without that capability — the legacy default profile fails there. `--profile=sysadmin` also works but grants far more than needed.
- **`kubectl debug`'s `--` arguments replace the image's entrypoint** (unlike `docker run`, where they are appended). Pass the entry script explicitly: `-- /app/entry.sh http -p 3001`. Bare `-- http -p 3001` fails with `exec: "http": executable file not found`.
- **`--target` shares only the PID namespace.** The app process is visible — typically as **PID 1** of the shared namespace (`kubectl exec "$POD" -c debugger -- ps -eo pid,comm`; the image ships `procps`).
- **Ephemeral containers cannot be removed or restarted** — each retry needs a fresh `--container` name; a pod restart clears them all.

### 2.3 Symbols across the mount-namespace boundary

PID namespaces are shared; **mount namespaces are not**. LLDB reads the target's module list from `/proc/1/maps`, whose paths (`/pricer`) don't exist in the debugger container's filesystem — attach still works, but frames show raw addresses and function breakpoints resolve 0 locations. The target's entire filesystem is visible at `/proc/<pid>/root/` (ptrace privilege grants this), so point CodeLLDB at the binary through it, right in the attach call ([#336](https://github.com/debugmcp/mcp-debugger/issues/336)):

```text
attach_to_process {sessionId, processId: 1, adapterConfig: {program: "/proc/1/root/pricer"}}
```

(The pre-#336 workaround — `kubectl exec "$POD" -c debugger -- ln -sf /proc/1/root/pricer /pricer` before attaching — still works, but the `adapterConfig` form keeps the flow self-contained: no exec step, nothing to clean up.)

With that in place CodeLLDB loads the DWARF from the live target's binary: frames symbolize, locals resolve, function breakpoints bind.

### 2.4 Attach by PID and find the bug

The sidecar has no source files and doesn't need them: **function breakpoints** address code by symbol (no file paths), and line tables plus variable names come from the DWARF inside the binary (compile with `-gdwarf-4 -O0`, don't strip — as `examples/sick-pod-cpp/Dockerfile` does).

```text
create_debug_session  {language: "cpp", name: "sick-pod-native"}
attach_to_process     {sessionId, processId: 1, stopOnEntry: true,
                       adapterConfig: {program: "/proc/1/root/pricer"}}
set_breakpoint        {sessionId, function: "apply_bulk_discount"}
                      # -> verified: true, "Resolved locations: 1"
continue_execution    {sessionId}
```

Trigger the buggy path while the function breakpoint is armed:

```bash
printf 'BULK cherry\n' | nc localhost 18080
```

The pod pauses at `apply_bulk_discount`. Inspect:

```text
get_stack_trace       {sessionId}   # ::apply_bulk_discount(std::vector<int>&) — fully symbolized
get_local_variables   {sessionId}   # prices: std::vector<int>& (size=1) — a REFERENCE into the cache
evaluate_expression   {sessionId, expression: "g_cart_cache"}
continue_execution    {sessionId}
detach_from_process   {sessionId, terminateProcess: false}
close_debug_session   {sessionId}   # pod keeps serving throughout — verified with a post-detach request
```

Diagnosis: `build_cart` returns a **reference to the cached vector**, and `apply_bulk_discount` writes through it — one bulk request corrupts the cache for every later request. Fix: return a copy, or total without mutating.

(One cosmetic note: the *initial* `stopOnEntry` pause usually lands inside the target's stripped libc — `accept(2)` — so that first frame shows an `___lldb_unnamed_symbol`. Your code symbolizes fine; libc symbols aren't needed for the diagnosis.)

### 2.5 Symbolication expectations

- **DWARF in the binary** (this tutorial): full source-line stacks, typed locals, expression evaluation — even with zero source files in the sidecar (source *display* needs files; control and inspection don't).
- **Stripped binary**: attach, pause, threads, and memory still work; function breakpoints only on surviving (exported/dynamic) symbols; no locals-by-name. Ship separate debug files, or run unstripped builds where you may need to diagnose.
- **Optimized builds** (`-O2`): expect `<optimized out>` locals and merged lines.

### 2.6 Outside Kubernetes: the escape hatches

- **Plain Docker on a Linux host**: `docker run --pid=host --cap-add=SYS_PTRACE debugmcp/mcp-debugger:latest http -p 3001` sees and can attach to host PIDs (with the isolation caveats that implies). From Docker Desktop (Windows/macOS), that reaches the VM's processes, not the host's — attaching to Windows/macOS processes needs a native install.
- **Same-container attach in plain Docker** needs `--cap-add=SYS_PTRACE` whenever the host kernel sets `kernel.yama.ptrace_scope >= 1` — the `docker-smoke-cpp-attach` e2e test does exactly this.
- **gdbserver / lldb-server next to the target**: the cpp adapter passes CodeLLDB's advanced config through (`initCommands`, `targetCreateCommands`, `processCreateCommands`), so a remote debug stub works with no namespace sharing at all — e.g. launch with `adapterLaunchConfig: {custom: true, targetCreateCommands: ["target create /path/to/binary"], processCreateCommands: ["gdb-remote <host>:<port>"]}` while a `gdbserver --attach <host>:<port> <pid>` runs next to the target.

## Security notes (read before using this pattern beyond a demo)

- **Never expose a debug port through a Service, Ingress, or LoadBalancer.** debugpy/rdbg listeners are unauthenticated and allow code execution. `kubectl port-forward` keeps the connection inside your kubeconfig's auth.
- Prefer **on-demand listeners** over always-on ones: add the debug flag to a single quarantined pod when diagnosing (e.g. remove the pod from the Service selector, then `kubectl debug`/patch it), rather than baking it into the deployment as this tutorial image does for convenience.
- Target **staging, canaries, or quarantined sick pods** — pausing a pod that's in a live serving rotation stops its traffic for the duration of the pause. For non-breaking inspection, pass `logMessage` to `set_breakpoint` (a logpoint, [#235](https://github.com/debugmcp/mcp-debugger/issues/235)): the pod keeps serving at full speed while interpolated values stream into `get_output`.
- The same Part-1 flow works for **Ruby** (`rdbg --open --port`) — see [docs/ruby/README.md](../ruby/README.md) — and **Java** (JDWP agent), covering three of the most common backend runtimes. The containerized server itself can be the attach client for those too: it reports per-mode availability (`ruby` is attach-only in the image — no Ruby runtime needed for a direct rdbg connection).
- **The ephemeral container's MCP HTTP port is unauthenticated** — reach it via `kubectl port-forward` only, never a Service. Whoever can call it controls a ptrace-capable debugger inside your pod.
- An uncleanly abandoned attach session no longer leaves an orphaned `lldb-server` tracing the target ([#337](https://github.com/debugmcp/mcp-debugger/issues/337)): teardown kills the adapter's whole process group, and the HTTP server reaps crash-abandoned MCP sessions after the stale window. If you suspect a leftover tracer anyway (e.g. after a hard kill of the debug container's server), check `grep TracerPid /proc/1/status` from the debug container and kill the reported PID.

## Cleanup

```bash
kind delete cluster --name jit-demo
```
