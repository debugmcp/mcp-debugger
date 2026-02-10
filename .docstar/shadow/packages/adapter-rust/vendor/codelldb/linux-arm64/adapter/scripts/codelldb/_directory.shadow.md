# packages/adapter-rust/vendor/codelldb/linux-arm64/adapter/scripts/codelldb/
@generated: 2026-02-09T18:16:13Z

## CodeLLDB Python Extension Module

This directory provides a complete Python extension framework for CodeLLDB, enabling advanced debugging capabilities for Rust programs within VS Code. The module serves as a bridge between LLDB's native debugging engine and VS Code's UI, with support for custom evaluation, webview integration, and interactive debugging sessions.

## Core Architecture

The module follows a layered architecture with clear separation of concerns:

- **Entry Point (`__init__.py`)**: Exposes public API and initializes logging infrastructure when loaded by LLDB
- **Public API (`api.py`)**: Main user-facing interface providing debugging functions, configuration access, and UI integration
- **FFI Bridge (`interface.py`)**: Critical Rust-Python communication layer handling bidirectional message passing and code evaluation
- **Value System (`value.py`)**: Pythonic wrapper for LLDB values with operator overloading and type conversions
- **UI Components (`webview.py`)**: VS Code webview panel management for rich debugging visualizations
- **Event System (`event.py`)**: Observer pattern implementation for decoupled component communication

## Key Entry Points

**Primary API Surface:**
- `evaluate(expr, unwrap=False)`: Execute expressions in current debugging context
- `get_config(name, default=None)`: Access VS Code adapter configuration settings
- `create_webview()`: Create interactive webview panels for custom debugging UI
- `wrap(obj)` / `unwrap(obj)`: Convert between LLDB SBValue and Python Value objects
- `debugger_message(output, category='console')`: Send messages to debugger console

**LLDB Integration:**
- `__lldb_init_module()`: Standard LLDB entry point for Python module initialization
- Native expression evaluation with fallback strategies via `nat_eval()`

## Internal Data Flow

1. **Initialization**: LLDB loads module via `__lldb_init_module()`, establishing Rust-Python FFI bridge through `interface.initialize()`

2. **Session Management**: Each debug session triggers `session_init()` for context isolation and console redirection

3. **Code Evaluation Pipeline**:
   - User expressions compiled via `compile_code()`
   - Executed in isolated context with `evaluate_in_context()`
   - Results converted between LLDB SBValue and Python Value objects
   - Type-aware conversions handled by comprehensive `type_traits` mapping

4. **Message Passing**: JSON-based communication between Python and Rust components via `handle_message()` and `send_message()`

5. **UI Integration**: Webview panels created through VS Code extension API with event-driven message routing

## Critical Patterns & Conventions

**Memory Management**: Manual reference counting for Python objects crossing FFI boundaries, with careful ownership tracking

**Context Switching**: Temporary modification of LLDB global state during expression evaluation with guaranteed cleanup

**Type Safety**: Comprehensive type trait system mapping LLDB basic types to Python semantics

**Error Handling**: Result-like enum patterns for robust FFI error propagation

**Resource Cleanup**: Proper lifecycle management for webviews, sessions, and FFI resources

## Dependencies & Integration

- **LLDB Python API**: Core debugging engine integration
- **ctypes**: Low-level C interface for Rust FFI compatibility
- **VS Code Extension Host**: UI integration via message passing protocol
- **Rust CodeLLDB Adapter**: Primary host process providing DAP implementation

This module enables sophisticated debugging workflows including custom expression evaluation, interactive data visualization, and extensible debugging commands while maintaining seamless integration with both LLDB's native capabilities and VS Code's user interface.