# Debug MCP Server Examples

This directory contains example code that can be used to test the Debug MCP Server.

Tool calls below are written as the tool name followed by its JSON arguments — the shape your MCP client sends. The repo-relative paths shown here are for readability: in a real call use **absolute** paths, since relative `file`/`scriptPath` values are rejected in host mode.

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

The `python` directory contains Python scripts that can be used for testing the Python debugging capabilities: `fibonacci.py`, `simple_test.py`, `pause_test.py` and `python_test_comprehensive.py` for launch debugging, and `attach_loop.py` — a long-running loop — as an `attach_to_process` target.

### fibonacci.py

This script implements both recursive and iterative versions of the Fibonacci sequence calculator, along with a deliberately introduced bug for debugging practice.

#### How to Debug with MCP

To debug this example using the Debug MCP Server:

1. Make sure the Debug MCP Server is running and connected
2. Create a new Python debug session:
   ```text
   create_debug_session { "language": "python", "name": "Fibonacci Example" }
   ```
3. Set a breakpoint at line 46 (where the bug is introduced):
   ```text
   set_breakpoint { "sessionId": "YOUR_SESSION_ID", "file": "examples/python/fibonacci.py",
                    "line": 46 }
   ```
4. Start debugging the script:
   ```text
   start_debugging { "sessionId": "YOUR_SESSION_ID",
                     "scriptPath": "examples/python/fibonacci.py" }
   ```
5. When execution pauses at the breakpoint, inspect variables to find the bug
6. When finished, close the debug session:
   ```text
   close_debug_session { "sessionId": "YOUR_SESSION_ID" }
   ```

See [`docs/python/README.md`](../docs/python/README.md) for the full Python guide.

### python_simple_swap

[`python_simple_swap/`](python_simple_swap/) holds `swap_vars.py`, a two-line variable swap with an intentional bug (the classic missing temporary), plus `debug_swap_demo.py`, a script that drives the server over HTTP to debug it. It is the smallest end-to-end "find the bug by inspecting locals" target in the repo.

## Other Languages

Each of these directories mirrors the Python flow — create a session with the matching
`language`, set a breakpoint, `start_debugging` — with the language guide linked alongside.

| Directory | Contents | Guide |
|---|---|---|
| [`cpp/`](cpp/) | `hello_world.c`, `hello_world.cpp`, `pause_test.cpp`, `throwing_example.cpp`, with build flags in its own [README](cpp/README.md) | [docs/cpp](../docs/cpp/README.md) |
| [`dotnet/`](dotnet/) | `Program.cs` + `dotnet.csproj` (build first, then launch the built `.dll`), and a `pause_test` project | [docs/dotnet](../docs/dotnet/README.md) |
| [`go/`](go/) | `hello_world.go`, `fibonacci.go`, and the `goroutines/` and `pause_test/` modules, with its own [README](go/README.md) | [docs/go](../docs/go/README.md) |
| [`java/`](java/) | `HelloWorld.java` plus targets for the harder cases — `InnerClassTest`, `FunctionBpTest`, `ThrowsTest`, `ExprTest`, `EventRaceTest`, `InfiniteWait`, and `RedefineTarget`/`RedefineTargetV2` for `redefine_classes`. Compile with `javac -g` | [docs/java](../docs/java/README.md) |
| [`javascript/`](javascript/) | launch targets (`simple_test.js`, `pause_test.js`), attach targets started under `node --inspect` (`attach_target.js`, `idle_server_attach_target.js`, `fork_attach_target.js`), function-breakpoint targets, and `typescript_test.ts` | [docs/javascript](../docs/javascript/README.md) |
| [`ruby/`](ruby/) | `fizzbuzz.rb` for launch, `long_running.rb` as an `rdbg --open` attach target, plus [`remote-attach/`](ruby/remote-attach/) — a Dockerfile and pod manifest for attaching to a containerized worker | [docs/ruby](../docs/ruby/README.md) |
| [`rust/`](rust/) | cargo projects `hello_world/`, `panic_example/`, `async_example/`, `pause_test/`, with its own [README](rust/README.md) | [docs/rust-debugging.md](../docs/rust-debugging.md) |

## Ad-hoc Scripts

- [`debugging/`](debugging/) — throwaway reproduction scripts kept from past investigations
  (transport repros, JS/Python driver scripts). Not a curated tutorial; read the file header
  before running one.
- `agent_demo.py` — a minimal "LLM agent loop" that drives the server over HTTP.
- `test_evaluate_expression.py` — a small `evaluate_expression` exercise target.
