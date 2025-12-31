# Go Debugging with Debug MCP Server

The Debug MCP Server provides support for Go debugging through [Delve](https://github.com/go-delve/delve) (dlv), Go's native debugger with DAP (Debug Adapter Protocol) support. This document explains how to use the Go debugging capabilities.

## Prerequisites

Before using the Go debugging features, ensure you have:

1. **Go 1.18 or higher** installed from [go.dev/dl](https://go.dev/dl/)
2. **Delve** installed with DAP support:
   ```bash
   go install github.com/go-delve/delve/cmd/dlv@latest
   ```

Verify your installation:
```bash
go version    # Should show 1.18 or higher
dlv version   # Should show Delve version
dlv dap --help # Should show DAP help (confirms DAP support)
```

## Debugging Workflow

### 1. Create a Debug Session

First, create a Go debug session:

```
use_mcp_tool(
  server_name="debug-mcp-server",
  tool_name="create_debug_session",
  arguments={
    "language": "go",
    "name": "My Go Debug Session"
  }
)
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

```
use_mcp_tool(
  server_name="debug-mcp-server",
  tool_name="set_breakpoint",
  arguments={
    "sessionId": "your-session-id",
    "file": "/path/to/your/main.go",
    "line": 15
  }
)
```

You can also set conditional breakpoints:

```
use_mcp_tool(
  server_name="debug-mcp-server",
  tool_name="set_breakpoint",
  arguments={
    "sessionId": "your-session-id",
    "file": "/path/to/your/main.go",
    "line": 20,
    "condition": "x > 10"
  }
)
```

### 4. Start Debugging

Start debugging your Go program. You can use different launch modes:

#### Debug Mode (compile and debug)
```
use_mcp_tool(
  server_name="debug-mcp-server",
  tool_name="start_debugging",
  arguments={
    "sessionId": "your-session-id",
    "scriptPath": "/path/to/your/main.go",
    "dapLaunchArgs": {
      "mode": "debug",
      "program": "/path/to/your/main.go",
      "stopOnEntry": false
    }
  }
)
```

#### Exec Mode (debug pre-compiled binary)
```
use_mcp_tool(
  server_name="debug-mcp-server",
  tool_name="start_debugging",
  arguments={
    "sessionId": "your-session-id",
    "scriptPath": "/path/to/your/compiled/binary",
    "dapLaunchArgs": {
      "mode": "exec",
      "program": "/path/to/your/compiled/binary"
    }
  }
)
```

#### Test Mode (debug Go tests)
```
use_mcp_tool(
  server_name="debug-mcp-server",
  tool_name="start_debugging",
  arguments={
    "sessionId": "your-session-id",
    "scriptPath": "/path/to/your/test/directory",
    "dapLaunchArgs": {
      "mode": "test",
      "program": "/path/to/your/test/directory"
    }
  }
)
```

### 5. Control Execution

When execution pauses at a breakpoint, you can:

#### Step Over (execute current line and pause at next line)
```
use_mcp_tool(
  server_name="debug-mcp-server",
  tool_name="step_over",
  arguments={
    "sessionId": "your-session-id"
  }
)
```

#### Step Into (go into functions called on current line)
```
use_mcp_tool(
  server_name="debug-mcp-server",
  tool_name="step_into",
  arguments={
    "sessionId": "your-session-id"
  }
)
```

#### Step Out (run until exiting current function)
```
use_mcp_tool(
  server_name="debug-mcp-server",
  tool_name="step_out",
  arguments={
    "sessionId": "your-session-id"
  }
)
```

#### Continue (run until next breakpoint)
```
use_mcp_tool(
  server_name="debug-mcp-server",
  tool_name="continue_execution",
  arguments={
    "sessionId": "your-session-id"
  }
)
```

### 6. Examine Program State

When paused, you can examine the program's state:

#### Get Local Variables
```
use_mcp_tool(
  server_name="debug-mcp-server",
  tool_name="get_variables",
  arguments={
    "sessionId": "your-session-id",
    "scope": "local"
  }
)
```

#### Get Stack Trace
```
use_mcp_tool(
  server_name="debug-mcp-server",
  tool_name="get_stack_trace",
  arguments={
    "sessionId": "your-session-id"
  }
)
```

#### Evaluate Expressions
```
use_mcp_tool(
  server_name="debug-mcp-server",
  tool_name="evaluate_expression",
  arguments={
    "sessionId": "your-session-id",
    "expression": "x + y * 2"
  }
)
```

### 7. Close the Session

When finished debugging, close the session:

```
use_mcp_tool(
  server_name="debug-mcp-server",
  tool_name="close_debug_session",
  arguments={
    "sessionId": "your-session-id"
  }
)
```

## Go-Specific Features

### Launch Modes

Delve supports several launch modes:

- **`debug`**: Compile and debug a main package
- **`test`**: Compile and debug a test binary
- **`exec`**: Debug a pre-compiled binary
- **`replay`**: Replay a recorded trace
- **`core`**: Debug a core dump

### Goroutine Management

Go programs use goroutines for concurrency. The debugger can:

- Inspect all goroutines
- Filter system/runtime goroutines
- Set breakpoints in specific goroutines
- Navigate goroutine stacks

### Exception Breakpoints

Delve supports breaking on Go panics and fatal errors:

- **Unrecovered Panics**: Break when a panic is not recovered
- **Fatal Throws**: Break on runtime fatal errors

These can be configured in the launch arguments or set during the session.

## Debugging Tips

1. **Always build with debug flags**: Use `-gcflags="all=-N -l"` to disable optimizations
2. **Absolute paths**: Use absolute paths for file references in breakpoints
3. **Goroutine filtering**: System goroutines are filtered by default for cleaner stack traces
4. **Stop on entry**: Delve has a quirk with "unknown goroutine 1" - the adapter defaults `stopOnEntry=false` to avoid this
5. **Variable inspection**: Pointers are automatically dereferenced, slices show length/capacity, maps show key-value pairs
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

4. Start debugging with `mode: "exec"` and `program: "./myprogram"`

5. Step through the code and inspect variables

## Troubleshooting

### "Delve not found" error
- Ensure Delve is installed: `go install github.com/go-delve/delve/cmd/dlv@latest`
- Check that `dlv` is in your PATH: `which dlv`
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

## Additional Resources

- [Delve Documentation](https://github.com/go-delve/delve/tree/master/Documentation)
- [Go Debugging Guide](https://go.dev/doc/diagnostics)
- [DAP Protocol Specification](https://microsoft.github.io/debug-adapter-protocol/)

