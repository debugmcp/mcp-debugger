# Rust debugging (mcp-debugger)

## Prerequisites

- Rust toolchain (`rustc`, `cargo`) installed via rustup.
- CodeLLDB debug adapter is vendored automatically at install/build time (`pnpm install` postinstall, or `pnpm --filter @debugmcp/codelldb-common run build:adapter`). The published npx CLI ships only the Linux x64 CodeLLDB runtime — on macOS/Windows set `CODELLDB_PATH` to a local CodeLLDB install (e.g. from the VSCode extension) or vendor from a cloned repo.
- **Windows: use the GNU toolchain.** CodeLLDB needs DWARF symbols; MSVC builds emit PDB, which LLDB reads only partially (variables often show `<unavailable>`). Build with:
  ```bash
  rustup target add x86_64-pc-windows-gnu
  cargo +stable-gnu build --target x86_64-pc-windows-gnu
  ```
- Rust debugging **works in the Docker image** for **Linux-compiled** binaries (linux-x64 CodeLLDB is vendored; launch-only — the rust adapter has no attach). Host-compiled (Windows/macOS) binaries mounted into the container are not debuggable by container LLDB — cross-compile for Linux or use a host deployment.

## Launch quickstart

Build first (`cargo build` — debug profile, not release), then:

```json
create_debug_session  {"language": "rust", "name": "rust-bug-hunt"}
set_breakpoint        {"sessionId": "<id>", "file": "C:/proj/src/main.rs", "line": 10}
start_debugging       {"sessionId": "<id>", "scriptPath": "C:/proj/src/main.rs"}
get_stack_trace       {"sessionId": "<id>"}
get_local_variables   {"sessionId": "<id>"}
evaluate_expression   {"sessionId": "<id>", "expression": "my_vec.len()"}
step_over             {"sessionId": "<id>"}
continue_execution    {"sessionId": "<id>"}
close_debug_session   {"sessionId": "<id>"}
```

- `scriptPath` may be the **source file** (`.rs`): the adapter locates the enclosing Cargo project, resolves the default binary, and rebuilds it if stale. Passing the compiled binary path (`target/debug/my_program` or `target/x86_64-pc-windows-gnu/debug/my_program.exe`) also works.
- Breakpoints always reference the **`.rs` source file**, never the binary. Use absolute paths.
- Select a specific target or pass env via `dapLaunchArgs`; program args go in top-level `args`:

```json
start_debugging {
  "sessionId": "<id>",
  "scriptPath": "C:/proj/src/main.rs",
  "args": ["--verbose", "input.txt"],
  "dapLaunchArgs": {
    "cargo": {"bin": "my_program", "release": false},
    "env": {"RUST_BACKTRACE": "1", "RUST_LOG": "debug"}
  }
}
```

The `cargo` object also accepts `example` and `test` target names. To debug a unit test, `cargo test --no-run`, then pass the test executable from `target/debug/deps/` as `scriptPath` with `args: ["test_name", "--nocapture"]`.

## Attach / remote

Not supported. The Rust adapter implements launch mode only — `attach_to_process` has no Rust backend. To debug a long-running program, launch it under the debugger instead.

## Quirks

- **Windows toolchain (critical):** MSVC-built binaries give control flow only — breakpoints/stepping work, but strings, Vecs, and structs show `<unavailable>` or corrupted values. `RUST_MSVC_BEHAVIOR` controls what happens when an MSVC binary is detected: `warn` (default — log and proceed), `error` (fail with `ENVIRONMENT_INVALID`), `continue` (silent). Check any binary first with `mcp-debugger check-rust-binary target/debug/app.exe` — it reports `Toolchain: GNU` or `MSVC`.
- **Initial stop varies by platform:** the first stop after `start_debugging` may be a launch-time system stop rather than your breakpoint (observed on Linux as a SIGSTOP-labeled stop; older Windows reports show ntdll frames, though current Windows traces usually land directly on the first breakpoint). If `get_stack_trace` shows no user frame, issue one `continue_execution` to reach your breakpoint.
- **Continue can re-stop on the same line — macro lines hold several breakpoint locations (issue #255):** a breakpoint on a line that expands to multiple inlined call sites (`format!`, `println!`, `vec!`, and other macros) resolves to one location *per* call site — the `setBreakpoints` response says `Resolved locations: N`. Each `continue_execution` advances to the next location, so the session re-pauses on the same file:line, with the same breakpoint id, at a different program counter. This is normal LLDB behavior on every platform, not a defect: keep continuing (N times) and the program leaves the line, or `step_over` once to traverse the whole line in one call. Confirmed by driving CodeLLDB with a raw DAP client, mcp-debugger out of the loop; plain single-statement lines resolve to one location and need exactly one continue. Note the location count for a given line is **toolchain-dependent** — different rustc versions merge macro call sites differently in the line tables (the same `format!` line resolved to 1 location under rustc 1.83 and 3 under 1.91), so the same program can need a different number of continues after a toolchain upgrade.
- **Stop reasons can be mislabeled on Windows:** CodeLLDB 1.11.8 has been observed reporting step completions as `reason: 'breakpoint'` and a continue's stop as `'step'`. Judge progress by `get_stack_trace` line numbers, not the reason string alone.
- **Pause on Windows lands via a break-in thread:** `pause_execution` injects a debug break (`EXCEPTION_BREAKPOINT` 0x80000003); the stop reason is normalized to `'pause'` (`rawReason: 'exception'` preserved, issue #275). The paused thread is the synthetic break-in thread, so its locals are empty — use `list_threads` and inspect your program's threads' frames instead.
- **Panics pause by default (issue #244):** launch sessions arm CodeLLDB's `rust_panic` filter by default, so a `panic!` pauses at the panic site with the backtrace live (exit code 101 after continuing). The pause reports `lastStop.reason: 'exception'` (normalized from CodeLLDB's internal-breakpoint stop, issue #260 — `rawReason: 'breakpoint'` is preserved); the panic message itself arrives on stderr via `get_output`, not in `lastStop.description`. Pass `breakOnExceptions: "none"` to run panicking programs to termination instead.
- **Debuggee output is captured:** on POSIX CodeLLDB forwards the program's stdio as DAP output events; on Windows (where LLDB's console mode makes the debuggee inherit the adapter process's stdio) the proxy forwards the adapter's stdio instead. Either way the program's stdout/stderr arrives as `get_output` entries.
- Expression evaluation goes through LLDB: simple field access and method calls like `my_vec.len()` work, but Rust-specific syntax (closures, trait methods) may not.
- Debug builds only: release builds need `debug = true` in `[profile.release]` and still inline/optimize away variables. Prefer `opt-level = 0`.
- GNU builds of crates that import Windows DLLs (`tokio`, `windows-sys`, `parking_lot_core`, ...) need full MinGW binutils — rustup's self-contained toolchain lacks `as.exe`, so `dlltool` fails. Install via MSYS2 (`mingw-w64-x86_64-binutils`, `-gcc`) and prepend `C:\msys64\mingw64\bin` to PATH.
- Macro-generated and generic code can behave oddly: step targets may land in expansions, and generic fns need a concrete instantiation for breakpoints. For async (tokio), set breakpoints inside async blocks, not on the `async fn` line.
- Logpoints work: `set_breakpoint` with `logMessage: "x={x}"` logs interpolated values to `get_output` without pausing (CodeLLDB).

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Breakpoints never hit | Release/optimized build lacks usable debug info | `cargo build` (debug profile), `opt-level = 0`; absolute source paths |
| Variables `<unavailable>` / garbage strings (Windows) | MSVC toolchain — PDB symbols | Rebuild: `cargo +stable-gnu build --target x86_64-pc-windows-gnu`; verify with `check-rust-binary` |
| "Can't find CodeLLDB" | Adapter not vendored / npx package on non-Linux | Run `pnpm --filter @debugmcp/codelldb-common run build:adapter`, or set `CODELLDB_PATH` |
| First stop is in system/ntdll frames (or a SIGSTOP stop on Linux) | Launch-time system stop | `continue_execution` once, then you land on your breakpoint |
| `continue_execution` re-stops on the same line | The line is a macro (`format!`, `println!`, …) whose expansion resolves to several breakpoint locations; each stop is a genuine hit at a different PC (issue #255) | Continue again until the line's locations are drained, or `step_over` once to cross the whole line |
| `dlltool ... CreateProcess` build error | rustup GNU toolchain missing `as.exe` | Install MSYS2 mingw-w64 binutils/gcc; prepend `C:\msys64\mingw64\bin` to PATH |
