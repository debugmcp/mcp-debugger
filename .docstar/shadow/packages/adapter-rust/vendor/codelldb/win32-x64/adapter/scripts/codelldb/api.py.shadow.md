# packages/adapter-rust/vendor/codelldb/win32-x64/adapter/scripts/codelldb/api.py
@source-hash: 10fd6587324dbf99
@generated: 2026-02-09T18:10:15Z

## Purpose
API module for CodeLLDB debugger adapter providing a Python interface for VS Code integration. Bridges LLDB debugging functionality with VS Code webview panels and configuration system.

## Key Functions

**Configuration Management:**
- `get_config(name, default=None)` (L11-23): Retrieves hierarchical configuration values from adapter settings using dot-separated paths (e.g., 'foo.bar' maps to 'lldb.script.foo.bar' in VS Code config)

**Expression Evaluation:**
- `evaluate(expr, unwrap=False)` (L26-33): Evaluates native LLDB expressions in current frame context, returns Value wrapper or raw SBValue
- `wrap(obj)` (L36-38): Converts SBValue to Value wrapper object
- `unwrap(obj)` (L41-43): Extracts SBValue from Value wrapper

**Webview Integration:**
- `create_webview(...)` (L46-75): Creates VS Code webview panels with extensive customization options (HTML content, positioning, script enablement, persistence)
- `display_html(...)` (L83-115): **Deprecated** HTML display function that creates singleton webview with command execution capability
- `debugger_message(output, category='console')` (L78-80): Sends messages to debugger console

**Module Initialization:**
- `__lldb_init_module(debugger, internal_dict)` (L118-119): LLDB module initialization hook that registers debug_info command

## Dependencies
- `lldb.SBValue`: Core LLDB value type
- `.interface`: Internal adapter communication layer  
- `.value.Value`: Enhanced LLDB value wrapper
- `.webview.Webview`: Webview panel management

## Architectural Patterns
- **Adapter Pattern**: Wraps LLDB primitives in higher-level abstractions
- **Singleton Pattern**: HTML webview uses instance-based singleton (L89-111)
- **Event-Driven**: Webview communication via message handlers (L102-110)
- **Configuration Hierarchy**: Dot-notation config path resolution with fallback defaults

## Critical Invariants
- Current debugger/frame context required for evaluation operations
- Webview lifecycle managed through debugger session lifetime
- Configuration settings must exist in adapter_settings.scriptConfig structure