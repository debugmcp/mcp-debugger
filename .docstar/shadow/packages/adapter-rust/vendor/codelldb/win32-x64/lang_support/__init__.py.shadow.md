# packages/adapter-rust/vendor/codelldb/win32-x64/lang_support/__init__.py
@source-hash: 044b446a66eee6c4
@generated: 2026-02-09T18:13:20Z

## Primary Purpose
LLDB debugger language support initialization module. Dynamically loads and initializes language-specific modules based on configured source languages.

## Key Functions

**`__lldb_init_module(debugger, internal_dict)` (L7-22)**
- Entry point called by LLDB debugger during initialization
- Extracts `sourceLanguages` list from adapter settings in `internal_dict` (L8-9)
- Dynamically imports language modules from the `lang_support` package (L12-13)
- Calls each language module's `__lldb_init_module` function to initialize language-specific debugging support (L18)
- Includes error handling with logging and console output for failed initializations (L17-22)

## Dependencies
- `logging` - For debug/info logging throughout initialization process
- `os.path` - Imported but unused in current implementation
- Dynamic imports from `lang_support` package submodules

## Architecture Pattern
Uses plugin-style architecture where:
1. Language modules are discovered dynamically by name
2. Each language module implements the same `__lldb_init_module` interface
3. Graceful degradation when language modules are missing or fail to load

## Key Variables
- `log` (L4) - Module-level logger instance
- `adapter_settings` (L8) - Configuration dictionary from LLDB internal state
- `langs` (L9) - Set of configured source languages to initialize

## Error Handling
- Missing language modules result in debug logging only (L14-15)
- Module initialization exceptions are caught, logged with full traceback, and printed to console (L17-22)