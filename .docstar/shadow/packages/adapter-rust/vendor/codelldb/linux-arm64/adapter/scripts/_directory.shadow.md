# packages/adapter-rust/vendor/codelldb/linux-arm64/adapter/scripts/
@generated: 2026-02-09T18:16:33Z

## Directory Purpose

This scripts directory provides the Python runtime environment and entry points for CodeLLDB's debugging adapter on Linux ARM64 architecture. It serves as the integration layer that bridges LLDB's native debugging engine with VS Code's Debug Adapter Protocol, enabling sophisticated Rust debugging capabilities through Python extensions.

## Component Architecture

The directory contains three key components that work in concert:

- **`debugger.py`**: Primary entry point that bootstraps the entire debugging environment by importing all CodeLLDB functionality into the global namespace
- **`console.py`**: LLDB extension module that enhances the debugging console with pip package management and registers additional CodeLLDB commands
- **`codelldb/`**: Core module directory containing the complete Python debugging framework with FFI bridges, value systems, webview integration, and session management

## Integration Flow

1. **Initialization**: LLDB loads the Python environment via `debugger.py`, which imports all CodeLLDB capabilities
2. **Console Enhancement**: `console.py` registers itself with LLDB through `__lldb_init_module()`, adding pip support and custom debugging commands
3. **Runtime Environment**: The `codelldb` module provides the complete debugging infrastructure including:
   - Rust-Python FFI communication via `interface.py`
   - Value conversion and expression evaluation
   - VS Code webview integration for rich debugging UI
   - Event-driven session management

## Public API Surface

**Main Entry Points:**
- **`debugger.py`**: Single wildcard import serving as the primary module interface
- **`console.py`**: LLDB command registration through `__lldb_init_module()`
- **pip command**: In-debugger package management via `console.pip()`

**Core Debugging API** (exposed through `debugger.py`):
- `evaluate(expr, unwrap=False)`: Expression evaluation in debugging context
- `get_config(name, default=None)`: Access to VS Code adapter configuration
- `create_webview()`: Interactive debugging panel creation
- `wrap(obj)` / `unwrap(obj)`: LLDB-Python value conversion utilities

## Internal Organization

The directory follows a layered architectural pattern:
- **Bootstrap Layer**: `debugger.py` provides unified namespace access
- **Extension Layer**: `console.py` adds LLDB-specific tooling and commands
- **Core Framework**: `codelldb/` implements the complete debugging adapter infrastructure

This organization enables seamless integration between LLDB's Python scripting capabilities and CodeLLDB's advanced debugging features, while maintaining platform-specific optimization for the Linux ARM64 architecture.