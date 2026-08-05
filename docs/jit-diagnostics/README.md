# Just-in-time diagnostics: debugging a sick pod without redeploying it

The prevailing observability model is *log everything in advance and pay to store it, in case you need it later*. This tutorial demonstrates the inverse: **interrogate the live process only when something is wrong** — an agent attaches a real debugger to a misbehaving Kubernetes pod, inspects actual runtime state, names the bug, and detaches. Nothing pre-instrumented, nothing stored, no redeploy, and the pod keeps serving.

The bug in this tutorial is chosen to be **invisible to logs**: it's state-dependent (only manifests after a particular traffic pattern) and the corrupted value lives in an in-memory cache no log line ever prints. A debugger finds it in minutes.

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

## Security notes (read before using this pattern beyond a demo)

- **Never expose a debug port through a Service, Ingress, or LoadBalancer.** debugpy/rdbg listeners are unauthenticated and allow code execution. `kubectl port-forward` keeps the connection inside your kubeconfig's auth.
- Prefer **on-demand listeners** over always-on ones: add the debug flag to a single quarantined pod when diagnosing (e.g. remove the pod from the Service selector, then `kubectl debug`/patch it), rather than baking it into the deployment as this tutorial image does for convenience.
- Target **staging, canaries, or quarantined sick pods** — pausing a pod that's in a live serving rotation stops its traffic for the duration of the pause. For non-breaking inspection, pass `logMessage` to `set_breakpoint` (a logpoint, [#235](https://github.com/debugmcp/mcp-debugger/issues/235)): the pod keeps serving at full speed while interpolated values stream into `get_output`.
- The same flow works for **Ruby** (`rdbg --open --port`) — see [docs/ruby/README.md](../ruby/README.md) — and **Java** (JDWP agent), covering three of the most common backend runtimes.

## Cleanup

```bash
kind delete cluster --name jit-demo
```
