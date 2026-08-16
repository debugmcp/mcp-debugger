# sick-pod-cpp — native sick-pod tutorial target

The compiled-service counterpart to [`examples/sick-pod`](../sick-pod/): same cache-mutation bug, but no in-process debug agent is possible — the debugger arrives as a Kubernetes **ephemeral debug container** and attaches by PID. Full walkthrough: [docs/jit-diagnostics](../../docs/jit-diagnostics/README.md).
