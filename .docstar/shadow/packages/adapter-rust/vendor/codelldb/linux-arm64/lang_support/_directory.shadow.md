# packages/adapter-rust/vendor/codelldb/linux-arm64/lang_support/
@generated: 2026-02-09T18:16:05Z

## Overall Purpose

The `lang_support` directory implements a dynamic language-specific debugging extension system for the CodeLLDB adapter on Linux ARM64. It provides a plugin architecture that allows LLDB to load and configure language-specific debugging enhancements based on the source languages configured in the adapter settings.

## Key Components and Relationships

**Dynamic Module Loader (`__init__.py`):**
- Acts as the central orchestrator for language-specific debugging support
- Implements LLDB's standard plugin initialization protocol via `__lldb_init_module()`
- Dynamically discovers and loads language modules based on configured source languages
- Provides graceful error handling and logging for missing or failing language modules

**Rust Language Support (`rust.py`):**
- Concrete implementation of language-specific debugging enhancements for Rust
- Configures step-over behavior to skip standard library internals
- Auto-discovers Rust toolchain resources and loads official Rust LLDB formatters
- Provides enhanced type visualization for Rust-specific types like `char`

## Public API Surface

**Main Entry Point:**
- `__lldb_init_module(debugger, internal_dict)` - Standard LLDB plugin initialization function called automatically by the debugger

**Configuration Interface:**
- Driven by `adapter_settings['sourceLanguages']` array from CodeLLDB configuration
- Supports extensible language module discovery through naming convention

## Internal Organization and Data Flow

1. **Initialization Phase:** LLDB calls the main `__lldb_init_module()` in `__init__.py`
2. **Configuration Reading:** Extracts configured source languages from adapter settings
3. **Dynamic Loading:** Iterates through language list, attempting to import corresponding modules
4. **Language Initialization:** Calls each loaded module's `__lldb_init_module()` function
5. **Error Handling:** Logs failures and continues with remaining languages

## Important Patterns and Conventions

**Plugin Architecture:**
- Each language module must implement `__lldb_init_module(debugger, internal_dict)` function
- Modules are discovered by matching language names to Python module names in the package
- Follows fail-safe design where individual language failures don't break the entire system

**Resource Discovery:**
- Language modules auto-discover external toolchain resources (e.g., Rust sysroot detection)
- Platform-aware implementations handle OS-specific behaviors (Windows console hiding)

**Integration Points:**
- Integrates with CodeLLDB's configuration system via `codelldb.get_config()`
- Loads external formatter scripts from language toolchains when available
- Configures LLDB's stepping and formatting behavior per language requirements

This directory serves as the extensible foundation for language-aware debugging capabilities, currently supporting Rust with the architecture designed to easily accommodate additional language modules.