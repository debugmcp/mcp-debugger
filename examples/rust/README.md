# Rust Debugging Examples

This directory contains example Rust projects for testing and demonstrating the MCP Debugger's Rust debugging capabilities.

## Prerequisites

1. **Rust toolchain**: Install Rust from [rustup.rs](https://rustup.rs/)
2. **CodeLLDB**: vendored automatically — the repo's root `postinstall` runs
   `vendor:adapters`, so a plain `pnpm install` fetches it. To re-vendor by hand:
   ```bash
   pnpm --filter @debugmcp/codelldb-common run build:adapter
   ```
3. **On Windows, build with the GNU toolchain — into `target/debug/`.** CodeLLDB reads
   DWARF; MSVC builds emit PDB, which LLDB reads only partially (variables often show
   `<unavailable>`). Install it with `rustup toolchain install stable-gnu`, then build with
   that toolchain but *without* `--target` — e.g. `rustup override set stable-gnu` in the
   crate, or `cargo +stable-gnu build`. A `--target x86_64-pc-windows-gnu` build lands in
   `target/x86_64-pc-windows-gnu/debug/`, which the `.rs`-`scriptPath` path never looks at:
   it resolves only `target/{debug,release}/<name>[.exe]`, and its auto-rebuild runs a plain
   `cargo build` on the default (usually MSVC) toolchain, so the GNU binary is ignored and an
   MSVC one is built in its place. To keep a triple-scoped build, pass that binary's path as
   `scriptPath` instead of the source file. Check any binary with
   `mcp-debugger check-rust-binary <path>`. When an MSVC binary is detected, only
   `RUST_MSVC_BEHAVIOR=continue` proceeds — `warn` (the default) and `error` both fail the
   launch with `MSVC_TOOLCHAIN_DETECTED`.

> **Launch only.** The Rust adapter advertises `modes: { launch: true, attach: 'none' }` —
> there is no `attach_to_process` backend for Rust. To debug a long-running program, start
> it under a launch session instead.

## Example Projects

### 1. Hello World (`hello_world/`)
A simple Rust program demonstrating basic debugging features:
- Variable inspection (primitives, strings, vectors)
- Function calls and parameter inspection
- Control flow (if statements, loops)
- Breakpoint handling

**To debug:** build first,

```bash
cd examples/rust/hello_world
cargo build
```

then drive the session with MCP tool calls. These are tools your MCP client invokes — not
`mcp-debugger` shell subcommands; the CLI only has `stdio`, `sse`, `http`, `doctor`, and
`check-rust-binary`.

```json
create_debug_session {"language": "rust", "name": "rust-hello"}
set_breakpoint       {"sessionId": "<id>", "file": "<abs>/examples/rust/hello_world/src/main.rs", "line": 18}
start_debugging      {"sessionId": "<id>", "scriptPath": "<abs>/examples/rust/hello_world/src/main.rs"}
get_stack_trace      {"sessionId": "<id>"}
get_local_variables  {"sessionId": "<id>"}
step_over            {"sessionId": "<id>"}
continue_execution   {"sessionId": "<id>"}
close_debug_session  {"sessionId": "<id>"}
```

`scriptPath` may be the `.rs` **source** file: the adapter locates the enclosing Cargo
project, resolves the default binary, and rebuilds it if stale. Passing the compiled
binary (`target/debug/hello_world`, `.exe` on Windows) works too. Breakpoints always
reference the `.rs` source, never the binary — use absolute paths.

### 2. Async Example (`async_example/`)
Demonstrates debugging async Rust code with Tokio:
- Async/await functions
- Concurrent tasks with `tokio::spawn`
- Future inspection
- Async runtime debugging

**To debug:** `cd examples/rust/async_example && cargo build`, then use the same tool
sequence as Hello World with `scriptPath` pointing at that crate's `src/main.rs`. Set
breakpoints *inside* async blocks rather than on the `async fn` line.

### 3. Panic Example (`panic_example/`)
Exercises the exception-breakpoint path — `validate()` panics on purpose. With the launch
default `breakOnExceptions: "uncaught"` the session pauses at the panic site with locals
live (CodeLLDB's `rust_panic` filter); the panic message itself arrives on stderr via
`get_output`. Pass `breakOnExceptions: "none"` to run to termination instead (exit code 101).

### 4. Pause Test (`pause_test/`)
A `loop { counter += 1; sleep(500ms) }` program with no breakpoints — used to exercise
`pause_execution` against a running debuggee.

## Launch Configuration

There is no per-project config file. Launch settings are arguments to `start_debugging`:
program arguments go in the top-level `args`, everything else in `dapLaunchArgs`.

```json
start_debugging {
  "sessionId": "<id>",
  "scriptPath": "<abs>/examples/rust/hello_world/src/main.rs",
  "args": ["--verbose", "input.txt"],
  "dapLaunchArgs": {
    "stopOnEntry": true,
    "cargo": {"bin": "hello_world", "release": false},
    "env": {"RUST_BACKTRACE": "1"}
  }
}
```

The `cargo` object accepts `bin`, `example`, `test`, `release`, `features`, `allFeatures`,
`noDefaultFeatures`, and `build` — but `cargo.build` (like `preLaunchTask`) is **not
implemented**: the adapter logs that the build step was skipped, so build manually first.

Unlike the C/C++ adapter, the Rust adapter assembles the CodeLLDB config from an explicit
key list, so keys outside it are dropped. The ones it forwards are `program`, `args`,
`cwd`, `env`, `name`, `stopOnEntry`, `sourceMap`, `initCommands`, `preRunCommands`,
`postRunCommands`, `cargo`, `terminal` (the legacy alias `console` is accepted and mapped
onto it), and `_adapterSettings` — see `RustLaunchConfig` and
`transformLaunchConfig` in `packages/adapter-rust/src/rust-debug-adapter.ts`.

## Tips for Rust Debugging

1. **Debug vs Release builds**: 
   - Debug builds include symbols and are easier to debug
   - Use `cargo build` for debug or `cargo build --release` for optimized builds

2. **Cargo targets**:
   - Binaries: `target/debug/<binary_name>`
   - Tests: `cargo test --no-run` builds a test executable into `target/debug/deps/`; pass
     that path as `scriptPath` with `"args": ["<test_name>", "--nocapture"]`
   - Examples: `target/debug/examples/<example_name>`

3. **Variable inspection**:
   - Rust's ownership model means variables may be moved
   - Use references (`&`) to inspect without moving
   - Collections like `Vec` and `HashMap` display nicely in the debugger

4. **Common issues**:
   - If breakpoints aren't hit, ensure you're debugging a debug build (not release)
   - Async code may require special handling for tokio runtime inspection
   - Generic functions may need concrete type instantiation to set breakpoints
   - A breakpoint on a **macro** line (`println!`, `format!`, `vec!`) resolves to one
     location per inlined call site, so `continue_execution` can re-stop on the same
     file:line at a different program counter (issue #255). Keep continuing until the
     line's locations are drained, or `step_over` once to cross it in one call. This is
     why the Hello World example above breaks on line 18 rather than the `println!` above it

## Running Tests

To test the Rust adapter with these examples:

```bash
# From the project root
pnpm test tests/integration/rust
```

## Contributing

Feel free to add more example projects that demonstrate specific Rust debugging scenarios!
