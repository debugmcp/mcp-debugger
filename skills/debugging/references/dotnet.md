# .NET/C# debugging (mcp-debugger)

## Prerequisites

- .NET 6+ SDK (`dotnet --version`) to build the target app.
- **netcoredbg** (Samsung's DAP debugger): download from github.com/Samsung/netcoredbg/releases, then set `NETCOREDBG_PATH` to the executable (Windows: `setx NETCOREDBG_PATH "C:\path\to\netcoredbg.exe"`, new shell required) or put its directory on PATH. Discovery order: `NETCOREDBG_X86_PATH` (x86 attach targets) → `NETCOREDBG_PATH` → caller-provided path → PATH → platform-specific fallbacks.
- **Portable PDB symbols required.** .NET Core / .NET 5+ builds produce them by default. .NET Framework 4.8: compile with `/debug:portable`, or rely on the adapter's bundled Pdb2Pdb auto-conversion (Windows only).
- .NET debugging is disabled in the Docker image (`DEBUG_MCP_DISABLE_LANGUAGES`); use a host deployment.

## Launch quickstart

Build first — `dotnet build` — then debug the **compiled .dll**, not the `.cs` file:

```json
create_debug_session  {"language": "dotnet", "name": "dotnet-bug-hunt"}
// Breakpoints reference the SOURCE file:
set_breakpoint        {"sessionId": "<id>", "file": "/abs/path/Program.cs", "line": 14}
start_debugging       {
  "sessionId": "<id>",
  "scriptPath": "/abs/path/bin/Debug/net8.0/MyApp.dll",
  "dapLaunchArgs": {
    "program": "/abs/path/bin/Debug/net8.0/MyApp.dll",
    "cwd": "/abs/path/project",
    "stopOnEntry": false
  }
}
get_stack_trace       {"sessionId": "<id>"}
get_local_variables   {"sessionId": "<id>"}
evaluate_expression   {"sessionId": "<id>", "expression": "x + y"}
step_over             {"sessionId": "<id>"}
continue_execution    {"sessionId": "<id>"}
close_debug_session   {"sessionId": "<id>"}
```

- `dapLaunchArgs.program` is required and must point to the compiled assembly (`bin/Debug/net8.0/MyApp.dll` or `.exe`) — never a `.cs` source file. Pass command-line arguments via `dapLaunchArgs.args`.
- Breakpoints go on executable lines (assignments, calls, conditionals) — not blank lines, comments, or `using` directives.
- Rebuild after every source edit; the PDB must sit alongside the DLL and match it.

## Attach / remote

Local process attach by PID is supported:

```json
create_debug_session  {"language": "dotnet"}
set_breakpoint        {"sessionId": "<id>", "file": "/abs/path/Worker.cs", "line": 30}
attach_to_process     {"sessionId": "<id>", "processId": 12345, "sourcePaths": ["/abs/path/bin/Debug/net8.0"]}
```

- `sourcePaths` tells the adapter where to scan for PDBs (defaults to the target process's executable directory). On Windows, discovered Windows-format PDBs are auto-converted to Portable via Pdb2Pdb.
- For 32-bit targets set `NETCOREDBG_X86_PATH` to an x86 netcoredbg build — the adapter detects the target's architecture.
- `detach_from_process {"sessionId": "<id>"}` never terminates the debuggee (the adapter pins `terminateDebuggee: false`). There is no remote host/port attach — attach is by local PID.

## Quirks

- **TCP-to-stdio bridge:** on all platforms the adapter spawns netcoredbg in stdio mode behind a TCP bridge, working around a netcoredbg `--server=PORT` bug where the connection drops after the DAP initialize sequence. First use can take a moment while the bridge starts.
- **Portable PDB or nothing:** netcoredbg cannot read Windows-format PDBs. Empty variable lists at a valid breakpoint are usually a symbol-format problem (`/debug:portable` for .NET Framework; the Pdb2Pdb fallback is Windows-only).
- Compiler-generated noise is filtered from variables automatically: `<>c__DisplayClass*` closures, `CS$<>*` temporaries, `<>t__`/`<>s__` async state-machine fields, `$VB$*`.
- Stack traces show user code only by default — frames without source and `System.*`/`Microsoft.*` frames are hidden. Pass `includeInternals: true` to `get_stack_trace` to see everything.
- Supports .NET Core / .NET 5+ and .NET Framework 4.8 (CoreCLR and Desktop CLR).

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| "netcoredbg not found" | Env var/PATH not set | Set `NETCOREDBG_PATH` to the executable (restart shell after `setx`) or add its dir to PATH |
| Empty variables at breakpoint | Non-Portable PDB (typically .NET Framework) | Compile with `/debug:portable`; on Windows the adapter can auto-convert via Pdb2Pdb |
| Breakpoints not firing | Stale build, missing PDB, or non-executable line | `dotnet build` after edits; keep the PDB next to the DLL; pick an executable line |
| Launch fails / nothing starts | `program` points at `Program.cs` instead of the built assembly | Point `scriptPath` and `dapLaunchArgs.program` at `bin/Debug/netX.0/App.dll` |
| Connection timeout on start | TCP-to-stdio bridge still starting, or port conflict | Retry; check nothing else holds the bridge port |
| Attach to 32-bit process fails | Architecture mismatch | Set `NETCOREDBG_X86_PATH` to an x86 netcoredbg |
