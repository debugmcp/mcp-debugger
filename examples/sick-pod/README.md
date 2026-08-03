# sick-pod example

A deliberately buggy checkout service (state-dependent, log-invisible cache-mutation bug) used by the [just-in-time diagnostics tutorial](../../docs/jit-diagnostics/README.md): deploy it to a kind cluster, watch it misprice orders, then let an agent attach mcp-debugger to the live pod and find the bug without redeploying.
