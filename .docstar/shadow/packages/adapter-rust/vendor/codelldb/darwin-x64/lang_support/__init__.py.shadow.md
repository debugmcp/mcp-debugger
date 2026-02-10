# packages/adapter-rust/vendor/codelldb/darwin-x64/lang_support/__init__.py
@source-hash: 044b446a66eee6c4
@generated: 2026-02-09T18:13:20Z

## Purpose
LLDB debugger module initializer that dynamically loads and initializes language-specific support modules based on adapter configuration.

## Key Functions
- `__lldb_init_module(debugger, internal_dict)` (L7-22): Main entry point called by LLDB to initialize the module. Reads source languages from adapter settings, dynamically imports corresponding language support modules, and initializes each one.

## Core Logic
1. Extracts `sourceLanguages` list from `adapter_settings` in `internal_dict` (L8-9)
2. Iterates through configured languages (L11-22)
3. Dynamically imports language modules using `__import__` with fromlist (L12)
4. Attempts to call each module's `__lldb_init_module` function (L18)
5. Handles and logs initialization failures gracefully (L19-22)

## Dependencies
- `logging`: For debug/info/exception logging (L1, L4)
- `os.path`: Imported but unused in this file (L2)

## Architecture Patterns
- Plugin-style architecture: Dynamically discovers and loads language support modules
- Error isolation: Individual language module failures don't prevent other modules from loading
- Convention-based loading: Expects language modules to have matching names and `__lldb_init_module` function

## Key Variables
- `log`: Module-level logger instance (L4)
- `adapter_settings`: Configuration dictionary containing source language list (L8)
- `langs`: Set of configured source languages (L9)

## Error Handling
Comprehensive exception handling with both logging and console output for debugging failed language module initialization (L19-22).