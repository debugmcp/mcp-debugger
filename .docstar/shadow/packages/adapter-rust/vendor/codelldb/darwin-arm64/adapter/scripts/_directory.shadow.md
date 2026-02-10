# packages/adapter-rust/vendor/codelldb/darwin-arm64/adapter/scripts/
@generated: 2026-02-09T18:16:35Z

## Primary Purpose
This directory contains the Python scripting runtime and entry point modules for the CodeLLDB debugger adapter on Darwin ARM64. It serves as the primary interface layer between LLDB's Python scripting environment and the CodeLLDB debugging ecosystem, providing enhanced debugging capabilities through custom commands, package management, and comprehensive Python API access.

## Key Components & Integration

### Entry Points & Module Loading
- **`debugger.py`**: Main entry point that exposes the entire CodeLLDB API surface through wildcard import (`from codelldb import *`)
- **`console.py`**: LLDB extension module that registers custom Python commands and package management capabilities
  - Provides `pip` command for package installation within LLDB sessions
  - Implements standard LLDB initialization hook (`__lldb_init_module`) for automatic command registration
  - Integrates with CodeLLDB command system through `codelldb.commands` module

### Underlying Runtime (`codelldb/` subdirectory)
The scripts directory acts as a gateway to a comprehensive Python debugging runtime that includes:
- **Rust-Python FFI Bridge**: Bidirectional communication between Rust host and Python environment
- **Value System**: Pythonic wrappers for LLDB values with operator overloading
- **UI Integration**: VSCode webview management for rich debugging visualizations
- **Expression Evaluation**: Multi-context evaluation pipeline with intelligent fallbacks

## Architecture Flow

1. **Module Loading**: LLDB automatically loads `console.py` which initializes the CodeLLDB command environment
2. **API Access**: Clients import `debugger.py` to access the full CodeLLDB API surface
3. **Runtime Integration**: Both entry points connect to the comprehensive `codelldb` Python package providing:
   - LLDB session management and DAP protocol compliance
   - Enhanced value inspection with Python-friendly interfaces  
   - Rich UI capabilities through VSCode webview integration
   - Custom command registration and package management

## Public API Surface

### Command Interface (via console.py)
- `pip`: Package management within LLDB debugging sessions
- Registration of CodeLLDB-specific debugging commands
- Interactive Python environment with enhanced capabilities

### Programming Interface (via debugger.py) 
- Complete CodeLLDB API including expression evaluation, value manipulation, configuration access
- Webview creation and HTML display capabilities
- Debugging utilities and message passing to VSCode
- Python-friendly wrappers for LLDB's native functionality

## Platform Context
Located under `darwin-arm64/adapter/scripts`, this directory provides the Darwin ARM64-specific Python runtime for CodeLLDB. It enables sophisticated Rust debugging experiences in VSCode through enhanced LLDB Python scripting capabilities, with seamless integration between native debugging and rich Python-based tooling.