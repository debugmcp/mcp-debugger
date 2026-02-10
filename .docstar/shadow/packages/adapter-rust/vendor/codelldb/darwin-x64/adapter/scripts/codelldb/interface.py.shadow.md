# packages/adapter-rust/vendor/codelldb/darwin-x64/adapter/scripts/codelldb/interface.py
@source-hash: 1bb5ae0d05d5888c
@generated: 2026-02-09T18:07:39Z

## Primary Purpose
Python-Rust FFI interface for CodeLLDB debugger adapter, providing bidirectional communication between Rust host and Python LLDB scripting environment. Handles message passing, code evaluation, and LLDB object marshalling.

## Key Components

### Core FFI Infrastructure
- **Rust Structure Wrappers (L27-49)**: ctypes.Structure classes mirroring Rust LLDB object representations
  - `RustSBError`, `RustSBDebugger`, `RustSBExecutionContext`, `RustSBValue`, `RustSBModule`
  - Each uses `c_int64` arrays to match Rust memory layout
- **SWIG Conversion Functions (L55-71)**: 
  - `into_swig_wrapper()`: Converts Rust ctypes objects to LLDB SWIG wrappers
  - `from_swig_wrapper()`: Reverse conversion with proper memory management

### Rust-Compatible Type System
- **RustEnum Factory (L73-95)**: Dynamically generates ctypes structures matching Rust `#[repr(C, i32)]` enums
- **PyResult Types (L98-104)**: Result type variants for FFI return values
  - `ValueResult`, `BoolResult`, `PyObjectResult` - handle success/error states

### Message Passing & Events
- **Event System (L109-118)**: 
  - `on_did_receive_message`: Event for incoming DAP messages
  - `send_message()`: Sends `_pythonMessage` events to DAP client
  - `fire_event()`: Generic event dispatcher (initialized in `initialize()`)

### Session Management
- **Initialization (L121-146)**: `initialize()` sets up Rust callbacks and function pointers
- **Session Lifecycle (L151-175)**:
  - `session_init()`: Creates per-debugger console file descriptors and command registration
  - `session_deinit()`: Cleanup session resources
- **Session Storage (L148)**: `session_stdouts` dict maps debugger IDs to console file objects

### Code Evaluation Engine
- **Compilation (L177-194)**: `compile_code()` compiles Python expressions/statements with fallback logic
- **Evaluation Functions (L196-225)**:
  - `evaluate_as_sbvalue()`: Evaluates code and converts result to LLDB SBValue
  - `evaluate_as_bool()`: Evaluates code as boolean
- **Context Management (L327-363)**: `evaluate_in_context()` handles three evaluation modes:
  - SimpleExpression (eval_context=2): Limited scope with `__eval` helper
  - PythonExpression (eval_context=1): Full debugger globals access
  - Statement (eval_context=0): Full statement execution

### LLDB Integration
- **Value Conversion (L279-314)**: `to_sbvalue()` converts Python objects to LLDB SBValue with type mapping:
  - bool → eBasicTypeBool, int → eBasicTypeLongLong, float → eBasicTypeDouble, fallback → string array
- **Native Evaluation (L383-401)**: `nat_eval()` performs LLDB-native expression evaluation with variable lookup hierarchy
- **Context Accessors (L365-381)**: `current_debugger()`, `current_frame()` provide access to active debugging context

### Utility Functions
- **Settings Management (L255-277)**: `update_adapter_settings()` and `expand_flat_keys()` handle nested configuration
- **String Conversion (L316-322)**: UTF-8 encoding/decoding helpers
- **Reference Counting (L244-251)**: Direct Python C-API reference management for FFI objects

## Architecture Patterns
- **FFI Boundary**: Clean separation between Rust and Python with explicit type conversions
- **Error Propagation**: Consistent Result<T, SBError> pattern throughout FFI functions
- **Context Injection**: Global state management for LLDB objects during evaluation
- **Memory Safety**: Careful ownership transfer between SWIG objects and ctypes structures

## Critical Dependencies
- `lldb`: Core LLDB Python bindings
- `ctypes`: FFI type system and memory management  
- `value.Value`, `event.Event`, `commands`: Internal codelldb modules
- Platform-specific console handling (msvcrt on Windows)

## Key Invariants
- All FFI functions return c_bool success indicators
- SWIG object ownership must be properly managed during conversions
- Session stdout redirection requires cleanup in deinit
- Evaluation contexts must restore global lldb module state