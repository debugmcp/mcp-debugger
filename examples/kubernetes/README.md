# Turnkey Kubernetes debugging targets

Registry-free demo workloads for [docs/kubernetes.md](../../docs/kubernetes.md):
every manifest uses **stock public images** with the app source in a ConfigMap
(and, where a build step is needed, an initContainer compiling into an
emptyDir). No docker build, no `kind load`, no registry — the same YAML works
on kind, EKS, or any cluster that can pull from Docker Hub.

Every app is the same ~15-line loop: `main` calls `tick(counter)` every 2
seconds, so an attached breakpoint in `tick` hits within 2 s, unattended.
The app container is always named `app` (so `kubectl debug --target=app` is
uniform across languages).

## Quickstart

```bash
kubectl apply -f python-app.yaml          # or ruby/javascript/java/cpp
kubectl wait --for=condition=available deployment/python-demo
kubectl port-forward deploy/python-demo 5678:5678
```

Then attach with the matching preset from [attach-presets.md](attach-presets.md).
For C/C++ (no debug port — the debugger goes *to* the pod):

```bash
./debug-sidecar.sh app=cpp-demo           # Git Bash: MSYS_NO_PATHCONV=1 ./debug-sidecar.sh app=cpp-demo
```

## Contents

| File | What it deploys | Debug mechanism | Port |
|---|---|---|---|
| `python-app.yaml` | `python:3.12-slim` + debugpy via initContainer | network attach (pattern A) | 5678 |
| `ruby-app.yaml` | `ruby:3.3-slim` (rdbg is bundled) | network attach (pattern A) | 12345 |
| `javascript-app.yaml` | `node:22-slim`, `--inspect` + `--preserve-symlinks-main` | network attach (pattern A) | 9229 |
| `java-app.yaml` | `eclipse-temurin:21`, `javac -g` initContainer, JDWP agent | network attach (pattern A) | 5005 |
| `cpp-app.yaml` | `gcc:13-bookworm` initContainer → `debian:12-slim`, DWARF, unstripped | ephemeral sidecar, attach by PID (pattern B) | — |
| `attach-presets.md` | — | copy-paste `attach_to_process` config per language | — |
| `debug-sidecar.sh` | — | injects `debugmcp/mcp-debugger:latest` as an ephemeral container + port-forwards its MCP endpoint | 3001 |
| `mcp-client.example.json` | — | MCP client config: local server (pattern A) + port-forwarded sidecar (pattern B) | — |

The python and cpp recipes (both attach patterns) are smoke-tested weekly on a
kind cluster by [`.github/workflows/k8s-smoke.yml`](../../.github/workflows/k8s-smoke.yml).

There is deliberately **no Service** in any manifest: debug listeners are
unauthenticated code-execution ports and must only ever be reached through
`kubectl port-forward` (which stays inside your kubeconfig's auth).

There is also no sidecar YAML — ephemeral containers are a pod *subresource*
you inject with `kubectl debug` (see `debug-sidecar.sh`); they can't be
declared in an applied manifest, removed, or restarted (each retry needs a
fresh `--container` name).

For a narrative tutorial with a realistic bug (a cache-corruption bug invisible
to logs), see [docs/jit-diagnostics](../../docs/jit-diagnostics/README.md) and
its [sick-pod](../sick-pod/) / [sick-pod-cpp](../sick-pod-cpp/) services.

## Cleanup

```bash
kubectl delete -f python-app.yaml -f ruby-app.yaml -f javascript-app.yaml -f java-app.yaml -f cpp-app.yaml
```
