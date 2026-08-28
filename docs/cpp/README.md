# C/C++ Debugging with Debug MCP Server

Step-through debugging for C and C++ via **CodeLLDB** — the same vendored LLDB-based adapter the Rust adapter uses. One language id (`cpp`) covers both C and C++ (the way `dotnet` covers C#).

## Architecture

```
MCP Client → mcp-debugger → proxy worker → CodeLLDB (vendored) → LLDB → your binary
```

- CodeLLDB binaries are vendored in `packages/codelldb-common/vendor/codelldb/<platform>/` (shared with the Rust adapter — one ~150 MB copy per platform, downloaded automatically during `pnpm install`).
- The adapter spawns CodeLLDB in TCP mode and speaks DAP to it. No system LLDB or gdb installation is required.
- npm/npx installs get CodeLLDB via the per-platform `@debugmcp/codelldb-*` optional dependencies; setting `CODELLDB_PATH` (e.g. to the VSCode extension's copy) overrides the installed platform package, though a repo/Docker vendored copy still wins over both.

## Prerequisites

- **To debug a prebuilt executable: nothing beyond the vendored CodeLLDB.**
- To launch a lone source file (auto-compile) you need a compiler on PATH — probed in order: `g++`, `clang++`, `c++` (C++); `gcc`, `clang`, `cc` (C):
  - **Windows**: MSYS2/MinGW-w64 (`pacman -S mingw-w64-x86_64-gcc`) or LLVM/clang
  - **Ubuntu/Debian**: `sudo apt install build-essential`
  - **macOS**: `xcode-select --install`

### Compilation Requirements

Compile with **`-gdwarf-4 -O0`**: full debug info, no optimization (optimized code steps unpredictably and optimizes locals away). `-gdwarf-4` matters on Windows: MinGW gcc 11+ defaults to DWARF-5, whose line tables LLDB cannot read from PE-COFF binaries — line breakpoints report "Resolved locations: 0" while function breakpoints (symbol-based) still bind. On Linux/macOS plain `-g` also works, but `-gdwarf-4` is safe everywhere.

**Windows debug-info reality:** CodeLLDB reads **DWARF** (MinGW-w64/clang output) with full fidelity. **MSVC PDB** support is partial — the native PDB reader is enabled (`LLDB_USE_NATIVE_PDB_READER=1`), breakpoints and stepping work, but complex-type variable inspection can degrade. The adapter detects MSVC binaries at launch and warns (`CPP_MSVC_BEHAVIOR=warn|error|continue`, default `warn`). Prefer MinGW-w64/MSYS2 g++ on Windows. (Microsoft's vsdbg cannot be used — its license restricts it to Visual Studio products.)

## Debugging Modes

### Launch Mode

`program` (the `scriptPath` in `start_debugging`) accepts either:

1. **A compiled executable** (primary path):
   ```
   g++ -gdwarf-4 -O0 -o myapp myapp.cpp
   start_debugging scriptPath=/path/to/myapp
   ```
2. **A lone `.c`/`.cpp`/`.cc`/`.cxx` source file** (convenience path): the adapter compiles it (`-gdwarf-4 -O0`) into `.debug-mcp/` next to the source, staleness-checked by mtime.
   - Headers are **not** staleness-tracked — pass `forceRebuild: true` in the launch config after header-only edits.
   - Rebuilds compile to a staging executable before replacing the stable output. On Windows, if a running debugger still locks the stable `.exe`, mcp-debugger launches the successful versioned artifact instead and reuses the newest managed artifact on the next launch. Older unlocked versions are cleaned up automatically.
   - Multi-file projects: build them yourself (make/cmake), then launch the executable.
   - Dialect by extension: `.c` → gcc/clang/cc, everything else → g++/clang++.

### Attach Mode (by PID)

```
attach_to_process sessionId=... processId=<pid>
```

- The target is held paused after attach (`stopOnEntry` defaults to `true` for attach; pass `false` to resume immediately).
- `detach_from_process` leaves the target running.
- **Linux**: `kernel.yama.ptrace_scope=1` (the default on many distros) only allows attaching to child processes. For arbitrary processes: `sudo sysctl kernel.yama.ptrace_scope=0` (temporary) or run the server with `CAP_SYS_PTRACE`.
- **Windows**: attach requires same-or-higher privilege than the target.
- Adapter-specific attach extras go in `adapterConfig` (issue #336): `program` is CodeLLDB's explicit-binary hint for symbol resolution, and `initCommands` runs LLDB commands before the attach. Both matter when the module paths in `/proc/<pid>/maps` are not openable from the debugger's mount namespace (e.g. a kubectl-debug ephemeral container):

  ```text
  attach_to_process {sessionId, processId: 1,
                     adapterConfig: {program: "/proc/1/root/pricer"}}
  # or equivalently:
  attach_to_process {sessionId, processId: 1,
                     adapterConfig: {initCommands: ["settings set target.exec-search-paths /proc/1/root"]}}
  ```

  For the full Kubernetes ephemeral-sidecar flow (flags, symbols, turnkey manifests), see the [Kubernetes debugging recipe](../kubernetes.md).

## Advanced CodeLLDB Features (pass-through)

Unrecognized keys in the launch config flow through to CodeLLDB untouched, so its full power stays available:

| Feature | Launch config |
|---|---|
| Core dump post-mortem | `"targetCreateCommands": ["target create -c /path/to/core myapp"]` |
| Remote gdbserver / QEMU / OpenOCD | `"targetCreateCommands": ["target create myapp"], "processCreateCommands": ["gdb-remote localhost:1234"]` |
| rr reverse debugging | attach CodeLLDB to `rr replay -s <port>` via `gdb-remote` (rr ≥ 5.3) |
| LLDB scripting | `"initCommands"`, `"preRunCommands"`, `"postRunCommands"` |
| Path mapping | `"sourceMap": {"/build/path": "/local/path"}` |
| Expression engine | `"expressions": "native" \| "simple" \| "python"` |

Data breakpoints (hardware watchpoints), disassembly view, instruction stepping, and memory reads are supported by the engine; exposure depends on the MCP tool surface.

## Debugging Workflow

1. `create_debug_session` with `language: "cpp"`
2. Build your program with `-gdwarf-4 -O0` (or point at a lone source file)
3. `set_breakpoint` on the source file (or `function: "name"` for function breakpoints — a bare `main` works fine in C/C++)
4. `start_debugging` with the executable (or source) path
5. Step (`step_over`/`step_into`/`step_out`), `continue_execution`, `pause_execution`
6. Inspect: `get_stack_trace`, `get_local_variables`, `evaluate_expression` (LLDB expressions, e.g. `ptr->field`, `vec.size()`)
7. `get_output` for captured stdout/stderr (Windows: forwarded via adapter stdio; POSIX: CodeLLDB output events)
8. `close_debug_session`

## Exceptions

- `breakOnExceptions: "all"` maps to CodeLLDB's `cpp_throw` filter — pauses at **every** throw (first chance), caught or not.
- The launch default `"uncaught"` sets **no filter**: LLDB has no uncaught-only C++ filter, and an uncaught exception reaches `std::terminate` → SIGABRT, which the debugger stops on natively — you still land at the crash with stack and locals.
- `cpp_catch` (break on catch) is available via explicit filter configuration.

## Debugging host-built binaries in Docker

A binary compiled on the host embeds host-absolute source paths (e.g. `/home/user/proj/src/main.cpp`) in its DWARF debug info. When the mcp-debugger container mounts the project at `/workspace`, breakpoint requests use `/workspace/...` paths and CodeLLDB cannot match them against the DWARF paths — file+line breakpoints and logpoints silently never bind (function breakpoints and pause still work; issue #363).

In container mode (`MCP_CONTAINER=true`) the adapter auto-derives a best-effort `sourceMap` for prebuilt binaries by scanning the binary for embedded host paths whose suffixes exist under the workspace mount (`MCP_WORKSPACE_ROOT`, default `/workspace`), so this usually just works. If auto-derivation misses (unusual layouts, stripped path strings), pass the mapping explicitly — a caller-supplied `sourceMap` always wins:

```json
{
  "scriptPath": "/workspace/build/app",
  "dapLaunchArgs": {
    "sourceMap": { "/home/user/proj": "/workspace" }
  }
}
```

Alternatively, compile inside the container (or with `-fdebug-prefix-map=/home/user/proj=/workspace`) so the DWARF paths match the mount directly.

## Troubleshooting

- **"CodeLLDB executable not found"** — run `pnpm --filter @debugmcp/codelldb-common run build:adapter`, or set `CODELLDB_PATH`.
- **"No C/C++ compiler found"** — only matters for source-file launch; install a compiler or pass a prebuilt binary. `MCP_CPP_ALLOW_PREBUILT=true` skips the check.
- **Variables show `<unavailable>`** — MSVC PDB binary (rebuild with MinGW/clang for DWARF) or optimized build (use `-O0`).
- **Breakpoints not binding** — binary built without debug info or with DWARF-5 on Windows (MinGW gcc's default; rebuild with `-gdwarf-4`), or the source moved since compilation (use `sourceMap`).
- **Attach fails with EPERM (Linux)** — see ptrace scope above.
- **Windows: spawn blocked** — Smart App Control can block the vendored `codelldb.exe`; the e2e suites skip in that case.
- **Step/continue re-stops on one line** — lines expanding to multiple breakpoint locations (macros, templates) drain one location per continue; known CodeLLDB behavior (#255).

## Additional Resources

- [CodeLLDB manual](https://github.com/vadimcn/codelldb/blob/master/MANUAL.md)
- `examples/cpp/` — ready-made fixtures (hello_world, pause_test, throwing_example)
- `skills/debugging/references/cpp.md` — agent-facing quick reference
