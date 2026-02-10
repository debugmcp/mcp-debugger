# packages/adapter-rust/vendor/codelldb/linux-arm64/adapter/scripts/codelldb/api.py
@source-hash: 10fd6587324dbf99
@generated: 2026-02-09T18:10:18Z

## Public API for CodeLLDB Debugger Extension

This module provides the public Python API for CodeLLDB, a VS Code debugging extension for LLDB. It serves as the main entry point for user scripts and debugging extensions.

### Core Functions

**Configuration Management:**
- `get_config(name, default=None)` (L11-23): Retrieves configuration values from VS Code adapter settings using dot-separated paths (e.g., 'foo.bar' maps to 'lldb.script.foo.bar')

**Expression Evaluation:**
- `evaluate(expr, unwrap=False)` (L26-33): Evaluates native LLDB expressions in current frame context, returns Value or SBValue based on unwrap flag
- `wrap(obj)` (L36-38): Converts SBValue to Value wrapper object  
- `unwrap(obj)` (L41-43): Extracts SBValue from Value wrapper object

**UI Integration:**
- `create_webview()` (L46-75): Creates VS Code webview panels with extensive configuration options (HTML content, positioning, script enablement, persistence)
- `display_html()` (L83-116): **DEPRECATED** legacy function for HTML display, internally delegates to create_webview with singleton pattern
- `debugger_message(output, category='console')` (L78-80): Sends messages to debugger console

### Key Dependencies
- `lldb.SBValue`: Core LLDB value type
- `.interface`: Internal adapter communication layer
- `.value.Value`: Enhanced value wrapper class  
- `.webview.Webview`: Webview panel management

### Architecture Notes
- Uses `interface` module for debugger state management and message passing
- Maintains singleton HTML webview instance with event handlers for command execution
- Webview lifecycle managed through debugger ID association
- Module initialization hook `__lldb_init_module()` (L118-119) registers debug commands

### Critical Patterns
- All functions depend on active debugger context via `interface.current_debugger()`
- Webview creation uses message-passing protocol to VS Code host
- Configuration retrieval follows hierarchical dot-notation traversal
- Value wrapping/unwrapping provides seamless LLDB integration