# Go debugging (mcp-debugger)

## Prerequisites

- Go 1.18+ (`go version`).
- Delve with DAP support on PATH: `go install github.com/go-delve/delve/cmd/dlv@latest` (installs to `~/go/bin` — make sure that is on PATH). Verify with `dlv version` and `dlv dap --help`.
- Go debugging is disabled in the Docker image by default (`DEBUG_MCP_DISABLE_LANGUAGES`); use a host deployment.

## Launch quickstart

```json
create_debug_session  {"language": "go", "name": "go-bug-hunt"}
set_breakpoint        {"sessionId": "<id>", "file": "/abs/path/main.go", "line": 10}
start_debugging       {"sessionId": "<id>", "scriptPath": "/abs/path/main.go"}
get_stack_trace       {"sessionId": "<id>"}
get_local_variables   {"sessionId": "<id>"}
evaluate_expression   {"sessionId": "<id>", "expression": "x + y*2"}
step_over             {"sessionId": "<id>"}
continue_execution    {"sessionId": "<id>"}
close_debug_session   {"sessionId": "<id>"}
```

In the default `debug` mode Delve compiles and debugs the main package for you — pass the `.go` source as `scriptPath`. Other launch modes go through `dapLaunchArgs.mode`:

```json
// Debug a pre-compiled binary (build it with: go build -gcflags="all=-N -l" -o myprogram main.go)
start_debugging {
  "sessionId": "<id>",
  "scriptPath": "/abs/path/myprogram",
  "dapLaunchArgs": {"mode": "exec", "program": "/abs/path/myprogram"}
}

// Debug tests: scriptPath/program is the test *directory*
start_debugging {
  "sessionId": "<id>",
  "scriptPath": "/abs/path/pkg",
  "dapLaunchArgs": {"mode": "test", "program": "/abs/path/pkg"}
}
```

For `exec` mode, always build with `-gcflags="all=-N -l"` (disables optimizations and inlining); optimized binaries skip breakpoints and hide variables. Conditional breakpoints work: add `"condition": "x > 10"` to `set_breakpoint`.

## Attach / remote

Not supported. The Go adapter implements launch mode only — `attach_to_process` has no Go backend. To debug a running service, restart it under a launch-mode session instead.

## Quirks

- **Debuggee output is captured:** the adapter launches with Delve's `outputMode: 'remote'`, so the program's stdout/stderr arrives as `get_output` entries (categories `stdout`/`stderr`).
- **`stopOnEntry` is forced to `false`** by the Go adapter policy (unless you explicitly set it) to dodge Delve's "unknown goroutine 1" quirk. If you force `stopOnEntry: true` and see that error, it is harmless — execution continues. Set a breakpoint on the first line of `main` if you need an entry stop.
- Goroutine-aware, with limits: stack traces show the current goroutine's frames; Go runtime and testing frames (paths with `/runtime/` or `/testing/`) are filtered out by default — pass `includeInternals: true` to `get_stack_trace` to see them. There are no MCP tools to list or switch goroutines.
- Exception breakpoints `panic` and `fatal` are enabled by default — panics stop the debugger without any setup (`get_stack_trace` reports `stopReason`).
- Delve's variable rendering auto-dereferences pointers, shows slices with len/cap, and maps as key-value pairs.
- Use absolute paths for `file` and `scriptPath`; breakpoints must be on executable statements.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| "Delve not found" | `dlv` not installed or not on PATH | `go install github.com/go-delve/delve/cmd/dlv@latest`; ensure `~/go/bin` on PATH; check `dlv dap --help` |
| "Go executable not found" | `go` not on PATH | Install Go 1.18+; verify `go version` |
| Breakpoints not hit | Optimized binary (exec mode) or wrong path/line | Rebuild with `-gcflags="all=-N -l"`; absolute paths; line must be an executable statement |
| "unknown goroutine 1" error | `stopOnEntry: true` with Delve | Leave `stopOnEntry` unset/false; the error is harmless if it appears |
| Stack full of runtime frames | `includeInternals: true` set, or panic inside runtime | Omit `includeInternals` for user frames only |
