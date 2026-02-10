# packages/adapter-rust/vendor/codelldb/linux-arm64/lang_support/rust.py
@source-hash: 7c4d867cb1c38025
@generated: 2026-02-09T18:13:22Z

**Primary Purpose:** LLDB debugger extension module for Rust language support, providing enhanced debugging capabilities and type formatting for Rust programs.

**Key Components:**

- **`__lldb_init_module()` (L10-43):** Main initialization function automatically called by LLDB when module loads
  - Configures step-over behavior to skip standard library internals (L11-12)
  - Sets up type formatting for char types (L14-15)
  - Auto-discovers Rust toolchain sysroot via `rustc --print=sysroot` (L17-29)
  - Loads Rust-specific LLDB formatters from toolchain's `lib/rustlib/etc/` directory (L30-37)
  - Handles Windows-specific subprocess configuration to hide console windows (L25-28)

**Dependencies:**
- `lldb`: Core LLDB Python API for debugger commands and configuration
- `codelldb`: Custom module providing configuration access and messaging utilities
- `subprocess`: Used to execute `rustc`/`rustup` commands for sysroot discovery
- External tools: `rustc`, optionally `rustup` for toolchain management

**Architecture Patterns:**
- Auto-discovery pattern: Dynamically locates Rust toolchain resources rather than hardcoding paths
- Graceful degradation: Falls back from configured toolchain to system default `rustc`
- Platform-aware execution: Handles Windows-specific subprocess behavior

**Critical Behaviors:**
- Step-avoid regex `'^<?(std|core|alloc)::'` prevents debugger from stepping into Rust standard library code
- Formatter loading is conditional on file existence - missing formatters trigger helpful error messaging
- MSVC toolchain detection provides specific troubleshooting guidance for Windows users

**Integration Points:**
- Integrates with CodeLLDB's configuration system via `codelldb.get_config()`
- Loads external Python formatters (`lldb_lookup.py`) and command scripts (`lldb_commands`) from Rust toolchain