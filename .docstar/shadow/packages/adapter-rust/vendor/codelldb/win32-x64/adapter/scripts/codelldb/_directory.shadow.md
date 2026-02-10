# packages/adapter-rust/vendor/codelldb/win32-x64/adapter/scripts/codelldb/
@generated: 2026-02-09T18:16:31Z

## Primary Purpose and Responsibility

The `codelldb` directory implements the Python scripting layer for the CodeLLDB debugger adapter, providing a comprehensive bridge between LLDB's native debugging capabilities and VS Code's debugging interface. This module serves as the core Python runtime environment that enables advanced debugging features, expression evaluation, UI integration, and extensible command functionality within the CodeLLDB adapter.

## Key Components and Architecture

### Core Integration Layer (`__init__.py`, `api.py`, `interface.py`)
- **`__init__.py`**: Central module entry point that exposes the complete public API and configures LLDB Python module initialization with structured logging
- **`api.py`**: High-level API facade providing VS Code integration functions for configuration access, expression evaluation, and webview management
- **`interface.py`**: Low-level FFI bridge implementing Python-Rust communication via ctypes, handling session management, code evaluation contexts, and DAP message routing

### Value System (`value.py`)
- **`Value`**: Pythonic wrapper around LLDB's SBValue with complete operator overloading, making debugger values behave like native Python objects
- **Type conversion utilities**: Comprehensive mapping between LLDB types and Python primitives with proper handling of numeric characteristics

### UI and Communication (`webview.py`, `event.py`)
- **`Webview`**: VS Code webview panel management with bidirectional messaging for custom debugging UI
- **`Event`**: Observer pattern implementation for synchronous message broadcasting throughout the system

### Extensible Command System (`commands/`)
- Custom LLDB command registration and execution framework
- Debug information inspection commands (`debug_info`)
- Failure-resistant command wrapper infrastructure

## Public API Surface

### Expression Evaluation and Values
- `evaluate(expr, unwrap=False)`: Execute LLDB expressions in current debugging context
- `wrap(obj)` / `unwrap(obj)`: Convert between SBValue and Value wrapper objects
- `Value` class: Full Pythonic interface to LLDB values with operator overloading

### Configuration and UI
- `get_config(name, default=None)`: Access hierarchical adapter configuration settings
- `create_webview(...)`: Create VS Code webview panels with extensive customization
- `display_html(...)`: Simplified HTML display in debugger interface
- `debugger_message(output, category)`: Send messages to debugger console

### Module Initialization
- `__lldb_init_module(debugger, internal_dict)`: Standard LLDB Python module entry point

## Internal Organization and Data Flow

### Initialization Flow
1. LLDB loads Python module via `__lldb_init_module`
2. Logging configuration established for debugging
3. FFI interface initialized with Rust adapter via `interface.initialize()`
4. Custom commands registered through command system
5. Session-specific setup via `interface.session_init()`

### Runtime Architecture
- **Context Management**: Execution contexts switch between SimpleExpression, PythonExpression, and Statement modes
- **Memory Safety**: Careful SWIG object lifecycle management prevents double-free issues
- **Event-Driven Communication**: DAP messages flow through event system to registered handlers
- **Type Conversion Pipeline**: Python values ↔ LLDB SBValue ↔ Rust FFI types

### Critical Data Paths
1. **Expression Evaluation**: `api.evaluate()` → `interface.evaluate_in_context()` → LLDB execution → `Value` wrapper
2. **Configuration Access**: `api.get_config()` → FFI call to Rust → hierarchical setting resolution
3. **UI Integration**: `create_webview()` → `Webview` instance → message exchange via `interface`
4. **Command Execution**: LLDB dispatch → command classes → result output with proper flushing

## Integration Patterns and Conventions

### FFI Safety Patterns
- Extensive use of ctypes with careful memory management for Rust interoperability
- SWIG wrapper conversion utilities to prevent memory leaks
- Structured error handling with Rust-compatible Result types

### LLDB Integration Standards
- Follows LLDB Python module conventions with proper initialization hooks
- Commands implement standard LLDB custom command interface
- Respects LLDB execution context and frame management protocols

### VS Code Adapter Integration
- DAP message handling through structured event system
- Webview lifecycle management aligned with debugging session scope
- Configuration system maps to VS Code settings hierarchy

## Dependencies and External Integration

- **LLDB Python API**: Core debugging functionality and SBValue manipulation
- **VS Code DAP**: Debug Adapter Protocol message exchange
- **Rust FFI**: Low-level adapter communication via ctypes
- **Standard Library**: logging, ctypes, operator, typing for infrastructure

This module represents the complete Python runtime environment for CodeLLDB, enabling sophisticated debugging experiences through seamless integration between LLDB's powerful debugging engine and VS Code's modern development interface.