# packages/adapter-rust/vendor/codelldb/linux-arm64/adapter/scripts/codelldb/__init__.py
@source-hash: 2de2a77ce36d6ccd
@generated: 2026-02-09T18:10:19Z

**Purpose**: LLDB debugger extension entry point for CodeLLDB Rust adapter. Provides Python API bindings and initializes logging infrastructure for debugging sessions.

**Key Components**:
- **API Imports (L1)**: Core debugging functions including `evaluate`, `wrap`/`unwrap`, `get_config`, `create_webview`, `display_html`, `debugger_message` from `.api` module
- **Value Import (L2)**: `Value` class from `.value` module for handling debugger values
- **Module Initializer (L4-7)**: `__lldb_init_module()` function - standard LLDB entry point that configures Python logging with DEBUG level, custom format including timestamp and logger name

**Architecture**:
- Package serves as facade exposing core debugging API
- Follows LLDB Python module conventions with `__lldb_init_module` hook
- Logging configured for debugging Python components within LLDB session
- Part of CodeLLDB adapter infrastructure for Rust debugging in VS Code

**Dependencies**:
- LLDB Python API (implicit through function signature)
- Internal `.api` and `.value` modules
- Python `logging` module

**Usage Context**: Loaded by LLDB when CodeLLDB adapter starts, providing Python-based debugging capabilities for Rust programs with integrated web UI support.