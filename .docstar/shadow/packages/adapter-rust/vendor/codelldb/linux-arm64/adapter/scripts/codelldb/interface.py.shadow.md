# packages/adapter-rust/vendor/codelldb/linux-arm64/adapter/scripts/codelldb/interface.py
@source-hash: 1bb5ae0d05d5888c
@generated: 2026-02-09T18:10:35Z

## Primary Purpose
This module provides the FFI (Foreign Function Interface) bridge between Rust and Python for the CodeLLDB debug adapter. It enables bi-directional communication, allowing Rust to call Python evaluation functions and Python to send messages back to the debug adapter protocol (DAP) client.

## Key Classes & Structures

### Rust FFI Types (L27-49)
- `RustSBError` (L27-29): 8-byte structure wrapping LLDB SBError
- `RustSBDebugger` (L32-34): 16-byte structure wrapping LLDB SBDebugger  
- `RustSBExecutionContext` (L37-39): 16-byte structure wrapping LLDB SBExecutionContext
- `RustSBValue` (L42-44): 16-byte structure wrapping LLDB SBValue
- `RustSBModule` (L47-49): 16-byte structure wrapping LLDB SBModule

All structures use opaque `c_int64` arrays to match Rust's memory layout and include `swig_type` attributes for SWIG wrapper conversion.

### Dynamic Enum Generator (L73-95)
- `RustEnum()` (L73-95): Factory function creating ctypes enums compatible with Rust `#[repr(C, i32)]` enums
- `PyResult()` (L98-99): Specialized enum generator for Rust Result<T, E> types

### Result Types (L102-104)
- `ValueResult`: Result type for SBValue operations
- `BoolResult`: Result type for boolean operations  
- `PyObjectResult`: Result type for Python object operations

## Core Interface Functions

### Initialization (L121-145)
- `initialize()` (L121-145): One-time setup of Rust-Python interface, registers callback pointers and establishes message passing

### Session Management
- `session_init()` (L152-163): Per-debug-session initialization, sets up console output redirection
- `session_deinit()` (L166-174): Per-debug-session cleanup

### Code Evaluation Bridge
- `compile_code()` (L177-193): Compiles Python expressions/statements for later execution
- `evaluate_as_sbvalue()` (L196-209): Executes Python code and returns LLDB SBValue
- `evaluate_as_bool()` (L212-224): Executes Python code and returns boolean result
- `evaluate_in_context()` (L327-362): Core evaluation engine with context switching

### Message Handling (L227-236)
- `handle_message()`: Processes JSON messages from DAP client
- `send_message()` (L112-114): Sends `_pythonMessage` events to DAP client

## Key Utility Functions

### SWIG Interop (L55-70)
- `into_swig_wrapper()` (L55-61): Converts ctypes structures to SWIG wrappers by memory manipulation
- `from_swig_wrapper()` (L64-70): Reverse conversion with ownership transfer

### Value Conversion (L279-313)
- `to_sbvalue()` (L279-313): Converts Python values (bool, int, float, str) to LLDB SBValue objects

### Context Management (L365-401)
- `current_debugger()` (L365-371): Returns active debugger instance
- `current_frame()` (L374-380): Returns active frame context
- `nat_eval()` (L383-400): Native LLDB expression evaluation with fallback strategies

## Important Dependencies
- **lldb**: Core LLDB Python bindings for debugger functionality
- **ctypes**: Low-level C interface for Rust FFI
- **json**: Message serialization between components
- **logging**: Debug logging infrastructure
- **.value**: Custom Value wrapper class
- **.event**: Event system for message passing
- **.commands**: Debug command registration

## Architectural Patterns
- **FFI Bridge**: Uses ctypes to create C-compatible structures matching Rust layout
- **Memory Management**: Careful ownership tracking with `incref`/`decref` for Python objects
- **Context Switching**: Temporarily modifies global lldb module attributes during evaluation
- **Error Handling**: Comprehensive exception wrapping in Result-like enums
- **Session Isolation**: Maintains per-debugger state via session dictionaries

## Critical Invariants
- All Rust structures must maintain exact memory layout compatibility
- Python object reference counting must be manually managed for FFI transfers  
- LLDB context variables are thread-local and must be cleaned up after evaluation
- Message passing uses JSON serialization with UTF-8 encoding
- Console output is redirected per debug session to maintain isolation