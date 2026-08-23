# Debug MCP Server Examples

This directory contains example code that can be used to test the Debug MCP Server.

## Kubernetes

The [`kubernetes/`](kubernetes/) directory contains **turnkey, registry-free debug
targets** for every attach-capable language (stock public images + ConfigMap source —
`kubectl apply` and attach, no docker build), plus per-language
[attach presets](kubernetes/attach-presets.md) and an ephemeral-sidecar helper. See the
[Kubernetes debugging recipe](../docs/kubernetes.md). For the narrative tutorial with a
realistic log-invisible bug, see [`sick-pod/`](sick-pod/) and
[`sick-pod-cpp/`](sick-pod-cpp/) with the
[JIT diagnostics tutorial](../docs/jit-diagnostics/README.md).

## Python Examples

The `python` directory contains Python scripts that can be used for testing the Python debugging capabilities.

### fibonacci.py

This script implements both recursive and iterative versions of the Fibonacci sequence calculator, along with a deliberately introduced bug for debugging practice.

#### How to Debug with MCP

To debug this example using the Debug MCP Server:

1. Make sure the Debug MCP Server is running and connected
2. Create a new Python debug session:
   ```
   use_mcp_tool(
     server_name="debug-mcp-server",
     tool_name="create_debug_session",
     arguments={
       "language": "python",
       "name": "Fibonacci Example"
     }
   )
   ```
3. Set a breakpoint at line 46 (where the bug is introduced):
   ```
   use_mcp_tool(
     server_name="debug-mcp-server",
     tool_name="set_breakpoint",
     arguments={
       "sessionId": "YOUR_SESSION_ID",
       "file": "examples/python/fibonacci.py",
       "line": 46
     }
   )
   ```
4. Start debugging the script:
   ```
   use_mcp_tool(
     server_name="debug-mcp-server",
     tool_name="start_debugging",
     arguments={
       "sessionId": "YOUR_SESSION_ID",
       "scriptPath": "examples/python/fibonacci.py"
     }
   )
   ```
5. When execution pauses at the breakpoint, inspect variables to find the bug
6. When finished, close the debug session:
   ```
   use_mcp_tool(
     server_name="debug-mcp-server",
     tool_name="close_debug_session",
     arguments={
       "sessionId": "YOUR_SESSION_ID"
     }
   )
   ```
