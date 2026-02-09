# Go Debugging Examples

This directory contains example Go programs for testing and demonstrating the MCP Debugger's Go debugging capabilities using Delve.

## Prerequisites

1. **Go**: Install Go 1.18 or higher from [go.dev/dl](https://go.dev/dl/)
2. **Delve**: Install the Delve debugger with DAP support:
   ```bash
   go install github.com/go-delve/delve/cmd/dlv@latest
   ```

## Example Programs

### 1. Hello World (`hello_world/`)
A simple Go program demonstrating basic debugging features:
- Variable inspection (primitives, strings, slices, maps)
- Function calls and parameter inspection
- Control flow (if statements, loops)
- Breakpoint handling
- Local variable inspection

**To debug:**
```bash
# Build the project with debug symbols
cd examples/go/hello_world
go build -gcflags="all=-N -l" -o hello_world main.go

# Create a debug session
mcp-debugger create_debug_session --language go

# Set a breakpoint
mcp-debugger set_breakpoint --file main.go --line 15

# Start debugging
mcp-debugger start_debugging --script ./hello_world
```

### 2. Goroutines Example (`goroutines/`)
Demonstrates debugging concurrent Go code with goroutines:
- Multiple goroutine debugging
- Channel communication
- Goroutine inspection and filtering
- Concurrent execution debugging
- WaitGroup synchronization

**To debug:**
```bash
# Build the project
cd examples/go/goroutines
go build -gcflags="all=-N -l" -o goroutines main.go

# Debug similar to hello_world
```

### 3. Fibonacci Example (`fibonacci/`)
A classic example with both recursive and iterative implementations:
- Recursive function debugging
- Stack trace inspection across recursive calls
- Variable state tracking
- Function return value inspection

## Debug Configurations

Each project can be debugged with custom Delve launch settings:

```json
{
  "mode": "exec",
  "program": "./hello_world",
  "stopOnEntry": false,
  "buildFlags": "-gcflags='all=-N -l'",
  "hideSystemGoroutines": true,
  "substitutePath": []
}
```

### Delve Launch Modes
- `debug`: Compile and debug main package
- `test`: Compile and debug test binary
- `exec`: Debug a pre-compiled binary
- `replay`: Replay a recorded trace
- `core`: Debug a core dump

## Tips for Go Debugging

1. **Build with debug symbols**: 
   - Always use `-gcflags="all=-N -l"` to disable optimizations
   - This ensures accurate variable inspection and breakpoint placement

2. **Goroutine management**:
   - Use `hideSystemGoroutines: true` to filter runtime goroutines
   - Each goroutine appears as a separate thread in the debugger
   - Set breakpoints in goroutines to debug concurrent code

3. **Variable inspection**:
   - Pointers are automatically dereferenced for inspection
   - Slices show length and capacity information
   - Maps display key-value pairs
   - Interfaces show both type and value

4. **Common issues**:
   - If breakpoints aren't hit, ensure you built with debug flags
   - Delve may show "unknown goroutine 1" error - this is handled automatically
   - Runtime/testing frames are filtered by default for cleaner stack traces
   - Use `showGlobalVariables: true` to inspect package-level variables

## Exception Breakpoints

Delve supports breaking on Go panics and fatal errors:

- **Unrecovered Panics**: Break when a panic is not recovered
- **Fatal Throws**: Break on runtime fatal errors

These can be enabled in the debug configuration or set during the session.

## Running Tests

To test the Go adapter with these examples:

```bash
# From the project root
pnpm test tests/adapters/go

# Run only integration tests
pnpm test tests/adapters/go/integration
```

## Debugging Tests

You can also debug Go tests:

```bash
# Build test binary
cd examples/go/fibonacci
go test -c -gcflags="all=-N -l"

# Debug the test binary
mcp-debugger start_debugging --script ./fibonacci.test
```

## Contributing

Feel free to add more example programs that demonstrate specific Go debugging scenarios such as:
- Web servers (HTTP handlers)
- Database interactions
- Error handling patterns
- Context propagation
- More advanced concurrency patterns (channels, select statements)
