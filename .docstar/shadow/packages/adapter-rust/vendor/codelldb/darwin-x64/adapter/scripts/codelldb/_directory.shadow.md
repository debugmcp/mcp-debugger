# packages/adapter-rust/vendor/codelldb/darwin-x64/adapter/scripts/codelldb/
@generated: 2026-02-09T18:16:17Z

## Purpose
CodeLLDB Python scripting module that provides a comprehensive Python API layer for the CodeLLDB debugger adapter. This directory implements the Python-side interface that bridges between LLDB's embedded Python interpreter and the Rust-based CodeLLDB extension, enabling advanced debugging scripts and custom UI components in VS Code.

## Key Components & Integration

### Core Architecture
The module follows a layered architecture with clear separation of concerns:

**API Layer (`api.py`, `__init__.py`)**:
- **Public Entry Point**: `__init__.py` serves as the module facade, exposing core functions (`evaluate`, `wrap/unwrap`, `get_config`, `create_webview`, `display_html`, `debugger_message`) and the `Value` class
- **High-level Interface**: `api.py` provides the main scripting API with simplified functions for expression evaluation, configuration access, and UI creation
- **LLDB Integration**: Both files implement the standard `__lldb_init_module` hook for automatic loading into LLDB's Python environment

**FFI Bridge (`interface.py`)**:
- **Python-Rust Communication**: Implements bidirectional FFI using ctypes structures that mirror Rust LLDB object representations
- **Message Passing**: Handles DAP (Debug Adapter Protocol) message routing between Python scripts and the VS Code extension
- **Code Evaluation Engine**: Provides multiple evaluation contexts (SimpleExpression, PythonExpression, Statement) with proper LLDB integration
- **Session Management**: Manages debugger session lifecycle, console redirection, and resource cleanup

**Value System (`value.py`)**:
- **Pythonic LLDB Values**: Wraps LLDB SBValue objects with full Python operator overloading (arithmetic, comparison, indexing, iteration)
- **Type-aware Operations**: Uses comprehensive type traits mapping to handle numeric conversions and string extraction correctly
- **Memory Efficient**: Implements `__slots__` pattern and careful object lifecycle management

**UI Integration (`webview.py`)**:
- **VS Code Integration**: Provides webview panel creation and management for custom debugging UIs
- **Event-driven Messaging**: Implements bidirectional communication between webview content and Python debugging scripts
- **Resource Management**: Handles webview lifecycle with proper cleanup and message routing

**Utility Components**:
- **Event System (`event.py`)**: Simple observer pattern implementation for decoupled component communication
- **Commands Directory**: Additional command extensions (details not provided in summary)

## Public API Surface

### Primary Entry Points
- **Module Initialization**: Automatic loading via `__lldb_init_module` when imported into LLDB
- **Expression Evaluation**: `evaluate(expr, unwrap=False)` for executing code in debug context
- **Value Operations**: `Value` class with full Python operator support for LLDB values
- **Configuration Access**: `get_config(name, default)` for hierarchical settings retrieval
- **UI Creation**: `create_webview()` for HTML-based debugging interfaces
- **Message Communication**: `debugger_message()` for console output

### Advanced Interfaces
- **FFI Functions**: Direct Rust integration through `interface.py` for extension developers
- **Value Wrapping**: `wrap()/unwrap()` utilities for converting between LLDB and Python value representations
- **Session Management**: Session initialization/cleanup hooks for debugger lifecycle events

## Internal Organization & Data Flow

1. **Initialization Flow**: LLDB loads module → `__lldb_init_module` called → interface initialized → session management activated
2. **Evaluation Flow**: User scripts call `evaluate()` → interface routes to appropriate evaluation context → results converted via Value wrappers
3. **UI Flow**: Scripts call `create_webview()` → FFI messages sent to Rust host → VS Code webview created → bidirectional messaging established
4. **Event Flow**: LLDB events → interface handlers → Python event objects → registered callbacks

## Important Patterns & Conventions

- **FFI Safety**: Consistent Result<T, Error> pattern with proper memory management between Python and Rust
- **Context Injection**: Global LLDB context management during code evaluation
- **Event-driven Architecture**: Observer pattern used throughout for loose coupling
- **Resource Management**: Careful cleanup of file handles, webviews, and FFI objects
- **Type Safety**: Comprehensive type mapping between LLDB, Python, and Rust representations

## Critical Dependencies
- **LLDB Python Bindings**: Core debugging functionality
- **VS Code Extension Host**: UI integration and DAP communication
- **Rust CodeLLDB Host**: FFI bridge and session management
- **Python Standard Library**: ctypes, logging, warnings for core functionality