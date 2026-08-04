# Rust debugging (mcp-debugger)

## Prerequisites

- Rust toolchain (`rustc`, `cargo`) installed via rustup.
- CodeLLDB debug adapter is vendored automatically at install/build time (`pnpm install` postinstall, or `pnpm --filter @debugmcp/adapter-rust run build:adapter`). The published npx CLI ships only the Linux x64 CodeLLDB runtime — on macOS/Windows set `CODELLDB_PATH` to a local CodeLLDB install (e.g. from the VSCode extension) or vendor from a cloned repo.
- **Windows: use the GNU toolchain.** CodeLLDB needs DWARF symbols; MSVC builds emit PDB, which LLDB reads only partially (variables often show `<unavailable>`). Build with:
  ```bash
  rustup target add x86_64-pc-windows-gnu
  cargo +stable-gnu build --target x86_64-pc-windows-gnu
  ```
- Rust debugging is **disabled in the Docker image** by default (`DEBUG_MCP_DISABLE_LANGUAGES`). Use a host (stdio/http) deployment.

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
- **Windows: continue re-stops at the same breakpoint (issue #255):** once paused at a breakpoint on Windows (MSVC binaries; reproduced with both the native and DIA PDB readers), `continue_execution` succeeds but immediately re-stops at the same line instead of advancing. **Workaround: `step_over` once, then `continue_execution` proceeds normally.** Does not occur on Linux (DWARF). Note a same-line re-stop inside a loop is a legitimate breakpoint re-hit — only apply the workaround when the program clearly isn't advancing.
- **Stop reasons can be mislabeled on Windows:** CodeLLDB 1.11.8 has been observed reporting step completions as `reason: 'breakpoint'` and a continue's stop as `'step'`; panic pauses report `'breakpoint'` rather than `'exception'` (issue #260). Judge progress by `get_stack_trace` line numbers, not the reason string alone.
- **Panics pause by default (issue #244):** launch sessions arm CodeLLDB's `rust_panic` filter by default, so a `panic!` pauses at the panic site with the backtrace live (exit code 101 after continuing). Pass `breakOnExceptions: "none"` to run panicking programs to termination instead.
- **Debuggee output is captured:** on POSIX CodeLLDB forwards the program's stdio as DAP output events; on Windows (where LLDB's console mode makes the debuggee inherit the adapter process's stdio) the proxy forwards the adapter's stdio instead. Either way the program's stdout/stderr arrives as `get_output` entries.
- Expression evaluation goes through LLDB: simple field access and method calls like `my_vec.len()` work, but Rust-specific syntax (closures, trait methods) may not.
- Debug builds only: release builds need `debug = true` in `[profile.release]` and still inline/optimize away variables. Prefer `opt-level = 0`.
- GNU builds of crates that import Windows DLLs (`tokio`, `windows-sys`, `parking_lot_core`, ...) need full MinGW binutils — rustup's self-contained toolchain lacks `as.exe`, so `dlltool` fails. Install via MSYS2 (`mingw-w64-x86_64-binutils`, `-gcc`) and prepend `C:\msys64\mingw64\bin` to PATH.
- Macro-generated and generic code can behave oddly: step targets may land in expansions, and generic fns need a concrete instantiation for breakpoints. For async (tokio), set breakpoints inside async blocks, not on the `async fn` line.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Breakpoints never hit | Release/optimized build lacks usable debug info | `cargo build` (debug profile), `opt-level = 0`; absolute source paths |
| Variables `<unavailable>` / garbage strings (Windows) | MSVC toolchain — PDB symbols | Rebuild: `cargo +stable-gnu build --target x86_64-pc-windows-gnu`; verify with `check-rust-binary` |
| "Can't find CodeLLDB" | Adapter not vendored / npx package on non-Linux | Run `pnpm --filter @debugmcp/adapter-rust run build:adapter`, or set `CODELLDB_PATH` |
| First stop is in system/ntdll frames (or a SIGSTOP stop on Linux) | Launch-time system stop | `continue_execution` once, then you land on your breakpoint |
| `continue_execution` re-stops at the same breakpoint line (Windows) | CodeLLDB breakpoint re-hit quirk on MSVC binaries, both PDB readers (issue #255) | `step_over` once, then `continue_execution` |
| `dlltool ... CreateProcess` build error | rustup GNU toolchain missing `as.exe` | Install MSYS2 mingw-w64 binutils/gcc; prepend `C:\msys64\mingw64\bin` to PATH |
