# Rust Adapter Performance Summary

**Last reviewed:** 2026-09-01
**Status:** Functional. Full fidelity with DWARF-producing toolchains (GNU on Windows, the default elsewhere); control-flow only against MSVC PDB.

## Performance measurements

**There are none to publish.** No latency benchmark for the Rust adapter exists
in this repository, so this page deliberately carries no response-time figures
— earlier revisions listed some, but they were never produced by a harness and
could not be reproduced.

The only benchmark harness in-tree is `scripts/mem-bench.mjs`, and it measures
**resident set size** (RSS/peak working set of the server process at fixed
lifecycle checkpoints), not operation latency. Treat any latency expectation for
Rust debugging as unmeasured until a harness exists to back it.

## Toolchain Compatibility

| Toolchain | Debug info | Variable Inspection | Overall Status |
|-----------|------------|---------------------|----------------|
| **GNU (`x86_64-pc-windows-gnu`)** | DWARF | Full | Recommended on Windows |
| **MSVC (`x86_64-pc-windows-msvc`)** | PDB | Partial — strings/`Vec`/structs often `<unavailable>` | Control flow only |
| **Linux / macOS (default toolchains)** | DWARF | Full | Supported |

CodeLLDB is pinned to **1.11.8** (`packages/codelldb-common/vendor-manifest.json`,
which also carries the per-platform SHA-256 digests the vendoring script verifies).

## Known Behavioral Characteristics

### Strengths
1. **Async code is debuggable:** `examples/rust/async_example` is a Tokio program kept in
   the tree for exercising this. Set breakpoints *inside* async blocks rather than on the
   `async fn` line.
2. **Rust type summaries:** `String`/`&str`/`Vec`/`HashMap` render through the toolchain's
   LLDB formatter scripts — CodeLLDB locates them via `rustc --print sysroot`, or via
   `CODELLDB_RUST_SYSROOT` on hosts with no rustc (issue #441). When neither is available
   the session still works, but values render as raw LLDB structures and the adapter says so
   in the captured output.
3. **Panics pause by default:** launch sessions arm CodeLLDB's `rust_panic` filter, so a
   `panic!` stops at the panic site with the backtrace live (issue #244). Pass
   `breakOnExceptions: "none"` to run panicking programs to termination.
4. **Logpoints:** `set_breakpoint` with `logMessage` logs interpolated values to
   `get_output` without pausing.

### Current Limitations
1. **Launch-time system stop is not auto-continued.** Auto-continue on `stopOnEntry: false`
   fires only for a DAP stop whose reason is `entry` (`src/session/session-manager-core.ts`);
   the relaxed first-stop rule is opt-in via the adapter policy and today only js-debug
   takes it. A Rust launch that stops in system/`ntdll` frames (or with a SIGSTOP-labeled
   stop on Linux) therefore stays paused — issue one `continue_execution` to reach your
   breakpoint. Current Windows traces frequently land directly on the first breakpoint, so
   this does not always occur.
2. **Macro lines hold several breakpoint locations (issue #255):** a breakpoint on a line
   that expands to multiple inlined call sites (`format!`, `println!`, `vec!`) resolves to
   one location *per* call site, so `continue_execution` can re-stop on the same file:line
   at a different program counter. Keep continuing, or `step_over` once. The location count
   is toolchain-dependent.
3. **MSVC Toolchain:** limited to control-flow debugging. CodeLLDB's native PDB reader is
   enabled on Windows (`LLDB_USE_NATIVE_PDB_READER=1`, set in
   `packages/shared/src/interfaces/lldb-policy-shared.ts`), but MSVC binaries are treated as
   compatibility-limited, and only `RUST_MSVC_BEHAVIOR=continue` proceeds with such a
   binary. Under both `warn` (the default) and `error` the launch is aborted:
   `ProxyLauncher.applyToolchainValidation` (`src/session/launch/proxy-launcher.ts`) throws
   for any incompatible verdict whose behavior is not `continue`, and `start_debugging`
   returns `success: false, error: "MSVC_TOOLCHAIN_DETECTED"` with the session reset to
   `CREATED` (`src/session/launch/debug-launcher.ts`). `warn` differs from `error` only in
   logging the warning and reporting `canContinue: true`.
4. **Attach is not implemented.** The Rust adapter is launch-only
   (`attach: 'none'` in `src/adapters/adapter-loader.ts`); `attach_to_process` fails fast
   for `language: "rust"`.
5. **Path Resolution:** absolute paths are the reliable form for `scriptPath` and breakpoint
   files.

## How CodeLLDB is located

`packages/codelldb-common/src/codelldb-resolver.ts` resolves the adapter binary in this
order, first hit wins:

1. **The vendored tree** — `packages/codelldb-common/vendor/codelldb/<platform>/adapter/`,
   populated by the `postinstall` hook (`pnpm run vendor:adapters`, which runs each
   package's `build:adapter`) or directly via
   `pnpm --filter @debugmcp/codelldb-common run build:adapter`. This is the path for repo
   checkouts and the Docker image.
2. **`CODELLDB_PATH`** — an explicit pointer at a local CodeLLDB install (e.g. the VS Code
   extension's copy). Deliberate user configuration beats the auto-installed package below,
   but not a vendored copy.
3. **A per-platform npm package** — `@debugmcp/codelldb-<platform>`, declared as
   `optionalDependencies` of the published CLI (`packages/mcp-debugger/package.json`) for
   `darwin-arm64`, `darwin-x64`, `linux-arm64`, `linux-x64`, and `win32-x64`. This is the
   intended path for `npm`/`npx` users: the package manager installs only the entry matching
   the host's os/cpu, so no manual vendoring step is needed. **These five packages have not
   been published to npm yet** — they first publish alongside the next release; until then
   only paths 1 and 2 are available. Installing with `--omit=optional` skips them by design,
   in which case set `CODELLDB_PATH`.

## Recommendations

1. **On Windows, use the GNU toolchain — and keep its output in `target/debug/`:**
   `rustup toolchain install stable-gnu`, then build with that toolchain but *without*
   `--target` (e.g. `rustup override set stable-gnu` in the crate, or
   `cargo +stable-gnu build`). A `--target x86_64-pc-windows-gnu` build lands in
   `target/x86_64-pc-windows-gnu/debug/`, which a `.rs` `scriptPath` never finds: the
   adapter resolves only `target/{debug,release}/<name>[.exe]` (`transformLaunchConfig` in
   `packages/adapter-rust/src/rust-debug-adapter.ts`) and its auto-rebuild runs a plain
   `cargo build` on the default toolchain (`buildCargoProject` in
   `packages/adapter-rust/src/utils/cargo-utils.ts`). If you do build to a triple-scoped
   directory, pass that binary's path as `scriptPath` instead of the source file. Check an
   existing binary with `mcp-debugger check-rust-binary target/debug/app.exe`, which reports
   `Toolchain: GNU` or `MSVC`.
2. **Build with debug symbols:** debug profile (`cargo build`); a release build needs
   `debug = true` and `opt-level = 0` in `[profile.release]` and still inlines variables away.
3. **Use absolute paths** for `scriptPath` and breakpoint files.
4. **Pre-vendor CodeLLDB** in a clone: `pnpm vendor:adapters` (or let `pnpm install` do it).

## See also

- [docs/rust-debugging.md](./rust-debugging.md) — setup, vendoring, and troubleshooting
- [skills/debugging/references/rust.md](../skills/debugging/references/rust.md) — the
  agent-facing quirk list this page's limitations are drawn from
