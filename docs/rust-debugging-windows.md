# Rust Debugging on Windows

Rust debugging on Windows depends heavily on the toolchain that produced your executable. CodeLLDB, the debugger bundled with the MCP Rust adapter, expects DWARF debug symbols. Rust binaries built with the GNU toolchain (`x86_64-pc-windows-gnu`) produce DWARF information, while the default MSVC toolchain emits PDB symbols that LLDB cannot fully interpret.

This guide covers how to identify the toolchain behind a binary, the practical impact of each option, and the quickest way to switch toolchains when you need full debugging support.

---

## Quick Summary

| Toolchain | Debug Symbols | Works With CodeLLDB? | Typical Experience |
|-----------|---------------|----------------------|--------------------|
| **GNU (`x86_64-pc-windows-gnu`)** | DWARF | ✅ Full support | Breakpoints, stepping, and variable inspection behave as expected. |
| **MSVC (`x86_64-pc-windows-msvc`)** | PDB | ⚠️ Limited | Breakpoints and stepping work, but string/collection variables often appear as `<unavailable>` or corrupted. |

> **Recommendation:** Build Rust projects for debugging with the GNU toolchain. Use the MSVC toolchain only when you specifically need MSVC compatibility.

---

## Check a Binary Before Debugging

Use the bundled CLI command to inspect any executable before starting a session:

```bash
mcp-debugger check-rust-binary target/debug/hello_world.exe
```

The command inspects nearby PDB files, CodeView (`RSDS`) markers, and import tables to infer the toolchain. Typical output:

```
Binary Analysis: C:\projects\rust\target\debug\hello_world.exe
=========================================

Toolchain:     MSVC
Debug Format:  PDB
PDB Present:   YES
RSDS Marker:   YES

Runtime Dependencies:
  - vcruntime140.dll
  - ucrtbase.dll

Debugging Compatibility:
  - ⚠️  Limited support (control flow only)

To enable full debugging, rebuild with GNU toolchain:
  rustup target add x86_64-pc-windows-gnu
  cargo clean
  cargo +stable-gnu build
```

When the command reports `Toolchain: GNU`, the executable is ready for full CodeLLDB support.

---

## Switching to the GNU Toolchain

1. Install the GNU target for the stable toolchain:
   ```bash
   rustup target add x86_64-pc-windows-gnu
   ```
2. (Optional) Install the pre-built GNU toolchain for convenience:
   ```bash
   rustup toolchain install stable-gnu
   ```
3. Build with the GNU target:
   ```bash
   cargo clean
   cargo +stable-gnu build
   ```

The resulting binaries (in `target/debug` by default) contain DWARF debug info. Re-run `mcp-debugger check-rust-binary` to confirm.

> **Tip:** For scripts or CI, set `RUSTFLAGS="-C debuginfo=2"` to ensure full debug symbols even if profiles are customised.

---

## What Happens With MSVC Builds?

When the MCP Rust adapter detects an MSVC build:

- Breakpoints and stepping still work because CodeLLDB can control the process.
- Variable inspection becomes unreliable: strings, vectors, async state machines, and complex structs typically appear as `<variable not available>` or show corrupted memory.
- Session startup emits a structured warning (`MSVC_TOOLCHAIN_DETECTED`) with instructions to continue with limited support or rebuild with GNU.

These issues stem from LLDB's partial support for Microsoft's PDB format. There is currently no safe or redistributable alternative debugger we can bundle, so focusing on the GNU toolchain provides the best overall experience.

---

## Frequently Asked Questions

### Can I debug MSVC builds anyway?
Yes, but expect limited inspection. The adapter logs a warning and lets you continue if you accept the degraded experience (`RUST_MSVC_BEHAVIOR=continue`).

### What about Visual Studio Code?
VS Code's C++ extension ships Microsoft's `cppvsdbg` adapter, which understands PDB files. If you must stay on MSVC, debug within VS Code instead of MCP.

### Does this affect Linux or macOS?
No. On non-Windows platforms Rust defaults to the GNU-compatible toolchains that produce DWARF symbols, so CodeLLDB works out of the box.

### Can I mix toolchains?
Yes. Many teams build release artifacts with MSVC but keep a GNU build profile just for debugging. `cargo build --target x86_64-pc-windows-gnu` is usually sufficient.

---

## Related Resources

- [`mcp-debugger check-rust-binary`](../src/cli/commands/check-rust-binary.ts) — CLI entry point
- [Rust toolchain book](https://doc.rust-lang.org/book/ch01-03-hello-cargo.html#installing-rustup) — Installing and managing toolchains
- [CodeLLDB project](https://github.com/vadimcn/vscode-lldb) — Upstream debugger documentation

For other platform-specific notes, follow updates in `README.md` or the issue tracker.
