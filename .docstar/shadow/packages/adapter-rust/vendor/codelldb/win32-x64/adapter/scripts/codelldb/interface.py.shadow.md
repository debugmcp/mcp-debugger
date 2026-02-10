# packages/adapter-rust/vendor/codelldb/win32-x64/adapter/scripts/codelldb/interface.py
@source-hash: 1bb5ae0d05d5888c
@generated: 2026-02-09T18:10:26Z

## Primary Purpose
Core interface module for CodeLLDB Python-Rust FFI integration, providing bi-directional communication between LLDB Python scripts and Rust debugger adapter implementation via ctypes.

## Key Components

### FFI Type Mappings (L27-49)
- `RustSBError` (L27): 8-byte C structure mapping to `lldb.SBError`
- `RustSBDebugger` (L32): 16-byte structure for `lldb.SBDebugger`
- `RustSBExecutionContext` (L37): Maps to `lldb.SBExecutionContext`
- `RustSBValue` (L42): Maps to `lldb.SBValue`
- `RustSBModule` (L47): Maps to `lldb.SBModule`

### SWIG Wrapper Converters (L55-70)
- `into_swig_wrapper()` (L55): Converts Rust C objects to LLDB SWIG wrappers by memory copying
- `from_swig_wrapper()` (L64): Reverse conversion, disowning SWIG object to prevent double-free

### Rust Enum Generator (L73-99)
- `RustEnum()` (L73): Dynamic factory for C-compatible Rust `#[repr(C, i32)]` enums
- `PyResult()` (L98): Specialized Result<T, Error> type generator
- Pre-defined result types: `ValueResult`, `BoolResult`, `PyObjectResult` (L102-104)

### Core Interface Functions

#### Initialization (L121-145)
- `initialize()` (L121): One-time setup of Rust-Python interface, registers callback pointers
- Creates function pointer array for Rust consumption
- Establishes `fire_event` for DAP communication

#### Session Management (L151-174)
- `session_init()` (L152): Per-debug-session initialization, sets up console output redirection
- `session_deinit()` (L167): Cleanup for debug session termination
- `session_stdouts` (L148): Global dict tracking stdout handles by debugger ID

#### Code Evaluation (L177-224)
- `compile_code()` (L178): Compiles Python expressions/statements with error handling
- `evaluate_as_sbvalue()` (L197): Executes code in LLDB context, returns SBValue
- `evaluate_as_bool()` (L213): Similar to above but returns boolean result

### Message Handling (L227-236)
- `handle_message()` (L228): Processes incoming DAP messages, emits to `on_did_receive_message` event
- `send_message()` (L112): Sends `_pythonMessage` events to DAP client

### Value Conversion (L279-313)
- `to_sbvalue()` (L279): Converts Python values (bool, int, float, str) to LLDB SBValue objects
- Handles type mapping to LLDB basic types with proper byte order/address size

### Execution Context Management (L324-381)
- `evaluate_in_context()` (L327): Main evaluation dispatcher with three contexts:
  - SimpleExpression (eval_context=2): Limited scope with `__eval` lambda
  - PythonExpression (eval_context=1): Full debugger dict access
  - Statement (eval_context=0): Full execution mode
- `current_debugger()` (L365): Context-aware debugger retrieval
- `current_frame()` (L374): Context-aware frame access

### Native Evaluation (L383-400)
- `nat_eval()` (L383): Multi-step variable/expression resolution:
  1. FindVariable() for locals
  2. FindValue() for globals/statics/registers
  3. GetValueForVariablePath() for complex paths
  4. EvaluateExpression() as fallback

## Dependencies
- `lldb`: LLDB Python API
- `ctypes`: C FFI for Rust integration
- Local modules: `.value`, `.event`, `.commands`

## Architectural Patterns
- **FFI Bridge**: Extensive use of ctypes for Rust interop with careful memory management
- **SWIG Integration**: Manual memory management for LLDB object lifecycle
- **Context Switching**: Global state management for execution contexts
- **Event-Driven**: Message passing via Event system for DAP communication

## Critical Invariants
- SWIG objects must be properly owned/disowned to prevent memory leaks
- Execution context globals (`lldb.frame`, etc.) must be cleaned up after evaluation
- Session stdout handles must be managed per debugger instance
- FFI function signatures must match Rust expectations exactly