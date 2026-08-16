# C/C++ debugging (mcp-debugger)

## Prerequisites

- **Nothing, for prebuilt binaries** — CodeLLDB is vendored automatically at install/build time (shared with the Rust adapter in `packages/codelldb-common`; `pnpm --filter @debugmcp/codelldb-common run build:adapter` to re-vendor, or set `CODELLDB_PATH`).
- A compiler (`g++`/`clang++`, or `gcc`/`clang` for C) only for source-file launch or building targets yourself. Always compile with `-gdwarf-4 -O0` (`-gdwarf-4` explicitly — MinGW gcc defaults to DWARF-5, whose line tables LLDB cannot read from PE-COFF, so line breakpoints never bind).
- **Windows: prefer DWARF toolchains** (MSYS2/MinGW-w64 g++, clang). MSVC-built binaries carry PDB symbols, which LLDB reads only partially (variables can show `<unavailable>`); the adapter warns when it detects one (`CPP_MSVC_BEHAVIOR=warn|error|continue`).
- C/C++ debugging **works in the Docker image**: linux-x64 CodeLLDB is vendored and `g++` is installed, so source-file launch compiles in-container and attach-by-PID works (`--cap-add=SYS_PTRACE` for non-descendant processes). Prebuilt binaries must be Linux-compiled — host-compiled (Windows/macOS) binaries mounted in are not debuggable by container LLDB.

## Launch quickstart

```json
create_debug_session  {"language": "cpp", "name": "cpp-bug-hunt"}
set_breakpoint        {"sessionId": "<id>", "file": "C:/proj/main.cpp", "line": 17}
start_debugging       {"sessionId": "<id>", "scriptPath": "C:/proj/build/myapp.exe"}
get_stack_trace       {"sessionId": "<id>"}
get_local_variables   {"sessionId": "<id>"}
evaluate_expression   {"sessionId": "<id>", "expression": "vec.size()"}
step_over             {"sessionId": "<id>"}
continue_execution    {"sessionId": "<id>"}
close_debug_session   {"sessionId": "<id>"}
```

- `scriptPath` is the **compiled executable** (primary), or a **lone `.c`/`.cpp` file** — the adapter compiles it into `.debug-mcp/` next to the source when stale (`-gdwarf-4 -O0`; dialect by extension). Headers are not staleness-tracked (`"forceRebuild": true` after header edits). Multi-file projects: prebuild, pass the binary.
- Breakpoints always reference the **source file**. Function breakpoints work with bare names — `{"function": "main"}` is fine in C/C++ (no Rust-style crate qualification needed).
- Program args go in top-level `args`; advanced CodeLLDB keys pass through `dapLaunchArgs` untouched: `initCommands`, `targetCreateCommands` (core dumps: `["target create -c core myapp"]`), `processCreateCommands` (`["gdb-remote host:port"]` for gdbserver/QEMU/rr), `sourceMap`, `expressions`.

## Attach (by PID)

```json
attach_to_process {"sessionId": "<id>", "processId": 4242}
```

- Target is held **paused** after attach (pass `stopOnEntry: false` to resume immediately). `detach_from_process` leaves it running.
- Linux: `kernel.yama.ptrace_scope=1` limits attach to child processes — `sudo sysctl kernel.yama.ptrace_scope=0` for arbitrary PIDs. Windows: same-privilege processes.
- Adapter extras go in `adapterConfig`: `{"adapterConfig": {"program": "/path/to/binary"}}` helps symbol resolution when LLDB cannot open the module paths from `/proc/<pid>/maps` (different mount namespace — kubectl-debug sidecar: use `"/proc/<pid>/root/<binary>"`); `initCommands` runs LLDB commands before attach.

## Quirks

- **Same CodeLLDB engine as Rust** — the Rust reference's engine quirks apply: possible launch-time system stop before the first breakpoint (one `continue_execution` fixes it), multi-location lines (macros/templates) draining one location per continue (#255), Windows pause via break-in thread with empty locals on the synthetic thread (#275), stop-reason labels occasionally off on Windows — judge progress by stack lines.
- **Exceptions:** launch default `"uncaught"` sets no filter — an uncaught `throw` reaches `std::terminate` → SIGABRT and the session pauses at the crash anyway. `breakOnExceptions: "all"` arms `cpp_throw` (pauses at every throw, caught included). `exceptionInfo` is populated for C++ exception stops.
- **Output** is captured like Rust's (#223 tier): POSIX via CodeLLDB DAP output events, Windows via adapter-stdio forwarding — `get_output` works either way.
- **Expression evaluation** is real LLDB: `ptr->field`, `obj.method()`, casts, and full Python via CodeLLDB's `/py` prefix when `expressions` allows.
- Logpoints work: `set_breakpoint` with `logMessage: "x={x}"`.
- Data breakpoints (hardware watchpoints: 1/2/4/8 bytes, max 4 on x86_64) and disassembly are engine-supported.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Breakpoints never hit | Built without debug info, DWARF-5-in-PE (MinGW default), or optimized | Rebuild `-gdwarf-4 -O0`; absolute source paths |
| Variables `<unavailable>` (Windows) | MSVC PDB binary | Rebuild with MinGW-w64/clang (DWARF) |
| "Can't find CodeLLDB" | Not vendored / npx package on non-Linux | `pnpm --filter @debugmcp/codelldb-common run build:adapter`, or `CODELLDB_PATH` |
| Attach EPERM (Linux) | ptrace scope | `sudo sysctl kernel.yama.ptrace_scope=0` |
| First stop in system frames | Launch-time system stop | One `continue_execution` |
| Compile fails on source-file launch | No compiler on PATH | Install g++/clang++, or pass a prebuilt binary |
