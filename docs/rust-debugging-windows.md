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
  cargo +stable-gnu build --target x86_64-pc-windows-gnu
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
   cargo +stable-gnu build --target x86_64-pc-windows-gnu
   ```

The resulting binaries (in `target/x86_64-pc-windows-gnu/debug`) contain DWARF debug info. Re-run `mcp-debugger check-rust-binary` to confirm.

> **Tip:** For scripts or CI, set `RUSTFLAGS="-C debuginfo=2"` to ensure full debug symbols even if profiles are customised.

### Full MinGW Binutils Required for Crates That Import From Windows DLLs

`rustup toolchain install stable-gnu` ships a *self-contained* GNU toolchain under `%USERPROFILE%\.rustup\toolchains\stable-x86_64-pc-windows-gnu\lib\rustlib\x86_64-pc-windows-gnu\bin\self-contained\`. That directory contains `dlltool.exe`, `ld.exe`, and a linker-only `x86_64-w64-mingw32-gcc.exe`, but **no GNU assembler (`as.exe`)**.

For a bare binary (no dependencies) that is enough — `rust-lld` handles linking and `dlltool` is never invoked. But as soon as any transitive dependency needs to import symbols from a Windows system DLL (e.g. `windows-sys`, `parking_lot_core`, anything that brings in `tokio`), `rustc` calls `dlltool.exe` to synthesise import libraries for `kernel32.dll` / `ntdll.dll`, and `dlltool` in turn spawns `as.exe`. Without it you get:

```
error: dlltool could not create import library with ... dlltool.exe ...:
    dlltool.exe: CreateProcess
error: could not compile `parking_lot_core` (lib) due to 1 previous error
```

Install the full MinGW-w64 binutils (and gcc, if any dependency's `build.rs` compiles C) via MSYS2:

```powershell
winget install --id=MSYS2.MSYS2 -e
C:\msys64\usr\bin\bash.exe -lc "pacman -Sy --noconfirm && pacman -S --needed --noconfirm mingw-w64-x86_64-binutils mingw-w64-x86_64-gcc"
```

Then prepend `C:\msys64\mingw64\bin` to your user `PATH` so `as.exe`, `ld.exe`, `dlltool.exe`, and `gcc.exe` resolve there:

```powershell
$current = [Environment]::GetEnvironmentVariable('Path','User')
[Environment]::SetEnvironmentVariable('Path', "C:\msys64\mingw64\bin;$current", 'User')
```

Open a new shell (or VS Code window) so the change is picked up, then rerun `cargo +stable-gnu build --target x86_64-pc-windows-gnu`.

---

## What Happens With MSVC Builds?

When the MCP Rust adapter detects an MSVC build:

- Breakpoints and stepping still work because CodeLLDB can control the process.
- Variable inspection becomes unreliable: strings, vectors, async state machines, and complex structs typically appear as `<variable not available>` or show corrupted memory.
- Session startup behavior depends on the `RUST_MSVC_BEHAVIOR` setting (default: `warn`). With `error` behavior, the adapter throws an `AdapterError` with code `ENVIRONMENT_INVALID`. With the default `warn` behavior, the adapter logs a warning and proceeds. With `continue` behavior, the adapter silently proceeds (no warning logged).

These issues stem from LLDB's partial support for Microsoft's PDB format. There is currently no safe or redistributable alternative debugger we can bundle, so focusing on the GNU toolchain provides the best overall experience.

---

## Frequently Asked Questions

### Can I debug MSVC builds anyway?
Yes, but expect limited inspection. Setting `RUST_MSVC_BEHAVIOR=continue` makes the adapter silently proceed (no warning logged) with the MSVC binary despite limited variable support.

### What about Visual Studio Code?
VS Code's C++ extension ships Microsoft's `cppvsdbg` adapter, which understands PDB files. If you must stay on MSVC, debug within VS Code instead of MCP.

### Does this affect Linux or macOS?
No. On non-Windows platforms Rust defaults to the GNU-compatible toolchains that produce DWARF symbols, so CodeLLDB works out of the box.

### Can I mix toolchains?
Yes. Many teams build release artifacts with MSVC but keep a GNU build profile just for debugging. `cargo build --target x86_64-pc-windows-gnu` is usually sufficient.

---

## Related Resources

- [`mcp-debugger check-rust-binary`](https://github.com/debugmcp/mcp-debugger/blob/main/src/cli/commands/check-rust-binary.ts) — CLI entry point
- [Rust toolchain book](https://doc.rust-lang.org/book/ch01-03-hello-cargo.html#installing-rustup) — Installing and managing toolchains
- [CodeLLDB project](https://github.com/vadimcn/vscode-lldb) — Upstream debugger documentation

For other platform-specific notes, follow updates in `README.md` or the issue tracker.
