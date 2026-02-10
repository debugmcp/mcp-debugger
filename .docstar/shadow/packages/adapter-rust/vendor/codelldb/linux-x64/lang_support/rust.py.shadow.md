# packages/adapter-rust/vendor/codelldb/linux-x64/lang_support/rust.py
@source-hash: 7c4d867cb1c38025
@generated: 2026-02-09T18:13:20Z

## Primary Purpose
LLDB initialization module for Rust language support in CodeLLDB debugger. Configures debugging environment with Rust-specific formatters, step-over patterns, and type display settings.

## Key Function
**`__lldb_init_module(debugger, internal_dict)` (L10-43)**
- Entry point called by LLDB when module loads
- Configures step-avoid patterns to skip std/core/alloc library code during debugging (L11-12)
- Sets up Rust-specific type formatters for char types (L14-15)
- Dynamically locates and loads Rust's built-in LLDB formatters from toolchain

## Core Logic Flow
1. **Step Configuration** (L11-12): Prevents stepping into Rust standard library internals
2. **Type Formatting** (L14-15): Configures char display formats (signed/unsigned)
3. **Sysroot Resolution** (L17-29): 
   - Attempts to get sysroot from config
   - Falls back to `rustc --print=sysroot` or `rustup run <toolchain> rustc --print=sysroot`
   - Handles Windows subprocess hiding via STARTUPINFO
4. **Formatter Loading** (L30-43):
   - Constructs path to `lib/rustlib/etc/` in sysroot
   - Imports `lldb_lookup.py` and sources `lldb_commands` if available
   - Provides MSVC-specific guidance on missing formatters

## Dependencies
- **lldb**: Core LLDB Python API
- **codelldb**: Custom module for configuration and messaging
- **subprocess**: For executing rustc/rustup commands
- **os.path**: File system path operations

## Critical Behavior
- Windows-specific subprocess handling to hide console windows (L26-28)
- Graceful fallback when formatters not found, with platform-specific messaging
- Relies on external Rust toolchain installation and proper sysroot structure