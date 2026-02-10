# packages/adapter-rust/vendor/codelldb/linux-x64/lang_support/__init__.py
@source-hash: 044b446a66eee6c4
@generated: 2026-02-09T18:13:18Z

## Purpose
LLDB debugger module initializer for the CodeLLDB adapter that dynamically loads language-specific support modules based on configuration.

## Core Functionality

**`__lldb_init_module(debugger, internal_dict)` (L7-22)**
- Primary entry point called by LLDB when loading this module
- Extracts `sourceLanguages` list from adapter settings in `internal_dict`
- Dynamically imports and initializes language support modules for each configured language
- Uses dynamic import via `__import__()` with `fromlist` parameter (L12)
- Calls each language module's own `__lldb_init_module()` function (L18)
- Implements robust error handling with logging and console output (L17-22)

## Key Dependencies
- `logging`: For debug/info level logging throughout initialization process
- `lang_support` namespace: Parent package containing language-specific modules

## Architecture Pattern
Implements a plugin-style architecture where:
1. Configuration drives which language modules to load
2. Each language module must implement the same `__lldb_init_module()` interface
3. Failures in individual language modules don't prevent others from loading

## Critical Behavior
- Missing language modules are logged as debug messages but don't cause failures (L14-15)
- Exceptions during language module initialization are caught, logged, and printed but don't propagate (L19-22)
- Language set is converted from list to set, potentially deduplicating entries (L9)