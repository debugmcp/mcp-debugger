# packages/adapter-rust/vendor/codelldb/darwin-arm64/adapter/scripts/codelldb/__init__.py
@source-hash: 2de2a77ce36d6ccd
@generated: 2026-02-09T18:06:50Z

## Purpose
Python package initialization module for CodeLLDB debugger adapter. Serves as the main entry point exposing debugger APIs and configuring logging for LLDB Python integration.

## Key Components

**Module Imports (L1-2)**
- Exposes core debugger functionality from `api` module: `evaluate`, `wrap`, `unwrap`, `get_config`, `create_webview`, `display_html`, `debugger_message`
- Exposes `Value` class from `value` module for debugger value representation

**LLDB Integration Function (L4-7)**
- `__lldb_init_module(debugger, internal_dict)` - Standard LLDB callback invoked when module is loaded into LLDB Python environment
- Configures Python logging with DEBUG level and structured format including timestamp, logger name, and message
- Uses console output (commented filename suggests file logging capability exists)

## Architecture Notes
- Follows LLDB Python module convention with `__lldb_init_module` as entry point
- Package structure separates API functions (`api.py`) from value types (`value.py`)
- Logging configuration ensures debugger operations are traceable with millisecond precision timestamps

## Dependencies
- Python `logging` module
- Local modules: `.api`, `.value`
- Integrates with LLDB Python API framework