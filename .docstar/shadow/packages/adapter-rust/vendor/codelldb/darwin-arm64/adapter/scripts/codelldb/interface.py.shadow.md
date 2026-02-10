# packages/adapter-rust/vendor/codelldb/darwin-arm64/adapter/scripts/codelldb/interface.py
@source-hash: 1bb5ae0d05d5888c
@generated: 2026-02-09T18:07:12Z

## Primary Purpose
Python-Rust FFI interface layer for CodeLLDB debugger adapter. Provides bidirectional communication between Rust host and Python scripting environment, enabling Python code evaluation within LLDB debugging contexts.

## Key Architecture Components

### Rust-Python Bridge Structures (L27-49)
- `RustSBError` (L27): 8-byte opaque wrapper for LLDB SBError
- `RustSBDebugger` (L32): 16-byte opaque wrapper for LLDB SBDebugger  
- `RustSBExecutionContext` (L37): 16-byte wrapper for LLDB SBExecutionContext
- `RustSBValue` (L42): 16-byte wrapper for LLDB SBValue
- `RustSBModule` (L47): 16-byte wrapper for LLDB SBModule

### Memory Management Functions (L55-70)
- `into_swig_wrapper()` (L55): Converts Rust C-struct to SWIG Python object by moving shared_ptr
- `from_swig_wrapper()` (L64): Reverse conversion, disowns SWIG object to prevent double-free

### FFI Type Generation (L73-104)
- `RustEnum()` (L73): Factory for C-compatible Rust enums with discriminated unions
- `PyResult()` (L98): Generates Result<T, SBError> enum types
- Pre-defined result types: `ValueResult`, `BoolResult`, `PyObjectResult` (L102-104)

## Core Interface Functions

### Initialization (L121-146)
- `initialize()` (L121): One-time setup, registers Python callbacks with Rust host
- Creates callback array with 8 function pointers for Rust to call
- Sets up bidirectional messaging via `fire_event` closure

### Session Management (L151-174)
- `session_init()` (L152): Per-debugger initialization, sets up console redirection
- `session_deinit()` (L167): Cleanup, removes debugger from session tracking
- `session_stdouts` (L148): Maps debugger IDs to console file handles

### Code Evaluation Pipeline (L177-224)
- `compile_code()` (L178): Compiles Python expressions/statements with error handling
- `evaluate_as_sbvalue()` (L197): Executes code in LLDB context, returns SBValue
- `evaluate_as_bool()` (L213): Executes code, returns boolean result
- All return `PyResult` enums for Rust consumption

### Messaging System (L112-236)
- `send_message()` (L112): Sends DAP events to client via '_pythonMessage'
- `handle_message()` (L228): Processes incoming DAP messages, emits to Python handlers
- `on_did_receive_message` (L109): Event dispatcher for message handling

## Value Conversion System (L279-313)

### Python to LLDB Conversion
- `to_sbvalue()` (L279): Converts Python objects to LLDB SBValue representations
- Handles: None→void, bool→eBasicTypeBool, int→eBasicTypeLongLong, float→eBasicTypeDouble, fallback to string
- Creates properly typed SBData with target-specific byte order/addressing

## Execution Context Management (L324-401)

### Context Switching (L327-362)
- `evaluate_in_context()` (L327): Core evaluation dispatcher with 3 context modes:
  - SimpleExpression (2): Minimal globals with `__eval` lambda
  - PythonExpression (1): Full debugger instance globals + `__eval`
  - Statement (0): Full debugger instance globals
- Temporarily redirects stdout to session-specific console
- Sets global LLDB state (`lldb.frame`, `lldb.debugger`, etc.) during evaluation

### Context Accessors (L365-381)
- `current_debugger()` (L365): Returns active debugger from global state or context
- `current_frame()` (L374): Returns active frame from global state or context

### Native Expression Evaluation (L383-400)
- `nat_eval()` (L383): LLDB-native expression evaluation with fallback chain:
  1. Local variables via `FindVariable`
  2. Global/static variables via `FindValue`
  3. Variable paths via `GetValueForVariablePath`
  4. Full expressions via `EvaluateExpression`
- Returns wrapped `Value` objects

## Utility Functions

### String Conversion (L316-321)
- `str_to_bytes()` (L316): UTF-8 encoding with null safety
- `bytes_to_str()` (L320): UTF-8 decoding with null safety

### Configuration Management (L255-276)
- `update_adapter_settings()` (L255): Updates adapter settings from JSON
- `expand_flat_keys()` (L265): Converts dot-notation keys to nested dictionaries

### Memory Management (L239-250)
- `drop_pyobject()` (L240): Decrements Python object reference count
- Direct ctypes bindings to `Py_IncRef`, `Py_DecRef`, `PyErr_SetInterrupt`

## Dependencies
- **lldb**: Core LLDB Python API for debugger interaction
- **ctypes**: Low-level C interop for Rust FFI
- **json**: DAP message serialization
- Local modules: `.value`, `.event`, `.commands`

## Critical Invariants
- SWIG objects must be properly owned/disowned to prevent memory leaks
- Session stdout redirection must be restored in finally blocks
- Global LLDB state must be cleared after evaluation contexts
- Reference counting for Python objects passed to Rust must be managed manually