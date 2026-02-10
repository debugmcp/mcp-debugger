# packages/adapter-rust/vendor/codelldb/darwin-arm64/lang_support/
@generated: 2026-02-09T18:16:04Z

## Overview

This directory provides LLDB language support infrastructure for the CodeLLDB adapter, implementing a plugin-based architecture for language-specific debugging enhancements. The module enables dynamic loading and initialization of debugging features tailored to different programming languages.

## Architecture

The directory follows a **plugin architecture** pattern with two main components:

- **`__init__.py`**: Core initialization dispatcher that dynamically loads language-specific modules
- **`rust.py`**: Rust language support implementation providing formatters and debugging configuration

The system is designed to be extensible - additional language support can be added by creating new modules following the established convention.

## Key Components

### Initialization Dispatcher (`__init__.py`)
- **Entry Point**: `__lldb_init_module(debugger, internal_dict)` - main LLDB hook
- **Dynamic Loading**: Reads `sourceLanguages` from adapter settings and imports corresponding modules
- **Error Resilience**: Gracefully handles missing modules and initialization failures
- **Plugin Interface**: Expects each language module to implement `__lldb_init_module` function

### Rust Language Support (`rust.py`)
- **Entry Point**: `__lldb_init_module(debugger, internal_dict)` - Rust-specific initialization
- **Step Filtering**: Configures LLDB to skip standard library code during debugging
- **Type Formatting**: Sets up character type display formats
- **Sysroot Detection**: Dynamically locates Rust toolchain installation
- **Formatter Integration**: Loads Rust LLDB data formatters from toolchain

## Data Flow

1. **Bootstrap**: LLDB calls `lang_support.__init__.__lldb_init_module`
2. **Configuration**: Reads `sourceLanguages` from adapter settings
3. **Dynamic Loading**: Imports and initializes each configured language module
4. **Language Setup**: Each language module configures LLDB for language-specific debugging

## Public API

### Primary Entry Points
- `lang_support.__lldb_init_module(debugger, internal_dict)`: Main initialization hook called by LLDB

### Extension Interface
Language modules must implement:
- `__lldb_init_module(debugger, internal_dict)`: Language-specific initialization function

## Configuration Dependencies

- **`sourceLanguages`**: List of languages to initialize (from adapter settings)
- **`codelldb.get_config()`**: Access to adapter configuration values
- **Rust-specific**: `lang.rust.sysroot`, `lang.rust.toolchain` configuration keys

## Integration Points

- **LLDB Framework**: Direct integration with LLDB Python API for debugger control
- **CodeLLDB Adapter**: Receives configuration and provides messaging capabilities
- **External Tools**: Interfaces with language toolchains (e.g., rustc, rustup for Rust)

## Error Handling Strategy

- **Non-blocking**: Failed language initialization doesn't prevent other languages from loading
- **Graceful Degradation**: Missing formatters or tools result in warnings, not failures
- **Comprehensive Logging**: All errors and successes are logged for debugging