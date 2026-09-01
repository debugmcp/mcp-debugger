# Go Debugging Examples

This directory contains example Go programs for testing and demonstrating the MCP Debugger's Go debugging capabilities using Delve.

## Prerequisites

1. **Go**: Install Go 1.18 or higher from [go.dev/dl](https://go.dev/dl/)
2. **Delve**: Install the Delve debugger with DAP support:
   ```bash
   go install github.com/go-delve/delve/cmd/dlv@latest
   ```
   It lands in `~/go/bin` — make sure that is on PATH (`dlv version`, `dlv dap --help`).

> **Launch only.** The Go adapter advertises `modes: { launch: true, attach: 'none' }` —
> there is no `attach_to_process` backend for Go. To debug a running service, restart it
> under a launch session.
>
> Go is also disabled in the Docker image (`DEBUG_MCP_DISABLE_LANGUAGES`); run the server
> via npm/npx next to your local toolchain.

## Example Programs

### 1. Hello World (`hello_world/`)
A simple Go program demonstrating basic debugging features:
- Variable inspection (primitives, strings, slices, maps)
- Function calls and parameter inspection
- Control flow (if statements, loops)
- Breakpoint handling
- Local variable inspection

**To debug:** point at the `.go` source and let Delve compile it (mode `debug`) — no
prior build needed. These are MCP tool calls your client invokes, not `mcp-debugger` shell
subcommands; the CLI only has `stdio`, `sse`, `http`, `doctor`, and `check-rust-binary`.

```json
create_debug_session {"language": "go", "name": "go-hello"}
set_breakpoint       {"sessionId": "<id>", "file": "<abs>/examples/go/hello_world/main.go", "line": 17}
start_debugging      {"sessionId": "<id>", "scriptPath": "<abs>/examples/go/hello_world/main.go"}
get_stack_trace      {"sessionId": "<id>"}
get_local_variables  {"sessionId": "<id>"}
step_over            {"sessionId": "<id>"}
continue_execution   {"sessionId": "<id>"}
close_debug_session  {"sessionId": "<id>"}
```

To debug a **pre-built** binary instead, build it yourself with optimizations off and ask
for `exec` mode:

```bash
cd examples/go/hello_world
go build -gcflags="all=-N -l" -o hello_world main.go
```

```json
start_debugging {"sessionId": "<id>", "scriptPath": "<abs>/examples/go/hello_world/hello_world",
                 "dapLaunchArgs": {"mode": "exec", "program": "<abs>/examples/go/hello_world/hello_world"}}
```

The adapter infers the mode from the path — a `.go` file means `debug`, anything else means
`exec` — so the explicit `mode` is belt-and-braces. Breakpoints always reference the `.go`
source; use absolute paths.

### 2. Goroutines Example (`goroutines/`)
Demonstrates debugging concurrent Go code with goroutines:
- Multiple goroutine debugging
- Channel communication
- Goroutine inspection and filtering
- Concurrent execution debugging
- WaitGroup synchronization

**To debug:** same tool sequence as Hello World, with `scriptPath` pointing at
`examples/go/goroutines/main.go`.

### 3. Fibonacci Example (`fibonacci/`)
A classic example with recursive, iterative, and memoized implementations:
- Recursive function debugging
- Stack trace inspection across recursive calls
- Variable state tracking
- Memoization cache inspection (map contents)
- Function return value inspection

### 4. Pause Test (`pause_test/`)
A `for { counter++; time.Sleep(500ms) }` program with no breakpoints — used to exercise
`pause_execution` against a running debuggee.

## Launch Configuration

There is no per-project config file. Delve settings go in the `dapLaunchArgs` object of
`start_debugging`; the adapter merges them into the config it hands Delve.

**Debug mode (recommended)** — point at the `.go` source; Delve compiles it itself with
optimizations disabled, so variables are always inspectable. This is the inferred mode for
a `.go` path, so `dapLaunchArgs` is usually unnecessary:

```json
start_debugging {"sessionId": "<id>", "scriptPath": "<abs>/hello_world/main.go"}
```

**Exec mode** — debug a pre-compiled binary. `buildFlags` has **no effect** here (Delve
never builds anything), so you must build with optimizations disabled yourself or locals
are reported under `"Locals (warning: optimized function)"` and may be empty:

```json
start_debugging {
  "sessionId": "<id>",
  "scriptPath": "<abs>/hello_world/hello_world",
  "dapLaunchArgs": {"mode": "exec", "program": "<abs>/hello_world/hello_world"}
}
```

**Test mode** — `program` is the package *directory*, not a binary:

```json
start_debugging {
  "sessionId": "<id>",
  "scriptPath": "<abs>/pkg",
  "dapLaunchArgs": {"mode": "test", "program": "<abs>/pkg"}
}
```

Three fields are written by the adapter *after* your config is merged, so passing your own
values for them has no effect: `showGlobalVariables` (forced `false`),
`hideSystemGoroutines` (forced `true`), and `stackTraceDepth` (forced to 50). Two more have
adapter-supplied defaults that an explicit value still overrides: `stopOnEntry` defaults to
`false` (to dodge Delve's "unknown goroutine 1" quirk) and `outputMode` defaults to
`remote` (Delve's own `local` default writes the debuggee's stdio to the `dlv` process,
where `get_output` never sees it — issue #225). Everything else, including `buildFlags`,
`substitutePath`, `env`, `cwd`, and `args`, is forwarded. See `transformLaunchConfig` in
`packages/adapter-go/src/go-debug-adapter.ts`.

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
   - System/runtime goroutines are filtered out for you (`hideSystemGoroutines` is forced on)
   - Each goroutine appears as a separate thread in the debugger
   - Set breakpoints in goroutines to debug concurrent code
   - `list_threads` returns that thread list as Delve reports it; pass one of its ids as
     `threadId` to `get_stack_trace` to inspect a specific goroutine — an explicit id is
     authoritative and is never silently switched
   - Stepping and `continue_execution` take no thread argument: they act on the session's
     current stopped thread

3. **Variable inspection**:
   - Pointers are automatically dereferenced for inspection
   - Slices show length and capacity information
   - Maps display key-value pairs
   - Interfaces show both type and value

4. **Common issues**:
   - If breakpoints aren't hit in `exec` mode, ensure you built with `-gcflags="all=-N -l"`
   - Delve's "unknown goroutine 1" error comes from stopping on entry; the adapter defaults
     `stopOnEntry` to `false` to avoid it, and the message is harmless if it appears anyway
   - Runtime/testing frames (paths containing `/runtime/` or `/testing/`) are filtered by
     default; pass `includeInternals: true` to `get_stack_trace` to see them
   - Package-level variables are not returned in scopes — the adapter forces
     `showGlobalVariables: false`. Read one by name with `evaluate_expression` instead

## Exception Breakpoints

Delve supports breaking on Go panics and fatal errors. The Go policy maps both
`breakOnExceptions: "uncaught"` and `"all"` onto Delve's two real filter IDs:

- `unrecovered-panic` — break when a panic is not recovered
- `runtime-fatal-throw` — break on runtime fatal errors

Launch sessions default to `"uncaught"`, so panics stop the debugger with no setup. Pass
`breakOnExceptions: "none"` to `start_debugging` to opt out.

## Running Tests

To test the Go adapter with these examples:

```bash
# From the project root
pnpm test tests/adapters/go

# Run only integration tests
pnpm test tests/adapters/go/integration
```

## Debugging Tests

Delve's `test` mode compiles and debugs a package's tests for you — `program` is the
package **directory**, and there is no separate build step:

```json
create_debug_session {"language": "go", "name": "go-tests"}
set_breakpoint       {"sessionId": "<id>", "file": "<abs>/pkg/thing_test.go", "line": 12}
start_debugging      {"sessionId": "<id>", "scriptPath": "<abs>/pkg",
                      "dapLaunchArgs": {"mode": "test", "program": "<abs>/pkg"}}
```

The example programs in this directory ship without `_test.go` files, so point this at a
package of your own.

## Contributing

Feel free to add more example programs that demonstrate specific Go debugging scenarios such as:
- Web servers (HTTP handlers)
- Database interactions
- Error handling patterns
- Context propagation
- More advanced concurrency patterns (channels, select statements)
