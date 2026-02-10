# packages/adapter-rust/vendor/codelldb/darwin-arm64/adapter/scripts/codelldb/api.py
@source-hash: 10fd6587324dbf99
@generated: 2026-02-09T18:06:58Z

## Purpose
Public API module for CodeLLDB Python scripting interface, providing high-level functions for configuration access, expression evaluation, value wrapping/unwrapping, webview creation, and debugging output.

## Key Functions

### Configuration Management
- **get_config(name, default)** (L11-23): Retrieves adapter configuration values using dot-separated paths from VSCode settings under `lldb.script.*`. Safely navigates nested configuration dictionaries with fallback to default values.

### Expression Evaluation & Value Handling
- **evaluate(expr, unwrap)** (L26-33): Evaluates native LLDB expressions in current frame context. Returns Value wrapper by default, or unwrapped SBValue when unwrap=True.
- **wrap(obj)** (L36-38): Converts SBValue to Value wrapper object (idempotent if already wrapped).
- **unwrap(obj)** (L41-43): Extracts SBValue from Value wrapper object.

### Webview Management
- **create_webview()** (L46-75): Creates VSCode webview panels with comprehensive configuration options. Sends webviewCreate message to debugger with all panel settings. Returns Webview instance tied to current debugger.
- **display_html()** (L83-116): **DEPRECATED** legacy function for HTML display. Internally uses create_webview and manages singleton html_webview instance. Includes event handlers for command execution and cleanup.

### Debugging Utilities
- **debugger_message(output, category)** (L78-80): Sends debug output to VSCode with specified category (default: 'console').

### Module Initialization
- **__lldb_init_module()** (L118-119): LLDB module initialization hook that registers the debug_info command.

## Dependencies
- `lldb.SBValue`: Core LLDB value type
- `.interface`: Internal interface for debugger communication
- `.value.Value`: Value wrapper class
- `.webview.Webview`: Webview management class

## Architectural Notes
- Functions operate on "current" debugger/frame context via interface module
- Message-based communication with VSCode adapter using debugger IDs
- Value wrapping system provides enhanced functionality over raw SBValues
- Webview system enables rich HTML-based debugging visualizations
- Configuration system allows script customization via VSCode settings