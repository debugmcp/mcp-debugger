# packages/adapter-rust/vendor/codelldb/linux-x64/lang_support/
@generated: 2026-02-09T18:16:06Z

## Purpose
Language support subsystem for the CodeLLDB debugger adapter that provides extensible, configuration-driven initialization of language-specific debugging features. This module enables LLDB to properly debug programs written in different languages by loading appropriate formatters, step patterns, and type display configurations.

## Core Architecture

**Plugin System Design**
The directory implements a two-tier plugin architecture:
- `__init__.py` serves as the dynamic module loader and orchestrator
- Individual language modules (like `rust.py`) implement language-specific debugging configurations
- All language modules must implement the standard `__lldb_init_module(debugger, internal_dict)` interface

**Configuration-Driven Loading**
- Reads `sourceLanguages` list from adapter configuration in `internal_dict`
- Dynamically imports only the language modules specified in configuration
- Provides fault tolerance - failures in individual language modules don't prevent others from loading

## Key Components

**Module Orchestrator (`__init__.py`)**
- Primary entry point: `__lldb_init_module()` function
- Manages dynamic import and initialization of language-specific modules
- Implements robust error handling and logging for plugin failures
- Converts language list to set for potential deduplication

**Rust Language Support (`rust.py`)**
- Configures step-avoid patterns to skip Rust standard library internals during debugging
- Sets up Rust-specific type formatters for character types
- Dynamically locates and loads Rust's built-in LLDB formatters from the toolchain
- Handles sysroot resolution with fallback mechanisms using `rustc` and `rustup`
- Provides platform-specific error guidance (especially for MSVC environments)

## Public API Surface
- **Primary Entry Point**: `__lldb_init_module(debugger, internal_dict)` - Called by LLDB when loading the language support module
- **Configuration Interface**: Reads `sourceLanguages` from adapter settings to determine which language modules to load

## Internal Data Flow
1. LLDB calls the main `__lldb_init_module()` function
2. Configuration is extracted from `internal_dict` to get list of target languages
3. For each configured language, corresponding module is dynamically imported
4. Each language module's `__lldb_init_module()` is called to perform language-specific setup
5. Language modules configure debugger settings like step patterns, type formatters, and external formatter loading

## Key Patterns
- **Graceful Degradation**: Missing modules or failed initializations are logged but don't prevent other languages from loading
- **External Tool Integration**: Language modules can invoke external toolchain commands (e.g., `rustc --print=sysroot`) to locate resources
- **Platform-Aware Behavior**: Handles platform-specific requirements like Windows subprocess console hiding
- **Fallback Mechanisms**: Multiple strategies for locating language resources (config → toolchain commands → error guidance)