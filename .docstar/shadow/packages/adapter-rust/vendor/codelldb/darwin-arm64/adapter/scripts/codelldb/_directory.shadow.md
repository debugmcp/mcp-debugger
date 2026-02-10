# packages/adapter-rust/vendor/codelldb/darwin-arm64/adapter/scripts/codelldb/
@generated: 2026-02-09T18:16:15Z

## Purpose
This directory contains the Python scripting runtime for CodeLLDB debugger adapter, providing a comprehensive bridge between LLDB's Python API and VSCode's debugging interface. It enables rich Python-based debugging experiences with custom visualizations, expression evaluation, and interactive debugging capabilities.

## Key Components & Architecture

### Core Entry Points
- **`__init__.py`**: Main package entry point exposing public API (`evaluate`, `wrap`, `unwrap`, `get_config`, `create_webview`, `display_html`, `debugger_message`) and `Value` class
- **`api.py`**: High-level public API functions for configuration, evaluation, webview management, and debugging utilities
- **LLDB Integration**: Standard `__lldb_init_module()` callback for seamless LLDB Python module loading

### Rust-Python FFI Layer
- **`interface.py`**: Critical bidirectional communication bridge between Rust host and Python environment
  - Manages Rust-Python object conversion with memory-safe SWIG wrappers
  - Handles code evaluation pipeline with multiple execution contexts
  - Provides DAP message routing and session management
  - Implements LLDB native expression evaluation with comprehensive fallback chains

### Value System
- **`value.py`**: Pythonic wrapper for LLDB's SBValue with complete operator overloading
  - Enables natural Python syntax for debugging expressions (`obj[0]`, `obj.field`, arithmetic operations)
  - Provides type-aware conversion between LLDB values and Python primitives
  - Supports container operations (indexing, iteration, length) for complex data structures

### UI & Visualization
- **`webview.py`**: VSCode webview panel management for rich HTML-based debugging visualizations
  - Creates and manages webview instances with unique IDs
  - Handles bidirectional message passing between Python and webview content
  - Provides event-driven lifecycle management (creation, disposal, message handling)

### Infrastructure
- **`event.py`**: Lightweight observer pattern implementation for pub/sub messaging throughout the system
- **`commands/`**: Extensible command system for LLDB integration

## Data Flow & Integration

1. **Initialization**: LLDB loads module via `__lldb_init_module()`, establishing Python runtime
2. **Session Management**: `interface.py` manages per-debugger sessions with console redirection
3. **Expression Evaluation**: Multi-context pipeline supports simple expressions, Python expressions, and full statements
4. **Value Handling**: Seamless conversion between LLDB SBValues and Python-friendly Value wrappers
5. **UI Communication**: DAP messages flow through interface layer to VSCode, enabling webview interactions
6. **Configuration**: Dot-notation settings from VSCode (`lldb.script.*`) accessible via `get_config()`

## Public API Surface

### Core Functions
- `evaluate(expr, unwrap=False)`: Execute expressions in LLDB context
- `wrap(obj)` / `unwrap(obj)`: Convert between SBValue and Value wrapper
- `get_config(name, default)`: Access VSCode debugger configuration
- `debugger_message(output, category)`: Send debug output to VSCode

### Rich UI
- `create_webview()`: Create VSCode webview panels with full configuration
- `display_html()`: Legacy HTML display (deprecated, uses webview internally)

### Value Manipulation
- `Value` class: Pythonic interface to LLDB values with operator overloading
- Native LLDB expression evaluation with intelligent fallback strategies

## Critical Architecture Patterns

- **Memory Management**: Careful SWIG object ownership to prevent leaks
- **Context Isolation**: Temporary global state during evaluation with guaranteed cleanup  
- **Type Safety**: Comprehensive type mapping between LLDB and Python type systems
- **Event-Driven**: Observer pattern enables loose coupling between components
- **Message-Based**: DAP protocol compliance for VSCode integration
- **Extensible**: Command system allows custom LLDB command registration

This module serves as the complete Python scripting foundation for CodeLLDB, enabling sophisticated debugging experiences that go far beyond basic LLDB functionality.