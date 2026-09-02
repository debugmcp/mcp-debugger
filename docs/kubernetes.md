# Kubernetes debugging

The copy-paste path from "my pod is misbehaving" to "an agent is stepping
through it". This is the operational reference: which attach pattern to use per
language, turnkey manifests to try it with, and the exact tool calls. For a
narrative tutorial that diagnoses a realistic log-invisible bug, see the
[JIT diagnostics tutorial](jit-diagnostics/README.md).

Everything below was verified end-to-end on kind (Kubernetes v1.36, containerd)
and on Amazon EKS — see [Managed clusters: EKS](#managed-clusters-eks) — and the
python + cpp cycles are re-verified weekly in CI against a kind cluster
(`.github/workflows/k8s-smoke.yml`, issue #451).

## The two patterns

**Pattern A — port-forward the debug port.** Interpreted/JIT runtimes can host
their own debug agent (debugpy, rdbg, the V8 inspector, JDWP): the debug engine
runs inside the target process and only a wire protocol crosses the network.
Forward the pod's debug port with `kubectl port-forward` and attach with an
mcp-debugger running anywhere (your workstation, your agent's host).

**Pattern B — send the debugger to the pod.** Compiled services (C/C++) have no
in-process agent; a native debugger needs `ptrace`, which never crosses the
network. Inject the mcp-debugger image as a Kubernetes *ephemeral debug
container* sharing the target's PID namespace, and attach **by PID** from
inside. Your agent reaches the sidecar's MCP endpoint over one forwarded HTTP
port. The sidecar also works for pattern-A languages as a **zero-exposed-port
variant**: ephemeral containers always share the pod's network namespace, so
the sidecar attaches to `127.0.0.1:<debug port>` in-pod and the debug port is
never forwarded anywhere.

| Language | Pattern | Debug port | Breakpoint addressing | Path-mapping lever | One-line caveat |
|---|---|---|---|---|---|
| python | A (or B in-pod) | 5678 (debugpy) | container path `/app/app.py`, or function | `adapterConfig.pathMappings: [{localRoot, remoteRoot}]` | don't put host/port in `adapterConfig` |
| ruby | A (or B in-pod) | 12345 (rdbg) | container path `/app/app.rb` | `localfsMap: "/app:<local>"` | `breakOnExceptions: "all"` (no uncaught-only); attach captures no stdout |
| javascript | A (or B in-pod) | 9229 (inspector) | container path, or function | none (`adapterConfig` ignored) | needs `--preserve-symlinks-main` (see below) |
| java | A (or B in-pod) | 5005 (JDWP) | **FQCN** `{"file": "App", "line": 4}` — no source needed | `sourcePaths` | `verifyTimeout` is ms — use `60000` for warming JVMs |
| cpp / c | **B only** (attach by PID) | — | function, or DWARF compile path | `adapterConfig.program` | needs `--profile=general` (SYS_PTRACE) |
| dotnet | — | — | — | — | PID-only attach + not in the Docker image → no k8s recipe today |
| go, rust | — | — | — | — | attach not implemented |

Per-language copy-paste configs: **[examples/kubernetes/attach-presets.md](../examples/kubernetes/attach-presets.md)**.

## Quickstart: turnkey targets

[`examples/kubernetes/`](../examples/kubernetes/) has one self-contained,
registry-free manifest per language — stock public images, app source in a
ConfigMap, initContainer compiles where needed. They deploy unchanged on kind,
EKS, or anything that pulls from Docker Hub:

```bash
kubectl apply -f examples/kubernetes/python-app.yaml
kubectl wait --for=condition=available deployment/python-demo
```

Each app calls `tick(counter)` every 2 seconds, so a breakpoint in `tick` hits
within 2 s of arming — no traffic generation needed.

## Pattern A worked example (python)

```bash
kubectl port-forward deploy/python-demo 5678:5678 &
```

```text
create_debug_session  {language: "python", name: "sick-pod"}
attach_to_process     {sessionId, host: "127.0.0.1", port: 5678, breakOnExceptions: "uncaught"}
set_breakpoint        {sessionId, file: "/app/app.py", line: 6}     # container-side path!
continue_execution    {sessionId}
# ...within 2s the tick loop hits the breakpoint...
get_stack_trace       {sessionId}    # tick at /app/app.py:6, main at :15
get_local_variables   {sessionId}    # counter=18, label='tick-18'
evaluate_expression   {sessionId, expression: "counter * 100"}
continue_execution    {sessionId}
detach_from_process   {sessionId, terminateProcess: false}
close_debug_session   {sessionId}    # pod keeps serving throughout
```

The same flow works for ruby (12345), javascript (9229), and java (5005) with
the presets. Java is the most k8s-friendly of all: address breakpoints by
fully-qualified class name (`{"file": "App", "line": 4}`) and you need **no
source files and no path mapping at all**.

### Breakpoints and paths on attach (read this once)

Attach sessions send breakpoint paths **verbatim** to the remote debugger,
which resolves them against the **target's** filesystem — host-side existence
checks are skipped. Practical rules, all verified:

- Use debuggee-side paths (`/app/app.py`), taken from `get_stack_trace` if in
  doubt. A local-workstation path reports `verified: false` and never binds
  unless a mapping translates it: python takes `adapterConfig.pathMappings:
  [{localRoot, remoteRoot}]` (debugpy's native shape), ruby takes `localfsMap`;
  js and cpp have no mapping lever. `adapterConfig` keys an adapter can't
  forward are named in the attach response's `warning` instead of vanishing.
- **ConfigMap volumes are symlink trees** and some runtimes resolve them:
  - node resolves the main module's real path (`/app/..<timestamp>/app.js`) —
    start node with `--preserve-symlinks-main` so plain `/app/app.js`
    breakpoints bind (the example manifest does).
  - ruby binds breakpoints at `/app/app.rb` fine but *reports* frames at the
    resolved `..<timestamp>` path — same file, don't be alarmed.
- **Function breakpoints sidestep paths entirely** (`{"function": "tick"}`) —
  supported for python, javascript (binds at the next pause), java, and
  cpp. When in doubt on attach, address by symbol, not by file.
- `breakOnExceptions` has **no default on attach** — pass it explicitly.
- `restart_debugging` is rejected on attach; detach and re-attach instead.

## Pattern B worked example (cpp ephemeral sidecar)

The target ([`cpp-app.yaml`](../examples/kubernetes/cpp-app.yaml)) has no debug
agent, no debug port, no toolchain — just an unstripped `-g -O0 -gdwarf-4`
binary. Send the debugger to it:

```bash
POD=$(kubectl get pods -l app=cpp-demo -o jsonpath='{.items[0].metadata.name}')
kubectl debug "$POD" --image=debugmcp/mcp-debugger:latest \
  --target=app --profile=general --container=debugger \
  --env=MCP_HTTP_STALE_SESSION_MS=300000 \
  -- /app/entry.sh http -p 3001
kubectl port-forward "pod/$POD" 3001:3001 &
```

(or `./examples/kubernetes/debug-sidecar.sh app=cpp-demo`, which does both.)
Register the endpoint with your agent, e.g.
`claude mcp add-json k8s-sidecar '{"type":"http","url":"http://127.0.0.1:3001/mcp"}'`.

The flags that matter — each one is load-bearing:

- **`--profile=general`** injects `SYS_PTRACE` into the ephemeral container.
  Many nodes run `kernel.yama.ptrace_scope=1` (kind nodes do), which blocks
  ptrace of non-descendant processes without it. Some node OSes ship `0` (EKS
  AL2023 does, observed) — keep the flag anyway: it's harmless where scope is
  0 and load-bearing everywhere else. `sysadmin` also works but over-grants.
- **`--target=app`** shares the *PID namespace* with the app container — the
  target process appears as **PID 1**. Mount namespaces are NOT shared.
- **The `--` arguments replace the image entrypoint** (unlike `docker run`):
  pass `-- /app/entry.sh http -p 3001` — bare `-- http -p 3001` fails with
  `exec: "http": executable file not found`. (Git Bash on Windows mangles
  `/app/...` — prefix the command with `MSYS_NO_PATHCONV=1`.)
- **`MCP_HTTP_STALE_SESSION_MS=300000`** tightens the reaper that cleans up MCP
  sessions abandoned by a client that never opened an SSE stream from 30 min
  to 5 — releasing the ptrace claim on your pod sooner. (A crashed SDK client,
  whose stream the server saw close, is reaped after 2 min regardless —
  `MCP_HTTP_STREAM_LOST_SESSION_MS`.)
- Ephemeral containers **cannot be removed or restarted** — each retry needs a
  fresh `--container` name; only a pod restart clears them.

Then, over the sidecar's MCP endpoint:

```text
create_debug_session  {language: "cpp", name: "sick-pod-native"}
attach_to_process     {sessionId, processId: 1, stopOnEntry: true,
                       adapterConfig: {program: "/proc/1/root/shared/app"}}
set_breakpoint        {sessionId, function: "tick"}      # -> verified, "Resolved locations: 1"
continue_execution    {sessionId}
# ...tick fires within 2s...
get_stack_trace       {sessionId}    # tick(int), main — fully symbolized
get_local_variables   {sessionId}    # counter: int, label: std::string — typed
detach_from_process   {sessionId, terminateProcess: false}
close_debug_session   {sessionId}    # target ran throughout
```

**Symbols across the mount-namespace boundary**: LLDB reads the target's module
list from `/proc/1/maps`, whose paths don't exist in the sidecar's filesystem.
`adapterConfig.program` points CodeLLDB at the binary through
`/proc/<pid>/root/` (the target's entire filesystem, visible via ptrace
privilege) — with it, frames symbolize, locals resolve with types, and function
breakpoints bind, with **zero source files in the sidecar**. Line breakpoints
also work, addressed by the compile-time path recorded in the DWARF
(`/app/app.cpp` for the example manifest). Expectations by build type:
unstripped `-O0` gives full fidelity; stripped binaries allow attach/pause/
memory but only exported-symbol breakpoints; `-O2` yields `<optimized out>`
locals and merged lines.

### The in-pod variant for interpreted languages

The same sidecar attached to the *python* pod debugs it with **no debug port
forwarded at all** (the sidecar reaches `127.0.0.1:5678` inside the pod's
network namespace; `--target`/`--profile` aren't needed for network attach,
though `--profile=general` avoids a deprecation warning):

```bash
kubectl debug "$POD" --image=debugmcp/mcp-debugger:latest --profile=general \
  --container=debugger --env=MCP_HTTP_STALE_SESSION_MS=300000 -- /app/entry.sh http -p 3001
```

Then `attach_to_process {host: "127.0.0.1", port: 5678, ...}` from a session on
the sidecar. This is the lowest-exposure pattern: the only forwarded port is
the MCP endpoint, and the containerized server attaches to python, ruby
(attach-only in the image — no Ruby runtime needed), javascript, and java.

## Security notes

- **Never expose a debug port or the sidecar's MCP port through a Service,
  Ingress, or LoadBalancer.** debugpy/rdbg/inspector/JDWP listeners are
  unauthenticated and allow arbitrary code execution; the MCP HTTP port
  controls a ptrace-capable debugger. `kubectl port-forward` keeps every hop
  inside your kubeconfig's auth.
- Prefer **on-demand listeners** over always-on ones: the example manifests
  bake the debug flag in for convenience, but for production workloads add it
  to a single quarantined pod (removed from the Service selector) when
  diagnosing.
- Target **staging, canaries, or quarantined pods** — a paused pod stops
  serving for the duration of the pause. For non-breaking inspection use
  logpoints (`set_breakpoint` with `logMessage`): the pod keeps running at full
  speed while values stream to `get_output`.
- An abandoned attach no longer leaves an orphaned tracer (#337): teardown
  kills the adapter's process group, and the sidecar's HTTP reaper cleans up
  crashed-client sessions after the stale window. Suspect a leftover anyway?
  `grep TracerPid /proc/1/status` from the sidecar.

## Distroless and minimal images

- **Pattern B needs nothing from the target image** — no shell, no package
  manager, no libc guarantees. The sidecar brings the debugger, `procps`, and
  its own shell; symbols come from the target binary via `/proc/<pid>/root`.
  This is the pattern for distroless native services (build with `-g`, don't
  strip).
- Pattern A on distroless interpreted images works only if the debug listener
  is baked into the start command (there's no shell to add it later) — e.g.
  distroless python must already run `python -m debugpy --listen ...`.
  Otherwise: `kubectl debug` a *copy* of the pod with a changed command
  (`--copy-to` + `--set-image`/command override), or fall back to pattern B's
  in-pod variant once a listener exists.
- The example manifests sidestep all of this with stock slim images + ConfigMap
  source — smallest possible step from "nothing" to "debuggable".

## Managed clusters: EKS

**Verified 2026-08-24 on Amazon EKS** (Kubernetes v1.34, eksctl-managed
nodegroup, Amazon Linux 2023 nodes) with the exact manifests and commands
above, unchanged — every image pulled straight from Docker Hub, all five
languages passed the same attach cycles as on kind, and the ephemeral sidecar
ran the published `debugmcp/mcp-debugger:latest`. Notes for managed clusters:

- **Ephemeral containers are GA and enabled by default** (Kubernetes ≥ 1.25 —
  every supported EKS version). `kubectl debug --profile=general` works on
  managed node groups as-is.
- **AL2023 nodes were observed with `kernel.yama.ptrace_scope=0`** — PID attach
  would work there even without SYS_PTRACE. Keep `--profile=general` anyway:
  other AMIs (e.g. hardened/Bottlerocket variants) and kind differ, and the
  capability is scoped to the ephemeral container.
- **Pod Security Admission**: namespaces enforcing the `baseline` or
  `restricted` Pod Security Standards reject `SYS_PTRACE`. EKS does not enforce
  any PSS by default; if your namespace does, label a quarantine namespace
  `pod-security.kubernetes.io/enforce=privileged` for the debug session (or
  restrict to pattern A, which needs no capabilities).
- **Docker Hub pull limits**: all images here (language runtimes and
  `debugmcp/mcp-debugger`) come from Docker Hub; a busy cluster behind one NAT
  IP can hit anonymous pull throttling. Mirror to ECR if that bites.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| breakpoint `verified: false`, never hits | local path sent to remote target — use the debuggee-side path from `get_stack_trace`, or a function breakpoint |
| js breakpoint "Unbound" at `/app/app.js` | node resolved the ConfigMap symlink — start node with `--preserve-symlinks-main`, or use the resolved path / a function breakpoint |
| `attach failed: no threads reported` (java) | JVM still warming — raise `verifyTimeout` (ms), e.g. `60000` |
| cpp attach ok but frames show raw addresses | missing `adapterConfig.program` (`/proc/<pid>/root/<binary>`), or binary stripped |
| `kubectl debug` container crashes: `exec: "http": not found` | the `--` args replace the entrypoint — pass `-- /app/entry.sh http -p 3001` |
| `kubectl debug` mangled path on Windows Git Bash | prefix `MSYS_NO_PATHCONV=1` |
| ptrace `EPERM` in a hand-rolled sidecar | no SYS_PTRACE — use `--profile=general` |
| second `kubectl debug` attempt: container name in use | ephemeral containers are permanent — new `--container` name each retry |

## Cleanup

```bash
kubectl delete -f examples/kubernetes/<lang>-app.yaml    # per language
# sidecars disappear with the pod; delete the Deployment and they're gone
```
