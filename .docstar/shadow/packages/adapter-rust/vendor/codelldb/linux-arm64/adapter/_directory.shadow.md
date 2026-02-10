# packages/adapter-rust/vendor/codelldb/linux-arm64/adapter/
@generated: 2026-02-09T18:16:41Z

## Directory Purpose

The `adapter` directory serves as the core integration layer for CodeLLDB's debugging adapter on Linux ARM64 architecture. It bridges LLDB's native debugging engine with VS Code's Debug Adapter Protocol through a sophisticated Python runtime environment, enabling advanced Rust debugging capabilities with rich UI integration.

## Component Architecture

The directory contains a single `scripts/` subdirectory that provides the complete Python runtime environment with three architectural layers:

**Bootstrap Layer:**
- `debugger.py` - Primary entry point that imports all CodeLLDB functionality into the global namespace, serving as the unified interface

**Extension Layer:**
- `console.py` - LLDB extension module that enhances the debugging console with pip package management and registers custom CodeLLDB commands

**Core Framework:**
- `codelldb/` module - Complete debugging adapter infrastructure including FFI bridges, value conversion systems, webview integration, and session management

## Integration Flow

1. **Environment Bootstrap**: LLDB initializes the Python environment via `debugger.py`, making all CodeLLDB capabilities globally available
2. **Console Enhancement**: `console.py` registers with LLDB through `__lldb_init_module()`, adding pip support and custom debugging commands
3. **Runtime Services**: The `codelldb` module provides the complete debugging infrastructure with Rust-Python FFI communication, value systems, and VS Code integration

## Public API Surface

**Primary Entry Points:**
- `debugger.py` - Main module interface providing unified access to all CodeLLDB functionality
- `console.py` - LLDB command registration and console enhancement via `__lldb_init_module()`

**Key API Functions:**
- `evaluate(expr, unwrap=False)` - Expression evaluation in debugging context
- `get_config(name, default=None)` - VS Code adapter configuration access
- `create_webview()` - Interactive debugging panel creation
- `wrap(obj)` / `unwrap(obj)` - LLDB-Python value conversion utilities
- `console.pip()` - In-debugger package management

## Internal Organization

The adapter follows a layered architecture that seamlessly integrates LLDB's Python scripting capabilities with CodeLLDB's advanced debugging features. The modular design enables platform-specific optimization for Linux ARM64 while maintaining a clean separation between bootstrap functionality, LLDB extensions, and the core debugging framework. This organization facilitates event-driven session management and rich debugging experiences through VS Code webview integration.