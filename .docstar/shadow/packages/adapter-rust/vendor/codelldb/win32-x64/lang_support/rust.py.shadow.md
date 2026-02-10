# packages/adapter-rust/vendor/codelldb/win32-x64/lang_support/rust.py
@source-hash: 7c4d867cb1c38025
@generated: 2026-02-09T18:13:22Z

## Purpose
LLDB debugger initialization module for Rust language support in CodeLLDB. Sets up Rust-specific debugging formatters, type displays, and step-over configurations to enhance Rust debugging experience.

## Key Function
**`__lldb_init_module(debugger, internal_dict)` (L10-43)**: Main LLDB module initialization function that:
- Configures step-over behavior to skip Rust standard library code (L11-12)
- Sets up character type formatting for signed/unsigned char display (L14-15)
- Dynamically discovers Rust sysroot path via rustc or rustup (L17-29)
- Loads Rust-specific LLDB formatters from toolchain (L32-43)

## Dependencies
- **lldb**: Core LLDB Python API for debugger control
- **codelldb**: Host debugger framework for configuration and messaging
- **subprocess**: External process execution for rustc/rustup commands
- **os.path**: File system path operations

## Architecture Patterns
- **Auto-discovery**: Dynamically locates Rust toolchain via subprocess calls to rustc/rustup
- **Conditional loading**: Gracefully handles missing formatter files with informative error messages
- **Platform adaptation**: Windows-specific subprocess configuration to hide console windows (L26-28)
- **Fallback strategy**: Attempts direct rustc call if no specific toolchain configured (L22-23)

## Critical Behavior
- Step-avoid regexp `'^<?(std|core|alloc)::'` prevents debugger from stepping into Rust standard library internals
- Expects `lldb_lookup.py` and `lldb_commands` files in `{sysroot}/lib/rustlib/etc/` for formatter loading
- MSVC toolchain detection provides specific troubleshooting guidance for Windows users (L39-43)
- Uses UTF-8 encoding for subprocess output to handle international characters in paths

## Configuration Dependencies
- `lang.rust.sysroot`: Optional explicit sysroot path override
- `lang.rust.toolchain`: Optional rustup toolchain specification