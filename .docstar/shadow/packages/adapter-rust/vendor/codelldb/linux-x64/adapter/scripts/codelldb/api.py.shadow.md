# packages/adapter-rust/vendor/codelldb/linux-x64/adapter/scripts/codelldb/api.py
@source-hash: 10fd6587324dbf99
@generated: 2026-02-09T18:11:23Z

**Primary Purpose**: API module for CodeLLDB Python scripting interface, providing high-level functions for configuration access, expression evaluation, value manipulation, webview creation, and debugger messaging within VS Code LLDB debugging sessions.

**Key Functions & Roles**:

- `get_config(name, default)` (L11-23): Retrieves hierarchical configuration values from adapter settings using dot-notation paths (e.g., 'foo.bar' → 'lldb.script.foo.bar' in VSCode config)
- `evaluate(expr, unwrap)` (L26-33): Evaluates native LLDB expressions, returning wrapped Value objects or unwrapped SBValue instances based on unwrap parameter
- `wrap(obj)` (L36-38): Converts SBValue to Value wrapper object (idempotent if already wrapped)
- `unwrap(obj)` (L41-43): Extracts SBValue from Value wrapper object
- `create_webview()` (L46-75): Creates VSCode webview panels with comprehensive configuration options, returns Webview instance
- `debugger_message(output, category)` (L78-80): Sends messages to debugger console with categorization
- `display_html()` (L83-116): **DEPRECATED** HTML display function, internally uses create_webview with compatibility layer
- `__lldb_init_module()` (L118-119): LLDB module initialization hook, registers debug_info command

**Dependencies & Relationships**:
- `lldb.SBValue`: Core LLDB value type for debugger data
- `.interface`: Internal adapter interface for debugger/frame access and messaging
- `.value.Value`: Custom wrapper class for enhanced SBValue functionality  
- `.webview.Webview`: Webview panel management class
- `warnings`: For deprecation notices
- `__main__`: Python main module access

**Architecture Patterns**:
- **Facade Pattern**: Provides simplified interface over complex LLDB/adapter internals
- **Wrapper Pattern**: Value class wrapping for enhanced functionality
- **Singleton Access**: Current debugger/frame access through interface module
- **Event-Driven**: Webview message handling with callback registration
- **Deprecation Management**: Graceful migration from old APIs with warnings

**Critical Invariants**:
- Debugger context must be active for most operations (interface.current_debugger())
- Webview IDs are tied to specific debugger instances
- Configuration paths use dot notation mapping to VSCode settings hierarchy
- Value wrapping/unwrapping maintains type safety between Value and SBValue