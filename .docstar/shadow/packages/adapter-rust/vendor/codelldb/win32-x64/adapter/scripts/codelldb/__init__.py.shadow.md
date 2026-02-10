# packages/adapter-rust/vendor/codelldb/win32-x64/adapter/scripts/codelldb/__init__.py
@source-hash: 2de2a77ce36d6ccd
@generated: 2026-02-09T18:10:10Z

## Primary Purpose
Python initialization module for CodeLLDB adapter, providing LLDB debugger integration APIs and Python environment setup for debugging sessions.

## Key Components

### API Imports (L1)
- **evaluate**: Core expression evaluation in debugger context
- **wrap/unwrap**: Value wrapping/unwrapping for Python-LLDB interop
- **get_config**: Configuration access for debugger settings
- **create_webview**: UI webview creation for debugger interface
- **display_html**: HTML content rendering in debugger UI
- **debugger_message**: Message communication with debugger frontend

### Value Import (L2)
- **Value**: Core value representation class for debugger data

### LLDB Module Initializer (L4-7)
- **__lldb_init_module**: Standard LLDB Python module entry point
- Configures Python logging with DEBUG level
- Sets structured log format with timestamp, level, and module name
- Contains commented-out file logging option for debugging

## Architecture Notes
- Follows LLDB's standard Python module initialization pattern
- Centralizes all public APIs through `__init__.py` for clean importing
- Logging configuration enables debugging of Python-side operations
- Module designed for integration with LLDB's Python scripting environment

## Dependencies
- Internal `.api` and `.value` modules
- Python `logging` standard library
- LLDB Python bindings (implicit through debugger parameter)