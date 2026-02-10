# packages/adapter-rust/vendor/codelldb/darwin-x64/lang_support/rust.py
@source-hash: 7c4d867cb1c38025
@generated: 2026-02-09T18:13:21Z

## Primary Purpose
LLDB debugger initialization module for Rust language support in CodeLLDB. Configures debugging behavior, formatters, and loads Rust-specific LLDB extensions to enhance debugging experience for Rust applications.

## Key Components

**__lldb_init_module(debugger, internal_dict) (L10-43)**: Main initialization function called by LLDB when module loads. Performs complete Rust debugging environment setup including:
- Step-over configuration for standard library code (L11-12)
- Basic type formatting for char types (L14-15)  
- Rust toolchain discovery and sysroot resolution (L17-29)
- Dynamic loading of Rust-specific LLDB formatters (L32-43)

## Core Functionality

**Sysroot Resolution (L17-30)**: Multi-tier approach to locate Rust installation:
1. Uses explicit `lang.rust.sysroot` config if available
2. Falls back to `rustup run <toolchain> rustc --print=sysroot` if toolchain specified
3. Defaults to `rustc --print=sysroot` command
4. Handles Windows-specific subprocess startup flags (L25-28)

**Formatter Loading (L32-43)**: Attempts to load Rust's built-in LLDB formatters from `<sysroot>/lib/rustlib/etc/`:
- Imports `lldb_lookup.py` script for custom type lookups
- Sources `lldb_commands` file for additional debugging commands
- Provides fallback messaging for MSVC toolchains missing formatters (L39-43)

## Dependencies
- **lldb**: Core LLDB Python API for debugger interaction
- **codelldb**: Host debugger framework providing config access and messaging
- **subprocess**: System command execution for Rust toolchain queries
- **logging**: Debug logging infrastructure

## Architecture Notes
- Follows LLDB's standard module initialization pattern via `__lldb_init_module`
- Uses CodeLLDB's configuration system for toolchain detection
- Gracefully handles missing formatter files with informative error messages
- Cross-platform compatible with Windows-specific subprocess handling