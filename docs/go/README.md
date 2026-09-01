# Go Debugging with Debug MCP Server

The Debug MCP Server provides support for Go debugging through [Delve](https://github.com/go-delve/delve) (dlv), Go's native debugger with DAP (Debug Adapter Protocol) support. This document explains how to use the Go debugging capabilities.

## Prerequisites

Before using the Go debugging features, ensure you have:

1. **Go 1.18 or higher** installed from [go.dev/dl](https://go.dev/dl/)
2. **Delve 1.6.0+** installed (that is when `dlv dap` landed; current releases are 1.2x):
   ```bash
   go install github.com/go-delve/delve/cmd/dlv@latest
   ```

Verify your installation:
```bash
go version    # Should show 1.18 or higher
dlv version   # Should show Delve version
dlv dap --help # Should show DAP help (confirms DAP support)
```

If `dlv` is not on your `PATH` (a common case when `GOPATH/bin` is not exported), point the
server at it with the `DLV_PATH` environment variable — set it to the Delve **binary**, not
its directory. The session's `executablePath` takes precedence over `DLV_PATH`; with neither
set, the adapter looks for `dlv`/`dlv-dap` on `PATH` and then in `GOPATH/bin`.

**Launch only.** Go has no attach implementation — `attach_to_process` fails fast with
"Attach mode is not implemented" for Go sessions. Debug Go by launching the program,
the test binary, or a prebuilt executable with the modes below.

## Debugging Workflow

### 1. Create a Debug Session

First, create a Go debug session:

```text
create_debug_session { "language": "go", "name": "My Go Debug Session" }
```

This returns a session ID that you'll use for all subsequent debugging commands.

### 2. Build Your Go Program

Before debugging, compile your Go program with debug symbols:

```bash
go build -gcflags="all=-N -l" -o myprogram main.go
```

The `-gcflags="all=-N -l"` flags disable optimizations and inlining, which are required for accurate debugging.

### 3. Set Breakpoints

Set breakpoints in your code before starting execution:

```text
set_breakpoint { "sessionId": "your-session-id", "file": "/path/to/your/main.go", "line": 15 }
```

You can also set conditional breakpoints:

```text
set_breakpoint { "sessionId": "your-session-id", "file": "/path/to/your/main.go", "line": 20,
                 "condition": "x > 10" }
```

### 4. Start Debugging

Start debugging your Go program. You can use different launch modes:

#### Debug Mode (compile and debug)
```text
start_debugging { "sessionId": "your-session-id", "scriptPath": "/path/to/your/main.go",
                  "dapLaunchArgs": { "mode": "debug", "program": "/path/to/your/main.go",
                                     "stopOnEntry": false } }
```

#### Exec Mode (debug pre-compiled binary)
```text
start_debugging { "sessionId": "your-session-id", "scriptPath": "/path/to/your/compiled/binary",
                  "dapLaunchArgs": { "mode": "exec",
                                     "program": "/path/to/your/compiled/binary" } }
```

#### Test Mode (debug Go tests)
```text
start_debugging { "sessionId": "your-session-id", "scriptPath": "/path/to/your/test/directory",
                  "dapLaunchArgs": { "mode": "test",
                                     "program": "/path/to/your/test/directory" } }
```

### 5. Control Execution

When execution pauses at a breakpoint, you can:

#### Step Over (execute current line and pause at next line)
```text
step_over { "sessionId": "your-session-id" }
```

#### Step Into (go into functions called on current line)
```text
step_into { "sessionId": "your-session-id" }
```

#### Step Out (run until exiting current function)
```text
step_out { "sessionId": "your-session-id" }
```

#### Continue (run until next breakpoint)
```text
continue_execution { "sessionId": "your-session-id" }
```

### 6. Examine Program State

When paused, you can examine the program's state:

#### Get Local Variables
```text
get_local_variables { "sessionId": "your-session-id" }
```

#### Get Stack Trace
```text
get_stack_trace { "sessionId": "your-session-id" }
```

#### Evaluate Expressions
```text
evaluate_expression { "sessionId": "your-session-id", "expression": "x + y * 2" }
```

### 7. Close the Session

When finished debugging, close the session:

```text
close_debug_session { "sessionId": "your-session-id" }
```

## Go-Specific Features

### Launch Modes

Delve supports several launch modes:

- **`debug`**: Compile and debug a main package
- **`test`**: Compile and debug a test binary
- **`exec`**: Debug a pre-compiled binary
- **`replay`**: Replay a recorded trace
- **`core`**: Debug a core dump

### Goroutine-Aware Debugging

Go programs use goroutines for concurrency. Delve natively handles goroutines, and the MCP tools reflect this:

- Stack traces show the goroutine context for each frame
- Internal runtime and testing frames (paths containing `/runtime/` or `/testing/`) are filtered out by default (use `includeInternals: true` in `get_stack_trace` to see them)
- Variable inspection works within the current goroutine's stack frame

Note: goroutines reach the MCP tools as DAP threads. `list_threads` returns them (Delve already hides system goroutines — the adapter forces `hideSystemGoroutines: true`), and `get_stack_trace` accepts a `threadId` from that list to inspect one specific goroutine; an explicit id is authoritative and is never silently switched. What is *not* exposed is Delve's goroutine-scoped machinery: `set_breakpoint` has no goroutine filter, and stepping and `continue_execution` take no thread argument — they act on the session's current stopped thread.

### Exception Breakpoints

The Go adapter supports exception breakpoints with two built-in filters: `unrecovered-panic` (break on unrecovered panics) and `runtime-fatal-throw` (break on fatal runtime errors). Delve has no caught/uncaught distinction, so both the `uncaught` and `all` exception break modes arm the same two filters; launch sessions default to `breakOnExceptions: "uncaught"`, which arms both, and launch is the only mode Go has. These are declared in the adapter's capabilities and sent to Delve during session configuration. Custom exception breakpoint configuration can also be provided via `dapLaunchArgs`.

## Debugging Tips

1. **Always build with debug flags**: Use `-gcflags="all=-N -l"` to disable optimizations
2. **Absolute paths**: Use absolute paths for file references in breakpoints
3. **Internal frame filtering**: Frames from Go runtime/testing paths are filtered by default for cleaner stack traces
4. **Stop on entry**: Delve has a quirk with "unknown goroutine 1" -- `stopOnEntry=false` is a global session-manager default (not Go-specific), but the Go adapter policy also enforces this default to avoid Delve's goroutine issue when the user has not explicitly specified `stopOnEntry`
5. **Variable inspection**: Delve's DAP output automatically dereferences pointers, and represents slices with length/capacity and maps as key-value pairs
6. **Test debugging**: Use `mode: "test"` to debug Go test functions

## Example: Debugging a Go Program

Here's a complete example debugging a simple Go program:

```go
// main.go
package main

import "fmt"

func main() {
    x := 10
    y := 20
    sum := add(x, y)
    fmt.Printf("Sum: %d\n", sum)
}

func add(a, b int) int {
    return a + b
}
```

1. Build with debug symbols:
   ```bash
   go build -gcflags="all=-N -l" -o myprogram main.go
   ```

2. Create debug session with `language: "go"`

3. Set breakpoint at line 7 (inside `main`)

4. Start debugging with `mode: "exec"` and an **absolute** `scriptPath` to the built binary
   (host mode rejects a relative path such as `./myprogram`)

5. Step through the code and inspect variables

## Troubleshooting

### "Delve not found" error
- Ensure Delve is installed: `go install github.com/go-delve/delve/cmd/dlv@latest`
- Check that `dlv` is in your PATH: `which dlv`
- If it is installed but not on `PATH` (e.g. `~/go/bin` is not exported), set `DLV_PATH` to
  the binary — for example `export DLV_PATH="$HOME/go/bin/dlv"` — or pass `executablePath`
  in `create_debug_session`
- Verify DAP support: `dlv dap --help`

### "Go executable not found" error
- Ensure Go 1.18+ is installed: `go version`
- Check that `go` is in your PATH: `which go`

### Breakpoints not hit
- Ensure you built with `-gcflags="all=-N -l"`
- Use absolute paths for file references
- Check that the line number corresponds to an executable statement

### "Unknown goroutine 1" error
- This is a Delve quirk when `stopOnEntry=true`
- The adapter defaults `stopOnEntry=false` to avoid this
- If you need to stop on entry, the error is harmless and execution continues

### "Attach mode is not implemented"
- Expected: the Go adapter declares launch support only
- Use `start_debugging` with `mode: "exec"` against the already-built binary instead of
  attaching to the running process

## Additional Resources

- [Delve Documentation](https://github.com/go-delve/delve/tree/master/Documentation)
- [Go Debugging Guide](https://go.dev/doc/diagnostics)
- [DAP Protocol Specification](https://microsoft.github.io/debug-adapter-protocol/)

