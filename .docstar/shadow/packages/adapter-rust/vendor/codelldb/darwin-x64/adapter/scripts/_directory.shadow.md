# packages/adapter-rust/vendor/codelldb/darwin-x64/adapter/scripts/
@generated: 2026-02-09T18:16:37Z

## Purpose

This scripts directory contains the Python scripting layer for the CodeLLDB debugger adapter, providing a bridge between LLDB's embedded Python interpreter and the Rust-based CodeLLDB extension in VS Code. It enables custom debugging commands, advanced value inspection, and HTML-based debugging UIs within the LLDB debugging environment.

## Key Components & Architecture

### Entry Points & Module Loading
- **debugger.py**: Primary entry point that re-exports all functionality from the `codelldb` package via wildcard import
- **console.py**: LLDB extension module that provides custom debugging commands, including pip package management within the debugger
- **codelldb/**: Core implementation package containing the complete Python API layer

### Component Integration
The directory follows a layered architecture with clear separation:

1. **Bootstrap Layer**: `debugger.py` serves as the main import facade
2. **Command Extension Layer**: `console.py` registers custom LLDB commands and delegates to the core package
3. **API Implementation Layer**: `codelldb/` package provides the complete Python-Rust FFI bridge and debugging utilities

### Data Flow & Initialization
1. LLDB loads the Python scripts during debugger startup
2. `__lldb_init_module` hooks in both `console.py` and the codelldb package initialize custom commands
3. The codelldb package establishes FFI communication with the Rust host process
4. Python debugging scripts can then use the high-level API for evaluation, UI creation, and value inspection

## Public API Surface

### Primary Entry Points
- **Custom Commands**: `pip` command for package management within LLDB sessions
- **Expression Evaluation**: Python code execution in debugging context with LLDB integration
- **Value System**: Pythonic wrapper for LLDB values with full operator overloading
- **Configuration Access**: Hierarchical settings retrieval from VS Code configuration
- **Webview Integration**: HTML-based custom debugging UI creation
- **Message Communication**: Bidirectional messaging between Python scripts and VS Code

### Command Interface
- Commands are registered automatically when modules are loaded into LLDB
- Help text is displayed to users showing available custom functionality
- Standard LLDB command scripting conventions are followed

## Internal Organization

### Module Structure
The scripts are organized as a hybrid system:
- Standalone utility scripts (`console.py`, `debugger.py`) for immediate LLDB integration
- Complete package (`codelldb/`) for comprehensive API functionality
- Clear separation between command registration and implementation

### Communication Patterns
- **FFI Bridge**: Python-Rust communication using ctypes structures
- **Event System**: Observer pattern for decoupled component communication  
- **Session Management**: Proper lifecycle handling with cleanup and resource management
- **Context Injection**: Global LLDB context management during code evaluation

## Important Patterns

- **Standard LLDB Integration**: Uses `__lldb_init_module` hooks for automatic loading
- **Facade Pattern**: `debugger.py` provides single import point for all functionality
- **Command Delegation**: `console.py` registers commands but delegates implementation to core package
- **Resource Safety**: Careful management of sys.argv, file handles, and FFI objects
- **Type Safety**: Comprehensive mapping between LLDB, Python, and Rust type systems

This directory essentially transforms LLDB's Python environment into a rich scripting platform that seamlessly integrates with VS Code's debugging interface while maintaining full access to LLDB's native debugging capabilities.