# C/C++ Debugging Examples

Example programs for debugging C and C++ with mcp-debugger's CodeLLDB-based adapter.

## Prerequisites

- No compiler is needed to debug a **prebuilt** executable — only the vendored CodeLLDB.
- For source-file launch (auto-compile) or building these examples yourself, install a compiler:
  - **Windows**: MSYS2/MinGW-w64 (`pacman -S mingw-w64-x86_64-gcc`) — emits DWARF, the debug-info flavor CodeLLDB reads best. MSVC-built binaries get partial symbol fidelity via LLDB's native PDB reader.
  - **Ubuntu/Debian**: `sudo apt install build-essential`
  - **macOS**: `xcode-select --install`

Always compile with **`-gdwarf-4 -O0`** — full debug info, unoptimized stepping. `-gdwarf-4` explicitly: MinGW gcc defaults to DWARF-5, whose line tables LLDB cannot read from PE-COFF (line breakpoints never bind).

## Example Programs

1. **hello_world.cpp** — variables, a named function (`compute_answer`) for function breakpoints, and printed output markers.

   **To debug:**
   ```bash
   g++ -gdwarf-4 -O0 -o hello_world hello_world.cpp
   # then launch hello_world (the binary) — or just launch hello_world.cpp
   # directly and let the adapter compile it into .debug-mcp/
   ```

2. **hello_world.c** — the same idea in plain C; exercises the C-dialect auto-compile branch (gcc/clang/cc).

3. **pause_test.cpp** — an endless ticking loop for `pause_execution` and attach-by-PID testing.

   **To debug (attach):**
   ```bash
   g++ -gdwarf-4 -O0 -o pause_test pause_test.cpp
   ./pause_test &
   # attach_to_process with the printed PID
   ```

4. **throwing_example.cpp** — one caught `std::runtime_error`, and an uncaught one with `--crash`. Use with `breakOnExceptions: "all"` (maps to CodeLLDB's `cpp_throw` filter) to stop on the caught throw; an uncaught throw reaches `std::terminate` → SIGABRT, which the debugger stops on without any filter.

## Debug Configurations

- Launch a binary: `start_debugging` with `scriptPath` = the executable.
- Launch a source file: `scriptPath` = the lone `.c`/`.cpp` file — the adapter compiles it (staleness-checked; `forceRebuild: true` to override) into `.debug-mcp/` next to the source. Headers are not staleness-tracked; multi-file projects should be prebuilt.
- Attach: `attach_to_process` with `processId`. On Linux, `kernel.yama.ptrace_scope=1` blocks attaching to non-child processes (`sudo sysctl kernel.yama.ptrace_scope=0` to relax temporarily).
- Advanced CodeLLDB features pass through `adapterLaunchConfig`: `initCommands`, `targetCreateCommands` (core dumps: `["target create -c core.dump"]`), gdbserver/rr remote targets, `sourceMap`, `expressions`.

## Running Tests

```bash
pnpm vitest run tests/e2e/mcp-server-smoke-cpp.test.ts --project e2e
```
