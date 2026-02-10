# packages/adapter-rust/vendor/codelldb/win32-x64/lang_support/
@generated: 2026-02-09T18:16:04Z

## Overall Purpose
This directory implements a pluggable language support system for the CodeLLDB debugger, providing language-specific debugging enhancements. The module uses a dynamic plugin architecture to automatically discover and initialize language-specific debugging features based on configured source languages.

## Key Components and Architecture

**Plugin Discovery System (`__init__.py`)**
- Main entry point implementing the LLDB module initialization interface
- Dynamically discovers and loads language support modules based on `sourceLanguages` configuration
- Provides graceful error handling and degradation when language modules fail to load
- Uses standardized `__lldb_init_module` interface contract across all language plugins

**Rust Language Support (`rust.py`)**
- Implements comprehensive Rust debugging enhancements including:
  - Step-over configuration to skip Rust standard library internals
  - Character type formatting for improved display
  - Auto-discovery of Rust toolchain and sysroot paths
  - Integration with Rust-provided LLDB formatters and commands

## Public API Surface

**Primary Entry Point:**
- `__lldb_init_module(debugger, internal_dict)` - LLDB standard initialization interface

**Configuration Interface:**
- Expects `sourceLanguages` list in adapter settings to determine which language modules to load
- Supports language-specific configuration (e.g., `lang.rust.sysroot`, `lang.rust.toolchain`)

## Internal Organization and Data Flow

1. **Initialization Phase**: LLDB calls the main `__lldb_init_module` function
2. **Configuration Extraction**: Retrieves `sourceLanguages` from adapter settings
3. **Dynamic Loading**: Attempts to import each configured language module
4. **Language Initialization**: Calls each language module's initialization function with debugger context
5. **Error Handling**: Logs failures and continues with available language support

## Important Patterns and Conventions

**Plugin Architecture:**
- Each language module must implement `__lldb_init_module(debugger, internal_dict)` interface
- Language modules are named by language identifier (e.g., `rust.py` for Rust support)
- Missing language modules are handled gracefully with debug logging

**Error Resilience:**
- Individual language initialization failures don't prevent other languages from loading
- Comprehensive error logging with full tracebacks for debugging
- Fallback behaviors when external toolchains or resources are unavailable

**External Integration:**
- Language modules can integrate with external toolchains (rustc, rustup)
- Platform-specific adaptations for subprocess execution
- Auto-discovery mechanisms for toolchain-provided debugging resources

This directory serves as the central hub for language-aware debugging features in CodeLLDB, allowing the debugger to provide enhanced experiences tailored to specific programming languages while maintaining modularity and extensibility.