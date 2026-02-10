# packages/adapter-rust/vendor/codelldb/linux-x64/adapter/scripts/codelldb/interface.py
@source-hash: 1bb5ae0d05d5888c
@generated: 2026-02-09T18:11:32Z

**Primary Purpose**: Python-Rust FFI interface for the CodeLLDB debugger adapter, providing bidirectional communication between Python scripts and Rust LLDB backend.

## Core Architecture

**FFI Type System (L27-105)**:
- `RustSBError` (L27-29): 8-byte ctypes wrapper for LLDB SBError
- `RustSBDebugger` (L32-34): 16-byte ctypes wrapper for LLDB SBDebugger  
- `RustSBExecutionContext` (L37-39): Execution context wrapper
- `RustSBValue` (L42-44): Value wrapper for LLDB variables
- `RustSBModule` (L47-49): Module wrapper

**SWIG Integration (L55-70)**:
- `into_swig_wrapper()` (L55-61): Converts Rust ctypes structs to SWIG-wrapped LLDB objects by memory manipulation
- `from_swig_wrapper()` (L64-70): Reverse conversion, disowns SWIG object to prevent double-free

**Rust Enum FFI (L73-105)**:
- `RustEnum()` (L73-95): Generates ctypes compatible with Rust `#[repr(C, i32)]` enums
- `PyResult()` (L98-99): Creates Result-type enums for error handling
- Pre-defined result types: `ValueResult`, `BoolResult`, `PyObjectResult` (L102-104)

## Session Management

**Initialization (L121-146)**:
- `initialize()` (L121-146): One-time setup registering Python function pointers with Rust
- Creates function pointer array for: session init/deinit, interrupt, object cleanup, message handling, code compilation/evaluation
- Establishes `fire_event` callback for DAP communication

**Session Lifecycle**:
- `session_init()` (L151-163): Per-session setup, handles console FD redirection, registers LLDB commands
- `session_deinit()` (L166-174): Cleanup session stdout handles
- `session_stdouts` (L148): Maps debugger IDs to file descriptors for output redirection

## Code Evaluation Engine

**Compilation (L177-193)**:
- `compile_code()` (L178-193): Compiles Python expressions/statements, tries 'eval' mode first, falls back to 'exec'

**Evaluation Contexts**:
- `evaluate_as_sbvalue()` (L196-209): Evaluates code returning LLDB SBValue
- `evaluate_as_bool()` (L212-224): Evaluates code returning boolean
- `evaluate_in_context()` (L327-362): Core evaluation with 3 context modes:
  - SimpleExpression (2): Limited scope with `__eval` helper
  - PythonExpression (1): Full Python with debugger instance dict
  - Statement (0): Full statement execution

**Native Variable Access**:
- `nat_eval()` (L383-400): LLDB native expression evaluation with fallback chain
- Tries: local variables → global/static → registers → variable paths → full expression evaluation

## Value Conversion

**Python to LLDB (L279-313)**:
- `to_sbvalue()` (L279-313): Converts Python objects to LLDB SBValue
- Handles: SBValue passthrough, None→void, bool→int, int→int64, float→double, fallback to string
- Uses target byte order and address size for proper serialization

**Context Management**:
- `current_exec_context` (L324): Global tracking of active execution context
- `current_debugger()`/`current_frame()` (L365-380): Context accessors with fallbacks

## Messaging & Events

**DAP Communication**:
- `on_did_receive_message` (L109): Event for incoming DAP messages
- `send_message()` (L112-114): Sends `_pythonMessage` events to DAP client
- `fire_event()` (L117-118): Global event dispatcher (replaced during initialization)
- `handle_message()` (L227-236): Processes incoming JSON messages

## Configuration

**Settings Management (L255-276)**:
- `update_adapter_settings()` (L255-262): Updates adapter configuration from JSON
- `expand_flat_keys()` (L265-276): Expands dot-notation keys into nested dictionaries

## Dependencies
- **LLDB Python API**: Core debugging functionality
- **ctypes**: FFI with Rust backend
- **Value/Event modules**: Local abstractions (L12-14)
- **commands module**: LLDB command registration (L14)

## Critical Invariants
- SWIG objects must be properly owned/disowned to prevent memory leaks
- Session stdout mapping must be maintained for proper output redirection  
- Global execution context must be properly cleaned up after evaluation
- FFI function signatures must exactly match Rust expectations