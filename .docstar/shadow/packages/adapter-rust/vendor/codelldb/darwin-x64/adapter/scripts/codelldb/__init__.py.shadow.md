# packages/adapter-rust/vendor/codelldb/darwin-x64/adapter/scripts/codelldb/__init__.py
@source-hash: 2de2a77ce36d6ccd
@generated: 2026-02-09T18:07:26Z

**Primary Purpose**: LLDB Python module initialization script that sets up the codelldb debugging adapter's Python API and configures logging for the LLDB debugger environment.

**Key Components**:
- **API Imports (L1)**: Exposes core debugging functions from `.api` module:
  - `evaluate`: Expression evaluation in debug context
  - `wrap/unwrap`: Object serialization/deserialization utilities
  - `get_config`: Configuration access
  - `create_webview`: UI component creation
  - `display_html`: HTML rendering capability
  - `debugger_message`: Debug communication interface
- **Value Import (L2)**: Imports `Value` class from `.value` module for debug value representation
- **LLDB Hook Function (L4-7)**: `__lldb_init_module` serves as the standard LLDB Python module entry point, automatically called when the module is loaded into LLDB's Python environment

**Architectural Pattern**: Standard LLDB Python extension pattern using the conventional `__lldb_init_module` hook for initialization.

**Dependencies**: 
- Internal modules: `.api`, `.value`
- Standard library: `logging`

**Critical Behavior**: 
- Configures DEBUG-level logging with custom format including Python prefix and timestamp
- Uses console output (commented file logging to `/tmp/codelldb.log`)
- Provides unified API surface for codelldb debugging operations

**Runtime Context**: Executes within LLDB's embedded Python interpreter as part of the CodeLLDB VS Code extension's debugging infrastructure.