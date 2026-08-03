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
- **Windows initial stop:** debugging may first stop in system functions (not user code). Issue one `continue_execution` to reach your breakpoint; auto-continue through these system stops is not yet implemented.
- **KNOWN ISSUE — `get_output` may be empty (issue #223):** debuggee stdout may not appear in `get_output` due to a launch-config console/terminal mismatch. Do not rely on print debugging — inspect state with `evaluate_expression`, `get_local_variables`, and breakpoints instead.
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
| First stop is in system/ntdll frames | Windows initial system breakpoint | `continue_execution` once, then you land on your breakpoint |
| `dlltool ... CreateProcess` build error | rustup GNU toolchain missing `as.exe` | Install MSYS2 mingw-w64 binutils/gcc; prepend `C:\msys64\mingw64\bin` to PATH |
| `get_output` returns no stdout | Issue #223 (console/terminal launch mismatch) | Use `evaluate_expression` / variables at breakpoints instead |
