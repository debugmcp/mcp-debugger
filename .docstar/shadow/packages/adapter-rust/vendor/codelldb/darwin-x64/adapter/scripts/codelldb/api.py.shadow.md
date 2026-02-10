# packages/adapter-rust/vendor/codelldb/darwin-x64/adapter/scripts/codelldb/api.py
@source-hash: 10fd6587324dbf99
@generated: 2026-02-09T18:07:29Z

**Purpose:** Python API module for CodeLLDB debugger adapter, providing high-level scripting interface for LLDB debugging with VSCode integration.

## Key Functions

**Configuration Management:**
- `get_config(name, default)` (L11-23): Retrieves hierarchical configuration values from adapter settings using dot-separated paths (e.g., 'foo.bar' → 'lldb.script.foo.bar')

**Expression Evaluation:**
- `evaluate(expr, unwrap=False)` (L26-33): Evaluates native expressions in current debug context, returns `Value` wrapper or raw `SBValue`
- `wrap(obj)` (L36-38): Converts `SBValue` to `Value` wrapper object
- `unwrap(obj)` (L41-43): Extracts `SBValue` from `Value` wrapper

**UI Integration:**
- `create_webview()` (L46-75): Creates VSCode webview panels with extensive configuration options (HTML content, positioning, script enablement, etc.)
- `display_html()` (L83-116): **Deprecated** HTML display function, internally uses `create_webview()` with singleton pattern
- `debugger_message(output, category)` (L78-80): Sends messages to debugger console

**Module Initialization:**
- `__lldb_init_module(debugger, internal_dict)` (L118-119): LLDB module initialization hook, registers 'debug_info' command

## Dependencies

- **Core:** `lldb.SBValue`, `warnings`, `typing`
- **Internal modules:** 
  - `.interface`: Core debugger interface functions
  - `.value.Value`: Enhanced value wrapper class  
  - `.webview.Webview`: Webview panel management

## Architectural Patterns

- **Facade Pattern:** Simplifies complex LLDB operations through clean API
- **Singleton Pattern:** Used in `display_html()` for HTML webview management
- **Event-driven:** Webview message handling with callback registration
- **Deprecation Management:** Graceful transition from `display_html()` to `create_webview()`

## Critical Notes

- Functions rely on `interface.current_debugger()` and `interface.current_frame()` for context
- Webview lifecycle tied to debugger session unless `preserve_orphaned=True`
- Configuration paths are automatically prefixed with 'lldb.script.'