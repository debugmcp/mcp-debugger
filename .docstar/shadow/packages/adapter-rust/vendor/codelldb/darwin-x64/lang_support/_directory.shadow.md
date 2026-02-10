# packages/adapter-rust/vendor/codelldb/darwin-x64/lang_support/
@generated: 2026-02-09T18:16:05Z

## Purpose
The `lang_support` directory provides a plugin-based language support system for the CodeLLDB debugger adapter. It enables dynamic loading and initialization of language-specific debugging enhancements, with primary focus on Rust language support.

## Key Components

**`__init__.py`** - Module orchestrator that:
- Serves as the main entry point called by LLDB via `__lldb_init_module`
- Reads configured source languages from adapter settings
- Dynamically discovers and loads language-specific support modules
- Provides error isolation so individual language module failures don't affect others

**`rust.py`** - Rust language support implementation that:
- Configures step-over behavior for Rust standard library code
- Sets up basic type formatters (char types)
- Discovers Rust toolchain installation and sysroot location
- Loads Rust's built-in LLDB formatters and debugging commands

## Architecture & Data Flow

1. **Initialization**: LLDB calls `__lldb_init_module` in the main module
2. **Configuration Reading**: Extracts `sourceLanguages` list from adapter settings
3. **Dynamic Loading**: Iterates through configured languages, importing matching modules
4. **Language Setup**: Each language module's `__lldb_init_module` is called to configure language-specific debugging features

## Public API Surface

**Main Entry Point:**
- `__lldb_init_module(debugger, internal_dict)` - Called by LLDB to initialize all language support

**Language Module Interface:**
- Each language module must implement `__lldb_init_module(debugger, internal_dict)`
- Language modules are imported by name matching the configured source language

## Key Patterns & Conventions

- **Plugin Architecture**: Language modules are discovered and loaded dynamically based on configuration
- **Convention-based Loading**: Language module names must match the configured language identifier
- **Graceful Degradation**: Individual language module failures are logged but don't prevent other modules from loading
- **Cross-platform Support**: Handles platform-specific requirements (e.g., Windows subprocess configuration)

## Internal Organization

The module follows a two-tier initialization pattern:
1. **Directory-level**: Main `__init__.py` handles discovery and loading
2. **Language-level**: Individual language modules handle specific debugging enhancements

This design allows for easy extension to support additional programming languages by simply adding new language-specific modules to the directory.