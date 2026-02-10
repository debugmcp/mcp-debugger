# packages/adapter-rust/vendor/codelldb/darwin-arm64/lang_support/rust.py
@source-hash: 7c4d867cb1c38025
@generated: 2026-02-09T18:13:18Z

**Primary Purpose:** LLDB debugger initialization module for Rust language support in CodeLLDB adapter, providing Rust-specific debugging configuration and data formatters.

**Key Function:**
- `__lldb_init_module` (L10-43): LLDB module entry point that configures debugging environment for Rust programs

**Core Functionality:**
1. **Step Filtering** (L11-12): Configures LLDB to skip over standard library code (`std`, `core`, `alloc`) during stepping operations
2. **Type Formatting** (L14-15): Sets up display formats for character types (`char`, `signed char`, `unsigned char`)
3. **Sysroot Detection** (L17-29): Dynamically determines Rust toolchain sysroot path using:
   - Config override from `codelldb.get_config('lang.rust.sysroot')`
   - Toolchain-specific rustc via `rustup run <toolchain> rustc --print=sysroot`
   - Default system rustc via `rustc --print=sysroot`
4. **Formatter Loading** (L32-43): Attempts to load Rust-specific LLDB data formatters from `<sysroot>/lib/rustlib/etc/`

**Key Dependencies:**
- `lldb`: Core LLDB Python API for debugger control
- `codelldb`: Host adapter module providing configuration and messaging
- `subprocess`: External command execution for rustc/rustup interaction

**Platform Considerations:**
- Windows-specific subprocess handling (L26-28) to hide console windows
- MSVC toolchain detection and error messaging (L39-43)

**Error Handling:**
- Graceful fallback when formatters not found, with platform-specific guidance for Windows MSVC

**Critical Paths:**
- Formatter files: `lldb_lookup.py` and `lldb_commands` in `<sysroot>/lib/rustlib/etc/`
- Config keys: `lang.rust.sysroot`, `lang.rust.toolchain`